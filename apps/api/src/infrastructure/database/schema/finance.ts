import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { hostBusinesses } from "./hosts.js";
import { bookings } from "./bookings.js";

// ============================================================================
// 1. Financial Ledger Entries (Append-Only Double-Entry Journal)
// ============================================================================
export const financialLedgerEntries = pgTable(
  "financial_ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionGroupId: uuid("transaction_group_id").notNull(),
    entryType: varchar("entry_type", { length: 16 }).notNull(),
    accountCode: varchar("account_code", { length: 32 }).notNull(),
    accountName: varchar("account_name", { length: 128 }).notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("LKR"),
    referenceType: varchar("reference_type", { length: 32 }).notNull(),
    referenceId: uuid("reference_id").notNull(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    businessId: uuid("business_id").references(() => hostBusinesses.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("financial_ledger_entries_group_id_idx").on(table.transactionGroupId),
    index("financial_ledger_entries_booking_id_idx").on(table.bookingId),
    index("financial_ledger_entries_business_id_idx").on(table.businessId),
    index("financial_ledger_entries_account_code_idx").on(table.accountCode),
    check("financial_ledger_entries_type_check", sql`${table.entryType} IN ('DEBIT', 'CREDIT')`),
    check("financial_ledger_entries_amount_check", sql`${table.amountMinor} > 0`),
    check(
      "financial_ledger_entries_ref_type_check",
      sql`${table.referenceType} IN ('BOOKING', 'PAYMENT', 'REFUND', 'HOST_PAYABLE')`
    )
  ]
);

// ============================================================================
// 2. Host Payables (Settlement Accruals — Non-Escrow Commercial Ledger)
// ============================================================================
export const hostPayables = pgTable(
  "host_payables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => hostBusinesses.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    grossSubtotalMinor: integer("gross_subtotal_minor").notNull(),
    commissionMinor: integer("commission_minor").notNull(),
    netPayableMinor: integer("net_payable_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("LKR"),
    status: varchar("status", { length: 32 }).notNull().default("ACCRUED"),
    accruedAt: timestamp("accrued_at", { withTimezone: true }).notNull().defaultNow(),
    eligibleAt: timestamp("eligible_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("host_payables_booking_id_unique").on(table.bookingId),
    index("host_payables_business_status_idx").on(table.businessId, table.status),
    check("host_payables_gross_check", sql`${table.grossSubtotalMinor} >= 0`),
    check("host_payables_commission_check", sql`${table.commissionMinor} >= 0`),
    check("host_payables_net_check", sql`${table.netPayableMinor} >= 0`),
    check(
      "host_payables_split_check",
      sql`${table.commissionMinor} + ${table.netPayableMinor} = ${table.grossSubtotalMinor}`
    ),
    check(
      "host_payables_status_check",
      sql`${table.status} IN ('ACCRUED', 'ON_HOLD', 'ELIGIBLE', 'PAID', 'CANCELLED_CLAWBACK')`
    )
  ]
);

export type FinancialLedgerEntryEntity = typeof financialLedgerEntries.$inferSelect;
export type HostPayableEntity = typeof hostPayables.$inferSelect;

