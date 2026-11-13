import crypto from "node:crypto";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  LEDGER_ACCOUNTS,
  FinancialLedgerEntry,
  HostPayableRecord,
  HostFinanceSummaryResponse,
  AdminLedgerQuery,
  AdminLedgerResponse
} from "@luggage-storage/contracts";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AppError } from "../../common/errors/app-error.js";

const PG_INT_MAX = 2_147_483_647;

export interface JournalPostingLine {
  entryType: "DEBIT" | "CREDIT";
  accountCode: string;
  accountName: string;
  amountMinor: number;
  currency: string;
  referenceType: "BOOKING" | "PAYMENT" | "REFUND" | "HOST_PAYABLE";
  referenceId: string;
  bookingId: string;
  businessId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}

export class LedgerService {
  /**
   * Posts an atomic, balanced double-entry journal group inside an active transaction.
   * Strictly enforces integer minor units and SUM(DEBIT) === SUM(CREDIT) > 0.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async postJournalGroup(tx: any, lines: JournalPostingLine[]): Promise<string> {
    if (lines.length < 2) {
      throw AppError.internal("Double-entry journal group requires at least two posting lines");
    }

    let totalDebits = 0;
    let totalCredits = 0;
    const currency = lines[0].currency;

    for (const line of lines) {
      if (
        !Number.isSafeInteger(line.amountMinor) ||
        line.amountMinor <= 0 ||
        line.amountMinor > PG_INT_MAX
      ) {
        throw AppError.internal(
          `Invalid ledger posting amount (${line.amountMinor}): must be a positive 32-bit integer in minor units`
        );
      }
      if (line.currency !== currency) {
        throw AppError.internal("Mixed currencies within a single ledger journal group are prohibited");
      }
      if (line.entryType === "DEBIT") {
        totalDebits += line.amountMinor;
      } else {
        totalCredits += line.amountMinor;
      }
    }

    if (
      !Number.isSafeInteger(totalDebits) ||
      !Number.isSafeInteger(totalCredits) ||
      totalDebits !== totalCredits ||
      totalDebits <= 0
    ) {
      throw AppError.internal(
        `Unbalanced double-entry journal group rejected: debits=${totalDebits}, credits=${totalCredits}`
      );
    }

    const transactionGroupId = crypto.randomUUID();

    await tx.insert(schema.financialLedgerEntries).values(
      lines.map((line) => ({
        transactionGroupId,
        entryType: line.entryType,
        accountCode: line.accountCode,
        accountName: line.accountName,
        amountMinor: line.amountMinor,
        currency: line.currency,
        referenceType: line.referenceType,
        referenceId: line.referenceId,
        bookingId: line.bookingId,
        businessId: line.businessId ?? null,
        description: line.description,
        metadata: line.metadata ?? {}
      }))
    );

    return transactionGroupId;
  }

  /**
   * Records gateway payment collection into unearned booking liability (non-escrow clearing).
   */
  async recordPaymentCaptured(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    params: {
      bookingId: string;
      businessId: string;
      paymentIntentId: string;
      amountMinor: number;
      currency: string;
      referenceCode: string;
    }
  ): Promise<string> {
    return this.postJournalGroup(tx, [
      {
        entryType: "DEBIT",
        accountCode: LEDGER_ACCOUNTS.GATEWAY_CLEARING_RECEIVABLE.code,
        accountName: LEDGER_ACCOUNTS.GATEWAY_CLEARING_RECEIVABLE.name,
        amountMinor: params.amountMinor,
        currency: params.currency,
        referenceType: "PAYMENT",
        referenceId: params.paymentIntentId,
        bookingId: params.bookingId,
        businessId: params.businessId,
        description: `Payment captured via gateway for booking ${params.referenceCode}`
      },
      {
        entryType: "CREDIT",
        accountCode: LEDGER_ACCOUNTS.TRAVELLER_BOOKING_LIABILITY.code,
        accountName: LEDGER_ACCOUNTS.TRAVELLER_BOOKING_LIABILITY.name,
        amountMinor: params.amountMinor,
        currency: params.currency,
        referenceType: "PAYMENT",
        referenceId: params.paymentIntentId,
        bookingId: params.bookingId,
        businessId: params.businessId,
        description: `Unearned booking liability recorded for ${params.referenceCode}`
      }
    ]);
  }

