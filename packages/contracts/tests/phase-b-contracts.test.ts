import { describe, it, expect } from "vitest";
import {
  BookingQuoteRequestSchema,
  CreateBookingRequestSchema,
  BookingStatusSchema,
  CreatePaymentIntentRequestSchema,
  RefundStatusSchema,
  VerifyCustodyPassRequestSchema,
  CompleteCheckInRequestSchema,
  CompleteCollectionRequestSchema,
  FinancialLedgerEntrySchema,
  LEDGER_ACCOUNTS,
  SecurityEventType
} from "../src/index.js";

describe("Phase B Shared Contracts — Booking, Payment, Custody & Finance", () => {
  it("validates booking quote and creation payloads and rejects collectionAt <= dropOffAt", () => {
    const valid = BookingQuoteRequestSchema.safeParse({
      locationId: "123e4567-e89b-12d3-a456-426614174000",
      dropOffAt: "2026-12-01T08:00:00.000Z",
      collectionAt: "2026-12-01T18:00:00.000Z",
      items: [{ bagCategory: "BAG_MEDIUM", quantity: 2 }]
    });
    expect(valid.success).toBe(true);

    const invalidRange = CreateBookingRequestSchema.safeParse({
      locationId: "123e4567-e89b-12d3-a456-426614174000",
      dropOffAt: "2026-12-01T18:00:00.000Z",
      collectionAt: "2026-12-01T18:00:00.000Z",
      items: [{ bagCategory: "BAG_SMALL", quantity: 1 }]
    });
    expect(invalidRange.success).toBe(false);
  });

  it("validates all 11 booking statuses and 7 refund lifecycle statuses", () => {
    const bookingStatuses = [
      "PENDING_HOST_APPROVAL",
      "PENDING_PAYMENT",
      "CONFIRMED",
      "IN_STORAGE",
      "COMPLETED",
      "CANCELLED_BY_TRAVELLER",
      "CANCELLED_BY_HOST",
      "CANCELLED_BY_PLATFORM",
      "REJECTED",
      "EXPIRED",
      "DISPUTED"
    ];
    for (const s of bookingStatuses) {
      expect(BookingStatusSchema.safeParse(s).success).toBe(true);
    }

    const refundStatuses = [
      "REQUESTED",
      "AUTHORIZED",
      "INITIATED",
      "PROCESSING",
      "SUCCEEDED",
      "FAILED",
      "MANUAL_REVIEW_REQUIRED"
    ];
    for (const s of refundStatuses) {
      expect(RefundStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it("enforces custody verification token or 6-digit PIN requirement", () => {
    const neither = VerifyCustodyPassRequestSchema.safeParse({
      bookingId: "123e4567-e89b-12d3-a456-426614174000",
      operation: "CHECK_IN"
    });
    expect(neither.success).toBe(false);

    const validPin = VerifyCustodyPassRequestSchema.safeParse({
      bookingId: "123e4567-e89b-12d3-a456-426614174000",
      operation: "CHECK_IN",
      verificationPin: "482910"
    });
    expect(validPin.success).toBe(true);

    const validToken = CompleteCollectionRequestSchema.safeParse({
      qrToken: "a".repeat(64),
      releasedBagCount: 2
    });
    expect(validToken.success).toBe(true);

    const checkInMissingBags = CompleteCheckInRequestSchema.safeParse({
      verificationPin: "123456",
      bags: []
    });
    expect(checkInMissingBags.success).toBe(false);
  });

  it("enforces integer minor-unit ledger entries and Phase B audit event constants", () => {
    expect(LEDGER_ACCOUNTS.GATEWAY_CLEARING_RECEIVABLE.code).toBe("1010");
    expect(LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE.code).toBe("4010");
    expect(SecurityEventType.BOOKING_CONFIRMED).toBe("BOOKING_CONFIRMED");
    expect(SecurityEventType.CUSTODY_RELEASED).toBe("CUSTODY_RELEASED");

    const floatLedger = FinancialLedgerEntrySchema.safeParse({
      id: "123e4567-e89b-12d3-a456-426614174000",
      transactionGroupId: "223e4567-e89b-12d3-a456-426614174000",
      entryType: "DEBIT",
      accountCode: "1010",
      accountName: "Gateway Clearing Receivable",
      amountMinor: 1250.5,
      currency: "LKR",
      referenceType: "PAYMENT",
      referenceId: "323e4567-e89b-12d3-a456-426614174000",
      bookingId: "423e4567-e89b-12d3-a456-426614174000",
      businessId: null,
      description: "Test float rejection",
      postedAt: "2026-12-01T10:00:00.000Z"
    });
    expect(floatLedger.success).toBe(false);

    const validIntent = CreatePaymentIntentRequestSchema.safeParse({
      bookingId: "123e4567-e89b-12d3-a456-426614174000",
      idempotencyKey: "idem-key-123456"
    });
    expect(validIntent.success).toBe(true);
  });
});

