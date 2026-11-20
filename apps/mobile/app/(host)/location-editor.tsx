import React, { useEffect, useState } from "react";
import { View, Text, Switch, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  DEFAULT_CATEGORY_MULTIPLIERS_BPS,
  LOCATION_AMENITIES,
  PRICING_UNITS,
  STORAGE_ZONE_TYPES,
  formatCurrencyMinorUnits,
  type BagCategory,
  type LocationAmenity,
  type OpeningHourItemInput,
  type PricingUnit,
  type StorageZoneType
} from "@luggage-storage/contracts";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormSection,
  ImageGallery,
  InteractiveMobileMap,
  LoadingSkeleton,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  SelectionCard,
  StatusBadge,
  TextInput
} from "../../src/components";
import {
  useAddOpeningHoursExceptionMutation,
  useCapacityPoolsQuery,
  useConfigurePricingPolicyMutation,
  useCreateCapacityPoolMutation,
  useCreateLocationMutation,
  useCreateStorageZoneMutation,
  useDeleteOpeningHoursExceptionMutation,
  useDisableLocationMutation,
  useHostLocationDetailQuery,
  useOwnedBusinessesQuery,
  usePricingPolicyQuery,
  useSetOpeningHoursMutation,
  useSubmitLocationForReviewMutation,
  useUpdateCapacityPoolMutation,
  useUpdateLocationMutation
} from "../../src/hooks";
import { getCurrentDeviceLocation } from "../../src/lib/geolocation";
import { normalizeApiError } from "../../src/services/api-client";
import { marketplaceApi } from "../../src/services/marketplace-api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type EditorSectionTab = "PROFILE" | "PHOTOS" | "HOURS" | "ZONES" | "PRICING";
const EDITOR_TABS: ReadonlyArray<{ key: EditorSectionTab; label: string }> = [
  { key: "PROFILE", label: "Profile" },
  { key: "PHOTOS", label: "Photos" },
  { key: "HOURS", label: "Hours" },
  { key: "ZONES", label: "Zones & Pools" },
  { key: "PRICING", label: "Pricing & Publish" }
];
const DAY_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday"
};

function defaultWeeklyHours(): OpeningHourItemInput[] {
  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
    dayOfWeek,
    openTime: "08:00",
    closeTime: "21:00",
    allowsDropoff: true,
    allowsCollection: true,
    isClosed: false
  }));
}

