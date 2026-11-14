import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  Badge,
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
        <Card variant="default" style={styles.cardGap}>
          <FormSection
            title="1. Select Reservation"
            subtitle="Choose the arriving traveller booking to verify single-use handover credentials."
          >
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
                  onPress={() => handleSelectBooking(b.id, b.status)}
                />
              ))
            )}
          </FormSection>
        </Card>

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
            </View>
          )}
        </Card>

        <Card variant="default" style={styles.cardGap}>
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
        </Card>

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
          </Card>
        ) : null}
      </View>
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
    height: 240,
    borderRadius: mobileRadius.lg,
    overflow: "hidden",
    backgroundColor: mobileColors.navy[950]
  },
  camera: {
    flex: 1
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
