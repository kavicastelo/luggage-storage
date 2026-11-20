import {
  CreateHostBusinessRequest,
  UpdateHostBusinessRequest,
  SubmitHostVerificationRequest,
  ReviewHostVerificationRequest,
  AddHostStaffRequest,
  UpdateHostStaffRequest,
  HostBusiness,
  HostVerification,
  HostVerificationQueueResponse,
  HostStaffMemberDetail,
  CreateLocationRequest,
  UpdateLocationRequest,
  ReviewLocationRequest,
  StorageLocation,
  PublicStorageLocationDetail,
  LocationModerationQueueResponse,
  OpeningHourItemInput,
  OpeningHours,
  CreateOpeningHoursExceptionRequest,
  OpeningHoursException,
  CreateStorageZoneRequest,
  UpdateStorageZoneRequest,
  StorageZone,
  AddLocationMediaRequest,
  UpdateLocationMediaRequest,
  LocationMedia,
  CreateCapacityPoolRequest,
  UpdateCapacityPoolRequest,
  StorageCapacityPool,
  ConfigurePricingPolicyRequest,
  PricingPolicy,
  InitiateUploadRequest,
  InitiateUploadResponse,
  ConfirmUploadRequest,
  ConfirmUploadResponse,
  SearchLocationsQueryInput,
  SearchLocationsResponse,
  AvailabilitySearchQuery,
  BookingQuoteRequest,
  BookingQuoteResponse,
  CreateBookingRequest,
  BookingDetail,
  BookingListQuery,
  CancelBookingRequest,
  HostDecisionBookingRequest,
  HostRejectBookingRequest,
  RecordBookingExceptionRequest,
  IssueCustodyPassRequest,
  CustodyPassResponse,
  VerifyCustodyPassRequest,
  VerifyCustodyPassResponse,
  CompleteCheckInRequest,
  CompleteCollectionRequest,
  CustodyRecordDetail,
  CreatePaymentIntentRequest,
  CheckoutStatusQuery,
  CheckoutStatusResponse,
  PaymentIntent,
  SandboxSimulatePaymentRequest,
  PaymentTransactionRecord,
  RefundRecord,
  AdminRefundListQuery,
  AdminTransitionRefundRequest,
  HostFinanceSummaryResponse,
  AdminLedgerQuery,
  AdminLedgerResponse,
  AdminMetricsSummary,
  AdminHostListQuery,
  AdminHostDirectoryItem,
  AdminHostDirectoryDetail,
  AdminSuspendHostBusinessRequest,
  AdminReinstateHostBusinessRequest,
  HostVerificationQueueQuery,
  LocationModerationQueueQuery,
  ResolveBookingDisputeRequest,
  EligibleHostPayablesGroup,
  CreatePayoutBatchRequest,
  DisbursePayoutBatchRequest,
  PayoutBatchSummary,
  PayoutBatchDetail,
  AdminPayoutBatchQuery,
  CreateSupportTicketRequest,
  SupportTicketCreatedResponse,
  SupportTicketSummary,
  SupportTicketCustomerDetail,
  SupportTicketAdminDetail,
  SupportTicketReplyRequest,
  CustomerSupportTicketReplyRequest,
  AdminUpdateSupportTicketRequest,
  AdminSupportTicketQuery,
  PaginatedApiResponse,
  PaginationMeta,
  RouteRequest,
  RouteResult,
  GeocodingQuery,
  GeocodingResponse,
  ReverseGeocodingQuery,
  GeocodingResult
} from "@luggage-storage/contracts";
import { ApiClientError, fetchApi } from "../lib/api-client";

