import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./identity.js";
import { bookings } from "./bookings.js";

// ============================================================================
// 1. Support Tickets (Customer & Host Helpdesk Triage)
// ============================================================================
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referenceCode: varchar("reference_code", { length: 32 }).notNull(),
    requesterUserId: uuid("requester_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    requesterName: varchar("requester_name", { length: 120 }).notNull(),
    requesterEmail: varchar("requester_email", { length: 254 }).notNull(),
    category: varchar("category", { length: 32 }).notNull().default("GENERAL_INQUIRY"),
    priority: varchar("priority", { length: 16 }).notNull().default("MEDIUM"),
    status: varchar("status", { length: 32 }).notNull().default("OPEN"),
    subject: varchar("subject", { length: 200 }).notNull(),
    bookingReferenceInput: varchar("booking_reference_input", { length: 64 }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    resolutionSummary: text("resolution_summary"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("support_tickets_reference_code_unique").on(table.referenceCode),
    index("support_tickets_status_priority_idx").on(table.status, table.priority, table.lastMessageAt),
    index("support_tickets_requester_user_idx").on(table.requesterUserId, table.createdAt),
    index("support_tickets_booking_id_idx").on(table.bookingId),
    check(
      "support_tickets_category_check",
      sql`${table.category} IN (
        'BOOKING_ISSUE',
        'CUSTODY_INCIDENT',
        'PAYMENT_REFUND',
        'HOST_ONBOARDING',
        'ACCOUNT_ACCESS',
        'GENERAL_INQUIRY'
      )`
    ),
    check(
      "support_tickets_priority_check",
      sql`${table.priority} IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')`
    ),
    check(
      "support_tickets_status_check",
      sql`${table.status} IN ('OPEN', 'IN_PROGRESS', 'AWAITING_CUSTOMER', 'RESOLVED', 'CLOSED')`
    )
  ]
);

// ============================================================================
// 2. Support Ticket Messages (Customer Thread & Internal Agent Notes)
// ============================================================================
export const supportTicketMessages = pgTable(
  "support_ticket_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "restrict" }),
    senderUserId: uuid("sender_user_id").references(() => users.id, { onDelete: "set null" }),
    senderRole: varchar("sender_role", { length: 32 }).notNull(),
    senderDisplayName: varchar("sender_display_name", { length: 120 }).notNull(),
    body: text("body").notNull(),
    isInternalNote: boolean("is_internal_note").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("support_ticket_messages_ticket_created_idx").on(table.ticketId, table.createdAt),
    check(
      "support_ticket_messages_sender_role_check",
      sql`${table.senderRole} IN ('GUEST', 'TRAVELLER', 'HOST', 'SUPPORT', 'SUPERADMIN')`
    )
  ]
);

export type SupportTicketEntity = typeof supportTickets.$inferSelect;
export type SupportTicketMessageEntity = typeof supportTicketMessages.$inferSelect;