  /**
   * Settles unearned booking liability into Platform Commission Revenue (4010)
   * and Host Settlement Payable Liability (2020) upon luggage return completion.
   */
  async recordBookingCompletedSettlement(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    params: {
      bookingId: string;
      businessId: string;
      storageSubtotalMinor: number;
      commissionMinor: number;
      hostPayableMinor: number;
      currency: string;
      referenceCode: string;
      holdPayable?: boolean;
    }
  ): Promise<{ transactionGroupId: string; payableId: string }> {
    const now = new Date();
    const payableStatus = params.holdPayable ? "ON_HOLD" : "ELIGIBLE";

    const [payable] = await tx
      .insert(schema.hostPayables)
      .values({
        businessId: params.businessId,
        bookingId: params.bookingId,
        grossSubtotalMinor: params.storageSubtotalMinor,
        commissionMinor: params.commissionMinor,
        netPayableMinor: params.hostPayableMinor,
        currency: params.currency,
        status: payableStatus,
        accruedAt: now,
        eligibleAt: params.holdPayable ? null : now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: schema.hostPayables.bookingId,
        set: {
          status: payableStatus,
          eligibleAt: params.holdPayable ? null : now,
          updatedAt: now
        }
      })
      .returning();

    const lines: JournalPostingLine[] = [
      {
        entryType: "DEBIT",
        accountCode: LEDGER_ACCOUNTS.TRAVELLER_BOOKING_LIABILITY.code,
        accountName: LEDGER_ACCOUNTS.TRAVELLER_BOOKING_LIABILITY.name,
        amountMinor: params.storageSubtotalMinor,
        currency: params.currency,
        referenceType: "HOST_PAYABLE",
        referenceId: payable.id,
        bookingId: params.bookingId,
        businessId: params.businessId,
        description: `Settlement of completed booking ${params.referenceCode}`
      }
    ];

    if (params.commissionMinor > 0) {
      lines.push({
        entryType: "CREDIT",
        accountCode: LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE.code,
        accountName: LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE.name,
        amountMinor: params.commissionMinor,
        currency: params.currency,
        referenceType: "HOST_PAYABLE",
        referenceId: payable.id,
        bookingId: params.bookingId,
        businessId: params.businessId,
        description: `Platform commission recognized for ${params.referenceCode}`
      });
    }

    if (params.hostPayableMinor > 0) {
      lines.push({
        entryType: "CREDIT",
        accountCode: LEDGER_ACCOUNTS.HOST_PAYABLE_LIABILITY.code,
        accountName: LEDGER_ACCOUNTS.HOST_PAYABLE_LIABILITY.name,
        amountMinor: params.hostPayableMinor,
        currency: params.currency,
        referenceType: "HOST_PAYABLE",
        referenceId: payable.id,
        bookingId: params.bookingId,
        businessId: params.businessId,
        description: `Host settlement payable accrued for ${params.referenceCode}`
      });
    }

    const transactionGroupId = await this.postJournalGroup(tx, lines);
    return { transactionGroupId, payableId: payable.id };
  }

