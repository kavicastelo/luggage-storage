import crypto from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  AdminPayoutBatchQuery,
  AdminPayoutBatchQuerySchema,
  CreatePayoutBatchRequest,
  CreatePayoutBatchRequestSchema,
  DisbursePayoutBatchRequest,
  DisbursePayoutBatchRequestSchema,
  EligibleHostPayablesGroup,
  HostPayableRecord,
  LEDGER_ACCOUNTS,
  PaginationMeta,
  PayoutBatchDetail,
  PayoutBatchItemRecord,
  PayoutBatchSummary,
  PayoutMethod,
  SecurityEventType
} from "@luggage-storage/contracts";
import { maskPayoutAccountNumber } from "../../common/crypto/payout-encryption.js";
import { AppError } from "../../common/errors/app-error.js";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { withSerializableOrDeadlockRetry } from "../../infrastructure/database/tx-retry.js";
import { AuditClientInfo, auditService } from "../audit/audit.service.js";
import { JournalPostingLine, ledgerService } from "./ledger.service.js";

function generateBatchCode(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return `PB-${y}${m}${d}-${suffix}`;
}

function isPgUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let i = 0; i < 4 && current && typeof current === "object"; i++) {
    const obj = current as { code?: unknown; cause?: unknown };
    if (obj.code === "23505") return true;
    current = obj.cause;
  }
  return false;
}

export class PayoutsService {
  /**
   * Groups unbatched ELIGIBLE host_payables by host business for AD-008 batch generation.
   */
  async getEligiblePayablesGrouped(businessIdFilter?: string): Promise<EligibleHostPayablesGroup[]> {
    const conditions = [
      eq(schema.hostPayables.status, "ELIGIBLE"),
      sql`NOT EXISTS (
        SELECT 1 FROM payout_batch_items pbi WHERE pbi.payable_id = ${schema.hostPayables.id}
      )`
    ];
    if (businessIdFilter) {
      conditions.push(eq(schema.hostPayables.businessId, businessIdFilter));
    }

    const rows = await db
      .select({
        payable: schema.hostPayables,
        referenceCode: schema.bookings.referenceCode,
        business: schema.hostBusinesses
      })
      .from(schema.hostPayables)
      .innerJoin(schema.hostBusinesses, eq(schema.hostPayables.businessId, schema.hostBusinesses.id))
      .innerJoin(schema.bookings, eq(schema.hostPayables.bookingId, schema.bookings.id))
      .where(and(...conditions))
      .orderBy(schema.hostBusinesses.tradeName, desc(schema.hostPayables.eligibleAt));

    const grouped = new Map<string, EligibleHostPayablesGroup>();

    for (const row of rows) {
      const biz = row.business;
      let group = grouped.get(biz.id);
      if (!group) {
        group = {
          businessId: biz.id,
          legalBusinessName: biz.legalBusinessName,
          tradeName: biz.tradeName,
          payoutBankName: biz.payoutBankName ?? null,
          payoutBranchCode: biz.payoutBranchCode ?? null,
          payoutAccountName: biz.payoutAccountName ?? null,
          payoutAccountMasked: maskPayoutAccountNumber(biz.payoutAccountNumber),
          currency: row.payable.currency,
          eligibleCount: 0,
          totalGrossMinor: 0,
          totalCommissionMinor: 0,
          totalNetPayableMinor: 0,
          payables: []
        };
        grouped.set(biz.id, group);
      }

      const item: HostPayableRecord = {
        id: row.payable.id,
        businessId: row.payable.businessId,
        businessName: biz.tradeName,
        bookingId: row.payable.bookingId,
        referenceCode: row.referenceCode,
        grossSubtotalMinor: row.payable.grossSubtotalMinor,
        commissionMinor: row.payable.commissionMinor,
        netPayableMinor: row.payable.netPayableMinor,
        currency: row.payable.currency,
        status: row.payable.status as HostPayableRecord["status"],
        accruedAt: row.payable.accruedAt.toISOString(),
        eligibleAt: row.payable.eligibleAt ? row.payable.eligibleAt.toISOString() : null,
        updatedAt: row.payable.updatedAt.toISOString()
      };

      group.payables.push(item);
      group.eligibleCount += 1;
      group.totalGrossMinor += row.payable.grossSubtotalMinor;
      group.totalCommissionMinor += row.payable.commissionMinor;
      group.totalNetPayableMinor += row.payable.netPayableMinor;
    }

    return Array.from(grouped.values()).filter((g) => g.totalNetPayableMinor > 0);
  }

