import {
  CreateHostBusinessRequest,
  UpdateHostBusinessRequest,
  SubmitHostVerificationRequest,
  HostBusiness,
  HostVerification,
  CreateLocationRequest,
  UpdateLocationRequest,
  StorageLocation,
  PublicStorageLocation,
  OpeningHourItemInput,
  CreateOpeningHoursExceptionRequest,
  StorageZone,
  CreateStorageZoneRequest,
  LocationMedia,
  AddLocationMediaRequest,
  StorageCapacityPool,
  CreateCapacityPoolRequest,
  UpdateCapacityPoolRequest,
  PricingPolicy,
  ConfigurePricingPolicyRequest,
  SearchLocationsQueryInput,
  SearchLocationsResponse,
  InitiateUploadRequest,
  InitiateUploadResponse,
  ConfirmUploadRequest,
  ConfirmUploadResponse,
  BookingQuoteRequest,
  BookingQuoteResponse,
  AvailabilitySearchQuery,
  CreateBookingRequest,
  BookingDetail,
  BookingListQuery,
  CancelBookingRequest,
  RecordBookingExceptionRequest,
  HostDecisionBookingRequest,
  HostRejectBookingRequest,
  IssueCustodyPassRequest,
  CustodyPassResponse,
  VerifyCustodyPassRequest,
  CompleteCheckInRequest,
  CompleteCollectionRequest,
  CustodyRecordDetail,
  CreatePaymentIntentRequest,
  CheckoutStatusQuery,
  CheckoutStatusResponse,
  PaymentIntent,
  SandboxSimulatePaymentRequest,
  HostFinanceSummaryResponse,
  PayoutBatchSummary,
  HostStaffMemberDetail,
  AddHostStaffRequest,
  UpdateHostStaffRequest,
  CreateSupportTicketRequest,
  SupportTicketCreatedResponse,
  SupportTicketSummary,
  SupportTicketCustomerDetail,
  CustomerSupportTicketReplyRequest,
  PaginatedApiResponse,
  PaginationMeta,
  RouteRequest,
  RouteResult,
  GeocodingQuery,
  GeocodingResponse,
  ReverseGeocodingQuery,
  GeocodingResult
} from "@luggage-storage/contracts";
import { ApiClientError, fetchApi } from "./api-client";

export interface HostPayoutDetailsResponse {
  payoutBankName: string | null;
  payoutAccountNumber: string | null;
  payoutAccountNumberMasked: string | null;
  payoutAccountName: string | null;
  payoutBranchCode: string | null;
}

