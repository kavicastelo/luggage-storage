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

// ============================================================================
// Payout Batches & Manual Disbursement Attestation
// ============================================================================

export const PAYOUT_BATCH_STATUSES = ["GENERATED", "DISBURSED"] as const;
export type PayoutBatchStatus = (typeof PAYOUT_BATCH_STATUSES)[number];
export const PayoutBatchStatusSchema = z.enum(PAYOUT_BATCH_STATUSES);

export const PAYOUT_METHODS = ["CEFT_SLIPS", "BANK_WIRE", "MANUAL_OFFLINE"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];
export const PayoutMethodSchema = z.enum(PAYOUT_METHODS);

export const EligibleHostPayablesGroupSchema = z.object({
  businessId: z.string().uuid(),
  legalBusinessName: z.string(),
  tradeName: z.string(),
  payoutBankName: z.string().nullable(),
  payoutBranchCode: z.string().nullable(),
  payoutAccountName: z.string().nullable(),
  payoutAccountMasked: z.string().nullable(),
  currency: z.string().length(3),
  eligibleCount: z.number().int().nonnegative(),
  totalGrossMinor: z.number().int().nonnegative(),
  totalCommissionMinor: z.number().int().nonnegative(),
  totalNetPayableMinor: z.number().int().nonnegative(),
  payables: z.array(HostPayableRecordSchema)
});
export type EligibleHostPayablesGroup = z.infer<typeof EligibleHostPayablesGroupSchema>;

export const CreatePayoutBatchRequestSchema = z.object({
  businessId: z.string().uuid(),
  payableIds: z.array(z.string().uuid()).min(1).max(200).optional(),
  payoutMethod: PayoutMethodSchema.default("CEFT_SLIPS"),
  notes: z.string().trim().max(500).optional()
});
export type CreatePayoutBatchRequest = z.infer<typeof CreatePayoutBatchRequestSchema>;

export const DisbursePayoutBatchRequestSchema = z.object({
  payoutReference: z
    .string()
    .trim()
    .min(3, "Bank transfer reference must be at least 3 characters")
    .max(128),
  payoutMethod: PayoutMethodSchema.optional(),
  notes: z.string().trim().max(500).optional()
});
export type DisbursePayoutBatchRequest = z.infer<typeof DisbursePayoutBatchRequestSchema>;

export const PayoutBatchItemRecordSchema = z.object({
  id: z.string().uuid(),
  batchId: z.string().uuid(),
  payableId: z.string().uuid(),
  bookingId: z.string().uuid(),
  referenceCode: z.string().optional(),
  grossSubtotalMinor: z.number().int().nonnegative(),
  commissionMinor: z.number().int().nonnegative(),
  netPayableMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  payableStatus: HostPayableStatusSchema,
  createdAt: z.string()
});
export type PayoutBatchItemRecord = z.infer<typeof PayoutBatchItemRecordSchema>;

export const PayoutBatchSummarySchema = z.object({
  id: z.string().uuid(),
  batchCode: z.string(),
  businessId: z.string().uuid(),
  businessName: z.string(),
  legalBusinessName: z.string(),
  currency: z.string().length(3),
  itemCount: z.number().int().positive(),
  totalGrossMinor: z.number().int().nonnegative(),
  totalCommissionMinor: z.number().int().nonnegative(),
  totalNetPayableMinor: z.number().int().nonnegative(),
  status: PayoutBatchStatusSchema,
  payoutBankName: z.string().nullable(),
  payoutBranchCode: z.string().nullable(),
  payoutAccountName: z.string().nullable(),
  payoutAccountMasked: z.string().nullable(),
  payoutMethod: PayoutMethodSchema,
  payoutReference: z.string().nullable(),
  notes: z.string().nullable(),
  ledgerTransactionGroupId: z.string().uuid().nullable(),
  generatedByUserId: z.string().uuid().nullable(),
  disbursedByUserId: z.string().uuid().nullable(),
  disbursedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type PayoutBatchSummary = z.infer<typeof PayoutBatchSummarySchema>;

export const PayoutBatchDetailSchema = PayoutBatchSummarySchema.extend({
  items: z.array(PayoutBatchItemRecordSchema)
});
export type PayoutBatchDetail = z.infer<typeof PayoutBatchDetailSchema>;

export const AdminPayoutBatchQuerySchema = z.object({
  status: PayoutBatchStatusSchema.optional(),
  businessId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
export type AdminPayoutBatchQuery = z.infer<typeof AdminPayoutBatchQuerySchema>;


