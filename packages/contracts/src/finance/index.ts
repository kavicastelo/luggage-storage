import { z } from "zod";

// ============================================================================
// Double-Entry Financial Ledger & Host Payables (Non-Escrow Settlement Model)
// ============================================================================

export const LEDGER_ENTRY_TYPES = ["DEBIT", "CREDIT"] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const LEDGER_ACCOUNTS = {
  GATEWAY_CLEARING_RECEIVABLE: {
    code: "1010",
    name: "Gateway Clearing Receivable"
  },
  TRAVELLER_OVERDUE_RECEIVABLE: {
    code: "1020",
    name: "Traveller Overdue Fee Receivable"
  },
  TRAVELLER_BOOKING_LIABILITY: {
    code: "2010",
    name: "Traveller Unearned Booking Liability"
  },
  HOST_PAYABLE_LIABILITY: {
    code: "2020",
    name: "Host Settlement Payable Liability"
  },
  TRAVELLER_REFUND_LIABILITY: {
    code: "2030",
    name: "Traveller Refund Payable Liability"
  },
  PLATFORM_COMMISSION_REVENUE: {
    code: "4010",
    name: "Platform Marketplace Commission Revenue"
  }
} as const;

export const HOST_PAYABLE_STATUSES = [
  "ACCRUED",
  "ON_HOLD",
  "ELIGIBLE",
  "PAID",
  "CANCELLED_CLAWBACK"
] as const;
export type HostPayableStatus = (typeof HOST_PAYABLE_STATUSES)[number];
export const HostPayableStatusSchema = z.enum(HOST_PAYABLE_STATUSES);

export const FinancialLedgerEntrySchema = z.object({
  id: z.string().uuid(),
  transactionGroupId: z.string().uuid(),
  entryType: z.enum(LEDGER_ENTRY_TYPES),
  accountCode: z.string(),
  accountName: z.string(),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  referenceType: z.enum(["BOOKING", "PAYMENT", "REFUND", "HOST_PAYABLE"]),
  referenceId: z.string().uuid(),
  bookingId: z.string().uuid(),
  referenceCode: z.string().optional(),
  businessId: z.string().uuid().nullable(),
  description: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  postedAt: z.string()
});
export type FinancialLedgerEntry = z.infer<typeof FinancialLedgerEntrySchema>;

export const HostPayableRecordSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  businessName: z.string().optional(),
  bookingId: z.string().uuid(),
  referenceCode: z.string().optional(),
  grossSubtotalMinor: z.number().int().nonnegative(),
  commissionMinor: z.number().int().nonnegative(),
  netPayableMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: HostPayableStatusSchema,
  accruedAt: z.string(),
  eligibleAt: z.string().nullable(),
  updatedAt: z.string()
});
export type HostPayableRecord = z.infer<typeof HostPayableRecordSchema>;

export const HostFinanceSummaryResponseSchema = z.object({
  currency: z.string().length(3),
  totalAccruedMinor: z.number().int().nonnegative(),
  totalEligibleMinor: z.number().int().nonnegative(),
  totalOnHoldMinor: z.number().int().nonnegative(),
  totalPaidMinor: z.number().int().nonnegative(),
  payables: z.array(HostPayableRecordSchema)
});
export type HostFinanceSummaryResponse = z.infer<typeof HostFinanceSummaryResponseSchema>;

export const AdminLedgerQuerySchema = z.object({
  bookingId: z.string().uuid().optional(),
  businessId: z.string().uuid().optional(),
  accountCode: z.string().trim().max(32).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50)
});
export type AdminLedgerQuery = z.infer<typeof AdminLedgerQuerySchema>;

export const AdminLedgerResponseSchema = z.object({
  entries: z.array(FinancialLedgerEntrySchema),
  totals: z.object({
    currency: z.string().length(3),
    totalDebitsMinor: z.number().int().nonnegative(),
    totalCreditsMinor: z.number().int().nonnegative(),
    isBalanced: z.boolean()
  }),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative()
  })
});
export type AdminLedgerResponse = z.infer<typeof AdminLedgerResponseSchema>;

