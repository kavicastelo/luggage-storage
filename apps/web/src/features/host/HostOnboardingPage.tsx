import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HOST_DOCUMENT_TYPES,
  HOST_ENTITY_TYPES,
  type HostDocumentType,
  type HostEntityType
} from "@luggage-storage/contracts";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileCheck2,
  MapPin,
  Upload
} from "lucide-react";
import { Alert, Badge, Button, Card, LoadingSkeleton, MascotIllustration } from "@/components/ui";
import { uploadFileToR2, validateFileForUpload } from "@/lib/r2-uploader";
import { useAuthStore } from "@/store/useAuthStore";
import { useHostContextStore } from "@/store/useHostContextStore";
import {
  useCreateBusinessMutation,
  useCreateLocationMutation,
  useHostVerificationQuery,
  useOwnedBusinessesQuery,
  useSubmitVerificationMutation
} from "@/hooks/queries/use-host-portal";
import { hostQueryKeys, useResolvedQueryClient } from "@/hooks/queries/query-keys";
import { SRI_LANKA_HUB_PRESETS } from "./host-helpers";

interface UploadedKycDocDraft {
  documentType: HostDocumentType;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

const DOC_TYPE_LABELS: Record<HostDocumentType, string> = {
  BUSINESS_REGISTRATION: "Business Registration Certificate (BRN)",
  NATIONAL_ID: "Director / Owner National ID (NIC)",
  PASSPORT: "Director / Owner Passport",
  UTILITY_BILL: "Recent Commercial Utility Bill",
  BANK_STATEMENT: "Business Bank Account Statement",
  PROOF_OF_ADDRESS: "Premises Proof of Address / Lease",
  OTHER: "Other Compliance Document"
};

export function HostOnboardingPage() {
  const qc = useResolvedQueryClient();
  const { isAuthenticated, user } = useAuthStore();
  const selectedBusinessId = useHostContextStore((state) => state.selectedBusinessId);
  const setSelectedBusinessId = useHostContextStore((state) => state.setSelectedBusinessId);
  const setSelectedLocationId = useHostContextStore((state) => state.setSelectedLocationId);

  const isHostOwnerOrAdmin = Boolean(
    user?.roles?.includes("HOST_OWNER") || user?.roles?.includes("SUPERADMIN")
  );
  const businessesQuery = useOwnedBusinessesQuery({
    enabled: isAuthenticated && isHostOwnerOrAdmin
  });
  const businesses = businessesQuery.data ?? [];

  const activeBusiness = useMemo(() => {
    if (selectedBusinessId) {
      const match = businesses.find((b) => b.id === selectedBusinessId);
      if (match) return match;
    }
    return businesses[0] ?? null;
  }, [businesses, selectedBusinessId]);

  const verificationQuery = useHostVerificationQuery(activeBusiness?.id, {
    enabled: isAuthenticated && Boolean(activeBusiness?.id)
  });

  const createBusinessMutation = useCreateBusinessMutation();
  const submitVerificationMutation = useSubmitVerificationMutation();
  const createLocationMutation = useCreateLocationMutation();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [createdLocationId, setCreatedLocationId] = useState<string | null>(null);

  // Step 1: Business form state
  const [legalBusinessName, setLegalBusinessName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [entityType, setEntityType] = useState<HostEntityType>("PRIVATE_LIMITED");
  const [brn, setBrn] = useState("");
  const [taxId, setTaxId] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [contactPhone, setContactPhone] = useState("+94771234567");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("Colombo");

  // Step 2: KYC uploads state
  const [docType, setDocType] = useState<HostDocumentType>("BUSINESS_REGISTRATION");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [stagedDocs, setStagedDocs] = useState<UploadedKycDocDraft[]>([]);

  // Step 3: First Storage Hub form state
  const [hubName, setHubName] = useState("");
  const [hubDescription, setHubDescription] = useState("");
  const [hubAddressLine1, setHubAddressLine1] = useState("");
  const [hubCity, setHubCity] = useState("Colombo");
  const [hubLatitude, setHubLatitude] = useState(6.9344);
  const [hubLongitude, setHubLongitude] = useState(79.8428);
  const [hubBookingMode, setHubBookingMode] = useState<"INSTANT" | "HOST_APPROVAL">("INSTANT");
  const [acceptsOversized, setAcceptsOversized] = useState(false);

  const effectiveStep: 1 | 2 | 3 = activeBusiness && step === 1 ? 2 : step;

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Card className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <MascotIllustration mascot="selfie" size="md" variant="bare" decorative />
          </div>
          <h1 className="text-2xl font-extrabold text-navy-950">
            Host Partner Onboarding
          </h1>
          <p className="text-sm text-navy-600 max-w-lg mx-auto">
            Sign in with your traveller or partner account to register a storage business, upload KYC documents, and publish your first hub in Sri Lanka.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              to="/login"
              state={{ from: { pathname: "/host/onboarding" } }}
              className="px-5 py-2.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold transition"
            >
              Sign In to Continue
            </Link>
            <Link
              to="/register"
              className="px-5 py-2.5 rounded-xl border border-sand-300 text-navy-900 hover:bg-sand-50 text-xs font-bold transition"
            >
              Create Account
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const created = await createBusinessMutation.mutateAsync({
        legalBusinessName: legalBusinessName.trim(),
        tradeName: tradeName.trim(),
        entityType,
        businessRegistrationNumber: brn.trim() || undefined,
        taxIdentifier: taxId.trim() || undefined,
        contactEmail: (contactEmail || user?.email || "").trim(),
        contactPhone: contactPhone.trim(),
        addressLine1: addressLine1.trim() || undefined,
        city: city.trim() || undefined,
        countryCode: "LK"
      });
      setSelectedBusinessId(created.id);
      setSuccessMsg(
        "Host business created and your account session has been promoted to Host Owner."
      );
      setStep(2);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to register host business.");
    }
  };

