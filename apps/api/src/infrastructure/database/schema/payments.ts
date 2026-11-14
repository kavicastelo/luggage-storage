import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
  type AnyPgColumn
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identity.js";
import { bookings } from "./bookings.js";

// ============================================================================
// 1. Payment Intents
// ============================================================================
export const paymentIntents = pgTable(
  "payment_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    travellerUserId: uuid("traveller_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    providerOrderId: varchar("provider_order_id", { length: 128 }).notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("LKR"),
    status: varchar("status", { length: 32 }).notNull().default("INITIATED"),
    checkoutPayload: jsonb("checkout_payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("payment_intents_provider_order_unique").on(table.providerOrderId),
    uniqueIndex("payment_intents_booking_idempotency_unique")
      .on(table.bookingId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    uniqueIndex("payment_intents_single_active_per_booking_idx")
      .on(table.bookingId)
      .where(sql`${table.status} IN ('INITIATED', 'PENDING_GATEWAY')`),
    index("payment_intents_booking_id_idx").on(table.bookingId),
    index("payment_intents_traveller_id_idx").on(table.travellerUserId),
    check(
      "payment_intents_provider_check",
      sql`${table.provider} IN ('SANDBOX_GATEWAY', 'PAYHERE')`
    ),
    check(
      "payment_intents_status_check",
      sql`${table.status} IN (
        'INITIATED',
        'PENDING_GATEWAY',
        'SUCCEEDED',
        'FAILED',
        'EXPIRED',
        'ORPHANED_SUCCEEDED'
      )`
    ),
    check("payment_intents_amount_check", sql`${table.amountMinor} > 0`)
  ]
);

// ============================================================================
// 2. Payment Transactions
// ============================================================================
export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentIntentId: uuid("payment_intent_id")
      .notNull()
      .references(() => paymentIntents.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    refundId: uuid("refund_id").references((): AnyPgColumn => refundRecords.id, {
      onDelete: "restrict"
    }),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerTransactionId: varchar("provider_transaction_id", { length: 128 }),
    transactionType: varchar("transaction_type", { length: 32 }).notNull().default("CHARGE"),
    status: varchar("status", { length: 32 }).notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("LKR"),
    rawStatusCode: varchar("raw_status_code", { length: 32 }),
    evidenceSource: varchar("evidence_source", { length: 32 }).notNull(),
    manualReference: varchar("manual_reference", { length: 128 }),
    settledByUserId: uuid("settled_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("payment_transactions_provider_tx_unique")
      .on(table.provider, table.providerTransactionId)
      .where(sql`${table.providerTransactionId} IS NOT NULL`),
    uniqueIndex("payment_transactions_refund_unique_idx")
      .on(table.refundId)
      .where(
        sql`${table.refundId} IS NOT NULL AND ${table.transactionType} = 'REFUND' AND ${table.status} = 'SUCCEEDED'`
      ),
    index("payment_transactions_booking_id_idx").on(table.bookingId),
    index("payment_transactions_intent_id_idx").on(table.paymentIntentId),
    index("payment_transactions_refund_id_idx").on(table.refundId),
    index("payment_transactions_evidence_source_idx").on(table.evidenceSource),
    check(
      "payment_transactions_type_check",
      sql`${table.transactionType} IN ('CHARGE', 'REFUND')`
    ),
    check(
      "payment_transactions_status_check",
      sql`${table.status} IN ('SUCCEEDED', 'FAILED', 'PENDING')`
    ),
    check("payment_transactions_amount_check", sql`${table.amountMinor} > 0`),
    check(
      "payment_transactions_evidence_source_check",
      sql`${table.evidenceSource} IN ('PROVIDER_WEBHOOK', 'SANDBOX_SIMULATOR', 'ADMIN_PROVIDER_ATTESTED', 'ADMIN_MANUAL_OFFLINE')`
    ),
    check(
      "payment_transactions_sig_evidence_check",
      sql`(NOT ${table.signatureVerified}) OR (${table.evidenceSource} = 'PROVIDER_WEBHOOK')`
    ),
    check(
      "payment_transactions_provider_tx_presence_check",
      sql`((${table.evidenceSource} = 'ADMIN_MANUAL_OFFLINE' AND ${table.transactionType} = 'REFUND' AND ${table.providerTransactionId} IS NULL AND ${table.manualReference} IS NOT NULL AND length(btrim(${table.manualReference})) >= 3) OR (${table.evidenceSource} <> 'ADMIN_MANUAL_OFFLINE' AND ${table.providerTransactionId} IS NOT NULL AND length(btrim(${table.providerTransactionId})) >= 3))`
    ),
    check(
      "payment_transactions_admin_refund_only_check",
      sql`${table.evidenceSource} NOT IN ('ADMIN_PROVIDER_ATTESTED', 'ADMIN_MANUAL_OFFLINE') OR ${table.transactionType} = 'REFUND'`
    )
  ]
);

// ============================================================================
// 3. Payment Webhook Events (Idempotent Replay & Deduplication Log)
// ============================================================================
export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 32 }).notNull(),
    eventId: varchar("event_id", { length: 128 }).notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    paymentIntentId: uuid("payment_intent_id").references(() => paymentIntents.id, {
      onDelete: "set null"
    }),
    processingOutcome: varchar("processing_outcome", { length: 64 }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("payment_webhook_events_provider_event_unique").on(table.provider, table.eventId),
    index("payment_webhook_events_intent_id_idx").on(table.paymentIntentId)
  ]
);