export default function HostLocationEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const initialId =
    typeof params.id === "string" && UUID_REGEX.test(params.id) ? params.id : undefined;

  const [locationId, setLocationId] = useState<string | undefined>(initialId);
  const [activeTab, setActiveTab] = useState<EditorSectionTab>("PROFILE");

  const businessesQuery = useOwnedBusinessesQuery(true);
  const locationQuery = useHostLocationDetailQuery(locationId);
  const poolsQuery = useCapacityPoolsQuery(locationId);
  const pricingQuery = usePricingPolicyQuery(locationId);

  const createLocationMutation = useCreateLocationMutation();
  const updateLocationMutation = useUpdateLocationMutation();
  const setHoursMutation = useSetOpeningHoursMutation();
  const addExceptionMutation = useAddOpeningHoursExceptionMutation();
  const deleteExceptionMutation = useDeleteOpeningHoursExceptionMutation();
  const createZoneMutation = useCreateStorageZoneMutation();
  const createPoolMutation = useCreateCapacityPoolMutation();
  const updatePoolMutation = useUpdateCapacityPoolMutation();
  const configurePricingMutation = useConfigurePricingPolicyMutation();
  const submitReviewMutation = useSubmitLocationForReviewMutation();
  const disableMutation = useDisableLocationMutation();

  const businesses = businessesQuery.data ?? [];
  const existing = locationQuery.data;

  const [businessId, setBusinessId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("Colombo");
  const [postalCode, setPostalCode] = useState("");
  const [latitudeText, setLatitudeText] = useState("6.9344");
  const [longitudeText, setLongitudeText] = useState("79.8500");
  const [bookingMode, setBookingMode] = useState<"INSTANT" | "HOST_APPROVAL">("INSTANT");
  const [acceptsOversized, setAcceptsOversized] = useState(true);
  const [selectedAmenities, setSelectedAmenities] = useState<LocationAmenity[]>(["CCTV"]);

  const [weeklyHours, setWeeklyHours] = useState<OpeningHourItemInput[]>(defaultWeeklyHours);
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionType, setExceptionType] = useState<"CLOSURE" | "SPECIAL_HOURS">("CLOSURE");
  const [exceptionReason, setExceptionReason] = useState("");

  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneType, setNewZoneType] = useState<StorageZoneType>("LOCKER");

  const [newPoolUnits, setNewPoolUnits] = useState("25");
  const [newPoolType, setNewPoolType] = useState<"SHARED" | "DEDICATED">("SHARED");
  const [newPoolZoneId, setNewPoolZoneId] = useState<string>("");

  const [pricingUnit, setPricingUnit] = useState<PricingUnit>("CALENDAR_DAY");
  const [baseRateRupees, setBaseRateRupees] = useState("1200");

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId && businesses[0]?.id) {
      setBusinessId(businesses[0].id);
    }
  }, [businesses, businessId]);

  useEffect(() => {
    if (existing) {
      setBusinessId(existing.businessId);
      setName(existing.name);
      setDescription(existing.description ?? "");
      setAddressLine1(existing.addressLine1);
      setAddressLine2(existing.addressLine2 ?? "");
      setCity(existing.city);
      setPostalCode(existing.postalCode ?? "");
      setLatitudeText(String(existing.latitude));
      setLongitudeText(String(existing.longitude));
      setBookingMode(existing.bookingMode);
      setAcceptsOversized(existing.acceptsOversized);
      setSelectedAmenities((existing.amenities ?? []) as LocationAmenity[]);

      if (existing.openingHours && existing.openingHours.length > 0) {
        const merged = defaultWeeklyHours().map((def) => {
          const found = existing.openingHours?.find((item) => item.dayOfWeek === def.dayOfWeek);
          return found
            ? {
                dayOfWeek: found.dayOfWeek,
                openTime: found.openTime.slice(0, 5),
                closeTime: found.closeTime.slice(0, 5),
                allowsDropoff: found.allowsDropoff,
                allowsCollection: found.allowsCollection,
                isClosed: found.isClosed
              }
            : def;
        });
        setWeeklyHours(merged);
      }

      if (existing.zones?.[0]?.id && !newPoolZoneId) {
        setNewPoolZoneId(existing.zones[0].id);
      }
    }
  }, [existing, newPoolZoneId]);

  useEffect(() => {
    if (pricingQuery.data) {
      setPricingUnit(pricingQuery.data.pricingUnit);
      setBaseRateRupees(String(Math.round(pricingQuery.data.baseRateMinor / 100)));
    }
  }, [pricingQuery.data]);

  const clearFeedback = () => {
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const handleUseDeviceGps = async () => {
    clearFeedback();
    const res = await getCurrentDeviceLocation();
    if (!res.ok) {
      setErrorMessage(res.reason);
      return;
    }
    setLatitudeText(res.latitude.toFixed(6));
    setLongitudeText(res.longitude.toFixed(6));
    setStatusMessage("Updated coordinates from device GPS.");
  };

  const toggleAmenity = (amenity: LocationAmenity) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((item) => item !== amenity) : [...prev, amenity]
    );
  };

  const handleSaveProfile = async () => {
    clearFeedback();
    const lat = Number(latitudeText);
    const lng = Number(longitudeText);

    if (!businessId) {
      setErrorMessage("Register your host business first.");
      return;
    }
    if (name.trim().length < 2 || addressLine1.trim().length < 3 || city.trim().length < 2) {
      setErrorMessage("Enter hub name, street address, and city.");
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setErrorMessage("Enter valid latitude and longitude numbers.");
      return;
    }

    try {
      if (locationId) {
        await updateLocationMutation.mutateAsync({
          locationId,
          data: {
            name: name.trim(),
            description: description.trim() || null,
            addressLine1: addressLine1.trim(),
            addressLine2: addressLine2.trim() || null,
            city: city.trim(),
            postalCode: postalCode.trim() || null,
            countryCode: "LK",
            latitude: lat,
            longitude: lng,
            timezone: "Asia/Colombo",
            bookingMode,
            acceptsOversized,
            amenities: selectedAmenities
          }
        });
        setStatusMessage("Storage hub profile saved.");
      } else {
        const created = await createLocationMutation.mutateAsync({
          businessId,
          name: name.trim(),
          description: description.trim() || undefined,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          postalCode: postalCode.trim() || undefined,
          countryCode: "LK",
          latitude: lat,
          longitude: lng,
          timezone: "Asia/Colombo",
          bookingMode,
          acceptsOversized,
          amenities: selectedAmenities
        });
        setLocationId(created.id);
        setStatusMessage("Storage hub created. Complete photos, hours, capacity, and pricing below.");
      }
    } catch (err) {
      setErrorMessage(normalizeApiError(err).message);
    }
  };

  const handleUploadLocationPhoto = async () => {
    if (!locationId) {
      return;
    }
    clearFeedback();
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85
      });
      if (res.canceled || !res.assets?.[0]) {
        return;
      }
      const asset = res.assets[0];
      const mimeType = asset.mimeType && asset.mimeType.startsWith("image/") ? asset.mimeType : "image/jpeg";
      setIsUploadingPhoto(true);

      const intent = await marketplaceApi.initiateUpload({
        purpose: "LOCATION_IMAGE",
        resourceType: "STORAGE_LOCATION",
        resourceId: locationId,
        fileName: asset.fileName || `hub-${Date.now()}.jpg`,
        fileSize: Math.max(1024, Math.round(asset.fileSize ?? 204800)),
        mimeType
      });

      await marketplaceApi.uploadFileToPresignedUrl({
        uploadUrl: intent.uploadUrl,
        fileUri: asset.uri,
        mimeType
      });

      await marketplaceApi.confirmUpload({
        intentId: intent.intentId,
        fileKey: intent.fileKey,
        purpose: "LOCATION_IMAGE",
        resourceId: locationId,
        isPrimary: (existing?.images?.length ?? 0) === 0
      });

      await locationQuery.refetch();
      setStatusMessage("Hub photo uploaded and linked.");
    } catch (err) {
      setErrorMessage(normalizeApiError(err).message);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveHours = async () => {
    if (!locationId) {
      return;
    }
    clearFeedback();
    try {
      await setHoursMutation.mutateAsync({
        locationId,
        schedules: weeklyHours
      });
      setStatusMessage("7-day operating schedule saved.");
    } catch (err) {
      setErrorMessage(normalizeApiError(err).message);
    }
  };

  const handleAddException = async () => {
    if (!locationId) {
      return;
    }
    clearFeedback();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exceptionDate.trim())) {
      setErrorMessage("Exception date must follow YYYY-MM-DD (e.g. 2026-05-01).");
      return;
    }
    try {
      await addExceptionMutation.mutateAsync({
        locationId,
        data: {
          exceptionDate: exceptionDate.trim(),
          exceptionType,
          openTime: exceptionType === "SPECIAL_HOURS" ? "09:00" : undefined,
          closeTime: exceptionType === "SPECIAL_HOURS" ? "17:00" : undefined,
          reason: exceptionReason.trim() || undefined
        }
      });
      setExceptionDate("");
      setExceptionReason("");
      setStatusMessage("Special closure / holiday exception added.");
    } catch (err) {
      setErrorMessage(normalizeApiError(err).message);
    }
  };

  const handleCreateZone = async () => {
    if (!locationId) {
      return;
    }
    clearFeedback();
    if (newZoneName.trim().length < 2) {
      setErrorMessage("Enter a storage zone name (e.g. Reception Locker A).");
      return;
    }
    try {
      await createZoneMutation.mutateAsync({
        locationId,
        data: {
          name: newZoneName.trim(),
          zoneType: newZoneType,
          securityTier: "STANDARD",
          isActive: true
        }
      });
      setNewZoneName("");
      setStatusMessage("Storage zone created.");
    } catch (err) {
      setErrorMessage(normalizeApiError(err).message);
    }
  };

  const handleCreatePool = async () => {
    if (!locationId) {
      return;
    }
    clearFeedback();
    const totalUnits = Number(newPoolUnits);
    if (!Number.isInteger(totalUnits) || totalUnits < 1) {
      setErrorMessage("Capacity pool total units must be a positive whole number.");
      return;
    }
    try {
      await createPoolMutation.mutateAsync({
        locationId,
        data: {
          zoneId: newPoolZoneId || undefined,
          poolType: newPoolType,
          dedicatedBagCategory: newPoolType === "DEDICATED" ? "BAG_MEDIUM" : undefined,
          totalUnits,
          isActive: true
        }
      });
      setStatusMessage("Capacity pool created.");
    } catch (err) {
      setErrorMessage(normalizeApiError(err).message);
    }
  };

  const handleSavePricing = async () => {
    if (!locationId) {
      return;
    }
    clearFeedback();
    const rupees = Number(baseRateRupees);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setErrorMessage("Enter a valid positive base rate in LKR.");
      return;
    }
    const baseRateMinor = Math.round(rupees * 100);
    const categories: BagCategory[] = ["BAG_SMALL", "BAG_MEDIUM", "BAG_LARGE", "BAG_OVERSIZED"];
    const tierRates = categories.map((bagCategory) => {
      const bps = DEFAULT_CATEGORY_MULTIPLIERS_BPS[bagCategory];
      return {
        bagCategory,
        rateMinor: Math.round((baseRateMinor * bps) / 10000),
        categoryMultiplierBps: bps
      };
    });

    try {
      await configurePricingMutation.mutateAsync({
        locationId,
        data: {
          currency: "LKR",
          pricingUnit,
          baseRateMinor,
          tierRates
        }
      });
      setStatusMessage(
        `Saved LKR pricing policy (${formatCurrencyMinorUnits(baseRateMinor, "LKR")} base rate).`
      );
    } catch (err) {
      setErrorMessage(normalizeApiError(err).message);
    }
  };

  const handleSubmitReview = async () => {
    if (!locationId) {
      return;
    }
    clearFeedback();
    try {
      await submitReviewMutation.mutateAsync(locationId);
      setStatusMessage("Submitted storage hub to platform moderation review.");
    } catch (err) {
      setErrorMessage(normalizeApiError(err).message);
    }
  };

  const handleDisableLocation = async () => {
    if (!locationId) {
      return;
    }
    setConfirmDisableOpen(false);
    clearFeedback();
    try {
      await disableMutation.mutateAsync(locationId);
      setStatusMessage("Storage hub disabled from public discovery.");
    } catch (err) {
      setErrorMessage(normalizeApiError(err).message);
    }
  };

  const pools = poolsQuery.data ?? [];
  const zones = existing?.zones ?? [];

  if (!businessesQuery.isLoading && businesses.length === 0) {
    return (
      <ScreenContainer
        header={<SafeHeader title="Hub Configuration" onBack={() => router.replace("/(host)/locations")} />}
        testID="host-location-no-business"
      >
        <EmptyState
          mascot="thinking"
          title="Register Your Business First"
          description="Complete partner business onboarding before creating and publishing a storage hub."
          actionTitle="Go to Partner Onboarding"
          onAction={() => router.replace("/(host)/onboarding")}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      keyboardAvoiding
      header={
        <SafeHeader
          title={existing ? existing.name : "Create Storage Hub"}
          subtitle={existing ? `${existing.city} • ${existing.status}` : "Sri Lanka Location Setup"}
          onBack={() => router.replace("/(host)/locations")}
        />
      }
      testID="host-location-editor-screen"
    >
      {initialId && locationQuery.isLoading ? (
        <LoadingSkeleton count={3} />
      ) : (
        <View style={styles.stack}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sectionTabsRow}
            accessibilityRole="tablist"
          >
            {EDITOR_TABS.map((tab) => {
              const selected = activeTab === tab.key;
              const disabled = !locationId && tab.key !== "PROFILE";
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.sectionTabBtn,
                    selected ? styles.sectionTabBtnActive : null,
                    disabled ? styles.sectionTabBtnDisabled : null
                  ]}
                  disabled={disabled}
                  onPress={() => setActiveTab(tab.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected, disabled }}
                >
                  <Text
                    style={[
                      styles.sectionTabText,
                      selected ? styles.sectionTabTextActive : null
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {errorMessage ? <ErrorState title="Configuration Notice" message={errorMessage} /> : null}
          {statusMessage ? (
            <View style={styles.successBanner} accessibilityRole="alert">
              <MobileIcon
                name="check-circle"
                size={16}
                color={mobileStatusTokens.successIcon}
              />
              <Text style={styles.successBannerText}>{statusMessage}</Text>
            </View>
          ) : null}

          {activeTab === "PROFILE" ? (
            <FormSection
              title="1. Hub Profile & Coordinates"
              subtitle="Exact street address and coordinates stay hidden from travellers until booking confirmation."
            >
              {existing ? <StatusBadge status={existing.status} size="sm" /> : null}

              <TextInput
                label="Hub Display Name"
                required
                value={name}
                onChangeText={setName}
                placeholder="Colombo Fort Express Vault"
              />
              <TextInput
                label="Counter Arrival & Safety Description"
                value={description}
                onChangeText={setDescription}
                placeholder="Ground-floor hotel reception opposite main rail exit."
              />
              <TextInput
                label="Street Address Line 1"
                required
                value={addressLine1}
                onChangeText={setAddressLine1}
                placeholder="45 Olcott Mawatha"
              />
              <TextInput
                label="Address Line 2 (Optional)"
                value={addressLine2}
                onChangeText={setAddressLine2}
              />
              <TextInput label="City" required value={city} onChangeText={setCity} />
              <TextInput label="Postal Code" value={postalCode} onChangeText={setPostalCode} />

              <View style={styles.rowTwo}>
                <TextInput
                  label="Latitude"
                  required
                  value={latitudeText}
                  onChangeText={setLatitudeText}
                  containerStyle={styles.flexField}
                />
                <TextInput
                  label="Longitude"
                  required
                  value={longitudeText}
                  onChangeText={setLongitudeText}
                  containerStyle={styles.flexField}
                />
              </View>
              <Button
                title="Use Device GPS Coordinates"
                variant="outline"
                size="sm"
                leftIcon={<MobileIcon name="map-pin" size={16} color={mobileColors.navy[900]} />}
                onPress={() => {
                  void handleUseDeviceGps();
                }}
              />

              {Number.isFinite(Number(latitudeText)) && Number.isFinite(Number(longitudeText)) && (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>Pin Location Preview</Text>
                  <InteractiveMobileMap
                    locations={[
                      {
                        id: "host-facility-preview",
                        name: name.trim() || "Storage Facility",
                        city: city.trim() || "Sri Lanka",
                        latitude: Number(latitudeText),
                        longitude: Number(longitudeText)
                      }
                    ]}
                    selectedLocationId="host-facility-preview"
                    height={160}
                    showControls={false}
                  />
                </View>
              )}

              <Text style={styles.fieldLabel}>Booking Acceptance Mode</Text>
              <SelectionCard
                title="Instant Confirmation"
                subtitle="Travellers proceed immediately to PayHere LKR checkout."
                selected={bookingMode === "INSTANT"}
                onPress={() => setBookingMode("INSTANT")}
              />
              <SelectionCard
                title="Host Approval Required"
                subtitle="You review and approve incoming requests before payment."
                selected={bookingMode === "HOST_APPROVAL"}
                onPress={() => setBookingMode("HOST_APPROVAL")}
              />

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Accepts Oversized Luggage</Text>
                <Switch value={acceptsOversized} onValueChange={setAcceptsOversized} />
              </View>

              <Text style={styles.fieldLabel}>Facility Amenities</Text>
              <View style={styles.chipsWrap}>
                {LOCATION_AMENITIES.map((amenity) => {
                  const selected = selectedAmenities.includes(amenity);
                  return (
                    <TouchableOpacity
                      key={amenity}
                      style={[styles.pillChip, selected ? styles.pillChipActive : null]}
                      onPress={() => toggleAmenity(amenity)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                    >
                      <Text
                        style={[
                          styles.pillChipText,
                          selected ? styles.pillChipTextActive : null
                        ]}
                      >
                        {amenity.replace(/_/g, " ")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Button
                title={locationId ? "Save Hub Profile" : "Create Storage Hub"}
                isLoading={createLocationMutation.isPending || updateLocationMutation.isPending}
                onPress={() => {
                  void handleSaveProfile();
                }}
              />
            </FormSection>
          ) : null}

          {locationId && activeTab === "PHOTOS" ? (
            <FormSection
              title="2. Facility Photos"
              subtitle="Upload entrance and counter photos (minimum 1 photo required for review)."
            >
              <ImageGallery
                images={(existing?.images ?? []).map((img) => ({
                  id: img.id,
                  url: img.url,
                  caption: img.caption,
                  isPrimary: img.isPrimary
                }))}
              />
              <Button
                title="Add Facility Photo"
                variant="outline"
                leftIcon={<MobileIcon name="camera" size={16} color={mobileColors.navy[900]} />}
                isLoading={isUploadingPhoto}
                onPress={() => {
                  void handleUploadLocationPhoto();
                }}
              />
            </FormSection>
          ) : null}

          {locationId && activeTab === "HOURS" ? (
            <FormSection
              title="3. Weekly Operating Hours & Closures"
              subtitle="Configure standard Monday–Sunday counter hours in Asia/Colombo time."
            >
              {weeklyHours.map((day, idx) => (
                <View key={day.dayOfWeek} style={styles.dayRow}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayTitle}>{DAY_LABELS[day.dayOfWeek]}</Text>
                    <Switch
                      value={!day.isClosed}
                      onValueChange={(open) => {
                        setWeeklyHours((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, isClosed: !open } : item
                          )
                        );
                      }}
                    />
                  </View>
                  {!day.isClosed ? (
                    <View style={styles.rowTwo}>
                      <TextInput
                        label="Open (HH:MM)"
                        value={day.openTime}
                        onChangeText={(val) =>
                          setWeeklyHours((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, openTime: val } : item
                            )
                          )
                        }
                        containerStyle={styles.flexField}
                      />
                      <TextInput
                        label="Close (HH:MM)"
                        value={day.closeTime}
                        onChangeText={(val) =>
                          setWeeklyHours((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, closeTime: val } : item
                            )
                          )
                        }
                        containerStyle={styles.flexField}
                      />
                    </View>
                  ) : (
                    <Text style={styles.mutedNote}>Closed all day</Text>
                  )}
                </View>
              ))}

              <Button
                title="Save Weekly Schedule"
                isLoading={setHoursMutation.isPending}
                onPress={() => {
                  void handleSaveHours();
                }}
              />

              <Text style={styles.fieldLabel}>Add Holiday / Special Exception</Text>
              <TextInput
                label="Date (YYYY-MM-DD)"
                value={exceptionDate}
                onChangeText={setExceptionDate}
                placeholder="2026-05-01"
              />
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  style={[
                    styles.pillChip,
                    exceptionType === "CLOSURE" ? styles.pillChipActive : null
                  ]}
                  onPress={() => setExceptionType("CLOSURE")}
                  accessibilityRole="button"
                  accessibilityState={{ selected: exceptionType === "CLOSURE" }}
                >
                  <Text
                    style={[
                      styles.pillChipText,
                      exceptionType === "CLOSURE" ? styles.pillChipTextActive : null
                    ]}
                  >
                    Full-Day Closure
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pillChip,
                    exceptionType === "SPECIAL_HOURS" ? styles.pillChipActive : null
                  ]}
                  onPress={() => setExceptionType("SPECIAL_HOURS")}
                  accessibilityRole="button"
                  accessibilityState={{ selected: exceptionType === "SPECIAL_HOURS" }}
                >
                  <Text
                    style={[
                      styles.pillChipText,
                      exceptionType === "SPECIAL_HOURS" ? styles.pillChipTextActive : null
                    ]}
                  >
                    Special Hours (09:00 - 17:00)
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                label="Reason"
                value={exceptionReason}
                onChangeText={setExceptionReason}
                placeholder="Poya Day holiday"
              />
              <Button
                title="Add Date Exception"
                variant="outline"
                isLoading={addExceptionMutation.isPending}
                onPress={() => {
                  void handleAddException();
                }}
              />
              {(existing?.exceptions?.length ?? 0) > 0 ? (
                <View style={styles.choicesWrap}>
                  {(existing?.exceptions ?? []).map((ex) => (
                    <View key={ex.id} style={styles.exceptionRow}>
                      <Text style={styles.mutedNote}>
                        {ex.exceptionDate} • {ex.exceptionType}
                        {ex.reason ? ` (${ex.reason})` : ""}
                      </Text>
                      <Button
                        title="Remove"
                        size="sm"
                        variant="outline"
                        isLoading={deleteExceptionMutation.isPending}
                        onPress={() => {
                          if (!existing?.id) return;
                          void deleteExceptionMutation.mutateAsync({
                            locationId: existing.id,
                            exceptionId: ex.id
                          });
                        }}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </FormSection>
          ) : null}

          {locationId && activeTab === "ZONES" ? (
            <FormSection
              title="4. Storage Zones & Capacity Pools"
              subtitle="Define physical vault zones and total active bag units."
            >
              <View style={styles.chipsWrap}>
                {zones.map((z) => (
                  <Badge
                    key={z.id}
                    label={`${z.name} (${z.zoneType})`}
                    variant="navy"
                    size="sm"
                  />
                ))}
              </View>
              <TextInput
                label="New Zone Name"
                value={newZoneName}
                onChangeText={setNewZoneName}
                placeholder="Locker Bank A"
              />
              <View style={styles.chipsWrap}>
                {STORAGE_ZONE_TYPES.map((zt) => {
                  const selected = newZoneType === zt;
                  return (
                    <TouchableOpacity
                      key={zt}
                      style={[styles.pillChip, selected ? styles.pillChipActive : null]}
                      onPress={() => setNewZoneType(zt)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.pillChipText,
                          selected ? styles.pillChipTextActive : null
                        ]}
                      >
                        {zt.replace(/_/g, " ")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Button
                title="Add Storage Zone"
                variant="outline"
                isLoading={createZoneMutation.isPending}
                onPress={() => {
                  void handleCreateZone();
                }}
              />

              <Text style={styles.fieldLabel}>Capacity Pools</Text>
              {pools.map((pool) => (
                <View key={pool.id} style={styles.poolRow}>
                  <View style={styles.flexField}>
                    <Text style={styles.dayTitle}>
                      {pool.poolType} • {pool.totalUnits} units
                    </Text>
                    <Text style={styles.mutedNote}>
                      {pool.isActive ? "Active" : "Paused"}
                    </Text>
                  </View>
                  <Button
                    title={pool.isActive ? "Pause" : "Activate"}
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      void updatePoolMutation.mutateAsync({
                        poolId: pool.id,
                        locationId,
                        data: { isActive: !pool.isActive }
                      });
                    }}
                  />
                </View>
              ))}

              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  style={[
                    styles.pillChip,
                    newPoolType === "SHARED" ? styles.pillChipActive : null
                  ]}
                  onPress={() => setNewPoolType("SHARED")}
                  accessibilityRole="button"
                  accessibilityState={{ selected: newPoolType === "SHARED" }}
                >
                  <Text
                    style={[
                      styles.pillChipText,
                      newPoolType === "SHARED" ? styles.pillChipTextActive : null
                    ]}
                  >
                    Shared Capacity Pool
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pillChip,
                    newPoolType === "DEDICATED" ? styles.pillChipActive : null
                  ]}
                  onPress={() => setNewPoolType("DEDICATED")}
                  accessibilityRole="button"
                  accessibilityState={{ selected: newPoolType === "DEDICATED" }}
                >
                  <Text
                    style={[
                      styles.pillChipText,
                      newPoolType === "DEDICATED" ? styles.pillChipTextActive : null
                    ]}
                  >
                    Dedicated Bag Pool
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                label="Total Bag Capacity Units"
                keyboardType="numeric"
                value={newPoolUnits}
                onChangeText={setNewPoolUnits}
              />
              <Button
                title="Create Capacity Pool"
                variant="outline"
                isLoading={createPoolMutation.isPending}
                onPress={() => {
                  void handleCreatePool();
                }}
              />
            </FormSection>
          ) : null}

          {locationId && activeTab === "PRICING" ? (
            <View style={styles.stack}>
              <FormSection
                title="5. LKR Pricing Policy"
                subtitle="Configure Sri Lankan Rupee base pricing; stored in minor cents with standard bag category tiers."
              >
                <View style={styles.chipsWrap}>
                  {PRICING_UNITS.map((unit) => {
                    const selected = pricingUnit === unit;
                    return (
                      <TouchableOpacity
                        key={unit}
                        style={[styles.pillChip, selected ? styles.pillChipActive : null]}
                        onPress={() => setPricingUnit(unit)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[
                            styles.pillChipText,
                            selected ? styles.pillChipTextActive : null
                          ]}
                        >
                          {unit.replace(/_/g, " ")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  label="Base Rate (LKR)"
                  keyboardType="numeric"
                  value={baseRateRupees}
                  onChangeText={setBaseRateRupees}
                  helperText="Medium bag base rate in rupees (converted to minor units on save)."
                />
                <Button
                  title="Save LKR Pricing Policy"
                  isLoading={configurePricingMutation.isPending}
                  onPress={() => {
                    void handleSavePricing();
                  }}
                />
              </FormSection>

              <FormSection
                title="6. Readiness & Publication"
                subtitle="Complete all checklist items before submitting your hub for marketplace review."
              >
                <View style={styles.chipsWrap}>
                  <Badge
                    label={`Photos: ${existing?.images?.length ?? 0}`}
                    variant={(existing?.images?.length ?? 0) > 0 ? "success" : "warning"}
                    size="sm"
                  />
                  <Badge
                    label={`Capacity Pools: ${pools.length}`}
                    variant={pools.length > 0 ? "success" : "warning"}
                    size="sm"
                  />
                  <Badge
                    label={pricingQuery.data ? "Pricing Configured (LKR)" : "Pricing Pending"}
                    variant={pricingQuery.data ? "success" : "warning"}
                    size="sm"
                  />
                </View>

                <Button
                  title="Submit Hub for Admin Review"
                  isLoading={submitReviewMutation.isPending}
                  onPress={() => {
                    void handleSubmitReview();
                  }}
                />
                <Button
                  title="Disable Storage Hub"
                  variant="danger"
                  isLoading={disableMutation.isPending}
                  onPress={() => setConfirmDisableOpen(true)}
                />
              </FormSection>
            </View>
          ) : null}
        </View>
      )}

      <ConfirmDialog
        visible={confirmDisableOpen}
        title="Disable This Storage Hub?"
        description="Travellers will no longer find or book this location in public search until re-enabled."
        confirmLabel="Disable Hub"
        destructive
        isLoading={disableMutation.isPending}
        onCancel={() => setConfirmDisableOpen(false)}
        onConfirm={() => {
          void handleDisableLocation();
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: mobileSpacing[4]
  },
  cardGap: {
    gap: mobileSpacing[3]
  },
  rowTwo: {
    flexDirection: "row",
    gap: mobileSpacing[2]
  },
  flexField: {
    flex: 1
  },
  fieldLabel: {
    ...mobileTypography.label,
    color: mobileTextColors.primary,
    marginTop: mobileSpacing[2]
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 48
  },
  choicesWrap: {
    gap: mobileSpacing[2]
  },
  dayRow: {
    padding: mobileSpacing[3],
    borderRadius: mobileRadius.lg,
    backgroundColor: mobileColors.sand[50],
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    gap: mobileSpacing[2]
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  dayTitle: {
    ...mobileTypography.label,
    color: mobileTextColors.primary
  },
  mutedNote: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileTextColors.muted
  },
  poolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing[2],
    padding: mobileSpacing[3],
    backgroundColor: mobileStatusTokens.infoBg,
    borderRadius: mobileRadius.md
  },
  sectionTabsRow: {
    flexDirection: "row",
    gap: mobileSpacing[2],
    paddingVertical: 2
  },
  sectionTabBtn: {
    minHeight: 42,
    paddingHorizontal: mobileSpacing[3],
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.white,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    justifyContent: "center",
    alignItems: "center"
  },
  sectionTabBtnActive: {
    backgroundColor: mobileColors.navy[900],
    borderColor: mobileColors.navy[900]
  },
  sectionTabBtnDisabled: {
    opacity: 0.45
  },
  sectionTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileTextColors.secondary
  },
  sectionTabTextActive: {
    color: mobileColors.white
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing[2]
  },
  pillChip: {
    minHeight: 40,
    paddingHorizontal: mobileSpacing[3],
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    justifyContent: "center",
    alignItems: "center"
  },
  pillChipActive: {
    backgroundColor: mobileColors.navy[900],
    borderColor: mobileColors.navy[900]
  },
  pillChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileTextColors.primary
  },
  pillChipTextActive: {
    color: mobileColors.white
  },
  exceptionRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing[2],
    backgroundColor: mobileStatusTokens.successBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.successBorder,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[3]
  },
  successBannerText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.success,
    fontWeight: "600",
    flex: 1
  }
});
