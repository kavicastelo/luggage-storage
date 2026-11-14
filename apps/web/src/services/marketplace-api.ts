import {
  CreateHostBusinessRequest,
  UpdateHostBusinessRequest,
  SubmitHostVerificationRequest,
  ReviewHostVerificationRequest,
  HostBusiness,
  HostVerification,
  HostVerificationQueueResponse,
  CreateLocationRequest,
  UpdateLocationRequest,
  ReviewLocationRequest,
  StorageLocation,
  PublicStorageLocation,
  LocationModerationQueueResponse,
  OpeningHourItemInput,
  CreateOpeningHoursExceptionRequest,
  CreateStorageZoneRequest,
  StorageZone,
  AddLocationMediaRequest,
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
  PaginatedApiResponse
} from "@luggage-storage/contracts";
import { fetchApi } from "../lib/api-client";

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

  // ==========================================================================
  // 2. Superadmin Host Verification Queue
  // ==========================================================================

  async getPendingVerifications(page = 1, limit = 20): Promise<HostVerificationQueueResponse> {
    const res = await fetchApi<HostVerificationQueueResponse>(
      `/admin/verifications?page=${page}&limit=${limit}`,
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

  // ==========================================================================
  // 5. Pricing Configuration
  // ==========================================================================

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
  // 6. Superadmin Storage Location Moderation
  // ==========================================================================

  async getPendingLocationsQueue(page = 1, limit = 20): Promise<LocationModerationQueueResponse> {
    const res = await fetchApi<LocationModerationQueueResponse>(
      `/admin/locations/moderation-queue?page=${page}&limit=${limit}`,
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
  ): Promise<{ downloadUrl: string; expiresInSeconds: number }> {
    const res = await fetchApi<{ downloadUrl: string; expiresInSeconds: number }>(
      `/uploads/documents/${documentId}/download`,
      { method: "GET" }
    );
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
  }> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    const qs = query.toString();
    const res = (await fetchApi<BookingDetail[]>(`/bookings${qs ? `?${qs}` : ""}`, {
      method: "GET"
    })) as unknown as PaginatedApiResponse<BookingDetail>;
    return {
      bookings: res.data ?? [],
      total: res.pagination?.total ?? (res.data?.length ?? 0)
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
      total: res.pagination?.total ?? (res.data?.length ?? 0)
    };
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

  // ==========================================================================
  // 12. Phase B — Superadmin & Support Operational Governance
  // ==========================================================================

  async getAdminBookings(params: Partial<BookingListQuery> = {}): Promise<{
    bookings: BookingDetail[];
    total: number;
  }> {
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
    return {
      bookings: res.data ?? [],
      total: res.pagination?.total ?? (res.data?.length ?? 0)
    };
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

  async getAdminPaymentTransactions(
    page = 1,
    limit = 20,
    bookingId?: string
  ): Promise<{ transactions: PaymentTransactionRecord[]; total: number }> {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (bookingId) query.set("bookingId", bookingId);
    const res = (await fetchApi<PaymentTransactionRecord[]>(
      `/admin/payments/transactions?${query.toString()}`,
      { method: "GET" }
    )) as unknown as PaginatedApiResponse<PaymentTransactionRecord>;
    return {
      transactions: res.data ?? [],
      total: res.pagination?.total ?? (res.data?.length ?? 0)
    };
  },

  async getAdminRefunds(params: Partial<AdminRefundListQuery> = {}): Promise<{
    refunds: RefundRecord[];
    total: number;
  }> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.bookingId) query.set("bookingId", params.bookingId);
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    const qs = query.toString();
    const res = (await fetchApi<RefundRecord[]>(`/admin/refunds${qs ? `?${qs}` : ""}`, {
      method: "GET"
    })) as unknown as PaginatedApiResponse<RefundRecord>;
    return {
      refunds: res.data ?? [],
      total: res.pagination?.total ?? (res.data?.length ?? 0)
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
  }
};

