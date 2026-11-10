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
  ConfirmUploadResponse
} from "@luggage-storage/contracts";
import { fetchApi } from "./api-client";

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
  }
};