  /**
   * Reclassifies unearned booking liability into refund liability (and settles any retained
   * non-refundable cancellation portion per OQ-009).
   */
  async recordCancellationSettlement(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    params: {
      bookingId: string;
      businessId: string;
      refundId: string | null;
      paidAmountMinor: number;
      refundAmountMinor: number;
      commissionRateBps: number;
      currency: string;
      referenceCode: string;
    }
  ): Promise<void> {
    if (
      !Number.isSafeInteger(params.paidAmountMinor) ||
      !Number.isSafeInteger(params.refundAmountMinor) ||
      params.paidAmountMinor < 0 ||
      params.paidAmountMinor > PG_INT_MAX ||
      params.refundAmountMinor < 0 ||
      params.refundAmountMinor > params.paidAmountMinor
    ) {
      throw AppError.internal(
        `Invalid cancellation settlement amounts: paid=${params.paidAmountMinor}, refund=${params.refundAmountMinor}`
      );
    }
    if (params.paidAmountMinor === 0) {
      return;
    }

    const retainedMinor = params.paidAmountMinor - params.refundAmountMinor;
    const lines: JournalPostingLine[] = [
      {
        entryType: "DEBIT",
        accountCode: LEDGER_ACCOUNTS.TRAVELLER_BOOKING_LIABILITY.code,
        accountName: LEDGER_ACCOUNTS.TRAVELLER_BOOKING_LIABILITY.name,
        amountMinor: params.paidAmountMinor,
        currency: params.currency,
        referenceType: params.refundId ? "REFUND" : "BOOKING",
        referenceId: params.refundId ?? params.bookingId,
        bookingId: params.bookingId,
        businessId: params.businessId,
        description: `Cancellation liability reclassification for ${params.referenceCode}`
      }
    ];

    if (params.refundAmountMinor > 0 && params.refundId) {
      lines.push({
        entryType: "CREDIT",
        accountCode: LEDGER_ACCOUNTS.TRAVELLER_REFUND_LIABILITY.code,
        accountName: LEDGER_ACCOUNTS.TRAVELLER_REFUND_LIABILITY.name,
        amountMinor: params.refundAmountMinor,
        currency: params.currency,
        referenceType: "REFUND",
        referenceId: params.refundId,
        bookingId: params.bookingId,
        businessId: params.businessId,
        description: `Authorized customer refund liability for ${params.referenceCode}`
      });
    }

    if (retainedMinor > 0) {
      const retainedCommission = Math.floor((retainedMinor * params.commissionRateBps) / 10000);
      const retainedHostNet = retainedMinor - retainedCommission;
      const now = new Date();

      const [payable] = await tx
        .insert(schema.hostPayables)
        .values({
          businessId: params.businessId,
          bookingId: params.bookingId,
          grossSubtotalMinor: retainedMinor,
          commissionMinor: retainedCommission,
          netPayableMinor: retainedHostNet,
          currency: params.currency,
          status: "ELIGIBLE",
          accruedAt: now,
          eligibleAt: now,
          updatedAt: now
        })
        .onConflictDoNothing()
        .returning();

      if (retainedCommission > 0) {
        lines.push({
          entryType: "CREDIT",
          accountCode: LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE.code,
          accountName: LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE.name,
          amountMinor: retainedCommission,
          currency: params.currency,
          referenceType: "BOOKING",
          referenceId: payable?.id ?? params.bookingId,
          bookingId: params.bookingId,
          businessId: params.businessId,
          description: `Commission on retained cancellation fee for ${params.referenceCode}`
        });
      }

      if (retainedHostNet > 0) {
        lines.push({
          entryType: "CREDIT",
          accountCode: LEDGER_ACCOUNTS.HOST_PAYABLE_LIABILITY.code,
          accountName: LEDGER_ACCOUNTS.HOST_PAYABLE_LIABILITY.name,
          amountMinor: retainedHostNet,
          currency: params.currency,
          referenceType: "BOOKING",
          referenceId: payable?.id ?? params.bookingId,
          bookingId: params.bookingId,
          businessId: params.businessId,
          description: `Host share on retained cancellation fee for ${params.referenceCode}`
        });
      }
    }

    await this.postJournalGroup(tx, lines);
  }

