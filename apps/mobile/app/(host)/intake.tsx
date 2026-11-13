import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useHostStore } from "../../src/store/useHostStore";
import { marketplaceApi } from "../../src/services/marketplace-api";
import { MobileIcon } from "../../src/components/MobileIcon";
import { mobileColors } from "../../src/lib/theme";

const INTAKE_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type IntakeStep = 1 | 2 | 3 | 4;

export default function HostIntakeWizardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const { isAuthenticated } = useAuthStore();
  const {
    intakeSession,
    updateIntake,
    confirmIntake,
    cancelIntake,
    bookings,
    startIntake
  } = useHostStore();

  const [currentStep, setCurrentStep] = useState<IntakeStep>(1);
  const [sealInputError, setSealInputError] = useState<string | null>(null);
  const [completedSuccessMsg, setCompletedSuccessMsg] = useState<string | null>(null);

  // Initialize booking if passed via query params and not in session
  useEffect(() => {
    if (params.ref && (!intakeSession.booking || intakeSession.booking.reference !== params.ref)) {
      const match = bookings.find((b) => b.reference === params.ref);
      if (match) {
        startIntake(match);
      }
    } else if (!intakeSession.booking && bookings.length > 0) {
      // Pick first confirmed booking as default if available
      const first = bookings.find((b) => b.status === "CONFIRMED") || bookings[0];
      if (first) {
        startIntake(first);
      }
    }
  }, [params.ref, intakeSession.booking, bookings, startIntake]);

  const booking = intakeSession.booking;

  const [photoActionError, setPhotoActionError] = useState<string | null>(null);

  const SAMPLE_EVIDENCE_PHOTO_URI =
    "https://images.unsplash.com/photo-1581553680321-4fffae59fccd?auto=format&fit=crop&w=600&q=80";

  const handleNextFromStep1 = () => {
    setCurrentStep(2);
  };

  const handleNextFromStep2 = () => {
    const seal = intakeSession.sealNumber.trim();
    if (!seal) {
      setSealInputError("Please enter or generate a tamper seal serial number.");
      return;
    }
    const sealRegex = /^SEAL-LK-\d{5}$/;
    if (!sealRegex.test(seal)) {
      setSealInputError("Seal serial must match the format SEAL-LK-XXXXX (e.g. SEAL-LK-48291).");
      return;
    }
    setSealInputError(null);
    setCurrentStep(3);
  };

  const handleTakePhoto = async () => {
    try {
      setPhotoActionError(null);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        setPhotoActionError("Camera permission denied. You can choose an image from your library or use a sample photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        updateIntake({
          photoUri: uri,
          photoCaptured: true,
          photoEvidenceStatus: "CAPTURED_LOCAL",
          photoBypassed: false
        });
      }
    } catch {
      setPhotoActionError("Camera could not be opened. You may choose an image or use a sample photo.");
    }
  };

  const handlePickImage = async () => {
    try {
      setPhotoActionError(null);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setPhotoActionError("Media library permission denied.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        updateIntake({
          photoUri: uri,
          photoCaptured: true,
          photoEvidenceStatus: "CAPTURED_LOCAL",
          photoBypassed: false
        });
      }
    } catch {
      setPhotoActionError("Media library could not be opened.");
    }
  };

  const handleUseSamplePhoto = () => {
    setPhotoActionError(null);
    updateIntake({
      photoUri: SAMPLE_EVIDENCE_PHOTO_URI,
      photoCaptured: true,
      photoEvidenceStatus: "CAPTURED_LOCAL",
      photoBypassed: false
    });
  };

  const handleRemovePhoto = () => {
    updateIntake({
      photoUri: null,
      photoCaptured: false,
      photoEvidenceStatus: "NOT_PROVIDED",
      photoBypassed: false
    });
  };

  const handleSkipPhotoEvidence = () => {
    updateIntake({
      photoUri: null,
      photoCaptured: false,
      photoEvidenceStatus: "SKIPPED_PENDING_POLICY",
      photoBypassed: true
    });
    setCurrentStep(4);
  };

  const handleCompleteIntake = async () => {
    if (booking && isAuthenticated && INTAKE_UUID_REGEX.test(booking.id)) {
      const bags = Array.from({ length: Math.max(1, intakeSession.reconciledBags) }, (_, idx) => ({
        bagTagCode: `TAG-${idx + 1}`,
        bagCategory: "BAG_MEDIUM" as const,
        securitySealNumber: `${intakeSession.sealNumber}-${idx + 1}`
      }));
      try {
        await marketplaceApi.completeCheckIn(booking.id, {
          verificationPin: /^\d{6}$/.test(booking.pinCode) ? booking.pinCode : undefined,
          qrToken: booking.qrPayload.length === 64 ? booking.qrPayload : undefined,
          bags,
          bagCountExceptionReason:
            intakeSession.reconciledBags !== booking.totalBags
              ? "Reconciled at mobile counter desk"
              : undefined
        });
        setCompletedSuccessMsg(
          `Checked in ${intakeSession.reconciledBags} bags into Zone ${intakeSession.assignedZone}.`
        );
        return;
      } catch (err: unknown) {
        setSealInputError(err instanceof Error ? err.message : "Unable to complete intake.");
        return;
      }
    }
    const result = confirmIntake();
    if (result && result.success) {
      setCompletedSuccessMsg(result.message);
    }
  };

  const handleGenerateSeal = () => {
    const rand = Math.floor(10000 + Math.random() * 90000);
    const generated = `SEAL-LK-${rand}`;
    updateIntake({ sealNumber: generated, sealIsDemoPlaceholder: true });
    setSealInputError(null);
  };

  if (!booking) {
    return (
      <View style={styles.fallbackContainer}>
        <MobileIcon name="alert-circle" size={40} color={mobileColors.terracotta[600]} />
        <Text style={styles.fallbackTitle}>No Booking Selected for Intake</Text>
        <Text style={styles.fallbackSub}>
          Please select a booking from the Requests list or scan a guest pass to begin intake.
        </Text>
        <TouchableOpacity
          style={styles.returnBtn}
          onPress={() => router.push("/(host)")}
        >
          <Text style={styles.returnBtnText}>Return to Live Desk</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // If completed successfully
  if (completedSuccessMsg) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.successCard}>
          <View style={styles.successIconCircle}>
            <MobileIcon name="check-circle" size={40} color="#15803D" />
          </View>
          <Text style={styles.successTitle}>Intake Completed Successfully</Text>
          <Text style={styles.successMessage}>{completedSuccessMsg}</Text>

          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Booking Reference:</Text>
              <Text style={styles.summaryValBold}>{booking.reference}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Guest Name:</Text>
              <Text style={styles.summaryVal}>{booking.travellerName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Reconciled Bags:</Text>
              <Text style={styles.summaryVal}>{intakeSession.reconciledBags} Bags</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tamper Seal:</Text>
              <Text style={styles.summaryValCode}>
                {intakeSession.sealNumber}{intakeSession.sealIsDemoPlaceholder ? " (Demo Tag)" : " (Physical Seal)"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Condition Photo:</Text>
              <Text style={styles.summaryVal}>
                {intakeSession.photoEvidenceStatus === "CAPTURED_LOCAL"
                  ? "Recorded (Local Image)"
                  : "Skipped (DEC-001)"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Vault Zone:</Text>
              <Text style={styles.summaryValBold}>Zone {intakeSession.assignedZone}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => router.push("/(host)")}
          >
            <Text style={styles.doneBtnText}>Return to Live Desk</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => {
            cancelIntake();
            router.back();
          }}
        >
          <MobileIcon name="x" size={20} color={mobileColors.navy[700]} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.pageTitle}>Luggage Intake Wizard</Text>
          <Text style={styles.pageSubtitle}>
            Custody transfer for {booking.reference} ({booking.travellerName})
          </Text>
        </View>
      </View>

      {/* Progress Stepper */}
      <View style={styles.stepperContainer}>
        {(
          [
            { step: 1, title: "1. Bags" },
            { step: 2, title: "2. Seal" },
            { step: 3, title: "3. Photo" },
            { step: 4, title: "4. Confirm" }
          ] as const
        ).map((item) => {
          const isActive = currentStep === item.step;
          const isDone = currentStep > item.step;
          return (
            <View key={item.step} style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  isActive && styles.stepDotActive,
                  isDone && styles.stepDotDone
                ]}
              >
                <Text
                  style={[
                    styles.stepDotText,
                    isActive && styles.stepDotTextActive,
                    isDone && styles.stepDotTextDone
                  ]}
                >
                  {isDone ? "✓" : item.step}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepTitle,
                  isActive && styles.stepTitleActive,
                  isDone && styles.stepTitleDone
                ]}
              >
                {item.title}
              </Text>
            </View>
          );
        })}
      </View>

      {/* STEP 1: Bag Reconciliation */}
      {currentStep === 1 && (
        <View style={styles.stepCard}>
          <Text style={styles.stepCardTitle}>Step 1: Bag Count Reconciliation</Text>
          <Text style={styles.stepCardSubtitle}>
            Verify physical pieces delivered by the traveller against the reservation manifest.
          </Text>

          <View style={styles.reconcileBox}>
            <Text style={styles.reconcileLabel}>Booked Luggage Pieces:</Text>
            <Text style={styles.reconcileBookedVal}>{booking.totalBags} Bags</Text>
          </View>

          <View style={styles.counterBox}>
            <Text style={styles.counterTitle}>Actual Bags Received at Counter:</Text>
            <View style={styles.counterControls}>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() =>
                  updateIntake({
                    reconciledBags: Math.max(1, intakeSession.reconciledBags - 1)
                  })
                }
              >
                <Text style={styles.counterBtnText}>-</Text>
              </TouchableOpacity>

              <Text style={styles.counterValue}>{intakeSession.reconciledBags}</Text>

              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() =>
                  updateIntake({
                    reconciledBags: intakeSession.reconciledBags + 1
                  })
                }
              >
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {intakeSession.reconciledBags !== booking.totalBags && (
              <View style={styles.mismatchAlert}>
                <MobileIcon name="info" size={14} color="#B45309" />
                <Text style={styles.mismatchAlertText}>
                  Reconciled count ({intakeSession.reconciledBags}) differs from booked count (
                  {booking.totalBags}). Staff custody audit will record difference.
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.primaryNextBtn} onPress={handleNextFromStep1}>
            <Text style={styles.primaryNextBtnText}>Proceed to Security Seal (Step 2)</Text>
            <MobileIcon name="arrow-right" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* STEP 2: Tamper Seal Serialization */}
      {currentStep === 2 && (
        <View style={styles.stepCard}>
          <Text style={styles.stepCardTitle}>Step 2: Security Seal Serialization</Text>
          <Text style={styles.stepCardSubtitle}>
            Apply tamper-evident security seal tag to luggage zippers and record the serial ID.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Seal Serial ID (#SEAL-LK-XXXXX):</Text>
            <TextInput
              style={[styles.sealInput, sealInputError ? styles.sealInputError : null]}
              value={intakeSession.sealNumber}
              onChangeText={(text) => {
                updateIntake({ sealNumber: text.toUpperCase() });
                setSealInputError(null);
              }}
              placeholder="SEAL-LK-48291"
              placeholderTextColor={mobileColors.sand[500]}
              autoCapitalize="characters"
            />
            {sealInputError && <Text style={styles.errorText}>{sealInputError}</Text>}
          </View>

          <TouchableOpacity style={styles.generateBtn} onPress={handleGenerateSeal}>
            <MobileIcon name="refresh" size={16} color={mobileColors.terracotta[600]} />
            <Text style={styles.generateBtnText}>Generate Demo Placeholder Tag (Local Simulation Only)</Text>
          </TouchableOpacity>

          {/* DEC-007 Compliance Disclosure */}
          <View style={styles.decCallout}>
            <Text style={styles.decCalloutText}>
              <Text style={styles.boldText}>Security Tagging Policy (DEC-007):</Text> Physical numbered
              tamper seals must be attached to luggage zippers in production. Generated serials in this
              prototype are local demonstration placeholders pending physical seal logistics sign-off.
            </Text>
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backStepBtn} onPress={() => setCurrentStep(1)}>
              <Text style={styles.backStepBtnText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryNextBtn} onPress={handleNextFromStep2}>
              <Text style={styles.primaryNextBtnText}>Proceed to Photo (Step 3)</Text>
              <MobileIcon name="arrow-right" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 3: Photo Evidence Capture & 1-Tap Bypass */}
      {currentStep === 3 && (
        <View style={styles.stepCard}>
          <Text style={styles.stepCardTitle}>Step 3: Pre-existing Condition Photo</Text>
          <Text style={styles.stepCardSubtitle}>
            Capture photo evidence of pre-existing scuffs, tears, or broken zippers if observed.
          </Text>

          {photoActionError && (
            <View style={styles.photoErrorBanner}>
              <MobileIcon name="alert-triangle" size={14} color="#DC2626" />
              <Text style={styles.photoErrorText}>{photoActionError}</Text>
            </View>
          )}

          {intakeSession.photoUri ? (
            <View style={styles.photoPreviewCard}>
              <Image source={{ uri: intakeSession.photoUri }} style={styles.photoPreviewImage} />
              <View style={styles.photoPreviewBadge}>
                <MobileIcon name="check-circle" size={14} color="#15803D" />
                <Text style={styles.photoPreviewBadgeText}>Photo Evidence Attached (Local URI)</Text>
              </View>
              <View style={styles.photoPreviewActions}>
                <TouchableOpacity style={styles.retakeBtn} onPress={handleTakePhoto}>
                  <MobileIcon name="camera" size={14} color={mobileColors.navy[800]} />
                  <Text style={styles.retakeBtnText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.retakeBtn} onPress={handlePickImage}>
                  <MobileIcon name="layers" size={14} color={mobileColors.navy[800]} />
                  <Text style={styles.retakeBtnText}>Library</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.removePhotoBtn} onPress={handleRemovePhoto}>
                  <MobileIcon name="x" size={14} color="#DC2626" />
                  <Text style={styles.removePhotoBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.primaryNextBtnFull}
                onPress={() => setCurrentStep(4)}
              >
                <Text style={styles.primaryNextBtnText}>Proceed with Photo Evidence (Step 4)</Text>
                <MobileIcon name="arrow-right" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoViewport}>
              <MobileIcon name="camera" size={44} color={mobileColors.sand[400]} />
              <Text style={styles.photoViewportTitle}>Attach Condition Photo</Text>
              <Text style={styles.photoViewportSub}>
                Capture camera photo or select from photo library for intake evidence.
              </Text>

              <View style={styles.photoCaptureRow}>
                <TouchableOpacity style={styles.captureBtn} onPress={handleTakePhoto}>
                  <MobileIcon name="camera" size={16} color="#FFFFFF" />
                  <Text style={styles.captureBtnText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryPhotoBtn} onPress={handlePickImage}>
                  <MobileIcon name="layers" size={16} color={mobileColors.navy[800]} />
                  <Text style={styles.secondaryPhotoBtnText}>Photo Library</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.samplePhotoBtn} onPress={handleUseSamplePhoto}>
                <Text style={styles.samplePhotoBtnText}>Use Sample Evidence Photo (Simulator Fallback)</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 1-Tap Bypass Option (DEC-001) */}
          <TouchableOpacity
            style={styles.bypassBtn}
            onPress={handleSkipPhotoEvidence}
          >
            <Text style={styles.bypassBtnTitle}>
              Skip Photo Evidence (DEC-001 Prototype Option)
            </Text>
            <Text style={styles.bypassBtnSub}>
              No visible pre-existing damage — fast 1-tap counter intake bypass.
            </Text>
          </TouchableOpacity>

          {/* DEC-001 Disclosure */}
          <View style={styles.decCallout}>
            <Text style={styles.decCalloutText}>
              <Text style={styles.boldText}>Photo Policy Invariant (DEC-001):</Text> Pre-existing
              condition photos are optional when no damage is detected. Skipping photo records that photo
              evidence was skipped; it does NOT verify pristine condition or affirm damage-free status
              pending DEC-001 policy sign-off.
            </Text>
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backStepBtn} onPress={() => setCurrentStep(2)}>
              <Text style={styles.backStepBtnText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* STEP 4: Zone Allocation & Final Confirmation */}
      {currentStep === 4 && (
        <View style={styles.stepCard}>
          <Text style={styles.stepCardTitle}>Step 4: Zone Allocation & Confirmation</Text>
          <Text style={styles.stepCardSubtitle}>
            Designate storage vault rack or locker and activate luggage custody.
          </Text>

          {/* Zone Selector */}
          <Text style={styles.zoneSelectorLabel}>Select Vault Storage Zone:</Text>
          <View style={styles.zoneOptionRow}>
            {(
              [
                { id: "RACK-A", label: "Zone RACK-A", desc: "Standard Shelving" },
                { id: "LOCKER-B", label: "Zone LOCKER-B", desc: "Secured Lockers" },
                { id: "FLOOR-C", label: "Zone FLOOR-C", desc: "Oversized Luggage" }
              ] as const
            ).map((zone) => {
              const isSelected = intakeSession.assignedZone === zone.id;
              return (
                <TouchableOpacity
                  key={zone.id}
                  style={[styles.zoneOption, isSelected && styles.zoneOptionSelected]}
                  onPress={() => updateIntake({ assignedZone: zone.id })}
                >
                  <Text style={[styles.zoneOptionTitle, isSelected && styles.zoneOptionTitleSelected]}>
                    {zone.label}
                  </Text>
                  <Text style={[styles.zoneOptionDesc, isSelected && styles.zoneOptionDescSelected]}>
                    {zone.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Staff Handling Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Staff Handling Notes (Optional):</Text>
            <TextInput
              style={styles.notesInput}
              value={intakeSession.staffNotes}
              onChangeText={(text) => updateIntake({ staffNotes: text })}
              placeholder="e.g. Fragile contents inside, handles taped"
              placeholderTextColor={mobileColors.sand[500]}
              multiline
            />
          </View>

          {/* Summary Manifest */}
          <View style={styles.finalSummaryCard}>
            <Text style={styles.finalSummaryTitle}>Custody Transfer Summary</Text>
            <View style={styles.finalSummaryRow}>
              <Text style={styles.summaryLabel}>Booking Reference:</Text>
              <Text style={styles.summaryValBold}>{booking.reference}</Text>
            </View>
            <View style={styles.finalSummaryRow}>
              <Text style={styles.summaryLabel}>Traveller Name:</Text>
              <Text style={styles.summaryVal}>{booking.travellerName}</Text>
            </View>
            <View style={styles.finalSummaryRow}>
              <Text style={styles.summaryLabel}>Reconciled Bags:</Text>
              <Text style={styles.summaryValBold}>{intakeSession.reconciledBags} Pieces</Text>
            </View>
            <View style={styles.finalSummaryRow}>
              <Text style={styles.summaryLabel}>Security Seal:</Text>
              <Text style={styles.summaryValCode}>
                {intakeSession.sealNumber}{intakeSession.sealIsDemoPlaceholder ? " (Demo Tag)" : " (Physical Seal)"}
              </Text>
            </View>
            <View style={styles.finalSummaryRow}>
              <Text style={styles.summaryLabel}>Condition Photo:</Text>
              <Text style={styles.summaryVal}>
                {intakeSession.photoEvidenceStatus === "CAPTURED_LOCAL"
                  ? "Recorded (Local Image)"
                  : "Skipped (DEC-001 Pending Sign-Off)"}
              </Text>
            </View>
            <View style={styles.finalSummaryRow}>
              <Text style={styles.summaryLabel}>Assigned Zone:</Text>
              <Text style={styles.summaryValBold}>Zone {intakeSession.assignedZone}</Text>
            </View>
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backStepBtn} onPress={() => setCurrentStep(3)}>
              <Text style={styles.backStepBtnText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmIntakeBtn} onPress={handleCompleteIntake}>
              <MobileIcon name="check" size={16} color="#FFFFFF" />
              <Text style={styles.confirmIntakeBtnText}>Activate Custody Storage</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Honest Prototype Notice */}
      <View style={styles.prototypeNoticeCard}>
        <MobileIcon name="info" size={16} color={mobileColors.terracotta[600]} />
        <Text style={styles.prototypeNoticeText}>
          <Text style={styles.boldText}>Intake Wizard Prototype:</Text> Bag counts, seal serials,
          and zone assignments update the local state store. Backend audit logs and automated traveller
          SMS notifications connect in Phase 3+.
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
  fallbackContainer: {
    flex: 1,
    backgroundColor: mobileColors.sand[100],
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginTop: 12,
    marginBottom: 6
  },
  fallbackSub: {
    fontSize: 13,
    color: mobileColors.navy[600],
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18
  },
  returnBtn: {
    backgroundColor: mobileColors.terracotta[600],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8
  },
  returnBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  pageTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  pageSubtitle: {
    fontSize: 12,
    color: mobileColors.navy[600]
  },
  stepperContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  stepItem: {
    alignItems: "center",
    flex: 1
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: mobileColors.sand[200],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4
  },
  stepDotActive: {
    backgroundColor: mobileColors.terracotta[600]
  },
  stepDotDone: {
    backgroundColor: "#15803D"
  },
  stepDotText: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.navy[700]
  },
  stepDotTextActive: {
    color: "#FFFFFF"
  },
  stepDotTextDone: {
    color: "#FFFFFF"
  },
  stepTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.navy[500]
  },
  stepTitleActive: {
    color: mobileColors.terracotta[600],
    fontWeight: "700"
  },
  stepTitleDone: {
    color: "#15803D"
  },
  stepCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  stepCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 4
  },
  stepCardSubtitle: {
    fontSize: 12,
    color: mobileColors.navy[600],
    lineHeight: 16,
    marginBottom: 16
  },
  reconcileBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: mobileColors.sand[100],
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  reconcileLabel: {
    fontSize: 13,
    color: mobileColors.navy[700]
  },
  reconcileBookedVal: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  counterBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    padding: 16,
    alignItems: "center",
    marginBottom: 20
  },
  counterTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[800],
    marginBottom: 12
  },
  counterControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20
  },
  counterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mobileColors.sand[200],
    justifyContent: "center",
    alignItems: "center"
  },
  counterBtnText: {
    fontSize: 22,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  counterValue: {
    fontSize: 32,
    fontWeight: "700",
    color: mobileColors.terracotta[600],
    width: 60,
    textAlign: "center"
  },
  mismatchAlert: {
    flexDirection: "row",
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    padding: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    gap: 6
  },
  mismatchAlertText: {
    flex: 1,
    fontSize: 11,
    color: "#B45309",
    lineHeight: 14
  },
  primaryNextBtn: {
    flexDirection: "row",
    backgroundColor: mobileColors.terracotta[600],
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: 1
  },
  primaryNextBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[800],
    marginBottom: 6
  },
  sealInput: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "700",
    color: mobileColors.navy[900],
    fontFamily: "monospace"
  },
  sealInputError: {
    borderColor: "#DC2626"
  },
  errorText: {
    fontSize: 11,
    color: "#DC2626",
    marginTop: 4
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.sand[100],
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    gap: 8,
    marginBottom: 16
  },
  generateBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.terracotta[600]
  },
  decCallout: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  decCalloutText: {
    fontSize: 11,
    color: mobileColors.navy[600],
    lineHeight: 15
  },
  boldText: {
    fontWeight: "700"
  },
  navRow: {
    flexDirection: "row",
    gap: 10
  },
  backStepBtn: {
    backgroundColor: mobileColors.sand[200],
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center"
  },
  backStepBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[800]
  },
  photoViewport: {
    height: 180,
    backgroundColor: mobileColors.sand[100],
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: mobileColors.sand[300],
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    marginBottom: 16
  },
  photoViewportTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.navy[800],
    marginTop: 8,
    marginBottom: 2
  },
  photoViewportSub: {
    fontSize: 11,
    color: mobileColors.navy[500],
    textAlign: "center",
    marginBottom: 12
  },
  photoCaptureRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8
  },
  captureBtn: {
    flexDirection: "row",
    backgroundColor: mobileColors.navy[900],
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: "center",
    gap: 6
  },
  captureBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF"
  },
  secondaryPhotoBtn: {
    flexDirection: "row",
    backgroundColor: mobileColors.sand[200],
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: "center",
    gap: 6
  },
  secondaryPhotoBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[800]
  },
  samplePhotoBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  samplePhotoBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.terracotta[600],
    textDecorationLine: "underline"
  },
  photoErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    gap: 6
  },
  photoErrorText: {
    flex: 1,
    fontSize: 11,
    color: "#DC2626"
  },
  photoPreviewCard: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    padding: 12,
    alignItems: "center",
    marginBottom: 16
  },
  photoPreviewImage: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    backgroundColor: mobileColors.sand[200]
  },
  photoPreviewBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    gap: 4
  },
  photoPreviewBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D"
  },
  photoPreviewActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    marginBottom: 10
  },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    gap: 4
  },
  retakeBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileColors.navy[800]
  },
  removePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4
  },
  removePhotoBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#DC2626"
  },
  primaryNextBtnFull: {
    flexDirection: "row",
    backgroundColor: mobileColors.terracotta[600],
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%"
  },
  bypassBtn: {
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 16
  },
  bypassBtnTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B45309",
    marginBottom: 2
  },
  bypassBtnSub: {
    fontSize: 11,
    color: "#92400E"
  },
  zoneSelectorLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[800],
    marginBottom: 8
  },
  zoneOptionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16
  },
  zoneOption: {
    flex: 1,
    backgroundColor: mobileColors.sand[100],
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    alignItems: "center"
  },
  zoneOptionSelected: {
    backgroundColor: "#FFFFFF",
    borderColor: mobileColors.terracotta[600],
    borderWidth: 2
  },
  zoneOptionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[800],
    marginBottom: 2
  },
  zoneOptionTitleSelected: {
    color: mobileColors.terracotta[600]
  },
  zoneOptionDesc: {
    fontSize: 10,
    color: mobileColors.navy[500],
    textAlign: "center"
  },
  zoneOptionDescSelected: {
    color: mobileColors.navy[700]
  },
  notesInput: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: mobileColors.navy[900],
    minHeight: 60
  },
  finalSummaryCard: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    gap: 6
  },
  finalSummaryTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 4
  },
  finalSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  summaryLabel: {
    fontSize: 12,
    color: mobileColors.navy[600]
  },
  summaryVal: {
    fontSize: 12,
    color: mobileColors.navy[800]
  },
  summaryValBold: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  summaryValCode: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.terracotta[600],
    fontFamily: "monospace"
  },
  confirmIntakeBtn: {
    flexDirection: "row",
    backgroundColor: "#15803D",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: 1
  },
  confirmIntakeBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  successCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#86EFAC"
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 6
  },
  successMessage: {
    fontSize: 13,
    color: "#15803D",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18
  },
  summaryBox: {
    width: "100%",
    backgroundColor: mobileColors.sand[100],
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  doneBtn: {
    width: "100%",
    backgroundColor: mobileColors.navy[900],
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center"
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF"
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
  }
});