  /**
   * Atomically creates a GENERATED payout batch for one host business, locking eligible payables
   * to guarantee each payable can belong to at most one batch.
   */
  async createPayoutBatch(
    actorUserId: string,
    rawInput: CreatePayoutBatchRequest,
    clientInfo?: AuditClientInfo
  ): Promise<PayoutBatchDetail> {
    const input = CreatePayoutBatchRequestSchema.parse(rawInput);

    let createdBatchId: string;
    try {
      createdBatchId = await withSerializableOrDeadlockRetry(() =>
        db.transaction(async (tx) => {
          const [business] = await tx
            .select()
            .from(schema.hostBusinesses)
            .where(eq(schema.hostBusinesses.id, input.businessId))
            .for("update")
            .limit(1);

          if (!business) {
            throw AppError.notFound("Host business not found");
          }

          let selectedPayables: Array<{
            id: string;
            businessId: string;
            bookingId: string;
            grossSubtotalMinor: number;
            commissionMinor: number;
            netPayableMinor: number;
            currency: string;
            status: string;
          }>;

          if (input.payableIds && input.payableIds.length > 0) {
            const uniquePayableIds = Array.from(new Set(input.payableIds)).sort();
            const lockedPayables = await tx
              .select({
                id: schema.hostPayables.id,
                businessId: schema.hostPayables.businessId,
                bookingId: schema.hostPayables.bookingId,
                grossSubtotalMinor: schema.hostPayables.grossSubtotalMinor,
                commissionMinor: schema.hostPayables.commissionMinor,
                netPayableMinor: schema.hostPayables.netPayableMinor,
                currency: schema.hostPayables.currency,
                status: schema.hostPayables.status
              })
              .from(schema.hostPayables)
              .where(inArray(schema.hostPayables.id, uniquePayableIds))
              .orderBy(schema.hostPayables.id)
              .for("update");

            if (lockedPayables.length !== uniquePayableIds.length) {
              throw AppError.notFound("One or more requested host payables were not found");
            }

            const existingItems = await tx
              .select({ payableId: schema.payoutBatchItems.payableId })
              .from(schema.payoutBatchItems)
              .where(inArray(schema.payoutBatchItems.payableId, uniquePayableIds))
              .for("update");

            if (existingItems.length > 0) {
              throw AppError.conflict(
                "One or more selected host payables are already assigned to an existing payout batch"
              );
            }

            for (const p of lockedPayables) {
              if (p.businessId !== input.businessId) {
                throw AppError.badRequest(
                  "All selected host payables must belong to the target host business"
                );
              }
              if (p.status !== "ELIGIBLE") {
                throw AppError.conflict(
                  `Host payable ${p.id} is in status ${p.status} and cannot be batched`
                );
              }
            }

            selectedPayables = lockedPayables;
          } else {
            selectedPayables = await tx
              .select({
                id: schema.hostPayables.id,
                businessId: schema.hostPayables.businessId,
                bookingId: schema.hostPayables.bookingId,
                grossSubtotalMinor: schema.hostPayables.grossSubtotalMinor,
                commissionMinor: schema.hostPayables.commissionMinor,
                netPayableMinor: schema.hostPayables.netPayableMinor,
                currency: schema.hostPayables.currency,
                status: schema.hostPayables.status
              })
              .from(schema.hostPayables)
              .where(
                and(
                  eq(schema.hostPayables.businessId, input.businessId),
                  eq(schema.hostPayables.status, "ELIGIBLE"),
                  sql`NOT EXISTS (
                    SELECT 1 FROM payout_batch_items pbi WHERE pbi.payable_id = ${schema.hostPayables.id}
                  )`
                )
              )
              .orderBy(schema.hostPayables.id)
              .for("update");
          }

          if (selectedPayables.length === 0) {
            throw AppError.conflict(
              "No eligible unbatched host payables are available for batch generation"
            );
          }

          const currency = selectedPayables[0].currency;
          let totalGrossMinor = 0;
          let totalCommissionMinor = 0;
          let totalNetPayableMinor = 0;

          for (const payable of selectedPayables) {
            if (payable.currency !== currency) {
              throw AppError.conflict("Cannot combine multiple currencies into one payout batch");
            }
            if (payable.netPayableMinor <= 0) {
              throw AppError.conflict(
                "Only payables with a positive net payable amount can be included in a payout batch"
              );
            }
            totalGrossMinor += payable.grossSubtotalMinor;
            totalCommissionMinor += payable.commissionMinor;
            totalNetPayableMinor += payable.netPayableMinor;
          }

          const now = new Date();
          const batchCode = generateBatchCode(now);
          const maskedAccount = maskPayoutAccountNumber(business.payoutAccountNumber);

          const [batch] = await tx
            .insert(schema.payoutBatches)
            .values({
              batchCode,
              businessId: business.id,
              currency,
              itemCount: selectedPayables.length,
              totalGrossMinor,
              totalCommissionMinor,
              totalNetPayableMinor,
              status: "GENERATED",
              payoutBankName: business.payoutBankName ?? null,
              payoutBranchCode: business.payoutBranchCode ?? null,
              payoutAccountName: business.payoutAccountName ?? null,
              payoutAccountMasked: maskedAccount,
              payoutMethod: input.payoutMethod,
              notes: input.notes?.trim() || null,
              generatedByUserId: actorUserId,
              createdAt: now,
              updatedAt: now
            })
            .returning();

          await tx.insert(schema.payoutBatchItems).values(
            selectedPayables.map((p) => ({
              batchId: batch.id,
              payableId: p.id,
              bookingId: p.bookingId,
              grossSubtotalMinor: p.grossSubtotalMinor,
              commissionMinor: p.commissionMinor,
              netPayableMinor: p.netPayableMinor,
              currency: p.currency,
              createdAt: now
            }))
          );

          await auditService.recordEvent({
            eventType: SecurityEventType.PAYOUT_BATCH_CREATED,
            userId: actorUserId,
            clientInfo,
            tx,
            metadata: {
              batchId: batch.id,
              batchCode: batch.batchCode,
              businessId: business.id,
              itemCount: batch.itemCount,
              totalNetPayableMinor: batch.totalNetPayableMinor,
              currency: batch.currency,
              payoutMethod: batch.payoutMethod
            }
          });

          return batch.id;
        })
      );
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        throw AppError.conflict(
          "One or more selected host payables were concurrently included in another payout batch"
        );
      }
      throw err;
    }