  /**
   * Clears Traveller Refund Payable Liability (2030) against Gateway Clearing (1010)
   * when refund execution succeeds.
   */
  async recordRefundDisbursed(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    params: {
      bookingId: string;
      businessId: string;
      refundId: string;
      amountMinor: number;
      currency: string;
      referenceCode: string;
    }
  ): Promise<void> {
    if (params.amountMinor <= 0) {
      return;
    }

    await this.postJournalGroup(tx, [
      {
        entryType: "DEBIT",
        accountCode: LEDGER_ACCOUNTS.TRAVELLER_REFUND_LIABILITY.code,
        accountName: LEDGER_ACCOUNTS.TRAVELLER_REFUND_LIABILITY.name,
        amountMinor: params.amountMinor,
        currency: params.currency,
        referenceType: "REFUND",
        referenceId: params.refundId,
        bookingId: params.bookingId,
        businessId: params.businessId,
        description: `Refund disbursed to traveller for ${params.referenceCode}`
      },
      {
        entryType: "CREDIT",
        accountCode: LEDGER_ACCOUNTS.GATEWAY_CLEARING_RECEIVABLE.code,
        accountName: LEDGER_ACCOUNTS.GATEWAY_CLEARING_RECEIVABLE.name,
        amountMinor: params.amountMinor,
        currency: params.currency,
        referenceType: "REFUND",
        referenceId: params.refundId,
        bookingId: params.bookingId,
        businessId: params.businessId,
        description: `Gateway refund settlement for ${params.referenceCode}`
      }
    ]);
  }

  /**
   * Host settlement payable summary (OQ-017: strictly restricted to HOST_OWNER and SUPERADMIN).
   */
  async getHostFinanceSummary(
    userId: string,
    userRoles: string[],
    businessIdFilter?: string
  ): Promise<HostFinanceSummaryResponse> {
    const isSuperadmin = userRoles.includes("SUPERADMIN");
    if (!isSuperadmin && !userRoles.includes("HOST_OWNER")) {
      throw AppError.forbidden("Host financial settlement records are restricted to business owners");
    }

    const ownedBusinesses = isSuperadmin
      ? businessIdFilter
        ? await db
            .select()
            .from(schema.hostBusinesses)
            .where(eq(schema.hostBusinesses.id, businessIdFilter))
        : await db.select().from(schema.hostBusinesses)
      : await db
          .select()
          .from(schema.hostBusinesses)
          .where(
            businessIdFilter
              ? and(
                  eq(schema.hostBusinesses.ownerUserId, userId),
                  eq(schema.hostBusinesses.id, businessIdFilter)
                )
              : eq(schema.hostBusinesses.ownerUserId, userId)
          );

    if (businessIdFilter && ownedBusinesses.length === 0) {
      throw AppError.forbidden("You do not have access to this business financial summary");
    }

    const businessIds = ownedBusinesses.map((b) => b.id);
    if (businessIds.length === 0) {
      return {
        currency: "LKR",
        totalAccruedMinor: 0,
        totalEligibleMinor: 0,
        totalOnHoldMinor: 0,
        totalPaidMinor: 0,
        payables: []
      };
    }

    const businessNameMap = new Map(ownedBusinesses.map((b) => [b.id, b.tradeName]));

    const rows = await db
      .select({
        payable: schema.hostPayables,
        referenceCode: schema.bookings.referenceCode
      })
      .from(schema.hostPayables)
      .innerJoin(schema.bookings, eq(schema.hostPayables.bookingId, schema.bookings.id))
      .where(inArray(schema.hostPayables.businessId, businessIds))
      .orderBy(desc(schema.hostPayables.accruedAt));

    let totalAccruedMinor = 0;
    let totalEligibleMinor = 0;
    let totalOnHoldMinor = 0;
    let totalPaidMinor = 0;

    const payables: HostPayableRecord[] = rows.map(({ payable, referenceCode }) => {
      if (payable.status === "ACCRUED") totalAccruedMinor += payable.netPayableMinor;
      if (payable.status === "ELIGIBLE") totalEligibleMinor += payable.netPayableMinor;
      if (payable.status === "ON_HOLD") totalOnHoldMinor += payable.netPayableMinor;
      if (payable.status === "PAID") totalPaidMinor += payable.netPayableMinor;

      return {
        id: payable.id,
        businessId: payable.businessId,
        businessName: businessNameMap.get(payable.businessId),
        bookingId: payable.bookingId,
        referenceCode,
        grossSubtotalMinor: payable.grossSubtotalMinor,
        commissionMinor: payable.commissionMinor,
        netPayableMinor: payable.netPayableMinor,
        currency: payable.currency,
        status: payable.status as HostPayableRecord["status"],
        accruedAt: payable.accruedAt.toISOString(),
        eligibleAt: payable.eligibleAt ? payable.eligibleAt.toISOString() : null,
        updatedAt: payable.updatedAt.toISOString()
      };
    });

    return {
      currency: "LKR",
      totalAccruedMinor,
      totalEligibleMinor,
      totalOnHoldMinor,
      totalPaidMinor,
      payables
    };
  }

