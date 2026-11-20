import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { BAG_CATEGORIES, type BagCategory } from "@luggage-storage/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormSection,
  LoadingSkeleton,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  StatusBadge,
  TextInput
} from "../../src/components";
import {
  useCompleteCheckInMutation,
  useHostBookingDetailQuery,
  useHostLocationDetailQuery
} from "../../src/hooks";
import { normalizeApiError } from "../../src/services/api-client";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface IntakeBagDraft {
  bagTagCode: string;
  bagCategory: BagCategory;
  securitySealNumber: string;
  zoneId: string;
  conditionNotes: string;
}

export default function HostIntakeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    bookingId?: string;
    qrToken?: string;
    pin?: string;
  }>();
  const bookingId =
    typeof params.bookingId === "string" && UUID_REGEX.test(params.bookingId)
      ? params.bookingId
      : undefined;

  const bookingQuery = useHostBookingDetailQuery(bookingId);
  const detail = bookingQuery.data;
  const locationQuery = useHostLocationDetailQuery(detail?.locationId, Boolean(detail?.locationId));
  const checkInMutation = useCompleteCheckInMutation();

  const submitInFlightRef = useRef(false);
  const [pinCode, setPinCode] = useState(typeof params.pin === "string" ? params.pin : "");
  const [qrToken, setQrToken] = useState(typeof params.qrToken === "string" ? params.qrToken : "");
  const [bags, setBags] = useState<IntakeBagDraft[]>([]);
  const [bagCountExceptionReason, setBagCountExceptionReason] = useState("");
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [photoSkipped, setPhotoSkipped] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof params.pin === "string" && params.pin) {
      setPinCode(params.pin);
    }
    if (typeof params.qrToken === "string" && params.qrToken) {
      setQrToken(params.qrToken);
    }
  }, [params.pin, params.qrToken]);

  useEffect(() => {
    if (!detail || bags.length > 0) {
      return;
    }
    const expanded: IntakeBagDraft[] = [];
    let counter = 1;
    for (const item of detail.items) {
      for (let i = 0; i < item.quantity; i += 1) {
        expanded.push({
          bagTagCode: `TAG-${detail.referenceCode.slice(-4)}-${counter}`,
          bagCategory: item.bagCategory,
          securitySealNumber: `SEAL-${counter.toString().padStart(3, "0")}`,
          zoneId: locationQuery.data?.zones?.[0]?.id ?? "",
          conditionNotes: ""
        });
        counter += 1;
      }
    }
    if (expanded.length === 0) {
      expanded.push({
        bagTagCode: `TAG-${detail.referenceCode.slice(-4)}-1`,
        bagCategory: "BAG_MEDIUM",
        securitySealNumber: "SEAL-001",
        zoneId: locationQuery.data?.zones?.[0]?.id ?? "",
        conditionNotes: ""
      });
    }
    setBags(expanded);
  }, [detail, locationQuery.data, bags.length]);

  const zones = locationQuery.data?.zones ?? [];

  const updateBagField = (index: number, patch: Partial<IntakeBagDraft>) => {
    setBags((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  const handleAddBagRow = () => {
    const nextNum = bags.length + 1;
    setBags((prev) => [
      ...prev,
      {
        bagTagCode: `TAG-${detail?.referenceCode.slice(-4) || "BAG"}-${nextNum}`,
        bagCategory: "BAG_MEDIUM",
        securitySealNumber: "",
        zoneId: zones[0]?.id ?? "",
        conditionNotes: ""
      }
    ]);
  };

  const handleRemoveBagRow = (index: number) => {
    if (bags.length <= 1) {
      return;
    }
    setBags((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCaptureCameraPhoto = async () => {
    setSubmitError(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setSubmitError("Camera permission denied. You can skip counter photo or choose from library.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!res.canceled && res.assets?.[0]) {
        setLocalPhotoUri(res.assets[0].uri);
        setPhotoSkipped(false);
      }
    } catch {
      setSubmitError("Camera capture failed on this runtime.");
    }
  };

  const handlePickLibraryPhoto = async () => {
    setSubmitError(null);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7
      });
      if (!res.canceled && res.assets?.[0]) {
        setLocalPhotoUri(res.assets[0].uri);
        setPhotoSkipped(false);
      }
    } catch {
      setSubmitError("Photo library selection failed.");
    }
  };

  const isCountMismatch = Boolean(detail && bags.length !== detail.totalBags);

  const handleConfirmCheckIn = async () => {
    if (submitInFlightRef.current || !bookingId || !detail) {
      return;
    }
    setSubmitError(null);

    if (!qrToken && !/^\d{6}$/.test(pinCode.replace(/\s+/g, ""))) {
      setSubmitError("Enter the traveller's 6-digit handover PIN (or verify via Scanner first).");
      return;
    }
    if (bags.some((b) => b.bagTagCode.trim().length < 2)) {
      setSubmitError("Every bag requires a valid tag code.");
      return;
    }
    if (isCountMismatch && bagCountExceptionReason.trim().length < 3) {
      setSubmitError("Explain why checked-in bag count differs from booked bag count.");
      return;
    }

    submitInFlightRef.current = true;
    try {
      await checkInMutation.mutateAsync({
        bookingId,
        data: {
          ...(qrToken ? { qrToken } : { verificationPin: pinCode.replace(/\s+/g, "") }),
          zoneId: zones[0]?.id || undefined,
          bags: bags.map((b) => ({
            bagTagCode: b.bagTagCode.trim(),
            bagCategory: b.bagCategory,
            ...(b.securitySealNumber.trim()
              ? { securitySealNumber: b.securitySealNumber.trim() }
              : {}),
            ...(b.zoneId ? { zoneId: b.zoneId } : {}),
            ...(b.conditionNotes.trim() ? { conditionNotes: b.conditionNotes.trim() } : {})
          })),
          ...(isCountMismatch
            ? { bagCountExceptionReason: bagCountExceptionReason.trim() }
            : {})
        }
      });

      router.replace({
        pathname: "/(host)/vault",
        params: { bookingId }
      });
    } catch (err) {
      setSubmitError(normalizeApiError(err).message);
    } finally {
      submitInFlightRef.current = false;
    }
  };

  if (!bookingId) {
    return (
      <ScreenContainer
        header={<SafeHeader title="Counter Bag Intake" onBack={() => router.back()} />}
        testID="host-intake-missing"
      >
        <EmptyState
          mascot="suitcase-peek"
          title="Select a Booking to Check In"
          description="Open an incoming CONFIRMED booking from Requests or verify its pass in Scanner first."
          actionTitle="Open Handover Scanner"
          onAction={() => router.replace("/(host)/scanner")}
        />
      </ScreenContainer>
    );
  }

  const stickyFooter = detail ? (
    <View style={styles.stickyFooter}>
      <Button
        title="Confirm Check-In into Vault"
        isLoading={checkInMutation.isPending}
        onPress={() => {
          void handleConfirmCheckIn();
        }}
        fullWidth
      />
    </View>
  ) : undefined;

  return (
    <ScreenContainer
      keyboardAvoiding
      header={
        <SafeHeader
          title="Counter Bag Intake"
          subtitle={detail ? `#${detail.referenceCode}` : "Custody Check-In"}
          onBack={() => router.back()}
        />
      }
      footer={stickyFooter}
      testID="host-intake-screen"
    >
      {bookingQuery.isLoading ? (
        <LoadingSkeleton count={3} />
      ) : bookingQuery.isError || !detail ? (
        <ErrorState
          title="Unable to Load Booking"
          message={
            bookingQuery.isError
              ? normalizeApiError(bookingQuery.error).message
              : "Booking record could not be loaded."
          }
          onRetry={() => {
            void bookingQuery.refetch();
          }}
        />
      ) : (
        <View style={styles.stack}>
          <Card variant="elevated" style={styles.cardGap}>
            <View style={styles.headerRow}>
              <Text style={styles.refTitle}>#{detail.referenceCode}</Text>
              <StatusBadge status={detail.status} size="sm" />
            </View>
            <Text style={styles.metaText}>
              Booked Quantity: {detail.totalBags} bag(s) at {detail.location.name}
            </Text>
          </Card>

          <FormSection
            title="1. Handover Credential"
            subtitle={
              qrToken
                ? "QR pass pre-verified from counter scanner."
                : "Enter the traveller's 6-digit check-in fallback PIN."
            }
          >
            {qrToken ? (
              <Badge label="Verified QR Pass Attached" variant="success" icon="check-circle" />
            ) : (
              <TextInput
                label="Traveller 6-Digit PIN"
                required
                keyboardType="numeric"
                maxLength={6}
                value={pinCode}
                onChangeText={setPinCode}
                placeholder="6-digit PIN"
              />
            )}
          </FormSection>

          <FormSection
            title={`2. Physical Bag Tags & Seals (${bags.length})`}
            subtitle="Assign tag codes, security seals, and storage zones per checked-in bag."
            rightSlot={
              <Button title="Add Bag" size="sm" variant="outline" onPress={handleAddBagRow} />
            }
          >
            {bags.map((bag, idx) => (
              <View key={`bag-${idx}`} style={styles.bagBox}>
                <View style={styles.headerRow}>
                  <Text style={styles.bagHeading}>Bag #{idx + 1}</Text>
                  {bags.length > 1 ? (
                    <Button
                      title="Remove"
                      size="sm"
                      variant="ghost"
                      onPress={() => handleRemoveBagRow(idx)}
                    />
                  ) : null}
                </View>

                <TextInput
                  label="Bag Tag Code"
                  required
                  value={bag.bagTagCode}
                  onChangeText={(val) => updateBagField(idx, { bagTagCode: val })}
                />
                <TextInput
                  label="Security Seal Serial"
                  value={bag.securitySealNumber}
                  onChangeText={(val) => updateBagField(idx, { securitySealNumber: val })}
                  placeholder="SEAL-LK-10001"
                />

                <Text style={styles.fieldLabel}>Bag Size Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScrollRow}
                >
                  {BAG_CATEGORIES.map((cat) => {
                    const selected = bag.bagCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.pillChip, selected ? styles.pillChipActive : null]}
                        onPress={() => updateBagField(idx, { bagCategory: cat })}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[
                            styles.pillChipText,
                            selected ? styles.pillChipTextActive : null
                          ]}
                        >
                          {cat.replace("BAG_", "")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {zones.length > 0 ? (
                  <>
                    <Text style={styles.fieldLabel}>Storage Zone</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chipsScrollRow}
                    >
                      {zones.map((z) => {
                        const selected = bag.zoneId === z.id;
                        return (
                          <TouchableOpacity
                            key={z.id}
                            style={[styles.pillChip, selected ? styles.pillChipActive : null]}
                            onPress={() => updateBagField(idx, { zoneId: z.id })}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                          >
                            <Text
                              style={[
                                styles.pillChipText,
                                selected ? styles.pillChipTextActive : null
                              ]}
                            >
                              {z.name} ({z.zoneType})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </>
                ) : null}

                <TextInput
                  label="Counter Notes (Optional)"
                  value={bag.conditionNotes}
                  onChangeText={(val) => updateBagField(idx, { conditionNotes: val })}
                  placeholder="Existing handle wear noted"
                />
              </View>
            ))}

            {isCountMismatch ? (
              <TextInput
                label="Bag Count Mismatch Reason"
                required
                value={bagCountExceptionReason}
                onChangeText={setBagCountExceptionReason}
                placeholder="Traveller checked in different number of bags"
              />
            ) : null}
          </FormSection>

          <FormSection
            title="3. Optional Counter Visual Reference Photo"
            subtitle="Optional on-device visual reference only. A counter photo does NOT verify pristine condition or waive standard custody inspection."
            style={styles.photoCard}
          >
            {localPhotoUri ? (
              <Image source={{ uri: localPhotoUri }} style={styles.previewImg} />
            ) : null}
            <View style={styles.photoBtnRow}>
              <Button
                title="Take Photo"
                size="sm"
                variant="outline"
                leftIcon={<MobileIcon name="camera" size={16} color={mobileColors.navy[900]} />}
                onPress={() => {
                  void handleCaptureCameraPhoto();
                }}
                style={styles.flexBtn}
              />
              <Button
                title="Choose Image"
                size="sm"
                variant="outline"
                onPress={() => {
                  void handlePickLibraryPhoto();
                }}
                style={styles.flexBtn}
              />
            </View>
            <Button
              title={photoSkipped ? "Counter Photo Skipped" : "Skip Counter Photo"}
              size="sm"
              variant="ghost"
              onPress={() => {
                setLocalPhotoUri(null);
                setPhotoSkipped(true);
              }}
            />
          </FormSection>

          {submitError ? <ErrorState title="Check-In Error" message={submitError} /> : null}
        </View>
      )}
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: mobileSpacing[2]
  },
  refTitle: {
    ...mobileTypography.headingMd,
    color: mobileColors.navy[900]
  },
  metaText: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary
  },
  bagBox: {
    padding: mobileSpacing[3],
    borderRadius: mobileRadius.lg,
    backgroundColor: mobileColors.sand[50],
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    gap: mobileSpacing[2]
  },
  bagHeading: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  fieldLabel: {
    ...mobileTypography.label,
    color: mobileTextColors.primary,
    marginTop: 4
  },
  choicesWrap: {
    gap: mobileSpacing[2]
  },
  chipsScrollRow: {
    flexDirection: "row",
    gap: mobileSpacing[2],
    paddingVertical: 2
  },
  pillChip: {
    minHeight: 44,
    paddingHorizontal: mobileSpacing[3],
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.white,
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
    fontWeight: "700",
    color: mobileTextColors.primary
  },
  pillChipTextActive: {
    color: mobileColors.white
  },
  stickyFooter: {
    backgroundColor: mobileColors.card,
    borderTopWidth: 1,
    borderTopColor: mobileColors.border,
    paddingHorizontal: mobileSpacing[4],
    paddingVertical: mobileSpacing[3]
  },
  photoCard: {
    backgroundColor: mobileStatusTokens.infoBg,
    borderColor: mobileStatusTokens.infoBorder,
    gap: mobileSpacing[2]
  },
  previewImg: {
    width: "100%",
    height: 160,
    borderRadius: mobileRadius.md
  },
  photoBtnRow: {
    flexDirection: "row",
    gap: mobileSpacing[2]
  },
  flexBtn: {
    flex: 1
  }
});
