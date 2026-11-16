import crypto from "node:crypto";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  AdminSupportTicketQuery,
  AdminSupportTicketQuerySchema,
  AdminUpdateSupportTicketRequest,
  AdminUpdateSupportTicketRequestSchema,
  CreateSupportTicketRequest,
  CreateSupportTicketRequestSchema,
  CustomerSupportTicketReplyRequest,
  CustomerSupportTicketReplyRequestSchema,
  PaginationMeta,
  SecurityEventType,
  SupportTicketAdminDetail,
  SupportTicketCategory,
  SupportTicketCreatedResponse,
  SupportTicketCustomerDetail,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketReplyRequest,
  SupportTicketReplyRequestSchema,
  SupportTicketStatus,
  SupportTicketSummary
} from "@luggage-storage/contracts";
import { AppError } from "../../common/errors/app-error.js";
import { db, schema } from "../../infrastructure/database/drizzle.js";
import { AuditClientInfo, auditService } from "../audit/audit.service.js";
import { rateLimitService } from "../auth/rate-limit.service.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateTicketReferenceCode(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return `SUP-${y}${m}${d}-${suffix}`;
}

function deriveInitialPriority(category: SupportTicketCategory): SupportTicketPriority {
  if (category === "CUSTODY_INCIDENT") return "HIGH";
  if (
    category === "BOOKING_ISSUE" ||
    category === "PAYMENT_REFUND" ||
    category === "HOST_ONBOARDING" ||
    category === "ACCOUNT_ACCESS"
  ) {
    return "MEDIUM";
  }
  return "LOW";
}

function resolveCustomerSenderRole(roles?: string[]): "TRAVELLER" | "HOST" | "GUEST" {
  if (!roles || roles.length === 0) return "GUEST";
  if (roles.includes("HOST_OWNER") || roles.includes("HOST_STAFF")) return "HOST";
  return "TRAVELLER";
}