  /**
   * Superadmin double-entry ledger inspection & mathematical balance verification.
   */
  async listAdminLedger(rawQuery: AdminLedgerQuery): Promise<AdminLedgerResponse> {
    const page = rawQuery.page ?? 1;
    const limit = rawQuery.limit ?? 50;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (rawQuery.bookingId) {
      conditions.push(eq(schema.financialLedgerEntries.bookingId, rawQuery.bookingId));
    }
    if (rawQuery.businessId) {
      conditions.push(eq(schema.financialLedgerEntries.businessId, rawQuery.businessId));
    }
    if (rawQuery.accountCode) {
      conditions.push(eq(schema.financialLedgerEntries.accountCode, rawQuery.accountCode));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.financialLedgerEntries)
      .where(whereClause);

    const total = countRes?.count ?? 0;

    const [totalsRes] = await db
      .select({
        debits: sql<number>`COALESCE(SUM(CASE WHEN ${schema.financialLedgerEntries.entryType} = 'DEBIT' THEN ${schema.financialLedgerEntries.amountMinor} ELSE 0 END), 0)::bigint`,
        credits: sql<number>`COALESCE(SUM(CASE WHEN ${schema.financialLedgerEntries.entryType} = 'CREDIT' THEN ${schema.financialLedgerEntries.amountMinor} ELSE 0 END), 0)::bigint`
      })
      .from(schema.financialLedgerEntries)
      .where(
        rawQuery.bookingId
          ? eq(schema.financialLedgerEntries.bookingId, rawQuery.bookingId)
          : rawQuery.businessId
          ? eq(schema.financialLedgerEntries.businessId, rawQuery.businessId)
          : undefined
      );

    const totalDebitsMinor = Number(totalsRes?.debits ?? 0);
    const totalCreditsMinor = Number(totalsRes?.credits ?? 0);

    const rows = await db
      .select({
        entry: schema.financialLedgerEntries,
        referenceCode: schema.bookings.referenceCode
      })
      .from(schema.financialLedgerEntries)
      .innerJoin(schema.bookings, eq(schema.financialLedgerEntries.bookingId, schema.bookings.id))
      .where(whereClause)
      .orderBy(desc(schema.financialLedgerEntries.postedAt))
      .limit(limit)
      .offset(offset);

    const entries: FinancialLedgerEntry[] = rows.map(({ entry, referenceCode }) => ({
      id: entry.id,
      transactionGroupId: entry.transactionGroupId,
      entryType: entry.entryType as FinancialLedgerEntry["entryType"],
      accountCode: entry.accountCode,
      accountName: entry.accountName,
      amountMinor: entry.amountMinor,
      currency: entry.currency,
      referenceType: entry.referenceType as FinancialLedgerEntry["referenceType"],
      referenceId: entry.referenceId,
      bookingId: entry.bookingId,
      referenceCode,
      businessId: entry.businessId,
      description: entry.description,
      metadata: (entry.metadata as Record<string, unknown>) ?? {},
      postedAt: entry.postedAt.toISOString()
    }));

    return {
      entries,
      totals: {
        currency: "LKR",
        totalDebitsMinor,
        totalCreditsMinor,
        isBalanced: totalDebitsMinor === totalCreditsMinor
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

export const ledgerService = new LedgerService();
