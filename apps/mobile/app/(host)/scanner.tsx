import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  ErrorState,
  FormSection,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  SelectionCard,
  TextInput
} from "../../src/components";
import { useHostBookingsQuery, useVerifyCustodyPassMutation } from "../../src/hooks";
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

export default function HostScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const [permission, requestPermission] = useCameraPermissions();

  const bookingsQuery = useHostBookingsQuery({ limit: 50 }, true);
  const verifyMutation = useVerifyCustodyPassMutation();

  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false);
  const [scanMode, setScanMode] = useState<"CAMERA" | "PIN">("CAMERA");
  const [operation, setOperation] = useState<"CHECK_IN" | "COLLECTION">("CHECK_IN");
  const [enableTorch, setEnableTorch] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [qrInput, setQrInput] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedSummary, setVerifiedSummary] = useState<{
    bookingId: string;
    referenceCode: string;
    operation: "CHECK_IN" | "COLLECTION";
    expectedBagCount: number;
    checkedInBagCount: number | null;
    custodyStatus: string;
    qrToken?: string;
    verificationPin?: string;
  } | null>(null);

  const eligibleBookings = useMemo(() => {
    const all = bookingsQuery.data?.bookings ?? [];
    return all.filter((b) => b.status === "CONFIRMED" || b.status === "IN_STORAGE");
  }, [bookingsQuery.data]);

  useEffect(() => {
    if (typeof params.bookingId === "string" && UUID_REGEX.test(params.bookingId)) {
      setSelectedBookingId(params.bookingId);
      const match = eligibleBookings.find((b) => b.id === params.bookingId);
      if (match) {
        setOperation(match.status === "IN_STORAGE" ? "COLLECTION" : "CHECK_IN");
      }
      return;
    }
    if (!selectedBookingId && eligibleBookings[0]) {
      setSelectedBookingId(eligibleBookings[0].id);
      setOperation(eligibleBookings[0].status === "IN_STORAGE" ? "COLLECTION" : "CHECK_IN");
    }
  }, [params.bookingId, eligibleBookings, selectedBookingId]);

  const handleSelectBooking = (bookingId: string, status: string) => {
    setSelectedBookingId(bookingId);
    setOperation(status === "IN_STORAGE" ? "COLLECTION" : "CHECK_IN");
    setVerifiedSummary(null);
    setVerifyError(null);
  };

  const runVerifyPass = async (payload: { qrToken?: string; verificationPin?: string }) => {
    setVerifyError(null);
    setVerifiedSummary(null);

    if (!selectedBookingId || !UUID_REGEX.test(selectedBookingId)) {
      setVerifyError("Select a confirmed or in-storage booking before verifying a pass.");
      return;
    }

    try {
      const result = await verifyMutation.mutateAsync({
        bookingId: selectedBookingId,
        operation,
        ...(payload.qrToken ? { qrToken: payload.qrToken } : {}),
        ...(payload.verificationPin ? { verificationPin: payload.verificationPin } : {})
      });
      setVerifiedSummary({
        ...result,
        qrToken: payload.qrToken,
        verificationPin: payload.verificationPin
      });
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (normalized.statusCode === 429 && normalized.retryAfterSeconds) {
        setVerifyError(
          `Too many verification attempts. Please wait ${normalized.retryAfterSeconds}s before retrying.`
        );
      } else {
        setVerifyError(normalized.message);
      }
    }
  };

  const handleQrScanned = ({ data }: { data: string }) => {
    if (verifyMutation.isPending || verifiedSummary) {
      return;
    }
    const cleanToken = data.trim();
    if (cleanToken.length === 64) {
      setQrInput(cleanToken);
      void runVerifyPass({ qrToken: cleanToken });
    }
  };

  const handleVerifyPin = () => {
    const cleanPin = pinInput.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(cleanPin)) {
      setVerifyError("Enter a valid 6-digit numeric fallback PIN.");
      return;
    }
    void runVerifyPass({ verificationPin: cleanPin });
  };

  const handleVerifyManualQr = () => {
    const cleanToken = qrInput.trim();
    if (cleanToken.length < 32) {
      setVerifyError("Scan or paste a valid custody QR token.");
      return;
    }
    void runVerifyPass({ qrToken: cleanToken });
  };

  const selectedBooking = useMemo(
    () => eligibleBookings.find((b) => b.id === selectedBookingId) ?? null,
    [eligibleBookings, selectedBookingId]
  );

  const handleResetScan = () => {
    setVerifiedSummary(null);
    setVerifyError(null);
    setPinInput("");
    setQrInput("");
  };

  return (
    <ScreenContainer
      keyboardAvoiding
      header={
        <SafeHeader
          title="Handover Scanner"
          subtitle="QR Token & 6-Digit PIN Verification"
          onBack={() => router.back()}
        />
      }
      testID="host-scanner-screen"
    >
      <View style={styles.stack}>
        <TouchableOpacity
          style={styles.activeBookingPill}
          onPress={() => setBookingSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Select booking for handover verification"
          testID="scanner-booking-selector-trigger"
        >
          <View style={styles.activeBookingTextCol}>
            <Text style={styles.activeBookingEyebrow}>
              ACTIVE RESERVATION ({operation === "COLLECTION" ? "COLLECTION" : "CHECK-IN"})
            </Text>
            <Text style={styles.activeBookingTitle} numberOfLines={1}>
              {selectedBooking
                ? `#${selectedBooking.referenceCode} • ${selectedBooking.totalBags} bag(s) • ${selectedBooking.location.name}`
                : eligibleBookings.length === 0
                  ? "No queued check-ins or collections"
                  : "Tap to select a reservation"}
            </Text>
          </View>
          <View style={styles.changePillBadge}>
            <Text style={styles.changePillText}>
              {eligibleBookings.length > 0 ? `Change (${eligibleBookings.length})` : "Empty"}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.modeToggleRow} accessibilityRole="tablist">
          <TouchableOpacity
            style={[styles.modeTabBtn, scanMode === "CAMERA" ? styles.modeTabBtnActive : null]}
            onPress={() => setScanMode("CAMERA")}
            accessibilityRole="tab"
            accessibilityState={{ selected: scanMode === "CAMERA" }}
          >
            <MobileIcon
              name="camera"
              size={15}
              color={scanMode === "CAMERA" ? mobileColors.white : mobileColors.navy[900]}
            />
            <Text
              style={[
                styles.modeTabText,
                scanMode === "CAMERA" ? styles.modeTabTextActive : null
              ]}
            >
              Camera Scanner
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTabBtn, scanMode === "PIN" ? styles.modeTabBtnActive : null]}
            onPress={() => setScanMode("PIN")}
            accessibilityRole="tab"
            accessibilityState={{ selected: scanMode === "PIN" }}
          >
            <MobileIcon
              name="key"
              size={15}
              color={scanMode === "PIN" ? mobileColors.white : mobileColors.navy[900]}
            />
            <Text
              style={[styles.modeTabText, scanMode === "PIN" ? styles.modeTabTextActive : null]}
            >
              6-Digit PIN Fallback
            </Text>
          </TouchableOpacity>
        </View>

        {scanMode === "CAMERA" ? (
          <Card variant="elevated" style={styles.cardGap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Camera Scanner</Text>
              <Button
                title={enableTorch ? "Torch On" : "Torch Off"}
                size="sm"
                variant="outline"
                onPress={() => setEnableTorch((prev) => !prev)}
              />
            </View>

            {!permission ? (
              <Text style={styles.mutedNote}>Checking camera permissions...</Text>
            ) : !permission.granted ? (
              <View style={styles.permBox}>
                <Text style={styles.mutedNote}>
                  Camera permission is required to scan traveller custody QR passes directly.
                </Text>
                <Button
                  title="Enable Camera Access"
                  onPress={() => {
                    void requestPermission();
                  }}
                />
              </View>
            ) : (
              <View style={styles.cameraBox}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  enableTorch={enableTorch}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={handleQrScanned}
                />
                <View style={styles.reticleOverlay} pointerEvents="none">
                  <View style={styles.reticleFrame} />
                  <Text style={styles.reticleHint}>Align custody QR inside frame</Text>
                </View>
              </View>
            )}
          </Card>
        ) : (
          <FormSection
            title="6-Digit PIN Fallback"
            subtitle="Use the traveller's 6-digit single-use PIN if camera scanning is unavailable."
          >
            <TextInput
              label="6-Digit Fallback PIN"
              keyboardType="numeric"
              maxLength={6}
              value={pinInput}
              onChangeText={setPinInput}
              placeholder="123456"
            />
            <Button
              title="Verify 6-Digit PIN"
              isLoading={verifyMutation.isPending}
              onPress={handleVerifyPin}
            />

            <TextInput
              label="Manual QR Token Entry"
              value={qrInput}
              onChangeText={setQrInput}
              placeholder="Paste 64-character custody token"
            />
            <Button
              title="Verify Token"
              variant="outline"
              isLoading={verifyMutation.isPending}
              onPress={handleVerifyManualQr}
            />
          </FormSection>
        )}

        {verifyError ? <ErrorState title="Verification Error" message={verifyError} /> : null}

        {verifiedSummary ? (
          <Card variant="outlined" style={styles.successCard}>
            <Badge
              label={`Pass Confirmed for ${verifiedSummary.operation.replace("_", "-")}`}
              variant="success"
              icon="check-circle"
            />
            <Text style={styles.successTitle}>#{verifiedSummary.referenceCode}</Text>
            <Text style={styles.successMeta}>
              Expected Bags: {verifiedSummary.expectedBagCount} • Custody Status:{" "}
              {verifiedSummary.custodyStatus}
            </Text>

            <Button
              title={
                verifiedSummary.operation === "CHECK_IN"
                  ? "Proceed to Counter Bag Intake"
                  : "Proceed to Vault Release"
              }
              rightIcon={<MobileIcon name="arrow-right" size={16} color={mobileColors.white} />}
              onPress={() =>
                router.push({
                  pathname:
                    verifiedSummary.operation === "CHECK_IN"
                      ? "/(host)/intake"
                      : "/(host)/vault",
                  params: {
                    bookingId: verifiedSummary.bookingId,
                    ...(verifiedSummary.qrToken ? { qrToken: verifiedSummary.qrToken } : {}),
                    ...(verifiedSummary.verificationPin
                      ? { pin: verifiedSummary.verificationPin }
                      : {})
                  }
                })
              }
            />
            <Button
              title="Scan Next"
              variant="outline"
              size="sm"
              leftIcon={<MobileIcon name="refresh" size={14} color={mobileColors.navy[900]} />}
              onPress={handleResetScan}
            />
          </Card>
        ) : null}
      </View>

      <BottomSheet
        visible={bookingSheetOpen}
        title="Select Reservation"
        subtitle="Choose the arriving traveller booking to verify handover credentials"
        onClose={() => setBookingSheetOpen(false)}
        testID="scanner-booking-sheet"
      >
        <View style={styles.sheetStack}>
          {eligibleBookings.length === 0 ? (
            <Text style={styles.mutedNote}>
              No CONFIRMED or IN_STORAGE bookings currently queued for handover.
            </Text>
          ) : (
            eligibleBookings.map((b) => (
              <SelectionCard
                key={b.id}
                title={`#${b.referenceCode} • ${b.totalBags} bag(s)`}
                subtitle={`${b.status === "IN_STORAGE" ? "Ready for Collection" : "Ready for Check-In"} • ${b.location.name}`}
                selected={selectedBookingId === b.id}
                onPress={() => {
                  handleSelectBooking(b.id, b.status);
                  setBookingSheetOpen(false);
                }}
              />
            ))
          )}
        </View>
      </BottomSheet>
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  mutedNote: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.muted
  },
  permBox: {
    gap: mobileSpacing[2]
  },
  cameraBox: {
    height: 260,
    borderRadius: mobileRadius.lg,
    overflow: "hidden",
    backgroundColor: mobileColors.navy[950],
    position: "relative"
  },
  camera: {
    flex: 1
  },
  reticleOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing[2]
  },
  reticleFrame: {
    width: 170,
    height: 170,
    borderRadius: mobileRadius.lg,
    borderWidth: 2,
    borderColor: mobileColors.terracotta[400],
    backgroundColor: "rgba(255, 255, 255, 0.04)"
  },
  reticleHint: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.white,
    backgroundColor: "rgba(7, 14, 26, 0.65)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: mobileRadius.full
  },
  activeBookingPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing[2],
    backgroundColor: mobileColors.card,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.xl,
    paddingHorizontal: mobileSpacing[4],
    paddingVertical: mobileSpacing[3],
    minHeight: 56
  },
  activeBookingTextCol: {
    flex: 1,
    gap: 2
  },
  activeBookingEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.7,
    color: mobileColors.terracotta[600]
  },
  activeBookingTitle: {
    ...mobileTypography.label,
    color: mobileTextColors.primary
  },
  changePillBadge: {
    minHeight: 32,
    paddingHorizontal: mobileSpacing[3],
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.sand[100],
    justifyContent: "center",
    alignItems: "center"
  },
  changePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  modeToggleRow: {
    flexDirection: "row",
    gap: mobileSpacing[2]
  },
  modeTabBtn: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.white,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    paddingHorizontal: mobileSpacing[3]
  },
  modeTabBtnActive: {
    backgroundColor: mobileColors.navy[900],
    borderColor: mobileColors.navy[900]
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  modeTabTextActive: {
    color: mobileColors.white
  },
  sheetStack: {
    gap: mobileSpacing[3]
  },
  successCard: {
    backgroundColor: mobileStatusTokens.successBg,
    borderColor: mobileStatusTokens.successBorder,
    gap: mobileSpacing[2]
  },
  successTitle: {
    ...mobileTypography.headingMd,
    color: mobileStatusTokens.success
  },
  successMeta: {
    ...mobileTypography.bodySm,
    color: mobileColors.emerald[700]
  }
});