  const handleUploadKycDocument = async () => {
    if (!activeBusiness) {
      setErrorMsg("Register a business profile before uploading KYC documents.");
      return;
    }
    if (!selectedFile) {
      setErrorMsg("Choose a PDF or image document to upload.");
      return;
    }

    setErrorMsg(null);
    setUploadingFile(true);
    try {
      validateFileForUpload(selectedFile, "HOST_VERIFICATION");
      const uploaded = await uploadFileToR2({
        file: selectedFile,
        purpose: "HOST_VERIFICATION",
        resourceId: activeBusiness.id,
        documentType: docType
      });
      setStagedDocs((prev) => [
        ...prev,
        {
          documentType: docType,
          fileKey: uploaded.fileKey,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type
        }
      ]);
      setSelectedFile(null);
      setSuccessMsg(`Uploaded "${selectedFile.name}" directly to secure storage.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "KYC document upload failed.");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!activeBusiness) {
      setErrorMsg("No active host business selected.");
      return;
    }
    if (stagedDocs.length === 0) {
      setErrorMsg("Upload at least one KYC compliance document before submitting for review.");
      return;
    }

    setErrorMsg(null);
    try {
      await submitVerificationMutation.mutateAsync({
        businessId: activeBusiness.id,
        data: { documents: stagedDocs }
      });
      qc.invalidateQueries({ queryKey: hostQueryKeys.verification(activeBusiness.id) });
      setSuccessMsg("KYC verification package submitted for Superadmin compliance review.");
      setStep(3);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit KYC dossier.");
    }
  };

  const handleCreateFirstLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness) {
      setErrorMsg("Create your host business before adding a storage location.");
      return;
    }

    setErrorMsg(null);
    try {
      const loc = await createLocationMutation.mutateAsync({
        businessId: activeBusiness.id,
        name: hubName.trim(),
        description: hubDescription.trim() || undefined,
        addressLine1: hubAddressLine1.trim(),
        city: hubCity.trim(),
        countryCode: "LK",
        latitude: Number(hubLatitude),
        longitude: Number(hubLongitude),
        timezone: "Asia/Colombo",
        bookingMode: hubBookingMode,
        acceptsOversized,
        amenities: ["CCTV", "STAFF_ON_DUTY"]
      });
      setSelectedLocationId(loc.id);
      setCreatedLocationId(loc.id);
      setSuccessMsg(
        `Draft storage hub "${loc.name}" created. Configure hours, capacity, and pricing before submitting for moderation.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create storage hub.");
    }
  };

  const existingVerification = verificationQuery.data ?? null;
  const isBusinessesLoading = isHostOwnerOrAdmin && businessesQuery.isLoading;
  const hasSubmittedKyc = Boolean(
    existingVerification &&
      existingVerification.status !== "REJECTED" &&
      existingVerification.status !== "INFORMATION_REQUESTED"
  );

  return (
    <div className="min-h-screen bg-sand-50 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-terracotta-600">
                Sri Lanka Partner Program
              </p>
              <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight mt-0.5">
                Host Partner Onboarding
              </h1>
              <p className="text-xs text-navy-600 mt-1">
                Establish your business profile, upload KYC documents, and configure your first luggage storage hub.
              </p>
            </div>
            <Link
              to="/host/dashboard"
              className="text-xs font-bold text-navy-700 hover:text-navy-950 underline"
            >
              Open Host Dashboard
            </Link>
          </div>

          {/* 3-Step Indicator */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              { num: 1, title: "1. Business Entity", icon: Building2 },
              { num: 2, title: "2. KYC Documents", icon: FileCheck2 },
              { num: 3, title: "3. First Storage Hub", icon: MapPin }
            ].map((item) => {
              const Icon = item.icon;
              const isCurrent = effectiveStep === item.num;
              const isCompleted =
                (item.num === 1 && Boolean(activeBusiness)) ||
                (item.num === 2 &&
                  Boolean(existingVerification && existingVerification.status !== "REJECTED")) ||
                (item.num === 3 && Boolean(createdLocationId));

              return (
                <button
                  key={item.num}
                  type="button"
                  disabled={item.num > 1 && !activeBusiness}
                  onClick={() => setStep(item.num as 1 | 2 | 3)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-bold transition ${
                    isCurrent
                      ? "bg-navy-950 text-white border-navy-950"
                      : isCompleted
                        ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                        : "bg-sand-50 text-navy-600 border-sand-200 disabled:opacity-50"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.title}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {errorMsg && (
          <Alert variant="danger" title="Action Required">
            {errorMsg}
          </Alert>
        )}

        {successMsg && (
          <Alert variant="success" title="Progress Saved">
            {successMsg}
          </Alert>
        )}

        {isBusinessesLoading ? (
          <Card className="p-6 space-y-4">
            <LoadingSkeleton variant="text" className="w-60 h-6" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <LoadingSkeleton className="h-12 w-full" />
              <LoadingSkeleton className="h-12 w-full" />
              <LoadingSkeleton className="h-12 w-full" />
              <LoadingSkeleton className="h-12 w-full" />
            </div>
          </Card>
        ) : null}

        {/* Step 1: Register Host Business */}
        {!isBusinessesLoading && effectiveStep === 1 && (
          <form
            onSubmit={handleCreateBusiness}
            className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm space-y-5 text-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-navy-950">
                  Register Host Business Entity
                </h2>
                <p className="text-navy-600 mt-0.5">
                  Creating your partner business automatically upgrades your session to Host Owner permissions.
                </p>
              </div>
              <MascotIllustration mascot="selfie" size="sm" variant="bare" decorative />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Legal Registered Business Name
                </label>
                <input
                  type="text"
                  required
                  value={legalBusinessName}
                  onChange={(e) => setLegalBusinessName(e.target.value)}
                  placeholder="e.g. Serendib Transit Storage (Pvt) Ltd"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Trade / Brand Name
                </label>
                <input
                  type="text"
                  required
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="e.g. Serendib Vault Colombo"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Entity Type</label>
                <select
                  aria-label="Entity Type"
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value as HostEntityType)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                >
                  {HOST_ENTITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Business Registration Number (BRN)
                </label>
                <input
                  type="text"
                  value={brn}
                  onChange={(e) => setBrn(e.target.value)}
                  placeholder="e.g. PV-00123456"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Tax Identifier / TIN (Optional)
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="e.g. TIN-10928472"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Operations Contact Email
                </label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="ops@partner-storage.lk"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Operations Contact Phone
                </label>
                <input
                  type="text"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+94771234567"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-navy-900 mb-1">
                  Registered Office Address
                </label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="No. 42 Lotus Road, Colombo 01"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                isLoading={createBusinessMutation.isPending}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {createBusinessMutation.isPending
                  ? "Establishing Business..."
                  : "Register Business & Continue"}
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: KYC Verification Uploads */}
        {!isBusinessesLoading && effectiveStep === 2 && activeBusiness && (
          <Card className="p-6 space-y-5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sand-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-navy-950">
                  Upload KYC Verification Documents
                </h2>
                <p className="text-navy-600 mt-0.5">
                  Entity: <strong>{activeBusiness.legalBusinessName}</strong> ({activeBusiness.status})
                </p>
              </div>
              {existingVerification && (
                <Badge
                  variant={
                    existingVerification.status === "APPROVED"
                      ? "success"
                      : existingVerification.status === "REJECTED"
                        ? "danger"
                        : "warning"
                  }
                  size="md"
                >
                  Verification Status: {existingVerification.status}
                </Badge>
              )}
            </div>

            {hasSubmittedKyc && existingVerification && (
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <MascotIllustration mascot="selfie" size="xs" variant="bare" decorative />
                  <div className="space-y-1">
                    <p className="font-bold text-navy-950">
                      {existingVerification.status === "APPROVED"
                        ? "Business KYC Approved"
                        : "KYC Dossier Under Compliance Review"}
                    </p>
                    <p className="text-navy-700">
                      {existingVerification.documents.length} compliance document(s) on file. You can proceed straight to creating your first storage hub.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setStep(3)}
                  rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  Continue to Hub Setup
                </Button>
              </div>
            )}

            {existingVerification?.rejectionReason && (
              <Alert variant="warning" title="Verification Feedback">
                {existingVerification.rejectionReason}
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Document Type</label>
                <select
                  aria-label="KYC Document Type"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as HostDocumentType)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                >
                  {HOST_DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {DOC_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Select File (PDF, JPG, PNG, WebP — max 15 MB)
                </label>
                <input
                  type="file"
                  aria-label="KYC Document File"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-1.5 bg-sand-50"
                />
              </div>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!selectedFile || uploadingFile}
                  onClick={() => void handleUploadKycDocument()}
                  leftIcon={<Upload className="h-4 w-4" />}
                  className="w-full"
                >
                  {uploadingFile ? "Uploading to Storage..." : "Upload Document"}
                </Button>
              </div>
            </div>

            {stagedDocs.length > 0 && (
              <div className="space-y-2">
                <p className="font-bold text-navy-900">Uploaded Documents Ready for Submission</p>
                {stagedDocs.map((doc, idx) => (
                  <div
                    key={`${doc.fileKey}-${idx}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-sand-50 border border-sand-200"
                  >
                    <div>
                      <p className="font-bold text-navy-950">{doc.fileName}</p>
                      <p className="text-[11px] text-navy-600">
                        {DOC_TYPE_LABELS[doc.documentType]} • {Math.ceil(doc.fileSize / 1024)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setStagedDocs((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                      }
                      className="text-red-700 font-bold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-sand-100">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-xl border border-sand-300 text-navy-800 font-bold hover:bg-sand-50"
              >
                Skip to Hub Draft Setup
              </button>
              <Button
                type="button"
                disabled={stagedDocs.length === 0 || submitVerificationMutation.isPending}
                onClick={() => void handleSubmitVerification()}
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
              >
                {submitVerificationMutation.isPending
                  ? "Submitting Dossier..."
                  : "Submit KYC Verification & Continue"}
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Register First Draft Location */}
        {!isBusinessesLoading && effectiveStep === 3 && activeBusiness && (
          <Card className="p-6 space-y-5 text-xs">
            <div>
              <h2 className="text-base font-extrabold text-navy-950">
                Create Your First Storage Location Draft
              </h2>
              <p className="text-navy-600 mt-0.5">
                Create a draft hub for <strong>{activeBusiness.tradeName}</strong>, then finish hours, storage zones, photos, and pricing before requesting moderation approval.
              </p>
            </div>

            {createdLocationId ? (
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-4">
                <div className="flex items-start gap-3">
                  <MascotIllustration mascot="pointing" size="sm" variant="bare" decorative />
                  <div className="space-y-1">
                    <p className="font-bold text-emerald-950 text-sm">
                      Onboarding Setup Complete — Go-Live Checklist
                    </p>
                    <p className="text-emerald-800">
                      Your host business and first storage location draft are saved. Complete these 4 setup steps before submitting for Superadmin review:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      stepLabel: "1. Upload Hub Photos & Amenities",
                      to: `/host/locations/${createdLocationId}`
                    },
                    {
                      stepLabel: "2. Set Weekly Hours & Poya Calendar",
                      to: `/host/locations/${createdLocationId}/schedule`
                    },
                    {
                      stepLabel: "3. Configure Zones & Capacity Pools",
                      to: `/host/locations/${createdLocationId}/capacity`
                    },
                    {
                      stepLabel: "4. Set LKR Tiered Pricing Rules",
                      to: `/host/locations/${createdLocationId}/pricing`
                    }
                  ].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-emerald-200 hover:border-terracotta-400 font-bold text-navy-900 transition"
                    >
                      <span>{item.stepLabel}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-terracotta-600" />
                    </Link>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    to={`/host/locations/${createdLocationId}`}
                    className="px-4 py-2 rounded-xl bg-terracotta-500 text-white font-bold hover:bg-terracotta-600"
                  >
                    Open Location Profile Editor
                  </Link>
                  <Link
                    to="/host/dashboard"
                    className="px-4 py-2 rounded-xl bg-navy-900 text-white font-bold hover:bg-navy-800"
                  >
                    Go to Host Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateFirstLocation} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-navy-900 mb-1">
                      Storage Hub Display Name
                    </label>
                    <input
                      type="text"
                      required
                      value={hubName}
                      onChange={(e) => setHubName(e.target.value)}
                      placeholder="e.g. Colombo Fort Station Luggage Concierge"
                      className="w-full rounded-xl border border-sand-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-navy-900 mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={hubCity}
                      onChange={(e) => setHubCity(e.target.value)}
                      className="w-full rounded-xl border border-sand-300 px-3 py-2"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-navy-900 mb-1">
                      Exact Street Address (Masked Until Confirmed Booking)
                    </label>
                    <input
                      type="text"
                      required
                      value={hubAddressLine1}
                      onChange={(e) => setHubAddressLine1(e.target.value)}
                      placeholder="No. 14 Olcott Mawatha, Colombo 11"
                      className="w-full rounded-xl border border-sand-300 px-3 py-2"
                    />
                  </div>

                  {/* Quick Sri Lanka City Coordinate Presets */}
                  <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-navy-600">
                      Sri Lanka City Presets:
                    </span>
                    {SRI_LANKA_HUB_PRESETS.map((preset) => (
                      <button
                        key={preset.city}
                        type="button"
                        onClick={() => {
                          setHubCity(preset.city);
                          setHubLatitude(preset.latitude);
                          setHubLongitude(preset.longitude);
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition ${
                          hubCity.toLowerCase() === preset.city.toLowerCase()
                            ? "bg-navy-900 text-white border-navy-900"
                            : "bg-sand-50 text-navy-800 border-sand-300 hover:bg-sand-100"
                        }`}
                      >
                        {preset.city}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block font-bold text-navy-900 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={hubLatitude}
                      onChange={(e) => setHubLatitude(Number(e.target.value))}
                      className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-navy-900 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={hubLongitude}
                      onChange={(e) => setHubLongitude(Number(e.target.value))}
                      className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-navy-900 mb-1">Booking Mode</label>
                    <select
                      aria-label="Booking Mode"
                      value={hubBookingMode}
                      onChange={(e) =>
                        setHubBookingMode(e.target.value as "INSTANT" | "HOST_APPROVAL")
                      }
                      className="w-full rounded-xl border border-sand-300 px-3 py-2"
                    >
                      <option value="INSTANT">Instant Confirmation</option>
                      <option value="HOST_APPROVAL">Host Approval Required</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 font-bold text-navy-900">
                      <input
                        type="checkbox"
                        checked={acceptsOversized}
                        onChange={(e) => setAcceptsOversized(e.target.checked)}
                        className="rounded text-terracotta-500"
                      />
                      <span>Accepts Oversized Surfboards / Equipment</span>
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-navy-900 mb-1">
                      Public Description
                    </label>
                    <textarea
                      rows={3}
                      value={hubDescription}
                      onChange={(e) => setHubDescription(e.target.value)}
                      placeholder="Ground floor luggage desk 100m from the railway terminal..."
                      className="w-full rounded-xl border border-sand-300 px-3 py-2"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Link
                    to="/host/dashboard"
                    className="px-4 py-2.5 rounded-xl border border-sand-300 text-navy-800 font-bold hover:bg-sand-50"
                  >
                    Finish Later in Dashboard
                  </Link>
                  <Button type="submit" isLoading={createLocationMutation.isPending}>
                    {createLocationMutation.isPending
                      ? "Creating Location Draft..."
                      : "Create Draft Storage Hub"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
