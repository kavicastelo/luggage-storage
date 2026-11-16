import { z } from "zod";
import { BookingStatusSchema } from "../bookings/index.js";

// ============================================================================
// Customer & Host Support Ticket System
// ============================================================================

export const SUPPORT_TICKET_CATEGORIES = [
  "BOOKING_ISSUE",
  "CUSTODY_INCIDENT",
  "PAYMENT_REFUND",
  "HOST_ONBOARDING",
  "ACCOUNT_ACCESS",
  "GENERAL_INQUIRY"
] as const;
export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number];
export const SupportTicketCategorySchema = z.enum(SUPPORT_TICKET_CATEGORIES);

export const SUPPORT_TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type SupportTicketPriority = (typeof SUPPORT_TICKET_PRIORITIES)[number];
export const SupportTicketPrioritySchema = z.enum(SUPPORT_TICKET_PRIORITIES);

export const SUPPORT_TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_CUSTOMER",
  "RESOLVED",
  "CLOSED"
] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];
export const SupportTicketStatusSchema = z.enum(SUPPORT_TICKET_STATUSES);

export const CreateSupportTicketRequestSchema = z.object({
  requesterName: z.string().trim().min(2, "Full name is required").max(120),
  requesterEmail: z.string().trim().email("Valid email address is required").max(254),
  category: SupportTicketCategorySchema.default("GENERAL_INQUIRY"),
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(200),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(4000),
  bookingReference: z.string().trim().max(64).optional()
});
export type CreateSupportTicketRequest = z.infer<typeof CreateSupportTicketRequestSchema>;

export const SupportTicketCreatedResponseSchema = z.object({
  id: z.string().uuid(),
  referenceCode: z.string(),
  category: SupportTicketCategorySchema,
  priority: SupportTicketPrioritySchema,
  status: SupportTicketStatusSchema,
  subject: z.string(),
  bookingReference: z.string().nullable(),
  createdAt: z.string()
});
export type SupportTicketCreatedResponse = z.infer<typeof SupportTicketCreatedResponseSchema>;

export const SupportTicketMessageSchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  senderUserId: z.string().uuid().nullable(),
  senderRole: z.string(),
  senderDisplayName: z.string(),
  body: z.string(),
  isInternalNote: z.boolean(),
  createdAt: z.string()
});
export type SupportTicketMessage = z.infer<typeof SupportTicketMessageSchema>;

export const SupportTicketSummarySchema = z.object({
  id: z.string().uuid(),
  referenceCode: z.string(),
  requesterUserId: z.string().uuid().nullable(),
  requesterName: z.string(),
  requesterEmail: z.string(),
  category: SupportTicketCategorySchema,
  priority: SupportTicketPrioritySchema,
  status: SupportTicketStatusSchema,
  subject: z.string(),
  bookingReferenceInput: z.string().nullable(),
  bookingId: z.string().uuid().nullable(),
  assignedToUserId: z.string().uuid().nullable(),
  assignedToDisplayName: z.string().nullable().optional(),
  resolutionSummary: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  lastMessageAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type SupportTicketSummary = z.infer<typeof SupportTicketSummarySchema>;

export const SupportTicketCustomerDetailSchema = SupportTicketSummarySchema.extend({
  messages: z.array(SupportTicketMessageSchema)
});
export type SupportTicketCustomerDetail = z.infer<typeof SupportTicketCustomerDetailSchema>;

export const SupportTicketLinkedBookingSchema = z.object({
  id: z.string().uuid(),
  referenceCode: z.string(),
  status: BookingStatusSchema,
  totalAmountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  locationName: z.string(),
  businessName: z.string()
});
export type SupportTicketLinkedBooking = z.infer<typeof SupportTicketLinkedBookingSchema>;

export const SupportTicketAdminDetailSchema = SupportTicketSummarySchema.extend({
  linkedBooking: SupportTicketLinkedBookingSchema.nullable(),
  messages: z.array(SupportTicketMessageSchema)
});
export type SupportTicketAdminDetail = z.infer<typeof SupportTicketAdminDetailSchema>;

export const SupportTicketReplyRequestSchema = z.object({
  message: z.string().trim().min(2, "Reply message cannot be empty").max(4000),
  isInternalNote: z.boolean().default(false)
});
export type SupportTicketReplyRequest = z.infer<typeof SupportTicketReplyRequestSchema>;

export const CustomerSupportTicketReplyRequestSchema = z.object({
  message: z.string().trim().min(2, "Reply message cannot be empty").max(4000)
});
export type CustomerSupportTicketReplyRequest = z.infer<
  typeof CustomerSupportTicketReplyRequestSchema
>;

export const AdminUpdateSupportTicketRequestSchema = z
  .object({
    status: SupportTicketStatusSchema.optional(),
    priority: SupportTicketPrioritySchema.optional(),
    assignedToUserId: z.string().uuid().nullable().optional(),
    resolutionSummary: z.string().trim().max(1000).nullable().optional()
  })
  .refine(
    (val) =>
      val.status !== undefined ||
      val.priority !== undefined ||
      val.assignedToUserId !== undefined ||
      val.resolutionSummary !== undefined,
    { message: "At least one support ticket field must be provided for update" }
  );
export type AdminUpdateSupportTicketRequest = z.infer<typeof AdminUpdateSupportTicketRequestSchema>;

export const AdminSupportTicketQuerySchema = z.object({
  status: SupportTicketStatusSchema.optional(),
  priority: SupportTicketPrioritySchema.optional(),
  category: SupportTicketCategorySchema.optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});
export type AdminSupportTicketQuery = z.infer<typeof AdminSupportTicketQuerySchema>;
