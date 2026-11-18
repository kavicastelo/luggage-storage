import React, { useEffect, useState } from "react";
import { View, Text, Linking, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  HOST_DOCUMENT_TYPES,
  HOST_ENTITY_TYPES,
  type HostDocumentType,
  type HostEntityType,
  type SubmitVerificationDocumentItem
} from "@luggage-storage/contracts";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  FormSection,
  LoadingSkeleton,
  MascotIllustration,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  StatusBadge,
  TextInput
} from "../../src/components";
import {
  useBusinessVerificationQuery,
  useCreateBusinessMutation,
  useOwnedBusinessesQuery,
  useSubmitVerificationMutation,
  useUpdateBusinessMutation
} from "../../src/hooks";
import { marketplaceApi } from "../../src/services/marketplace-api";
import { normalizeApiError } from "../../src/services/api-client";
import { useAuthStore } from "../../src/store/useAuthStore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

const ALLOWED_KYC_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export default function HostOnboardingScreen() {
  const router = useRouter();
  const { user, refreshSessionAndUser } = useAuthStore();

  const businessesQuery = useOwnedBusinessesQuery(true);
  const existingBusiness = businessesQuery.data?.[0] ?? null;

  const verificationQuery = useBusinessVerificationQuery(existingBusiness?.id);
  const createMutation = useCreateBusinessMutation();
  const updateMutation = useUpdateBusinessMutation();
  const submitVerificationMutation = useSubmitVerificationMutation();

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [legalBusinessName, setLegalBusinessName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [entityType, setEntityType] = useState<HostEntityType>("SOLE_PROPRIETORSHIP");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState("");
  const [taxIdentifier, setTaxIdentifier] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [contactPhone, setContactPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("Colombo");
  const [postalCode, setPostalCode] = useState("");
  const [payoutBankName, setPayoutBankName] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [payoutAccountName, setPayoutAccountName] = useState("");
  const [payoutBranchCode, setPayoutBranchCode] = useState("");

  const [selectedDocType, setSelectedDocType] = useState<HostDocumentType>("BUSINESS_REGISTRATION");
  const [pendingDocs, setPendingDocs] = useState<SubmitVerificationDocumentItem[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [kycError, setKycError] = useState<string | null>(null);
  const [kycNotice, setKycNotice] = useState<string | null>(null);

  useEffect(() => {
    if (existingBusiness) {
      setLegalBusinessName(existingBusiness.legalBusinessName);
      setTradeName(existingBusiness.tradeName);
      setEntityType(existingBusiness.entityType);
      setBusinessRegistrationNumber(existingBusiness.businessRegistrationNumber ?? "");
      setTaxIdentifier(existingBusiness.taxIdentifier ?? "");
      setContactEmail(existingBusiness.contactEmail);
      setContactPhone(existingBusiness.contactPhone);
      setAddressLine1(existingBusiness.addressLine1 ?? "");
      setCity(existingBusiness.city ?? "Colombo");
      setPostalCode(existingBusiness.postalCode ?? "");
      setPayoutBankName(existingBusiness.payoutBankName ?? "");
      setPayoutAccountName(existingBusiness.payoutAccountName ?? "");
      setPayoutBranchCode(existingBusiness.payoutBranchCode ?? "");
      setPayoutAccountNumber("");
    }
  }, [existingBusiness]);

  const handleSaveBusiness = async () => {
    setFormError(null);
    setFormNotice(null);

    if (legalBusinessName.trim().length < 2 || tradeName.trim().length < 2) {
      setFormError("Legal business name and trade name must each be at least 2 characters.");
      return;
    }
    if (!contactEmail.includes("@") || contactPhone.trim().length < 7) {
      setFormError("Enter a valid business email and Sri Lanka phone number.");
      return;
    }

    try {
      if (existingBusiness) {
        await updateMutation.mutateAsync({
          businessId: existingBusiness.id,
          data: {
            legalBusinessName: legalBusinessName.trim(),
            tradeName: tradeName.trim(),
            entityType,
            businessRegistrationNumber: businessRegistrationNumber.trim() || null,
            taxIdentifier: taxIdentifier.trim() || null,
            contactEmail: contactEmail.trim(),
            contactPhone: contactPhone.trim(),
            addressLine1: addressLine1.trim() || null,
            city: city.trim() || null,
            postalCode: postalCode.trim() || null,
            countryCode: "LK",
            payoutBankName: payoutBankName.trim() || null,
            payoutAccountNumber: payoutAccountNumber.trim() || undefined,
            payoutAccountName: payoutAccountName.trim() || null,
            payoutBranchCode: payoutBranchCode.trim() || null
          }
        });
        setFormNotice("Partner business profile and payout details updated.");
      } else {
        await createMutation.mutateAsync({
          legalBusinessName: legalBusinessName.trim(),
          tradeName: tradeName.trim(),
          entityType,
          businessRegistrationNumber: businessRegistrationNumber.trim() || null,
          taxIdentifier: taxIdentifier.trim() || null,
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          addressLine1: addressLine1.trim() || null,
          city: city.trim() || null,
          postalCode: postalCode.trim() || null,
          countryCode: "LK",
          payoutBankName: payoutBankName.trim() || null,
          payoutAccountNumber: payoutAccountNumber.trim() || null,
          payoutAccountName: payoutAccountName.trim() || null,
          payoutBranchCode: payoutBranchCode.trim() || null
        });
        await refreshSessionAndUser();
        setFormNotice(
          "Partner business registered and HOST_OWNER session activated. Upload KYC documents below to submit for verification."
        );
      }
    } catch (err) {
      setFormError(normalizeApiError(err).message);
    }
  };

  const runThreeStepDocumentUpload = async (file: {
    uri: string;
    name: string;
    size: number;
    mimeType: string;
  }) => {
    if (!existingBusiness) {
      setKycError("Save your partner business profile before uploading verification documents.");
      return;
    }
    const normalizedMime = ALLOWED_KYC_MIMES.has(file.mimeType) ? file.mimeType : "image/jpeg";
    setKycError(null);
    setKycNotice(null);
    setIsUploadingDoc(true);

    try {
      const intent = await marketplaceApi.initiateUpload({
        purpose: "HOST_VERIFICATION",
        resourceType: "HOST_BUSINESS",
        resourceId: existingBusiness.id,
        fileName: file.name,
        fileSize: Math.max(1024, Math.round(file.size)),
        mimeType: normalizedMime
      });

      await marketplaceApi.uploadFileToPresignedUrl({
        uploadUrl: intent.uploadUrl,
        fileUri: file.uri,
        mimeType: normalizedMime
      });

      const confirmed = await marketplaceApi.confirmUpload({
        intentId: intent.intentId,
        fileKey: intent.fileKey,
        purpose: "HOST_VERIFICATION",
        resourceId: existingBusiness.id,
        documentType: selectedDocType,
        isPrimary: false
      });

      setPendingDocs((prev) => [
        ...prev,
        {
          documentType: selectedDocType,
          intentId: confirmed.intentId,
          fileKey: confirmed.fileKey,
          fileName: file.name,
          fileSize: Math.max(1024, Math.round(file.size)),
          mimeType: normalizedMime
        }
      ]);
      setKycNotice(`Uploaded ${file.name}. Tap Submit KYC Package when all documents are ready.`);
    } catch (err) {
      setKycError(normalizeApiError(err).message);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
        copyToCacheDirectory: true
      });
      if (res.canceled || !res.assets?.[0]) {
        return;
      }
      const asset = res.assets[0];
      await runThreeStepDocumentUpload({
        uri: asset.uri,
        name: asset.name || `kyc-${Date.now()}.pdf`,
        size: asset.size ?? 102400,
        mimeType: asset.mimeType || "application/pdf"
      });
    } catch {
      setKycError("Unable to open document picker on this device.");
    }
  };

  const handlePickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85
      });
      if (res.canceled || !res.assets?.[0]) {
        return;
      }
      const asset = res.assets[0];
      await runThreeStepDocumentUpload({
        uri: asset.uri,
        name: asset.fileName || `kyc-${Date.now()}.jpg`,
        size: asset.fileSize ?? 204800,
        mimeType: asset.mimeType || "image/jpeg"
      });
    } catch {
      setKycError("Unable to open photo library.");
    }
  };

  const handleSubmitVerification = async () => {
    if (!existingBusiness) {
      return;
    }
    if (pendingDocs.length === 0) {
      setKycError("Upload at least one verification document before submitting.");
      return;
    }
    setKycError(null);
    setKycNotice(null);
    try {
      await submitVerificationMutation.mutateAsync({
        businessId: existingBusiness.id,
        data: { documents: pendingDocs }
      });
      setPendingDocs([]);
      setKycNotice("KYC verification package submitted for administrator review.");
    } catch (err) {
      setKycError(normalizeApiError(err).message);
    }
  };

  const handlePreviewServerDoc = async (docId: string) => {
    setKycError(null);
    try {
      const result = await marketplaceApi.getVerificationDocumentDownloadUrl(docId);
      await Linking.openURL(result.downloadUrl);
    } catch (err) {
      setKycError(normalizeApiError(err).message);
    }
  };

  const verification = verificationQuery.data;

  return (
    <ScreenContainer
      keyboardAvoiding
      header={
        <SafeHeader
          title="Partner Onboarding & KYC"
          subtitle="Sri Lanka Business Profile & Bank Payouts"
          onBack={() => router.back()}
        />
      }
      testID="host-onboarding-screen"
    >
      {businessesQuery.isLoading ? (
        <LoadingSkeleton count={3} />
      ) : (
        <View style={styles.stack}>
          {existingBusiness ? (
            <Card variant="elevated" style={styles.cardGap}>
              <View style={styles.statusRow}>
                <View style={styles.statusCol}>
                  <Text style={styles.sectionLabel}>PARTNER ACCOUNT STATUS</Text>
                  <Text style={styles.businessName}>{existingBusiness.tradeName}</Text>
                </View>
                <StatusBadge status={existingBusiness.status} />
              </View>
              {existingBusiness.payoutAccountNumberMasked ? (
                <Badge
                  label={`Linked Bank: ${existingBusiness.payoutBankName || "LKR"} (${existingBusiness.payoutAccountNumberMasked})`}
                  variant="info"
                  icon="wallet"
                  size="sm"
                />
              ) : (
                <Badge label="Add Sri Lanka LKR payout bank details below" variant="warning" size="sm" />
              )}
              {existingBusiness.status === "ACTIVE" ? (
                <Button
                  title="Manage Storage Hubs"
                  variant="secondary"
                  rightIcon={<MobileIcon name="arrow-right" size={16} color={mobileColors.white} />}
                  onPress={() => router.push("/(host)/locations")}
                />
              ) : null}
            </Card>
          ) : (
            <Card variant="outlined" style={styles.infoBanner}>
              <Text style={styles.infoTitle}>Become a Verified Storage Partner</Text>
              <Text style={styles.infoBody}>
                Register your hotel, guesthouse, café, or luggage shop in Sri Lanka. Saving your
                business activates your partner owner permissions so you can submit KYC documents and
                configure storage hubs.
              </Text>
            </Card>
          )}

          <View style={styles.stepperRow} accessibilityRole="tablist">
            {(
              [
                { step: 1 as const, label: "1. Business", locked: false },
                { step: 2 as const, label: "2. Payout Bank", locked: false },
                { step: 3 as const, label: "3. KYC Docs", locked: !existingBusiness }
              ]
            ).map((item) => {
              const active = wizardStep === item.step;
              const done = wizardStep > item.step;
              return (
                <TouchableOpacity
                  key={item.step}
                  style={[
                    styles.stepPill,
                    active ? styles.stepPillActive : null,
                    done ? styles.stepPillDone : null,
                    item.locked ? styles.stepPillLocked : null
                  ]}
                  disabled={item.locked}
                  onPress={() => setWizardStep(item.step)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active, disabled: item.locked }}
                >
                  <Text
                    style={[
                      styles.stepPillText,
                      (active || done) ? styles.stepPillTextActive : null
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {wizardStep === 1 ? (
            <FormSection
              title={existingBusiness ? "1. Business Identity" : "1. Register Business"}
              subtitle="Legal identity and primary Sri Lanka contact details."
            >
              <TextInput
                label="Legal Business Name"
                required
                value={legalBusinessName}
                onChangeText={setLegalBusinessName}
                placeholder="Colombo Heritage Hospitality (Pvt) Ltd"
              />
              <TextInput
                label="Public Trade Name"
                required
                value={tradeName}
                onChangeText={setTradeName}
                placeholder="Fort Heritage Bag Storage"
              />

              <Text style={styles.fieldLabel}>Entity Type</Text>
              <View style={styles.chipsWrap}>
                {HOST_ENTITY_TYPES.map((type) => {
                  const selected = entityType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.pillChip, selected ? styles.pillChipActive : null]}
                      onPress={() => setEntityType(type)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.pillChipText,
                          selected ? styles.pillChipTextActive : null
                        ]}
                      >
                        {type.replace(/_/g, " ")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                label="Business Registration No. (BRC)"
                value={businessRegistrationNumber}
                onChangeText={setBusinessRegistrationNumber}
                placeholder="PV-00124567"
              />
              <TextInput
                label="Tax / TIN Identifier"
                value={taxIdentifier}
                onChangeText={setTaxIdentifier}
                placeholder="Optional TIN"
              />
              <TextInput
                label="Contact Email"
                required
                keyboardType="email-address"
                autoCapitalize="none"
                value={contactEmail}
                onChangeText={setContactEmail}
              />
              <TextInput
                label="Contact Phone"
                required
                keyboardType="phone-pad"
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="+94771234567"
              />
              <TextInput
                label="Registered Street Address"
                value={addressLine1}
                onChangeText={setAddressLine1}
                placeholder="100 Chatham Street, Fort"
              />
              <TextInput label="City" value={city} onChangeText={setCity} placeholder="Colombo" />
              <TextInput
                label="Postal Code"
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="00100"
              />

              {formError ? <ErrorState title="Validation Error" message={formError} /> : null}
              {formNotice ? (
                <View style={styles.successBanner} accessibilityRole="alert">
                  <MobileIcon
                    name="check-circle"
                    size={16}
                    color={mobileStatusTokens.successIcon}
                  />
                  <Text style={styles.successBannerText}>{formNotice}</Text>
                </View>
              ) : null}

              <Button
                title="Continue to Payout Bank"
                rightIcon={<MobileIcon name="arrow-right" size={16} color={mobileColors.white} />}
                onPress={() => setWizardStep(2)}
              />
            </FormSection>
          ) : null}

          {wizardStep === 2 ? (
            <FormSection
              title="2. LKR Payout Bank Details"
              subtitle="Bank account details used for manual LKR settlements."
            >
              <TextInput
                label="Bank Name"
                value={payoutBankName}
                onChangeText={setPayoutBankName}
                placeholder="Commercial Bank / Sampath Bank"
              />
              <TextInput
                label="Account Holder Name"
                value={payoutAccountName}
                onChangeText={setPayoutAccountName}
                placeholder="Account legal name"
              />
              <TextInput
                label={
                  existingBusiness?.payoutAccountNumberMasked
                    ? `Account Number (leave blank to keep ${existingBusiness.payoutAccountNumberMasked})`
                    : "Account Number"
                }
                keyboardType="numeric"
                value={payoutAccountNumber}
                onChangeText={setPayoutAccountNumber}
                placeholder="Enter full account number to set or rotate"
              />
              <TextInput
                label="Branch Code"
                value={payoutBranchCode}
                onChangeText={setPayoutBranchCode}
                placeholder="001"
              />

              {formError ? <ErrorState title="Validation Error" message={formError} /> : null}
              {formNotice ? (
                <View style={styles.successBanner} accessibilityRole="alert">
                  <MobileIcon
                    name="check-circle"
                    size={16}
                    color={mobileStatusTokens.successIcon}
                  />
                  <Text style={styles.successBannerText}>{formNotice}</Text>
                </View>
              ) : null}

              <Button
                title={existingBusiness ? "Save Business & Bank Details" : "Register Business"}
                isLoading={createMutation.isPending || updateMutation.isPending}
                onPress={() => {
                  void handleSaveBusiness();
                }}
              />
              {existingBusiness ? (
                <Button
                  title="Next: Upload KYC Docs"
                  variant="outline"
                  rightIcon={
                    <MobileIcon name="arrow-right" size={16} color={mobileColors.navy[900]} />
                  }
                  onPress={() => setWizardStep(3)}
                />
              ) : null}
            </FormSection>
          ) : null}

          {wizardStep === 3 && existingBusiness ? (
            <FormSection
              title="3. Partner KYC Verification Documents"
              subtitle="Upload clear PDF or image scans (max 15 MB each). Files are confirmed directly with storage before submission."
            >
              <MascotIllustration
                mascot="selfie"
                size="sm"
                variant="bare"
                caption="Capture crisp, uncropped photos or PDFs of your business registration & ID."
              />

              {verification ? (
                <View style={styles.kycStatusBox}>
                  <View style={styles.statusRow}>
                    <Text style={styles.fieldLabel}>Current Review Status</Text>
                    <StatusBadge status={verification.status} size="sm" />
                  </View>
                  {verification.rejectionReason ? (
                    <Text style={styles.rejectionText}>
                      Reviewer Note: {verification.rejectionReason}
                    </Text>
                  ) : null}
                  {verification.documents.map((doc) => (
                    <View key={doc.id} style={styles.docRow}>
                      <View style={styles.docCol}>
                        <Text style={styles.docName}>{doc.fileName}</Text>
                        <Text style={styles.docMeta}>
                          {doc.documentType} • {doc.status}
                        </Text>
                      </View>
                      <Button
                        title="Preview"
                        size="sm"
                        variant="outline"
                        onPress={() => {
                          void handlePreviewServerDoc(doc.id);
                        }}
                      />
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>Document Category</Text>
              <View style={styles.chipsWrap}>
                {HOST_DOCUMENT_TYPES.map((docType) => {
                  const selected = selectedDocType === docType;
                  return (
                    <TouchableOpacity
                      key={docType}
                      style={[styles.pillChip, selected ? styles.pillChipActive : null]}
                      onPress={() => setSelectedDocType(docType)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.pillChipText,
                          selected ? styles.pillChipTextActive : null
                        ]}
                      >
                        {docType.replace(/_/g, " ")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.uploadBtnRow}>
                <Button
                  title="Upload PDF / File"
                  variant="outline"
                  leftIcon={<MobileIcon name="file-text" size={16} color={mobileColors.navy[900]} />}
                  isLoading={isUploadingDoc}
                  onPress={() => {
                    void handlePickDocument();
                  }}
                  style={styles.flexBtn}
                />
                <Button
                  title="Upload Photo"
                  variant="outline"
                  leftIcon={<MobileIcon name="camera" size={16} color={mobileColors.navy[900]} />}
                  isLoading={isUploadingDoc}
                  onPress={() => {
                    void handlePickImage();
                  }}
                  style={styles.flexBtn}
                />
              </View>

              {pendingDocs.length > 0 ? (
                <View style={styles.pendingList}>
                  <Text style={styles.fieldLabel}>
                    Ready to Submit ({pendingDocs.length})
                  </Text>
                  {pendingDocs.map((item, idx) => (
                    <View key={`${item.fileKey}-${idx}`} style={styles.docRow}>
                      <Text style={styles.docName}>
                        {item.documentType}: {item.fileName}
                      </Text>
                      <Badge label="Confirmed" variant="success" size="sm" />
                    </View>
                  ))}
                </View>
              ) : null}

              {kycError ? <ErrorState title="Verification Error" message={kycError} /> : null}
              {kycNotice ? (
                <View style={styles.successBanner} accessibilityRole="alert">
                  <MobileIcon
                    name="check-circle"
                    size={16}
                    color={mobileStatusTokens.successIcon}
                  />
                  <Text style={styles.successBannerText}>{kycNotice}</Text>
                </View>
              ) : null}

              <Button
                title="Submit KYC Package for Review"
                isLoading={submitVerificationMutation.isPending}
                disabled={pendingDocs.length === 0}
                onPress={() => {
                  void handleSubmitVerification();
                }}
              />
            </FormSection>
          ) : null}
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
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: mobileSpacing[2]
  },
  statusCol: {
    flex: 1
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.terracotta[600],
    letterSpacing: 0.7
  },
  businessName: {
    ...mobileTypography.headingMd,
    color: mobileTextColors.primary
  },
  infoBanner: {
    backgroundColor: mobileStatusTokens.infoBg,
    borderColor: mobileStatusTokens.infoBorder,
    gap: 6
  },
  infoTitle: {
    ...mobileTypography.headingSm,
    color: mobileColors.navy[900]
  },
  infoBody: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary
  },
  fieldLabel: {
    ...mobileTypography.label,
    color: mobileTextColors.primary,
    marginTop: mobileSpacing[2]
  },
  choicesWrap: {
    gap: mobileSpacing[2]
  },
  kycStatusBox: {
    gap: mobileSpacing[2],
    padding: mobileSpacing[3],
    backgroundColor: mobileColors.sand[50],
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  rejectionText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.danger
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing[2],
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[200]
  },
  docCol: {
    flex: 1
  },
  docName: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.primary,
    fontWeight: "600"
  },
  docMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileTextColors.muted
  },
  uploadBtnRow: {
    flexDirection: "row",
    gap: mobileSpacing[2]
  },
  flexBtn: {
    flex: 1
  },
  pendingList: {
    gap: mobileSpacing[2]
  },
  stepperRow: {
    flexDirection: "row",
    gap: mobileSpacing[2]
  },
  stepPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  stepPillActive: {
    backgroundColor: mobileColors.navy[900],
    borderColor: mobileColors.navy[900]
  },
  stepPillDone: {
    backgroundColor: mobileColors.emerald[700],
    borderColor: mobileColors.emerald[700]
  },
  stepPillLocked: {
    opacity: 0.5
  },
  stepPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileTextColors.secondary
  },
  stepPillTextActive: {
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
