import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StyleSheet
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useHostStore } from "../../src/store/useHostStore";
import { marketplaceApi } from "../../src/services/marketplace-api";
import { DemoHostBooking, DEMO_SCANNER_FIXTURES } from "../../src/data/mock-host-data";
import { MobileIcon } from "../../src/components/MobileIcon";
import { mobileColors } from "../../src/lib/theme";

const SCAN_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ScannerMode = "CAMERA" | "PIN";

export default function HostScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const { isAuthenticated } = useAuthStore();
  const { bookings, lookupByPin, lookupByQr, startIntake } = useHostStore();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<ScannerMode>("CAMERA");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [pinDigits, setPinDigits] = useState("");
  const [scannedResult, setScannedResult] = useState<DemoHostBooking | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scannedResult) return; // avoid duplicate triggers
    setErrorMessage(null);
    if (isAuthenticated && params.bookingId && SCAN_UUID_REGEX.test(params.bookingId) && data.trim().length === 64) {
      try {
        const verified = await marketplaceApi.verifyCustodyPass({
          bookingId: params.bookingId,
          operation: "CHECK_IN",
          qrToken: data.trim()
        });
        if (verified.verified && bookings[0]) {
          setScannedResult({
            ...bookings[0],
            id: verified.bookingId,
            reference: verified.referenceCode,
            totalBags: verified.expectedBagCount,
            qrPayload: data.trim()
          });
          return;
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "QR token verification failed.");
        return;
      }
    }
    const matched = lookupByQr(data);
    if (matched) {
      setScannedResult(matched);
    } else {
      setErrorMessage(`No matching booking for QR code: "${data.substring(0, 30)}..."`);
    }
  };

  const handleVerifyPin = async (codeToVerify?: string) => {
    const code = codeToVerify ?? pinDigits;
    setErrorMessage(null);
    if (code.length < 6) {
      setErrorMessage("Please enter all 6 digits of the guest's pickup pass PIN.");
      return;
    }
    if (isAuthenticated && params.bookingId && SCAN_UUID_REGEX.test(params.bookingId)) {
      try {
        const verified = await marketplaceApi.verifyCustodyPass({
          bookingId: params.bookingId,
          operation: "CHECK_IN",
          verificationPin: code
        });
        if (verified.verified && bookings[0]) {
          setScannedResult({
            ...bookings[0],
            id: verified.bookingId,
            reference: verified.referenceCode,
            totalBags: verified.expectedBagCount,
            pinCode: code
          });
          return;
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "PIN verification failed.");
        return;
      }
    }
    const matched = lookupByPin(code);
    if (matched) {
      setScannedResult(matched);
    } else {
      setErrorMessage(`No booking matches PIN "${code}". Please check with traveller.`);
    }
  };

  const handleProceedToIntake = () => {
    if (!scannedResult) return;
    startIntake(scannedResult);
    router.push({
      pathname: "/(host)/intake",
      params: { ref: scannedResult.reference }
    });
  };

  const handleQuickSimulate = (qrString: string) => {
    handleBarcodeScanned({ data: qrString });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Back to Desk"
        >
          <MobileIcon name="arrow-left" size={20} color={mobileColors.navy[900]} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Scan Luggage Pass</Text>
          <Text style={styles.headerSubtitle}>Intake verification or pickup handover</Text>
        </View>
      </View>

      {/* Mode Switcher Tabs */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.modeTab, mode === "CAMERA" && styles.modeTabActive]}
          onPress={() => {
            setMode("CAMERA");
            setErrorMessage(null);
          }}
        >
          <MobileIcon
            name="camera"
            size={18}
            color={mode === "CAMERA" ? "#FFFFFF" : mobileColors.navy[700]}
          />
          <Text style={[styles.modeTabText, mode === "CAMERA" && styles.modeTabTextActive]}>
            Camera Scanner
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, mode === "PIN" && styles.modeTabActive]}
          onPress={() => {
            setMode("PIN");
            setErrorMessage(null);
          }}
        >
          <MobileIcon
            name="key"
            size={18}
            color={mode === "PIN" ? "#FFFFFF" : mobileColors.navy[700]}
          />
          <Text style={[styles.modeTabText, mode === "PIN" && styles.modeTabTextActive]}>
            6-Digit PIN Fallback
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mode 1: Camera Scanner */}
      {mode === "CAMERA" && (
        <View style={styles.scannerWrapper}>
          {!permission ? (
            <View style={styles.permissionCard}>
              <Text style={styles.permissionTitle}>Checking camera permissions...</Text>
            </View>
          ) : !permission.granted ? (
            <View style={styles.permissionCard}>
              <MobileIcon name="camera" size={32} color={mobileColors.terracotta[600]} />
              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionBody}>
                To scan guest QR passes directly at the counter, please grant camera permission.
              </Text>
              <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                <Text style={styles.grantBtnText}>Grant Camera Access</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraBox}>
              {Platform.OS === "web" ? (
                <View style={styles.webCameraFallback}>
                  <MobileIcon name="qr-code" size={56} color={mobileColors.sand[400]} />
                  <Text style={styles.webFallbackTitle}>Interactive Viewfinder Active</Text>
                  <Text style={styles.webFallbackSub}>
                    Point physical mobile camera at guest pass, or use quick-simulator buttons below.
                  </Text>
                </View>
              ) : (
                <CameraView
                  style={styles.cameraView}
                  enableTorch={torchEnabled}
                  onBarcodeScanned={scannedResult ? undefined : handleBarcodeScanned}
                  barcodeScannerSettings={{
                    barcodeTypes: ["qr"]
                  }}
                >
                  <View style={styles.reticleOverlay}>
                    <View style={styles.reticleFrame} />
                    <Text style={styles.reticleHint}>Align QR code inside box</Text>
                  </View>
                </CameraView>
              )}

              {/* Torch Toggle */}
              <TouchableOpacity
                style={[styles.torchBtn, torchEnabled && styles.torchBtnActive]}
                onPress={() => setTorchEnabled(!torchEnabled)}
              >
                <MobileIcon
                  name="sun"
                  size={18}
                  color={torchEnabled ? "#FFFFFF" : mobileColors.navy[800]}
                />
                <Text style={[styles.torchBtnText, torchEnabled && styles.torchBtnTextActive]}>
                  {torchEnabled ? "Torch On" : "Flashlight"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Demo Simulator Buttons for Testing */}
          <View style={styles.simulatorCard}>
            <Text style={styles.simulatorLabel}>Quick Pass Simulator (Local Testing):</Text>
            <View style={styles.simButtonsRow}>
              {DEMO_SCANNER_FIXTURES.map((fixture) => (
                <TouchableOpacity
                  key={fixture.reference}
                  style={styles.simBtn}
                  onPress={() => handleQuickSimulate(fixture.qrPayload)}
                >
                  <Text style={styles.simBtnText}>
                    Pass #{fixture.reference.replace("LS-2026-", "")} ({fixture.travellerName.split(" ")[0]} - {fixture.totalBags} {fixture.totalBags === 1 ? "Bag" : "Bags"})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Mode 2: 6-Digit PIN Fallback */}
      {mode === "PIN" && (
        <View style={styles.pinWrapper}>
          <View style={styles.pinCard}>
            <Text style={styles.pinTitle}>Manual 6-Digit PIN Entry</Text>
            <Text style={styles.pinSubtitle}>
              Ask traveller for the 6-digit numeric pass code displayed on their luggage pass screen.
            </Text>

            <TextInput
              style={styles.pinInput}
              value={pinDigits}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, "").slice(0, 6);
                setPinDigits(cleaned);
                if (cleaned.length === 6) {
                  handleVerifyPin(cleaned);
                }
              }}
              placeholder="000000"
              placeholderTextColor={mobileColors.sand[500]}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <TouchableOpacity
              style={styles.verifyPinBtn}
              onPress={() => handleVerifyPin()}
            >
              <Text style={styles.verifyPinBtnText}>Verify PIN</Text>
            </TouchableOpacity>

            <View style={styles.quickPinRow}>
              <Text style={styles.quickPinLabel}>Sample PINs:</Text>
              {DEMO_SCANNER_FIXTURES.map((fixture) => (
                <TouchableOpacity
                  key={fixture.pinCode}
                  style={styles.quickPinChip}
                  onPress={() => {
                    setPinDigits(fixture.pinCode);
                    handleVerifyPin(fixture.pinCode);
                  }}
                >
                  <Text style={styles.quickPinChipText}>
                    {fixture.pinCode} ({fixture.travellerName.split(" ")[0]})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Error Message */}
      {errorMessage && (
        <View style={styles.errorCard}>
          <MobileIcon name="alert-triangle" size={18} color="#DC2626" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Matched Booking Result Card */}
      {scannedResult && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={styles.resultSuccessIcon}>
              <MobileIcon name="check-circle" size={20} color="#15803D" />
            </View>
            <View style={styles.resultTitleCol}>
              <Text style={styles.resultTitle}>Booking Matched</Text>
              <Text style={styles.resultSub}>Demo booking lookup matched (DEC-005 Pending Sign-Off)</Text>
            </View>
          </View>

          <View style={styles.matchedDetailsBox}>
            <View style={styles.matchedRow}>
              <Text style={styles.matchedLabel}>Reference:</Text>
              <Text style={styles.matchedValueBold}>{scannedResult.reference}</Text>
            </View>
            <View style={styles.matchedRow}>
              <Text style={styles.matchedLabel}>Guest:</Text>
              <Text style={styles.matchedValue}>{scannedResult.travellerName}</Text>
            </View>
            <View style={styles.matchedRow}>
              <Text style={styles.matchedLabel}>Luggage:</Text>
              <Text style={styles.matchedValue}>
                {scannedResult.totalBags} {scannedResult.totalBags === 1 ? "Piece" : "Pieces"}
              </Text>
            </View>
            <View style={styles.matchedRow}>
              <Text style={styles.matchedLabel}>Status:</Text>
              <Text style={styles.matchedValue}>
                {scannedResult.status === "CONFIRMED"
                  ? "Incoming (Pending Intake)"
                  : scannedResult.status === "IN_STORAGE"
                  ? "Stored in Vault"
                  : scannedResult.status === "OVERDUE"
                  ? "Overdue in Vault"
                  : "Completed"}
              </Text>
            </View>
          </View>

          {/* Action button depending on status */}
          <View style={styles.resultActions}>
            {scannedResult.status === "CONFIRMED" ? (
              <TouchableOpacity
                style={styles.proceedIntakeBtn}
                onPress={handleProceedToIntake}
              >
                <Text style={styles.proceedIntakeBtnText}>
                  Proceed to Bag Tagging & Intake
                </Text>
                <MobileIcon name="arrow-right" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.proceedVaultBtn}
                onPress={() => router.push("/(host)/vault")}
              >
                <Text style={styles.proceedVaultBtnText}>
                  Manage Custody in Vault
                </Text>
                <MobileIcon name="arrow-right" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.scanAnotherBtn}
              onPress={() => {
                setScannedResult(null);
                setPinDigits("");
                setErrorMessage(null);
              }}
            >
              <Text style={styles.scanAnotherBtnText}>Scan Another Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Honest Prototype Notice */}
      <View style={styles.prototypeNoticeCard}>
        <MobileIcon name="info" size={16} color={mobileColors.terracotta[600]} />
        <Text style={styles.prototypeNoticeText}>
          <Text style={styles.boldText}>Pass Verification Scope (DEC-005):</Text> Pass verification
          checks local demo fixtures in memory. QR scanning extracts plain text identifiers, and PIN
          entry performs client-side dictionary lookup. Production offline cryptographic signature validation
          (DEC-005) remains pending sign-off.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: mobileColors.sand[100],
    paddingBottom: 40
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    marginRight: 12
  },
  headerTitles: {
    flex: 1
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  headerSubtitle: {
    fontSize: 12,
    color: mobileColors.navy[600]
  },
  modeTabs: {
    flexDirection: "row",
    backgroundColor: mobileColors.sand[200],
    borderRadius: 12,
    padding: 4,
    marginBottom: 16
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8
  },
  modeTabActive: {
    backgroundColor: mobileColors.navy[900]
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[700]
  },
  modeTabTextActive: {
    color: "#FFFFFF"
  },
  scannerWrapper: {
    marginBottom: 16
  },
  permissionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginTop: 8,
    marginBottom: 6
  },
  permissionBody: {
    fontSize: 13,
    color: mobileColors.navy[600],
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18
  },
  grantBtn: {
    backgroundColor: mobileColors.terracotta[600],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  grantBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  cameraBox: {
    height: 260,
    backgroundColor: mobileColors.navy[950],
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center"
  },
  cameraView: {
    width: "100%",
    height: "100%"
  },
  webCameraFallback: {
    alignItems: "center",
    padding: 24
  },
  webFallbackTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 12,
    marginBottom: 4
  },
  webFallbackSub: {
    fontSize: 12,
    color: mobileColors.sand[300],
    textAlign: "center",
    lineHeight: 16
  },
  reticleOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)"
  },
  reticleFrame: {
    width: 180,
    height: 180,
    borderWidth: 2,
    borderColor: mobileColors.terracotta[500],
    borderRadius: 12,
    backgroundColor: "transparent"
  },
  reticleHint: {
    fontSize: 12,
    color: "#FFFFFF",
    marginTop: 12,
    fontWeight: "600"
  },
  torchBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6
  },
  torchBtnActive: {
    backgroundColor: mobileColors.terracotta[600]
  },
  torchBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  torchBtnTextActive: {
    color: "#FFFFFF"
  },
  simulatorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  simulatorLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[800],
    marginBottom: 8
  },
  simButtonsRow: {
    gap: 6
  },
  simBtn: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: mobileColors.sand[300]
  },
  simBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[800]
  },
  pinWrapper: {
    marginBottom: 16
  },
  pinCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  pinTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 4
  },
  pinSubtitle: {
    fontSize: 12,
    color: mobileColors.navy[600],
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 16
  },
  pinInput: {
    width: 220,
    height: 52,
    backgroundColor: mobileColors.sand[100],
    borderRadius: 12,
    borderWidth: 2,
    borderColor: mobileColors.terracotta[600],
    fontSize: 28,
    fontWeight: "700",
    color: mobileColors.navy[900],
    textAlign: "center",
    letterSpacing: 12,
    marginBottom: 16,
    fontFamily: "monospace"
  },
  verifyPinBtn: {
    width: "100%",
    backgroundColor: mobileColors.navy[900],
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16
  },
  verifyPinBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  quickPinRow: {
    alignItems: "center",
    gap: 6
  },
  quickPinLabel: {
    fontSize: 11,
    color: mobileColors.navy[500]
  },
  quickPinChip: {
    backgroundColor: mobileColors.sand[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  quickPinChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.navy[800]
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 8
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600"
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#86EFAC",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12
  },
  resultSuccessIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center"
  },
  resultTitleCol: {},
  resultTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  resultSub: {
    fontSize: 11,
    color: "#15803D",
    fontWeight: "600"
  },
  matchedDetailsBox: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: 10,
    padding: 12,
    gap: 6,
    marginBottom: 14
  },
  matchedRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  matchedLabel: {
    fontSize: 12,
    color: mobileColors.navy[600]
  },
  matchedValue: {
    fontSize: 12,
    color: mobileColors.navy[800]
  },
  matchedValueBold: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900],
    fontFamily: "monospace"
  },
  resultActions: {
    gap: 8
  },
  proceedIntakeBtn: {
    flexDirection: "row",
    backgroundColor: mobileColors.terracotta[600],
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  proceedIntakeBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  proceedVaultBtn: {
    flexDirection: "row",
    backgroundColor: mobileColors.navy[900],
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  proceedVaultBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  scanAnotherBtn: {
    alignItems: "center",
    paddingVertical: 8
  },
  scanAnotherBtnText: {
    fontSize: 12,
    color: mobileColors.navy[600],
    fontWeight: "600"
  },
  prototypeNoticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 10
  },
  prototypeNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 16
  },
  boldText: {
    fontWeight: "700"
  }
});
