import type { AvailabilitySearchQuery, SearchLocationsQueryInput } from "@luggage-storage/contracts";

export const mobileQueryKeys = {
  auth: {
    me: ["auth", "me"] as const,
    sessions: ["auth", "sessions"] as const
  },
  discovery: {
    all: ["discovery"] as const,
    search: (params?: Partial<SearchLocationsQueryInput>) =>
      ["discovery", "search", params ?? {}] as const,
    detail: (locationId: string) => ["discovery", "detail", locationId] as const,
    availability: (params: AvailabilitySearchQuery) =>
      ["discovery", "availability", params] as const
  },
  bookings: {
    all: ["bookings"] as const,
    list: (filters?: { status?: string; page?: number; limit?: number }) =>
      ["bookings", "list", filters ?? {}] as const,
    detail: (bookingId: string) => ["bookings", "detail", bookingId] as const,
    checkoutStatus: (bookingId: string) => ["payments", "checkout-status", bookingId] as const
  },
  host: {
    all: ["host"] as const,
    businesses: ["host", "businesses"] as const,
    verification: (businessId: string) => ["host", "verification", businessId] as const,
    payoutDetails: (businessId: string) => ["host", "payout-details", businessId] as const,
    locations: ["host", "locations"] as const,
    location: (locationId: string) => ["host", "location", locationId] as const,
    capacityPools: (locationId: string) => ["host", "capacity-pools", locationId] as const,
    pricing: (locationId: string) => ["host", "pricing", locationId] as const,
    bookings: (filters?: { status?: string; locationId?: string; page?: number }) =>
      ["host", "bookings", filters ?? {}] as const,
    bookingDetail: (bookingId: string) => ["host", "booking-detail", bookingId] as const,
    custodyDetail: (bookingId: string) => ["host", "custody", bookingId] as const,
    financeSummary: ["host", "finance", "summary"] as const,
    payoutBatches: (businessId?: string) =>
      ["host", "finance", "payout-batches", businessId ?? "all"] as const,
    staff: (businessId: string) => ["host", "staff", businessId] as const
  },
  support: {
    tickets: ["support", "tickets", "me"] as const,
    ticketDetail: (ticketId: string) => ["support", "tickets", "me", ticketId] as const
  }
} as const;