    return this.getAdminPayoutBatchDetail(createdBatchId);
  }

  /**
   * Lists payout batches globally for Admin / Finance Governance.
   */
  async listAdminPayoutBatches(rawQuery: Partial<AdminPayoutBatchQuery> = {}): Promise<{
    batches: PayoutBatchSummary[];
    total: number;
    pagination: PaginationMeta;
  }> {
    const query = AdminPayoutBatchQuerySchema.parse(rawQuery);
    const offset = (query.page - 1) * query.limit;
    const conditions = [];
    if (query.status) conditions.push(eq(schema.payoutBatches.status, query.status));
    if (query.businessId) conditions.push(eq(schema.payoutBatches.businessId, query.businessId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.payoutBatches)
      .where(whereClause);

    const total = countRes?.count ?? 0;

    const rows = await db
      .select({
        batch: schema.payoutBatches,
        businessName: schema.hostBusinesses.tradeName,
        legalBusinessName: schema.hostBusinesses.legalBusinessName
      })
      .from(schema.payoutBatches)
      .innerJoin(schema.hostBusinesses, eq(schema.payoutBatches.businessId, schema.hostBusinesses.id))
      .where(whereClause)
      .orderBy(desc(schema.payoutBatches.createdAt))
      .limit(query.limit)
      .offset(offset);

    const batches = rows.map((r) =>
      this.mapBatchSummary(r.batch, r.businessName, r.legalBusinessName)
    );

    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return {
      batches,
      total,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1
      }
    };
  }

  /**
   * Retrieves a single payout batch with all included booking payables.
   */
  async getAdminPayoutBatchDetail(batchId: string): Promise<PayoutBatchDetail> {
    const [row] = await db
      .select({
        batch: schema.payoutBatches,
        businessName: schema.hostBusinesses.tradeName,
        legalBusinessName: schema.hostBusinesses.legalBusinessName
      })
      .from(schema.payoutBatches)
      .innerJoin(schema.hostBusinesses, eq(schema.payoutBatches.businessId, schema.hostBusinesses.id))
      .where(eq(schema.payoutBatches.id, batchId))
      .limit(1);

    if (!row) {
      throw AppError.notFound("Payout batch not found");
    }

    const itemRows = await db
      .select({
        item: schema.payoutBatchItems,
        payableStatus: schema.hostPayables.status,
        referenceCode: schema.bookings.referenceCode
      })
      .from(schema.payoutBatchItems)
      .innerJoin(schema.hostPayables, eq(schema.payoutBatchItems.payableId, schema.hostPayables.id))
      .innerJoin(schema.bookings, eq(schema.payoutBatchItems.bookingId, schema.bookings.id))
      .where(eq(schema.payoutBatchItems.batchId, batchId))
      .orderBy(schema.payoutBatchItems.createdAt);

    const items: PayoutBatchItemRecord[] = itemRows.map((r) => ({
      id: r.item.id,
      batchId: r.item.batchId,
      payableId: r.item.payableId,
      bookingId: r.item.bookingId,
      referenceCode: r.referenceCode,
      grossSubtotalMinor: r.item.grossSubtotalMinor,
      commissionMinor: r.item.commissionMinor,
      netPayableMinor: r.item.netPayableMinor,
      currency: r.item.currency,
      payableStatus: r.payableStatus as PayoutBatchItemRecord["payableStatus"],
      createdAt: r.item.createdAt.toISOString()
    }));

    return {
      ...this.mapBatchSummary(row.batch, row.businessName, row.legalBusinessName),
      items
    };
  }

  /**
   * Attests bank wire/CEFT disbursement reference, marks payables PAID, and posts balanced
   * DEBIT 2020 Host Payable Liability / CREDIT 1010 Gateway Clearing Receivable ledger entries.
   */
  async disbursePayoutBatch(
    batchId: string,
    actorUserId: string,
    rawInput: DisbursePayoutBatchRequest,
    clientInfo?: AuditClientInfo
  ): Promise<PayoutBatchDetail> {
    const input = DisbursePayoutBatchRequestSchema.parse(rawInput);

    await withSerializableOrDeadlockRetry(() =>
      db.transaction(async (tx) => {
        const [batch] = await tx
          .select()
          .from(schema.payoutBatches)
          .where(eq(schema.payoutBatches.id, batchId))
          .for("update")
          .limit(1);

        if (!batch) {
          throw AppError.notFound("Payout batch not found");
        }
        if (batch.status !== "GENERATED") {
          throw AppError.conflict(`Payout batch ${batch.batchCode} has already been disbursed`);
        }

        const items = await tx
          .select()
          .from(schema.payoutBatchItems)
          .where(eq(schema.payoutBatchItems.batchId, batch.id))
          .orderBy(schema.payoutBatchItems.payableId)
          .for("update");

        if (items.length === 0) {
          throw AppError.conflict("Payout batch contains no line items");
        }

        const payableIds = items.map((i) => i.payableId);
        const lockedPayables = await tx
          .select()
          .from(schema.hostPayables)
          .where(inArray(schema.hostPayables.id, payableIds))
          .orderBy(schema.hostPayables.id)
          .for("update");

        if (lockedPayables.length !== payableIds.length) {
          throw AppError.internal("Missing host payable records referenced by payout batch");
        }

        const bookingRows = await tx
          .select({ id: schema.bookings.id, referenceCode: schema.bookings.referenceCode })
          .from(schema.bookings)
          .where(inArray(schema.bookings.id, lockedPayables.map((p) => p.bookingId)));
        const bookingRefMap = new Map(bookingRows.map((b) => [b.id, b.referenceCode]));

        const resolvedMethod = (input.payoutMethod ?? batch.payoutMethod) as PayoutMethod;
        const ledgerLines: JournalPostingLine[] = [];

        for (const payable of lockedPayables) {
          if (payable.status !== "ELIGIBLE") {
            throw AppError.conflict(
              `Included host payable ${payable.id} is in status ${payable.status} rather than ELIGIBLE`
            );
          }
          if (payable.netPayableMinor <= 0) {
            throw AppError.conflict(
              `Included host payable ${payable.id} has non-positive net payable amount`
            );
          }

          const bookingRef = bookingRefMap.get(payable.bookingId) ?? payable.bookingId;
          ledgerLines.push(
            {
              entryType: "DEBIT",
              accountCode: LEDGER_ACCOUNTS.HOST_PAYABLE_LIABILITY.code,
              accountName: LEDGER_ACCOUNTS.HOST_PAYABLE_LIABILITY.name,
              amountMinor: payable.netPayableMinor,
              currency: payable.currency,
              referenceType: "HOST_PAYABLE",
              referenceId: payable.id,
              bookingId: payable.bookingId,
              businessId: payable.businessId,
              description: `Host payout batch ${batch.batchCode} disbursement (${input.payoutReference}) for ${bookingRef}`,
              metadata: {
                batchId: batch.id,
                batchCode: batch.batchCode,
                payoutMethod: resolvedMethod,
                payoutReference: input.payoutReference
              }
            },
            {
              entryType: "CREDIT",
              accountCode: LEDGER_ACCOUNTS.GATEWAY_CLEARING_RECEIVABLE.code,
              accountName: LEDGER_ACCOUNTS.GATEWAY_CLEARING_RECEIVABLE.name,
              amountMinor: payable.netPayableMinor,
              currency: payable.currency,
              referenceType: "HOST_PAYABLE",
              referenceId: payable.id,
              bookingId: payable.bookingId,
              businessId: payable.businessId,
              description: `Bank clearing disbursement (${input.payoutReference}) for batch ${batch.batchCode}`,
              metadata: {
                batchId: batch.id,
                batchCode: batch.batchCode,
                payoutMethod: resolvedMethod,
                payoutReference: input.payoutReference
              }
            }
          );
        }

        const ledgerTxGroupId = await ledgerService.postJournalGroup(tx, ledgerLines);
        const now = new Date();

        await tx
          .update(schema.hostPayables)
          .set({
            status: "PAID",
            updatedAt: now
          })
          .where(inArray(schema.hostPayables.id, payableIds));

        await tx
          .update(schema.payoutBatches)
          .set({
            status: "DISBURSED",
            payoutMethod: resolvedMethod,
            payoutReference: input.payoutReference,
            notes: input.notes?.trim() || batch.notes,
            ledgerTransactionGroupId: ledgerTxGroupId,
            disbursedByUserId: actorUserId,
            disbursedAt: now,
            updatedAt: now
          })
          .where(eq(schema.payoutBatches.id, batch.id));

        await auditService.recordEvent({
          eventType: SecurityEventType.PAYOUT_BATCH_DISBURSED,
          userId: actorUserId,
          clientInfo,
          tx,
          metadata: {
            batchId: batch.id,
            batchCode: batch.batchCode,
            businessId: batch.businessId,
            itemCount: batch.itemCount,
            totalNetPayableMinor: batch.totalNetPayableMinor,
            currency: batch.currency,
            payoutMethod: resolvedMethod,
            payoutReference: input.payoutReference,
            ledgerTransactionGroupId: ledgerTxGroupId
          }
        });
      })
    );

    return this.getAdminPayoutBatchDetail(batchId);
  }

  /**
   * Lists settlement payout batches for HOST_OWNER (or SUPERADMIN), strictly excluding HOST_STAFF (OQ-017).
   */
  async listHostPayoutBatches(
    userId: string,
    userRoles: string[],
    businessIdFilter?: string
  ): Promise<PayoutBatchSummary[]> {
    const isSuperadmin = userRoles.includes("SUPERADMIN");
    if (!isSuperadmin && !userRoles.includes("HOST_OWNER")) {
      throw AppError.forbidden("Host financial payout statements are restricted to business owners");
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
      throw AppError.forbidden("You do not have access to this business payout history");
    }

    const businessIds = ownedBusinesses.map((b) => b.id);
    if (businessIds.length === 0) {
      return [];
    }

    const bizMap = new Map(ownedBusinesses.map((b) => [b.id, b]));
    const rows = await db
      .select()
      .from(schema.payoutBatches)
      .where(inArray(schema.payoutBatches.businessId, businessIds))
      .orderBy(desc(schema.payoutBatches.createdAt));

    return rows.map((row) => {
      const biz = bizMap.get(row.businessId);
      return this.mapBatchSummary(
        row,
        biz?.tradeName ?? "Host Business",
        biz?.legalBusinessName ?? "Host Business"
      );
    });
  }

  private mapBatchSummary(
    row: typeof schema.payoutBatches.$inferSelect,
    businessName: string,
    legalBusinessName: string
  ): PayoutBatchSummary {
    return {
      id: row.id,
      batchCode: row.batchCode,
      businessId: row.businessId,
      businessName,
      legalBusinessName,
      currency: row.currency,
      itemCount: row.itemCount,
      totalGrossMinor: row.totalGrossMinor,
      totalCommissionMinor: row.totalCommissionMinor,
      totalNetPayableMinor: row.totalNetPayableMinor,
      status: row.status as PayoutBatchSummary["status"],
      payoutBankName: row.payoutBankName ?? null,
      payoutBranchCode: row.payoutBranchCode ?? null,
      payoutAccountName: row.payoutAccountName ?? null,
      payoutAccountMasked: row.payoutAccountMasked ?? null,
      payoutMethod: row.payoutMethod as PayoutBatchSummary["payoutMethod"],
      payoutReference: row.payoutReference ?? null,
      notes: row.notes ?? null,
      ledgerTransactionGroupId: row.ledgerTransactionGroupId ?? null,
      generatedByUserId: row.generatedByUserId ?? null,
      disbursedByUserId: row.disbursedByUserId ?? null,
      disbursedAt: row.disbursedAt ? row.disbursedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}

export const payoutsService = new PayoutsService();