export class SupportService {
  /**
   * Public / optionally authenticated ticket intake endpoint (PW-009 /contact).
   * Enforces rate limiting and never discloses booking existence to callers.
   */
  async createTicket(
    rawInput: CreateSupportTicketRequest,
    caller: { userId?: string; roles?: string[] } | null,
    clientInfo?: AuditClientInfo
  ): Promise<SupportTicketCreatedResponse> {
    const input = CreateSupportTicketRequestSchema.parse(rawInput);

    const rateLimitClientInfo = clientInfo
      ? {
          ip: clientInfo.ip ?? undefined,
          userAgent: clientInfo.userAgent ?? undefined,
          correlationId: clientInfo.correlationId ?? undefined
        }
      : undefined;

    await rateLimitService.enforce({
      scope: "support_ticket_ip",
      identifier: clientInfo?.ip || "unknown-ip",
      message: "Too many support inquiries submitted recently. Please wait before submitting another.",
      clientInfo: rateLimitClientInfo
    });

    await rateLimitService.enforce({
      scope: "support_ticket_email",
      identifier: input.requesterEmail,
      message: "Too many support inquiries submitted for this email address. Please wait before trying again.",
      clientInfo: rateLimitClientInfo
    });

    const trimmedRef = input.bookingReference?.trim() || null;
    let linkedBookingId: string | null = null;
    if (trimmedRef) {
      const [bookingHit] = await db
        .select({ id: schema.bookings.id })
        .from(schema.bookings)
        .where(ilike(schema.bookings.referenceCode, trimmedRef))
        .limit(1);
      linkedBookingId = bookingHit?.id ?? null;
    }

    const now = new Date();
    const referenceCode = generateTicketReferenceCode(now);
    const priority = deriveInitialPriority(input.category);
    const senderRole = caller?.userId ? resolveCustomerSenderRole(caller.roles) : "GUEST";

    const [created] = await db.transaction(async (tx) => {
      const [ticket] = await tx
        .insert(schema.supportTickets)
        .values({
          referenceCode,
          requesterUserId: caller?.userId ?? null,
          requesterName: input.requesterName,
          requesterEmail: input.requesterEmail.toLowerCase(),
          category: input.category,
          priority,
          status: "OPEN",
          subject: input.subject,
          bookingReferenceInput: trimmedRef,
          bookingId: linkedBookingId,
          lastMessageAt: now,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      await tx.insert(schema.supportTicketMessages).values({
        ticketId: ticket.id,
        senderUserId: caller?.userId ?? null,
        senderRole,
        senderDisplayName: input.requesterName,
        body: input.message,
        isInternalNote: false,
        createdAt: now
      });

      await auditService.recordEvent({
        eventType: SecurityEventType.SUPPORT_TICKET_CREATED,
        userId: caller?.userId ?? null,
        clientInfo,
        tx,
        metadata: {
          ticketId: ticket.id,
          referenceCode: ticket.referenceCode,
          category: ticket.category,
          priority: ticket.priority,
          hasLinkedBooking: Boolean(linkedBookingId)
        }
      });

      return [ticket];
    });

    return {
      id: created.id,
      referenceCode: created.referenceCode,
      category: created.category as SupportTicketCategory,
      priority: created.priority as SupportTicketPriority,
      status: created.status as SupportTicketStatus,
      subject: created.subject,
      bookingReference: created.bookingReferenceInput ?? null,
      createdAt: created.createdAt.toISOString()
    };
  }

  /**
   * Lists tickets created while authenticated as the current traveller or host user.
   */
  async listMyTickets(userId: string): Promise<SupportTicketSummary[]> {
    const rows = await db
      .select()
      .from(schema.supportTickets)
      .where(eq(schema.supportTickets.requesterUserId, userId))
      .orderBy(desc(schema.supportTickets.lastMessageAt))
      .limit(50);

    return rows.map((row) => this.mapTicketSummary(row, null));
  }

  /**
   * Retrieves a single ticket owned by the authenticated user, strictly stripping internal notes.
   */
  async getMyTicketDetail(
    ticketIdOrRef: string,
    userId: string
  ): Promise<SupportTicketCustomerDetail> {
    const ticket = await this.findTicketByIdOrRef(ticketIdOrRef);
    if (!ticket || ticket.requesterUserId !== userId) {
      throw AppError.notFound("Support ticket not found");
    }

    const messageRows = await db
      .select()
      .from(schema.supportTicketMessages)
      .where(
        and(
          eq(schema.supportTicketMessages.ticketId, ticket.id),
          eq(schema.supportTicketMessages.isInternalNote, false)
        )
      )
      .orderBy(asc(schema.supportTicketMessages.createdAt));

    return {
      ...this.mapTicketSummary(ticket, null),
      assignedToUserId: null,
      assignedToDisplayName: null,
      messages: messageRows.map((m) => this.mapMessage(m))
    };
  }

  /**
   * Allows the authenticated requester to reply on their own open/resolved ticket.
   */
  async replyMyTicket(
    ticketIdOrRef: string,
    userId: string,
    userRoles: string[],
    rawInput: CustomerSupportTicketReplyRequest,
    clientInfo?: AuditClientInfo
  ): Promise<SupportTicketCustomerDetail> {
    const input = CustomerSupportTicketReplyRequestSchema.parse(rawInput);
    const ticket = await this.findTicketByIdOrRef(ticketIdOrRef);
    if (!ticket || ticket.requesterUserId !== userId) {
      throw AppError.notFound("Support ticket not found");
    }
    if (ticket.status === "CLOSED") {
      throw AppError.conflict("Closed support tickets cannot accept new replies");
    }

    const [senderUser] = await db
      .select({ displayName: schema.users.displayName })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    const senderDisplayName = senderUser?.displayName || ticket.requesterName;
    const senderRole = resolveCustomerSenderRole(userRoles);
    const now = new Date();
    const shouldReopen =
      ticket.status === "AWAITING_CUSTOMER" || ticket.status === "RESOLVED";

    await db.transaction(async (tx) => {
      await tx.insert(schema.supportTicketMessages).values({
        ticketId: ticket.id,
        senderUserId: userId,
        senderRole,
        senderDisplayName,
        body: input.message,
        isInternalNote: false,
        createdAt: now
      });

      await tx
        .update(schema.supportTickets)
        .set({
          status: shouldReopen ? "OPEN" : ticket.status,
          resolvedAt: shouldReopen ? null : ticket.resolvedAt,
          lastMessageAt: now,
          updatedAt: now
        })
        .where(eq(schema.supportTickets.id, ticket.id));

      await auditService.recordEvent({
        eventType: SecurityEventType.SUPPORT_TICKET_MESSAGE_ADDED,
        userId,
        clientInfo,
        tx,
        metadata: {
          ticketId: ticket.id,
          referenceCode: ticket.referenceCode,
          senderRole,
          isInternalNote: false
        }
      });
    });

    return this.getMyTicketDetail(ticket.id, userId);
  }

  /**
   * Admin / Support queue listing with search and filters.
   */
  async listAdminTickets(rawQuery: Partial<AdminSupportTicketQuery> = {}): Promise<{
    tickets: SupportTicketSummary[];
    total: number;
    pagination: PaginationMeta;
  }> {
    const query = AdminSupportTicketQuerySchema.parse(rawQuery);
    const offset = (query.page - 1) * query.limit;

    const conditions = [];
    if (query.status) conditions.push(eq(schema.supportTickets.status, query.status));
    if (query.priority) conditions.push(eq(schema.supportTickets.priority, query.priority));
    if (query.category) conditions.push(eq(schema.supportTickets.category, query.category));
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(schema.supportTickets.referenceCode, pattern),
          ilike(schema.supportTickets.subject, pattern),
          ilike(schema.supportTickets.requesterEmail, pattern),
          ilike(schema.supportTickets.requesterName, pattern),
          ilike(schema.supportTickets.bookingReferenceInput, pattern)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.supportTickets)
      .where(whereClause);

    const total = countRes?.count ?? 0;

    const rows = await db
      .select()
      .from(schema.supportTickets)
      .where(whereClause)
      .orderBy(desc(schema.supportTickets.lastMessageAt))
      .limit(query.limit)
      .offset(offset);

    const assigneeIds = Array.from(
      new Set(rows.map((r) => r.assignedToUserId).filter((id): id is string => Boolean(id)))
    );
    const assigneeMap = new Map<string, string>();
    if (assigneeIds.length > 0) {
      const assignees = await db
        .select({ id: schema.users.id, displayName: schema.users.displayName })
        .from(schema.users)
        .where(inArray(schema.users.id, assigneeIds));
      for (const a of assignees) {
        assigneeMap.set(a.id, a.displayName);
      }
    }

    const totalPages = Math.max(1, Math.ceil(total / query.limit));

    return {
      tickets: rows.map((row) =>
        this.mapTicketSummary(
          row,
          row.assignedToUserId ? assigneeMap.get(row.assignedToUserId) ?? null : null
        )
      ),
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
   * Full Support / Superadmin investigation view including internal notes & linked booking metadata.
   */
  async getAdminTicketDetail(ticketIdOrRef: string): Promise<SupportTicketAdminDetail> {
    const ticket = await this.findTicketByIdOrRef(ticketIdOrRef);
    if (!ticket) {
      throw AppError.notFound("Support ticket not found");
    }

    const [messages, assigneeRows, linkedBookingRows] = await Promise.all([
      db
        .select()
        .from(schema.supportTicketMessages)
        .where(eq(schema.supportTicketMessages.ticketId, ticket.id))
        .orderBy(asc(schema.supportTicketMessages.createdAt)),
      ticket.assignedToUserId
        ? db
            .select({ displayName: schema.users.displayName })
            .from(schema.users)
            .where(eq(schema.users.id, ticket.assignedToUserId))
            .limit(1)
        : Promise.resolve([]),
      ticket.bookingId
        ? db
            .select({
              id: schema.bookings.id,
              referenceCode: schema.bookings.referenceCode,
              status: schema.bookings.status,
              totalAmountMinor: schema.bookings.totalAmountMinor,
              currency: schema.bookings.currency,
              locationName: schema.storageLocations.name,
              businessName: schema.hostBusinesses.tradeName
            })
            .from(schema.bookings)
            .innerJoin(
              schema.storageLocations,
              eq(schema.bookings.locationId, schema.storageLocations.id)
            )
            .innerJoin(
              schema.hostBusinesses,
              eq(schema.bookings.businessId, schema.hostBusinesses.id)
            )
            .where(eq(schema.bookings.id, ticket.bookingId))
            .limit(1)
        : Promise.resolve([])
    ]);

    const linkedRow = linkedBookingRows[0] ?? null;

    return {
      ...this.mapTicketSummary(ticket, assigneeRows[0]?.displayName ?? null),
      linkedBooking: linkedRow
        ? {
            id: linkedRow.id,
            referenceCode: linkedRow.referenceCode,
            status: linkedRow.status as SupportTicketAdminDetail["linkedBooking"] extends infer T
              ? T extends { status: infer S }
                ? S
                : never
              : never,
            totalAmountMinor: linkedRow.totalAmountMinor,
            currency: linkedRow.currency,
            locationName: linkedRow.locationName,
            businessName: linkedRow.businessName
          }
        : null,
      messages: messages.map((m) => this.mapMessage(m))
    };
  }

  /**
   * Support / Superadmin replies publicly to requester OR appends an internal staff note.
   */
  async replyAdminTicket(
    ticketIdOrRef: string,
    actorUserId: string,
    actorRoles: string[],
    rawInput: SupportTicketReplyRequest,
    clientInfo?: AuditClientInfo
  ): Promise<SupportTicketAdminDetail> {
    const input = SupportTicketReplyRequestSchema.parse(rawInput);
    const ticket = await this.findTicketByIdOrRef(ticketIdOrRef);
    if (!ticket) {
      throw AppError.notFound("Support ticket not found");
    }

    const [actor] = await db
      .select({ displayName: schema.users.displayName })
      .from(schema.users)
      .where(eq(schema.users.id, actorUserId))
      .limit(1);

    const senderRole = actorRoles.includes("SUPERADMIN") ? "SUPERADMIN" : "SUPPORT";
    const senderDisplayName = actor?.displayName || senderRole;
    const now = new Date();

    const nextStatus: SupportTicketStatus = input.isInternalNote
      ? ticket.status === "OPEN"
        ? "IN_PROGRESS"
        : (ticket.status as SupportTicketStatus)
      : ticket.status === "OPEN" || ticket.status === "IN_PROGRESS"
      ? "AWAITING_CUSTOMER"
      : (ticket.status as SupportTicketStatus);

    await db.transaction(async (tx) => {
      await tx.insert(schema.supportTicketMessages).values({
        ticketId: ticket.id,
        senderUserId: actorUserId,
        senderRole,
        senderDisplayName,
        body: input.message,
        isInternalNote: input.isInternalNote,
        createdAt: now
      });

      await tx
        .update(schema.supportTickets)
        .set({
          status: nextStatus,
          assignedToUserId: ticket.assignedToUserId ?? actorUserId,
          lastMessageAt: now,
          updatedAt: now
        })
        .where(eq(schema.supportTickets.id, ticket.id));

      await auditService.recordEvent({
        eventType: SecurityEventType.SUPPORT_TICKET_MESSAGE_ADDED,
        userId: actorUserId,
        clientInfo,
        tx,
        metadata: {
          ticketId: ticket.id,
          referenceCode: ticket.referenceCode,
          senderRole,
          isInternalNote: input.isInternalNote,
          newStatus: nextStatus
        }
      });
    });

    return this.getAdminTicketDetail(ticket.id);
  }

  /**
   * Updates status, priority, assignee, or resolution summary for a support ticket.
   */
  async updateAdminTicket(
    ticketIdOrRef: string,
    actorUserId: string,
    rawInput: AdminUpdateSupportTicketRequest,
    clientInfo?: AuditClientInfo
  ): Promise<SupportTicketAdminDetail> {
    const input = AdminUpdateSupportTicketRequestSchema.parse(rawInput);
    const ticket = await this.findTicketByIdOrRef(ticketIdOrRef);
    if (!ticket) {
      throw AppError.notFound("Support ticket not found");
    }

    if (input.assignedToUserId) {
      const [assignee] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, input.assignedToUserId))
        .limit(1);
      if (!assignee) {
        throw AppError.notFound("Assignee user not found");
      }
    }

    const now = new Date();
    const nextStatus = input.status ?? (ticket.status as SupportTicketStatus);
    const nextResolvedAt =
      input.status === undefined
        ? ticket.resolvedAt
        : nextStatus === "RESOLVED" || nextStatus === "CLOSED"
        ? ticket.resolvedAt ?? now
        : null;

    await db.transaction(async (tx) => {
      await tx
        .update(schema.supportTickets)
        .set({
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.assignedToUserId !== undefined
            ? { assignedToUserId: input.assignedToUserId }
            : {}),
          ...(input.resolutionSummary !== undefined
            ? { resolutionSummary: input.resolutionSummary }
            : {}),
          resolvedAt: nextResolvedAt,
          updatedAt: now
        })
        .where(eq(schema.supportTickets.id, ticket.id));

      await auditService.recordEvent({
        eventType: SecurityEventType.SUPPORT_TICKET_UPDATED,
        userId: actorUserId,
        clientInfo,
        tx,
        metadata: {
          ticketId: ticket.id,
          referenceCode: ticket.referenceCode,
          previousStatus: ticket.status,
          newStatus: nextStatus,
          priority: input.priority ?? ticket.priority
        }
      });
    });

    return this.getAdminTicketDetail(ticket.id);
  }