// ============================================================================
// 4. Refund Records (7-Stage OQ-013 Lifecycle)
// ============================================================================
export const refundRecords = pgTable(
  "refund_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    paymentIntentId: uuid("payment_intent_id").references(() => paymentIntents.id, {
      onDelete: "restrict"
    }),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("LKR"),
    refundPercentage: integer("refund_percentage").notNull(),
    reasonCategory: varchar("reason_category", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("REQUESTED"),
    settlementMode: varchar("settlement_mode", { length: 32 }),
    providerRefundId: varchar("provider_refund_id", { length: 128 }),
    manualReference: varchar("manual_reference", { length: 128 }),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    authorizedByUserId: uuid("authorized_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    settledByUserId: uuid("settled_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("refund_records_booking_id_idx").on(table.bookingId),
    index("refund_records_status_idx").on(table.status),
    uniqueIndex("refund_records_provider_refund_unique_idx")
      .on(table.providerRefundId)
      .where(sql`${table.providerRefundId} IS NOT NULL`),
    check("refund_records_amount_check", sql`${table.amountMinor} >= 0`),
    check(
      "refund_records_pct_check",
      sql`${table.refundPercentage} >= 0 AND ${table.refundPercentage} <= 100`
    ),
    check(
      "refund_records_reason_check",
      sql`${table.reasonCategory} IN (
        'TRAVELLER_CANCELLATION',
        'HOST_CANCELLATION',
        'PLATFORM_CANCELLATION',
        'LATE_WEBHOOK_EXPIRED_HOLD',
        'DISPUTE_RESOLUTION'
      )`
    ),
    check(
      "refund_records_status_check",
      sql`${table.status} IN (
        'REQUESTED',
        'AUTHORIZED',
        'INITIATED',
        'PROCESSING',
        'SUCCEEDED',
        'FAILED',
        'MANUAL_REVIEW_REQUIRED'
      )`
    ),
    check(
      "refund_records_settlement_mode_check",
      sql`${table.settlementMode} IS NULL OR ${table.settlementMode} IN ('PROVIDER_CONFIRMED', 'MANUAL_OFFLINE')`
    ),
    check(
      "refund_records_succeeded_evidence_check",
      sql`${table.status} <> 'SUCCEEDED' OR ((${table.settlementMode} = 'PROVIDER_CONFIRMED' AND ${table.providerRefundId} IS NOT NULL AND length(btrim(${table.providerRefundId})) >= 3 AND ${table.manualReference} IS NULL) OR (${table.settlementMode} = 'MANUAL_OFFLINE' AND ${table.manualReference} IS NOT NULL AND length(btrim(${table.manualReference})) >= 3 AND ${table.providerRefundId} IS NULL))`
    )
  ]
);

export type PaymentIntentEntity = typeof paymentIntents.$inferSelect;
export type PaymentTransactionEntity = typeof paymentTransactions.$inferSelect;
export type RefundRecordEntity = typeof refundRecords.$inferSelect;