export const marketplaceApi = {
  // ==========================================================================
  // 1. Host Businesses & Verification
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

  async getBusinessPayoutDetails(businessId: string): Promise<HostPayoutDetailsResponse> {
    const res = await fetchApi<HostPayoutDetailsResponse>(
      `/hosts/businesses/${businessId}/payout-details`,
      { method: "GET" }
    );
    return res.data;
  },

  // ==========================================================================
  // 2. Storage Locations
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

  async addOpeningHoursException(
    locationId: string,
    data: CreateOpeningHoursExceptionRequest
  ): Promise<{ success: boolean }> {
    const res = await fetchApi<{ success: boolean }>(`/hosts/locations/${locationId}/exceptions`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
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

  // ==========================================================================
  // 3. Capacity & Pricing
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

  async getPricingPolicy(locationId: string): Promise<PricingPolicy> {
    const res = await fetchApi<PricingPolicy>(`/hosts/locations/${locationId}/pricing`, {
      method: "GET"
    });
    return res.data;
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
  // 4. File Uploads
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

  async getVerificationDocumentDownloadUrl(
    documentId: string
  ): Promise<{ downloadUrl: string; fileName: string; mimeType: string }> {
    const res = await fetchApi<{ downloadUrl: string; fileName: string; mimeType: string }>(
      `/uploads/documents/${documentId}/download`,
      { method: "GET" }
    );
    return res.data;
  },

  async uploadFileToPresignedUrl(params: {
    uploadUrl: string;
    fileUri: string;
    mimeType: string;
  }): Promise<void> {
    const localRes = await fetch(params.fileUri);
    const blob = await localRes.blob();
    const putRes = await fetch(params.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": params.mimeType
      },
      body: blob
    });
    if (!putRes.ok) {
      throw new ApiClientError("Failed to upload file to storage", putRes.status, "UPLOAD_PUT_FAILED");
    }
  },

  // ==========================================================================
  // 5. Public Discovery
  // ==========================================================================

  async searchLocations(params: SearchLocationsQueryInput = {}): Promise<SearchLocationsResponse> {
    const query = new URLSearchParams();
    if (params.latitude !== undefined) query.set("latitude", String(params.latitude));
    if (params.longitude !== undefined) query.set("longitude", String(params.longitude));
    if (params.radiusMeters !== undefined) query.set("radiusMeters", String(params.radiusMeters));
    if (params.city) query.set("city", params.city);
    if (params.searchTerm) query.set("searchTerm", params.searchTerm);
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

  async getPublicLocationDetails(locationId: string): Promise<PublicStorageLocation> {
    const res = await fetchApi<PublicStorageLocation>(`/discovery/locations/${locationId}`, {
      method: "GET"
    });
    return res.data;
  },

  async searchAvailability(
    query: AvailabilitySearchQuery
  ): Promise<{ quotes: BookingQuoteResponse[] }> {
    const params = new URLSearchParams();
    if (query.locationId) params.set("locationId", query.locationId);
    if (query.city) params.set("city", query.city);
    params.set("dropOffAt", query.dropOffAt);
    params.set("collectionAt", query.collectionAt);
    params.set("smallBags", String(query.smallBags ?? 0));
    params.set("mediumBags", String(query.mediumBags ?? 0));
    params.set("largeBags", String(query.largeBags ?? 0));
    params.set("oversizedBags", String(query.oversizedBags ?? 0));

    const res = await fetchApi<{ quotes: BookingQuoteResponse[] }>(
      `/availability/search?${params.toString()}`,
      { method: "GET" }
    );
    return res.data;
  },

  // ==========================================================================
  // 6. Phase B — Traveller Quotation, Booking, Payment & Custody Pass
  // ==========================================================================

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
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.search) query.set("search", params.search);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    const qs = query.toString();
    const res = (await fetchApi<BookingDetail[]>(`/bookings${qs ? `?${qs}` : ""}`, {
      method: "GET"
    })) as unknown as PaginatedApiResponse<BookingDetail>;
    return {
      bookings: res.data ?? [],
      total: res.pagination?.total ?? (res.data?.length ?? 0),
      pagination: res.pagination
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
  // 7. Phase B — Host Requests, Counter Custody & Owner Finance
  // ==========================================================================

  async getHostBookings(params: Partial<BookingListQuery> = {}): Promise<{
    bookings: BookingDetail[];
    total: number;
    pagination?: PaginationMeta;
  }> {
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
    return {
      bookings: res.data ?? [],
      total: res.pagination?.total ?? (res.data?.length ?? 0),
      pagination: res.pagination
    };
  },

  async getHostBookingDetail(bookingId: string): Promise<BookingDetail> {
    const res = await fetchApi<BookingDetail>(`/hosts/bookings/${bookingId}`, {
      method: "GET"
    });
    return res.data;
  },

  async hostCancelBooking(bookingId: string, data: CancelBookingRequest): Promise<BookingDetail> {
    const res = await fetchApi<BookingDetail>(`/hosts/bookings/${bookingId}/cancel`, {
      method: "POST",
      body: JSON.stringify(data)
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

  async verifyCustodyPass(data: VerifyCustodyPassRequest): Promise<{
    verified: boolean;
    bookingId: string;
    referenceCode: string;
    operation: "CHECK_IN" | "COLLECTION";
    expectedBagCount: number;
    checkedInBagCount: number | null;
    custodyStatus: string;
  }> {
    const res = await fetchApi<{
      verified: boolean;
      bookingId: string;
      referenceCode: string;
      operation: "CHECK_IN" | "COLLECTION";
      expectedBagCount: number;
      checkedInBagCount: number | null;
      custodyStatus: string;
    }>("/hosts/custody/verify", {
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

  async getHostPayoutBatches(businessId?: string): Promise<PayoutBatchSummary[]> {
    const qs = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    const res = await fetchApi<{ batches: PayoutBatchSummary[] }>(
      `/hosts/finance/payout-batches${qs}`,
      { method: "GET" }
    );
    return res.data.batches ?? [];
  },

  // ==========================================================================
  // 5. Host Staff Management & Location Schedule Exceptions
  // ==========================================================================

  async getBusinessStaff(businessId: string): Promise<HostStaffMemberDetail[]> {
    const res = await fetchApi<{ staff: HostStaffMemberDetail[] }>(
      `/hosts/businesses/${businessId}/staff`,
      { method: "GET" }
    );
    return res.data.staff ?? [];
  },

  async inviteBusinessStaff(
    businessId: string,
    data: AddHostStaffRequest
  ): Promise<HostStaffMemberDetail> {
    const res = await fetchApi<HostStaffMemberDetail>(`/hosts/businesses/${businessId}/staff`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    return res.data;
  },

  async updateBusinessStaff(
    businessId: string,
    membershipId: string,
    data: UpdateHostStaffRequest
  ): Promise<HostStaffMemberDetail> {
    const res = await fetchApi<HostStaffMemberDetail>(
      `/hosts/businesses/${businessId}/staff/${membershipId}`,
      {
        method: "PATCH",
        body: JSON.stringify(data)
      }
    );
    return res.data;
  },

  async removeBusinessStaff(businessId: string, membershipId: string): Promise<void> {
    await fetchApi<{ removed: boolean }>(
      `/hosts/businesses/${businessId}/staff/${membershipId}`,
      { method: "DELETE" }
    );
  },

  async deleteOpeningHoursException(locationId: string, exceptionId: string): Promise<void> {
    await fetchApi<{ deleted: boolean }>(
      `/hosts/locations/${locationId}/exceptions/${exceptionId}`,
      { method: "DELETE" }
    );
  },

  // ==========================================================================
  // 6. Customer Support Tickets
  // ==========================================================================

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
    return res.data.tickets ?? [];
  },

  async getMySupportTicketDetail(ticketId: string): Promise<SupportTicketCustomerDetail> {
    const res = await fetchApi<SupportTicketCustomerDetail>(`/support/tickets/me/${ticketId}`, {
      method: "GET"
    });
    return res.data;
  },

  async replyMySupportTicket(
    ticketId: string,
    data: CustomerSupportTicketReplyRequest
  ): Promise<SupportTicketCustomerDetail> {
    const res = await fetchApi<SupportTicketCustomerDetail>(
      `/support/tickets/me/${ticketId}/messages`,
      {
        method: "POST",
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