function buildDefaultPagination(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

export interface HostBusinessPayoutDetails {
  payoutBankName: string | null;
  payoutAccountNumber: string | null;
  payoutAccountNumberMasked: string | null;
  payoutAccountName: string | null;
  payoutBranchCode: string | null;
}

export const marketplaceApi = {
  // ==========================================================================
  // 1. Host Businesses & KYC
  // ==========================================================================

  async createBusiness(data: CreateHostBusinessRequest): Promise<HostBusiness> {
    const res = await fetchApi<HostBusiness>("/hosts/businesses", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getOwnedBusinesses(): Promise<HostBusiness[]> {
    const res = await fetchApi<{ businesses: HostBusiness[] }>("/hosts/businesses", {
      method: "GET"
    });
    return res.data.businesses;
  },

  async getBusinessById(businessId: string): Promise<HostBusiness> {
    const res = await fetchApi<HostBusiness>(`/hosts/businesses/${businessId}`, {
      method: "GET"
    });
    return res.data;
  },

  async updateBusiness(businessId: string, data: UpdateHostBusinessRequest): Promise<HostBusiness> {
    const res = await fetchApi<HostBusiness>(`/hosts/businesses/${businessId}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async submitVerification(
    businessId: string,
    data: SubmitHostVerificationRequest
  ): Promise<HostVerification> {
    const res = await fetchApi<HostVerification>(`/hosts/businesses/${businessId}/verification`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getVerification(businessId: string): Promise<HostVerification | null> {
    const res = await fetchApi<HostVerification | null>(`/hosts/businesses/${businessId}/verification`, {
      method: "GET"
    });
    return res.data;
  },

  async getPayoutDetails(businessId: string): Promise<HostBusinessPayoutDetails> {
    const res = await fetchApi<HostBusinessPayoutDetails>(
      `/hosts/businesses/${businessId}/payout-details`,
      { method: "GET" }
    );
    return res.data;
  },

  async getBusinessStaff(businessId: string): Promise<HostStaffMemberDetail[]> {
    const res = await fetchApi<{ staff: HostStaffMemberDetail[] }>(
      `/hosts/businesses/${businessId}/staff`,
      { method: "GET" }
    );
    return res.data.staff;
  },

  async addBusinessStaff(
    businessId: string,
    data: AddHostStaffRequest
  ): Promise<HostStaffMemberDetail> {
    const res = await fetchApi<{ staffMember: HostStaffMemberDetail }>(
      `/hosts/businesses/${businessId}/staff`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
    return res.data.staffMember;
  },

  async updateBusinessStaff(
    businessId: string,
    membershipId: string,
    data: UpdateHostStaffRequest
  ): Promise<HostStaffMemberDetail> {
    const res = await fetchApi<{ staffMember: HostStaffMemberDetail }>(
      `/hosts/businesses/${businessId}/staff/${membershipId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data)
      }
    );
    return res.data.staffMember;
  },

  async removeBusinessStaff(
    businessId: string,
    membershipId: string
  ): Promise<{ removed: boolean; membershipId: string }> {
    const res = await fetchApi<{ removed: boolean; membershipId: string }>(
      `/hosts/businesses/${businessId}/staff/${membershipId}`,
      { method: "DELETE" }
    );
    return res.data;
  },

  // ==========================================================================
  // 2. Superadmin Host Verification Queue
  // ==========================================================================

  async getPendingVerifications(
    pageOrQuery: number | Partial<HostVerificationQueueQuery> = 1,
    limit = 20
  ): Promise<HostVerificationQueueResponse> {
    const params: Partial<HostVerificationQueueQuery> =
      typeof pageOrQuery === "number" ? { page: pageOrQuery, limit } : pageOrQuery;
    const search = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20)
    });
    if (params.status) search.set("status", params.status);
    const res = await fetchApi<HostVerificationQueueResponse>(
      `/admin/verifications?${search.toString()}`,
      { method: "GET" }
    );
    return res.data;
  },

  async getVerificationDetails(verificationId: string): Promise<HostVerification> {
    const res = await fetchApi<HostVerification>(`/admin/verifications/${verificationId}`, {
      method: "GET"
    });
    return res.data;
  },

  async reviewVerification(
    verificationId: string,
    data: ReviewHostVerificationRequest
  ): Promise<HostVerification> {
    const res = await fetchApi<HostVerification>(`/admin/verifications/${verificationId}/review`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  // ==========================================================================
  // 3. Storage Location Management
  // ==========================================================================

  async createLocation(data: CreateLocationRequest): Promise<StorageLocation> {
    const res = await fetchApi<StorageLocation>("/hosts/locations", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getOwnedLocations(): Promise<StorageLocation[]> {
    const res = await fetchApi<{ locations: StorageLocation[] }>("/hosts/locations", {
      method: "GET"
    });
    return res.data.locations;
  },

  async getLocationById(locationId: string): Promise<StorageLocation> {
    const res = await fetchApi<StorageLocation>(`/hosts/locations/${locationId}`, {
      method: "GET"
    });
    return res.data;
  },

  async updateLocation(locationId: string, data: UpdateLocationRequest): Promise<StorageLocation> {
    const res = await fetchApi<StorageLocation>(`/hosts/locations/${locationId}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async submitLocationForReview(locationId: string): Promise<StorageLocation> {
    const res = await fetchApi<StorageLocation>(`/hosts/locations/${locationId}/submit`, {
      method: "POST"
    });
    return res.data;
  },

  async disableLocation(locationId: string): Promise<StorageLocation> {
    const res = await fetchApi<StorageLocation>(`/hosts/locations/${locationId}/disable`, {
      method: "POST"
    });
    return res.data;
  },

  async getOpeningHours(locationId: string): Promise<OpeningHours[]> {
    const res = await fetchApi<{ schedules: OpeningHours[] }>(
      `/hosts/locations/${locationId}/opening-hours`,
      { method: "GET" }
    );
    return res.data.schedules;
  },

  async setOpeningHours(
    locationId: string,
    schedules: OpeningHourItemInput[]
  ): Promise<{ success: boolean }> {
    const res = await fetchApi<{ success: boolean }>(`/hosts/locations/${locationId}/opening-hours`, {
      method: "PUT",
      body: JSON.stringify({ schedules })
    });
    return res.data;
  },

  async getOpeningHoursExceptions(locationId: string): Promise<OpeningHoursException[]> {
    const res = await fetchApi<{ exceptions: OpeningHoursException[] }>(
      `/hosts/locations/${locationId}/exceptions`,
      { method: "GET" }
    );
    return res.data.exceptions;
  },

  async addOpeningHoursException(
    locationId: string,
    data: CreateOpeningHoursExceptionRequest
  ): Promise<{ success: boolean; exception?: OpeningHoursException }> {
    const res = await fetchApi<{ success: boolean; exception?: OpeningHoursException }>(
      `/hosts/locations/${locationId}/exceptions`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
    return res.data;
  },

  async deleteOpeningHoursException(
    locationId: string,
    exceptionId: string
  ): Promise<{ removed: boolean; exceptionId: string }> {
    const res = await fetchApi<{ removed: boolean; exceptionId: string }>(
      `/hosts/locations/${locationId}/exceptions/${exceptionId}`,
      { method: "DELETE" }
    );
    return res.data;
  },

  async getStorageZones(locationId: string): Promise<StorageZone[]> {
    const res = await fetchApi<{ zones: StorageZone[] }>(
      `/hosts/locations/${locationId}/zones`,
      { method: "GET" }
    );
    return res.data.zones;
  },

  async createStorageZone(
    locationId: string,
    data: CreateStorageZoneRequest
  ): Promise<StorageZone> {
    const res = await fetchApi<StorageZone>(`/hosts/locations/${locationId}/zones`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async updateStorageZone(
    locationId: string,
    zoneId: string,
    data: UpdateStorageZoneRequest
  ): Promise<StorageZone> {
    const res = await fetchApi<StorageZone>(`/hosts/locations/${locationId}/zones/${zoneId}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async deleteStorageZone(
    locationId: string,
    zoneId: string
  ): Promise<{ removed: boolean; zoneId: string }> {
    const res = await fetchApi<{ removed: boolean; zoneId: string }>(
      `/hosts/locations/${locationId}/zones/${zoneId}`,
      { method: "DELETE" }
    );
    return res.data;
  },

  async getLocationMedia(locationId: string): Promise<LocationMedia[]> {
    const res = await fetchApi<{ media: LocationMedia[] }>(
      `/hosts/locations/${locationId}/media`,
      { method: "GET" }
    );
    return res.data.media;
  },

  async addLocationMedia(
    locationId: string,
    data: AddLocationMediaRequest
  ): Promise<LocationMedia> {
    const res = await fetchApi<LocationMedia>(`/hosts/locations/${locationId}/media`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async updateLocationMedia(
    locationId: string,
    mediaId: string,
    data: UpdateLocationMediaRequest
  ): Promise<LocationMedia> {
    const res = await fetchApi<LocationMedia>(`/hosts/locations/${locationId}/media/${mediaId}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async deleteLocationMedia(
    locationId: string,
    mediaId: string
  ): Promise<{ removed: boolean; mediaId: string }> {
    const res = await fetchApi<{ removed: boolean; mediaId: string }>(
      `/hosts/locations/${locationId}/media/${mediaId}`,
      { method: "DELETE" }
    );
    return res.data;
  },

  // ==========================================================================
  // 4. Capacity Pools & Zones
  // ==========================================================================

  async getCapacityPools(locationId: string): Promise<StorageCapacityPool[]> {
    const res = await fetchApi<{ pools: StorageCapacityPool[] }>(
      `/hosts/locations/${locationId}/capacity-pools`,
      { method: "GET" }
    );
    return res.data.pools;
  },

  async createCapacityPool(
    locationId: string,
    data: CreateCapacityPoolRequest
  ): Promise<StorageCapacityPool> {
    const res = await fetchApi<StorageCapacityPool>(
      `/hosts/locations/${locationId}/capacity-pools`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
    return res.data;
  },

  async updateCapacityPool(
    poolId: string,
    data: UpdateCapacityPoolRequest
  ): Promise<StorageCapacityPool> {
    const res = await fetchApi<StorageCapacityPool>(`/hosts/capacity-pools/${poolId}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async deleteCapacityPool(poolId: string): Promise<{ removed: boolean; poolId: string }> {
    const res = await fetchApi<{ removed: boolean; poolId: string }>(
      `/hosts/capacity-pools/${poolId}`,
      { method: "DELETE" }
    );
    return res.data;
  },

  // ==========================================================================
  // 5. Pricing Configuration
  // ==========================================================================

  async getPricingPolicy(locationId: string): Promise<PricingPolicy> {
    const res = await fetchApi<PricingPolicy>(`/hosts/locations/${locationId}/pricing`, {
      method: "GET"
    });
    return res.data;
  },

  async getPricingPolicyOrNull(locationId: string): Promise<PricingPolicy | null> {
    try {
      return await this.getPricingPolicy(locationId);
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  },

  async configurePricingPolicy(
    locationId: string,
    data: ConfigurePricingPolicyRequest
  ): Promise<PricingPolicy> {
    const res = await fetchApi<PricingPolicy>(`/hosts/locations/${locationId}/pricing`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  // ==========================================================================
  // 6. Superadmin Storage Location Moderation
  // ==========================================================================

  async getPendingLocationsQueue(
    pageOrQuery: number | Partial<LocationModerationQueueQuery> = 1,
    limit = 20
  ): Promise<LocationModerationQueueResponse> {
    const params: Partial<LocationModerationQueueQuery> =
      typeof pageOrQuery === "number" ? { page: pageOrQuery, limit } : pageOrQuery;
    const search = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20)
    });
    if (params.status) search.set("status", params.status);
    const res = await fetchApi<LocationModerationQueueResponse>(
      `/admin/locations/moderation-queue?${search.toString()}`,
      { method: "GET" }
    );
    return res.data;
  },

  async reviewLocation(
    locationId: string,
    data: ReviewLocationRequest
  ): Promise<StorageLocation> {
    const res = await fetchApi<StorageLocation>(`/admin/locations/${locationId}/review`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  // ==========================================================================
  // 7. Secure File Uploads
  // ==========================================================================

  async initiateUpload(data: InitiateUploadRequest): Promise<InitiateUploadResponse> {
    const res = await fetchApi<InitiateUploadResponse>("/uploads/presigned-url", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async confirmUpload(data: ConfirmUploadRequest): Promise<ConfirmUploadResponse> {
    const res = await fetchApi<ConfirmUploadResponse>("/uploads/confirm", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getDocumentDownloadUrl(
    documentId: string
  ): Promise<{
    downloadUrl: string;
    fileName: string;
    mimeType: string;
    expiresInSeconds?: number;
  }> {
    const res = await fetchApi<{
      downloadUrl: string;
      fileName: string;
      mimeType: string;
      expiresInSeconds?: number;
    }>(`/uploads/documents/${documentId}/download`, { method: "GET" });
    return res.data;
  },

  // ==========================================================================
  // 8. Public Discovery & Privacy Protected Locations
  // ==========================================================================

  async searchLocations(params: SearchLocationsQueryInput = {}): Promise<SearchLocationsResponse> {
    const query = new URLSearchParams();
    if (params.latitude !== undefined) query.set("latitude", String(params.latitude));
    if (params.longitude !== undefined) query.set("longitude", String(params.longitude));
    if (params.radiusMeters !== undefined) query.set("radiusMeters", String(params.radiusMeters));
    if (params.city) query.set("city", params.city);
    if (params.searchTerm) query.set("searchTerm", params.searchTerm);
    if (typeof params.acceptsOversized === "boolean") {
      query.set("acceptsOversized", String(params.acceptsOversized));
    }
    if (params.sortBy) query.set("sortBy", params.sortBy);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.amenities) {
      if (Array.isArray(params.amenities)) {
        params.amenities.forEach((a: string) => query.append("amenities", a));
      } else {
        query.set("amenities", String(params.amenities));
      }
    }

    const queryString = query.toString();
    const url = `/discovery/locations${queryString ? `?${queryString}` : ""}`;
    const res = await fetchApi<SearchLocationsResponse>(url, { method: "GET" });
    return res.data;
  },

  async getPublicLocationDetails(locationId: string): Promise<PublicStorageLocationDetail> {
    const res = await fetchApi<PublicStorageLocationDetail>(`/discovery/locations/${locationId}`, {
      method: "GET"
    });
    return res.data;
  },

  // ==========================================================================
  // 9. Phase B — Availability, Quotation & Traveller Bookings
  // ==========================================================================

  async searchAvailability(
    params: Partial<AvailabilitySearchQuery> & { dropOffAt: string; collectionAt: string }
  ): Promise<{ quotes: BookingQuoteResponse[] }> {
    const query = new URLSearchParams();
    query.set("dropOffAt", params.dropOffAt);
    query.set("collectionAt", params.collectionAt);
    if (params.locationId) query.set("locationId", params.locationId);
    if (params.city) query.set("city", params.city);
    if (params.smallBags !== undefined) query.set("smallBags", String(params.smallBags));
    if (params.mediumBags !== undefined) query.set("mediumBags", String(params.mediumBags));
    if (params.largeBags !== undefined) query.set("largeBags", String(params.largeBags));
    if (params.oversizedBags !== undefined) query.set("oversizedBags", String(params.oversizedBags));

    const res = await fetchApi<{ quotes: BookingQuoteResponse[] }>(
      `/availability/search?${query.toString()}`,
      { method: "GET" }
    );
    return res.data;
  },

  async quoteBooking(data: BookingQuoteRequest): Promise<BookingQuoteResponse> {
    const res = await fetchApi<BookingQuoteResponse>("/bookings/quote", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async createBooking(data: CreateBookingRequest): Promise<BookingDetail> {
    const res = await fetchApi<BookingDetail>("/bookings", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getMyBookings(params: Partial<BookingListQuery> = {}): Promise<{
    bookings: BookingDetail[];
    total: number;
    pagination?: PaginationMeta;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.search) query.set("search", params.search);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    const qs = query.toString();
    const res = (await fetchApi<BookingDetail[]>(`/bookings${qs ? `?${qs}` : ""}`, {
      method: "GET"
    })) as unknown as PaginatedApiResponse<BookingDetail>;
    const bookings = res.data ?? [];
    const total = res.pagination?.total ?? bookings.length;
    return {
      bookings,
      total,
      pagination: res.pagination ?? buildDefaultPagination(page, limit, total)
    };
  },

  async getBookingDetail(bookingId: string): Promise<BookingDetail> {
    const res = await fetchApi<BookingDetail>(`/bookings/${bookingId}`, {
      method: "GET"
    });
    return res.data;
  },

  async cancelBooking(bookingId: string, data: CancelBookingRequest): Promise<BookingDetail> {
    const res = await fetchApi<BookingDetail>(`/bookings/${bookingId}/cancel`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async reportBookingException(
    bookingId: string,
    data: RecordBookingExceptionRequest
  ): Promise<BookingDetail> {
    const res = await fetchApi<BookingDetail>(`/bookings/${bookingId}/exceptions`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async issueCustodyPass(
    bookingId: string,
    data: IssueCustodyPassRequest
  ): Promise<CustodyPassResponse> {
    const res = await fetchApi<CustodyPassResponse>(`/bookings/${bookingId}/custody-pass`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  // ==========================================================================
  // 10. Phase B — Payments & Sandbox Gateway Checkout
  // ==========================================================================

  async createPaymentIntent(data: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    const res = await fetchApi<PaymentIntent>("/payments/intents", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getCheckoutStatus(query: CheckoutStatusQuery): Promise<CheckoutStatusResponse> {
    const params = new URLSearchParams();
    if (query.bookingId) params.set("bookingId", query.bookingId);
    if (query.orderId) params.set("orderId", query.orderId);
    const res = await fetchApi<CheckoutStatusResponse>(
      `/payments/checkout-status?${params.toString()}`
    );
    return res.data;
  },

  async simulateSandboxPayment(
    intentId: string,
    data: SandboxSimulatePaymentRequest = { outcome: "SUCCEEDED" }
  ): Promise<{
    duplicate: boolean;
    outcome: string;
    bookingId?: string;
    bookingStatus?: string;
  }> {
    const res = await fetchApi<{
      duplicate: boolean;
      outcome: string;
      bookingId?: string;
      bookingStatus?: string;
    }>(`/payments/intents/${intentId}/sandbox-simulate`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  // ==========================================================================
  // 11. Phase B — Host Bookings, Counter Custody & Finance Payables
  // ==========================================================================

  async getHostBookings(params: Partial<BookingListQuery> = {}): Promise<{
    bookings: BookingDetail[];
    total: number;
    pagination?: PaginationMeta;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.locationId) query.set("locationId", params.locationId);
    if (params.businessId) query.set("businessId", params.businessId);
    if (params.search) query.set("search", params.search);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    const qs = query.toString();
    const res = (await fetchApi<BookingDetail[]>(`/hosts/bookings${qs ? `?${qs}` : ""}`, {
      method: "GET"
    })) as unknown as PaginatedApiResponse<BookingDetail>;
    const bookings = res.data ?? [];
    const total = res.pagination?.total ?? bookings.length;
    return {
      bookings,
      total,
      pagination: res.pagination ?? buildDefaultPagination(page, limit, total)
    };
  },

  async getHostBookingDetail(bookingId: string): Promise<BookingDetail> {
    const res = await fetchApi<BookingDetail>(`/hosts/bookings/${bookingId}`, {
      method: "GET"
    });
    return res.data;
  },

  async acceptHostBooking(
    bookingId: string,
    data: HostDecisionBookingRequest = {}
  ): Promise<BookingDetail> {
    const res = await fetchApi<BookingDetail>(`/hosts/bookings/${bookingId}/accept`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async rejectHostBooking(
    bookingId: string,
    data: HostRejectBookingRequest
  ): Promise<BookingDetail> {
    const res = await fetchApi<BookingDetail>(`/hosts/bookings/${bookingId}/reject`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async cancelHostBooking(bookingId: string, data: CancelBookingRequest): Promise<BookingDetail> {
    const res = await fetchApi<BookingDetail>(`/hosts/bookings/${bookingId}/cancel`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async verifyCustodyPass(data: VerifyCustodyPassRequest): Promise<VerifyCustodyPassResponse> {
    const res = await fetchApi<VerifyCustodyPassResponse>("/hosts/custody/verify", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getCustodyDetail(bookingId: string): Promise<CustodyRecordDetail> {
    const res = await fetchApi<CustodyRecordDetail>(`/hosts/custody/${bookingId}`, {
      method: "GET"
    });
    return res.data;
  },

  async getCustodyDetailOrNull(bookingId: string): Promise<CustodyRecordDetail | null> {
    try {
      return await this.getCustodyDetail(bookingId);
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  },

  async completeCheckIn(
    bookingId: string,
    data: CompleteCheckInRequest
  ): Promise<CustodyRecordDetail> {
    const res = await fetchApi<CustodyRecordDetail>(`/hosts/custody/${bookingId}/check-in`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async completeCollection(
    bookingId: string,
    data: CompleteCollectionRequest
  ): Promise<CustodyRecordDetail> {
    const res = await fetchApi<CustodyRecordDetail>(`/hosts/custody/${bookingId}/check-out`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getHostFinanceSummary(businessId?: string): Promise<HostFinanceSummaryResponse> {
    const qs = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    const res = await fetchApi<HostFinanceSummaryResponse>(`/hosts/finance/summary${qs}`, {
      method: "GET"
    });
    return res.data;
  },

  // ==========================================================================
  // 12. Phase B — Superadmin & Support Operational Governance
  // ==========================================================================

  async getAdminMetricsSummary(): Promise<AdminMetricsSummary> {
    const res = await fetchApi<AdminMetricsSummary>("/admin/metrics/summary", {
      method: "GET"
    });
    return res.data;
  },

  async getAdminHosts(params: Partial<AdminHostListQuery> = {}): Promise<{
    hosts: AdminHostDirectoryItem[];
    total: number;
    pagination: PaginationMeta;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (params.status) query.set("status", params.status);
    if (params.search) query.set("search", params.search);
    const res = (await fetchApi<AdminHostDirectoryItem[]>(
      `/admin/hosts?${query.toString()}`,
      { method: "GET" }
    )) as unknown as PaginatedApiResponse<AdminHostDirectoryItem>;
    const hosts = res.data ?? [];
    const total = res.pagination?.total ?? hosts.length;
    return {
      hosts,
      total,
      pagination: res.pagination ?? buildDefaultPagination(page, limit, total)
    };
  },

  async getAdminHostDetail(businessId: string): Promise<AdminHostDirectoryDetail> {
    const res = await fetchApi<AdminHostDirectoryDetail>(`/admin/hosts/${businessId}`, {
      method: "GET"
    });
    return res.data;
  },

  async suspendAdminHost(
    businessId: string,
    data: AdminSuspendHostBusinessRequest
  ): Promise<AdminHostDirectoryDetail> {
    const res = await fetchApi<AdminHostDirectoryDetail>(`/admin/hosts/${businessId}/suspend`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async reinstateAdminHost(
    businessId: string,
    data: AdminReinstateHostBusinessRequest = {}
  ): Promise<AdminHostDirectoryDetail> {
    const res = await fetchApi<AdminHostDirectoryDetail>(
      `/admin/hosts/${businessId}/reinstate`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
    return res.data;
  },

  async getAdminBookings(params: Partial<BookingListQuery> = {}): Promise<{
    bookings: BookingDetail[];
    total: number;
    pagination?: PaginationMeta;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.locationId) query.set("locationId", params.locationId);
    if (params.businessId) query.set("businessId", params.businessId);
    if (params.search) query.set("search", params.search);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    const qs = query.toString();
    const res = (await fetchApi<BookingDetail[]>(`/admin/bookings${qs ? `?${qs}` : ""}`, {
      method: "GET"
    })) as unknown as PaginatedApiResponse<BookingDetail>;
    const bookings = res.data ?? [];
    const total = res.pagination?.total ?? bookings.length;
    return {
      bookings,
      total,
      pagination: res.pagination ?? buildDefaultPagination(page, limit, total)
    };
  },

  async getAdminBookingDetail(bookingId: string): Promise<BookingDetail> {
    const res = await fetchApi<BookingDetail>(`/admin/bookings/${bookingId}`, {
      method: "GET"
    });
    return res.data;
  },

  async adminCancelBooking(bookingId: string, data: CancelBookingRequest): Promise<BookingDetail> {
    const res = await fetchApi<BookingDetail>(`/admin/bookings/${bookingId}/cancel`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getAdminCustodyDetail(bookingId: string): Promise<CustodyRecordDetail> {
    const res = await fetchApi<CustodyRecordDetail>(`/admin/bookings/${bookingId}/custody`, {
      method: "GET"
    });
    return res.data;
  },

  async getAdminCustodyDetailOrNull(bookingId: string): Promise<CustodyRecordDetail | null> {
    try {
      return await this.getAdminCustodyDetail(bookingId);
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  },

  async getAdminPaymentTransactions(
    page = 1,
    limit = 20,
    bookingId?: string
  ): Promise<{
    transactions: PaymentTransactionRecord[];
    total: number;
    pagination?: PaginationMeta;
  }> {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (bookingId) query.set("bookingId", bookingId);
    const res = (await fetchApi<PaymentTransactionRecord[]>(
      `/admin/payments/transactions?${query.toString()}`,
      { method: "GET" }
    )) as unknown as PaginatedApiResponse<PaymentTransactionRecord>;
    const transactions = res.data ?? [];
    const total = res.pagination?.total ?? transactions.length;
    return {
      transactions,
      total,
      pagination: res.pagination ?? buildDefaultPagination(page, limit, total)
    };
  },

  async getAdminRefunds(params: Partial<AdminRefundListQuery> = {}): Promise<{
    refunds: RefundRecord[];
    total: number;
    pagination?: PaginationMeta;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.bookingId) query.set("bookingId", params.bookingId);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    const qs = query.toString();
    const res = (await fetchApi<RefundRecord[]>(`/admin/refunds${qs ? `?${qs}` : ""}`, {
      method: "GET"
    })) as unknown as PaginatedApiResponse<RefundRecord>;
    const refunds = res.data ?? [];
    const total = res.pagination?.total ?? refunds.length;
    return {
      refunds,
      total,
      pagination: res.pagination ?? buildDefaultPagination(page, limit, total)
    };
  },

  async adminTransitionRefund(
    refundId: string,
    data: AdminTransitionRefundRequest
  ): Promise<RefundRecord> {
    const res = await fetchApi<RefundRecord>(`/admin/refunds/${refundId}/transition`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getAdminLedger(params: Partial<AdminLedgerQuery> = {}): Promise<AdminLedgerResponse> {
    const query = new URLSearchParams();
    if (params.bookingId) query.set("bookingId", params.bookingId);
    if (params.businessId) query.set("businessId", params.businessId);
    if (params.accountCode) query.set("accountCode", params.accountCode);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    const qs = query.toString();
    const res = await fetchApi<AdminLedgerResponse>(
      `/admin/finance/ledger${qs ? `?${qs}` : ""}`,
      { method: "GET" }
    );
    return res.data;
  },

  // ==========================================================================
  // 13. Initiative 6 — Dispute Adjudication, Payout Batches & Support Desk
  // ==========================================================================

  async adminResolveBookingDispute(
    bookingId: string,
    data: ResolveBookingDisputeRequest
  ): Promise<BookingDetail> {
    const res = await fetchApi<BookingDetail>(`/admin/bookings/${bookingId}/resolve-dispute`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getAdminEligiblePayables(businessId?: string): Promise<EligibleHostPayablesGroup[]> {
    const qs = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    const res = await fetchApi<{ groups: EligibleHostPayablesGroup[] }>(
      `/admin/payouts/eligible-payables${qs}`,
      { method: "GET" }
    );
    return res.data.groups;
  },

  async getAdminPayoutBatches(params: Partial<AdminPayoutBatchQuery> = {}): Promise<{
    batches: PayoutBatchSummary[];
    total: number;
    pagination: PaginationMeta;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (params.status) query.set("status", params.status);
    if (params.businessId) query.set("businessId", params.businessId);
    const res = (await fetchApi<PayoutBatchSummary[]>(
      `/admin/payouts/batches?${query.toString()}`,
      { method: "GET" }
    )) as unknown as PaginatedApiResponse<PayoutBatchSummary>;
    const batches = res.data ?? [];
    const total = res.pagination?.total ?? batches.length;
    return {
      batches,
      total,
      pagination: res.pagination ?? buildDefaultPagination(page, limit, total)
    };
  },

  async getAdminPayoutBatchDetail(batchId: string): Promise<PayoutBatchDetail> {
    const res = await fetchApi<PayoutBatchDetail>(`/admin/payouts/batches/${batchId}`, {
      method: "GET"
    });
    return res.data;
  },

  async createAdminPayoutBatch(data: CreatePayoutBatchRequest): Promise<PayoutBatchDetail> {
    const res = await fetchApi<PayoutBatchDetail>("/admin/payouts/batches", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async disburseAdminPayoutBatch(
    batchId: string,
    data: DisbursePayoutBatchRequest
  ): Promise<PayoutBatchDetail> {
    const res = await fetchApi<PayoutBatchDetail>(`/admin/payouts/batches/${batchId}/disburse`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getHostPayoutBatches(businessId?: string): Promise<PayoutBatchSummary[]> {
    const qs = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    const res = await fetchApi<{ batches: PayoutBatchSummary[] }>(
      `/hosts/finance/payout-batches${qs}`,
      { method: "GET" }
    );
    return res.data.batches;
  },

  async createSupportTicket(
    data: CreateSupportTicketRequest
  ): Promise<SupportTicketCreatedResponse> {
    const res = await fetchApi<SupportTicketCreatedResponse>("/support/tickets", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async getMySupportTickets(): Promise<SupportTicketSummary[]> {
    const res = await fetchApi<{ tickets: SupportTicketSummary[] }>("/support/tickets/me", {
      method: "GET"
    });
    return res.data.tickets;
  },

  async getMySupportTicketDetail(ticketId: string): Promise<SupportTicketCustomerDetail> {
    const res = await fetchApi<SupportTicketCustomerDetail>(
      `/support/tickets/me/${encodeURIComponent(ticketId)}`,
      { method: "GET" }
    );
    return res.data;
  },

  async replyMySupportTicket(
    ticketId: string,
    data: CustomerSupportTicketReplyRequest
  ): Promise<SupportTicketCustomerDetail> {
    const res = await fetchApi<SupportTicketCustomerDetail>(
      `/support/tickets/me/${encodeURIComponent(ticketId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
    return res.data;
  },

  async getAdminSupportTickets(params: Partial<AdminSupportTicketQuery> = {}): Promise<{
    tickets: SupportTicketSummary[];
    total: number;
    pagination: PaginationMeta;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (params.status) query.set("status", params.status);
    if (params.priority) query.set("priority", params.priority);
    if (params.category) query.set("category", params.category);
    if (params.search) query.set("search", params.search);
    const res = (await fetchApi<SupportTicketSummary[]>(
      `/admin/support/tickets?${query.toString()}`,
      { method: "GET" }
    )) as unknown as PaginatedApiResponse<SupportTicketSummary>;
    const tickets = res.data ?? [];
    const total = res.pagination?.total ?? tickets.length;
    return {
      tickets,
      total,
      pagination: res.pagination ?? buildDefaultPagination(page, limit, total)
    };
  },

  async getAdminSupportTicketDetail(ticketId: string): Promise<SupportTicketAdminDetail> {
    const res = await fetchApi<SupportTicketAdminDetail>(
      `/admin/support/tickets/${encodeURIComponent(ticketId)}`,
      { method: "GET" }
    );
    return res.data;
  },

  async replyAdminSupportTicket(
    ticketId: string,
    data: SupportTicketReplyRequest
  ): Promise<SupportTicketAdminDetail> {
    const res = await fetchApi<SupportTicketAdminDetail>(
      `/admin/support/tickets/${encodeURIComponent(ticketId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
    return res.data;
  },

  async updateAdminSupportTicket(
    ticketId: string,
    data: AdminUpdateSupportTicketRequest
  ): Promise<SupportTicketAdminDetail> {
    const res = await fetchApi<SupportTicketAdminDetail>(
      `/admin/support/tickets/${encodeURIComponent(ticketId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(data)
      }
    );
    return res.data;
  },

  async calculateRoute(data: RouteRequest): Promise<RouteResult> {
    const res = await fetchApi<RouteResult>("/maps/routes", {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async searchPlaces(query: GeocodingQuery): Promise<GeocodingResponse> {
    const params = new URLSearchParams({ query: query.query });
    if (query.limit) params.set("limit", String(query.limit));
    const res = await fetchApi<GeocodingResponse>(`/maps/geocoding?${params.toString()}`, {
      method: "GET"
    });
    return res.data;
  },

  async reverseGeocode(query: ReverseGeocodingQuery): Promise<GeocodingResult | null> {
    const params = new URLSearchParams({
      latitude: String(query.latitude),
      longitude: String(query.longitude)
    });
    const res = await fetchApi<GeocodingResult | null>(`/maps/reverse-geocoding?${params.toString()}`, {
      method: "GET"
    });
    return res.data;
  }
};