  private async findTicketByIdOrRef(
    ticketIdOrRef: string
  ): Promise<typeof schema.supportTickets.$inferSelect | null> {
    const trimmed = ticketIdOrRef.trim();
    if (!trimmed) return null;

    const whereCond = UUID_REGEX.test(trimmed)
      ? eq(schema.supportTickets.id, trimmed)
      : ilike(schema.supportTickets.referenceCode, trimmed);

    const [row] = await db
      .select()
      .from(schema.supportTickets)
      .where(whereCond)
      .limit(1);

    return row ?? null;
  }

  private mapTicketSummary(
    row: typeof schema.supportTickets.$inferSelect,
    assignedToDisplayName: string | null
  ): SupportTicketSummary {
    return {
      id: row.id,
      referenceCode: row.referenceCode,
      requesterUserId: row.requesterUserId ?? null,
      requesterName: row.requesterName,
      requesterEmail: row.requesterEmail,
      category: row.category as SupportTicketCategory,
      priority: row.priority as SupportTicketPriority,
      status: row.status as SupportTicketStatus,
      subject: row.subject,
      bookingReferenceInput: row.bookingReferenceInput ?? null,
      bookingId: row.bookingId ?? null,
      assignedToUserId: row.assignedToUserId ?? null,
      assignedToDisplayName,
      resolutionSummary: row.resolutionSummary ?? null,
      resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
      lastMessageAt: row.lastMessageAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private mapMessage(
    row: typeof schema.supportTicketMessages.$inferSelect
  ): SupportTicketMessage {
    return {
      id: row.id,
      ticketId: row.ticketId,
      senderUserId: row.senderUserId ?? null,
      senderRole: row.senderRole,
      senderDisplayName: row.senderDisplayName,
      body: row.body,
      isInternalNote: row.isInternalNote,
      createdAt: row.createdAt.toISOString()
    };
  }
}

export const supportService = new SupportService();
