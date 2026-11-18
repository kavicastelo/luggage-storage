import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  HOST_DOCUMENT_TYPES,
  HOST_ENTITY_TYPES,
  type HostDocumentType,
  type HostEntityType
} from "@luggage-storage/contracts";
import { CheckCircle2, FileText, Info, Upload } from "lucide-react";
import { Alert, Button, Card, EmptyState, LoadingSkeleton, Modal } from "@/components/ui";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { uploadFileToR2, validateFileForUpload } from "@/lib/r2-uploader";
import { useAuthStore } from "@/store/useAuthStore";
import { useHostContextStore } from "@/store/useHostContextStore";
import {
  useCreateBusinessMutation,
  useHostPayoutDetailsQuery,
  useHostVerificationQuery,
  useOwnedBusinessesQuery,
  useSubmitVerificationMutation,
  useUpdateBusinessMutation
} from "@/hooks/queries/use-host-portal";
import { HostQueryErrorAlert } from "./host-helpers";
import { useHostVenue } from "./HostDashboardLayout";

interface StagedKycDoc {
  documentType: HostDocumentType;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export function HostBusinessProfileLegalPage() {
  const location = useLocation();
  const { isDemoActive } = useHostVenue();
  const { isAuthenticated, user } = useAuthStore();
  const showDemo =
    !isAuthenticated &&
    (isDemoActive ||
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));

  const storedBusinessId = useHostContextStore((state) => state.selectedBusinessId);
  const setStoredBusinessId = useHostContextStore((state) => state.setSelectedBusinessId);

  const businessesQuery = useOwnedBusinessesQuery({ enabled: isAuthenticated });
  const businesses = businessesQuery.data ?? [];

  const currentBusiness = useMemo(() => {
    if (businesses.some((b) => b.id === storedBusinessId)) {
      return businesses.find((b) => b.id === storedBusinessId) ?? null;
    }
    return businesses[0] ?? null;
  }, [businesses, storedBusinessId]);

  const verificationQuery = useHostVerificationQuery(currentBusiness?.id, {
    enabled: isAuthenticated && Boolean(currentBusiness?.id)
  });
  const payoutQuery = useHostPayoutDetailsQuery(currentBusiness?.id, {
    enabled: isAuthenticated && Boolean(currentBusiness?.id)
  });

  const createBusinessMutation = useCreateBusinessMutation();
  const updateBusinessMutation = useUpdateBusinessMutation();
  const submitVerificationMutation = useSubmitVerificationMutation();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create business fields
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [entityType, setEntityType] = useState<HostEntityType>("PRIVATE_LIMITED");
  const [brn, setBrn] = useState("");
  const [tin, setTin] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email ?? "");
  const [contactPhone, setContactPhone] = useState("+94771234567");
  const [city, setCity] = useState("Colombo");
  const [addressLine1, setAddressLine1] = useState("");

  // Payout edit fields
  const [bankName, setBankName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  // KYC upload fields
  const [docType, setDocType] = useState<HostDocumentType>("BUSINESS_REGISTRATION");
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [uploadingKyc, setUploadingKyc] = useState(false);
  const [stagedDocs, setStagedDocs] = useState<StagedKycDoc[]>([]);

  useEffect(() => {
    setEditingProfile(false);
  }, [currentBusiness?.id]);

  useEffect(() => {
    if (!currentBusiness) return;
    setBankName(payoutQuery.data?.payoutBankName ?? currentBusiness.payoutBankName ?? "");
    setBranchCode(payoutQuery.data?.payoutBranchCode ?? "");
    setAccountName(payoutQuery.data?.payoutAccountName ?? "");
  }, [currentBusiness, payoutQuery.data]);

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateModalError(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const created = await createBusinessMutation.mutateAsync({
        legalBusinessName: legalName.trim(),
        tradeName: tradeName.trim(),
        entityType,
        businessRegistrationNumber: brn.trim() || undefined,
        taxIdentifier: tin.trim() || undefined,
        contactEmail: (contactEmail || user?.email || "").trim(),
        contactPhone: contactPhone.trim(),
        city: city.trim() || undefined,
        addressLine1: addressLine1.trim() || undefined,
        countryCode: "LK"
      });
      setStoredBusinessId(created.id);
      setSuccessMsg("Host Business established successfully.");
      setShowCreateModal(false);
    } catch (err) {
      setCreateModalError(err instanceof Error ? err.message : "Failed to register host business.");
    }
  };

  const handleSaveProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBusiness) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updateBusinessMutation.mutateAsync({
        businessId: currentBusiness.id,
        data: {
          tradeName: tradeName.trim() || currentBusiness.tradeName,
          contactEmail: contactEmail.trim() || currentBusiness.contactEmail,
          contactPhone: contactPhone.trim() || currentBusiness.contactPhone,
          city: city.trim() || undefined,
          addressLine1: addressLine1.trim() || undefined
        }
      });
      setEditingProfile(false);
      setSuccessMsg("Business profile updated.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update business profile.");
    }
  };

  const handleSavePayoutDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBusiness) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updateBusinessMutation.mutateAsync({
        businessId: currentBusiness.id,
        data: {
          payoutBankName: bankName.trim() || undefined,
          payoutBranchCode: branchCode.trim() || undefined,
          payoutAccountName: accountName.trim() || undefined,
          payoutAccountNumber: accountNumber.trim() || undefined
        }
      });
      setAccountNumber("");
      setSuccessMsg("Payout bank settlement details saved.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update bank payout details.");
    }
  };

  const handleUploadKyc = async () => {
    if (!currentBusiness || !kycFile) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploadingKyc(true);
    try {
      validateFileForUpload(kycFile, "HOST_VERIFICATION");
      const uploaded = await uploadFileToR2({
        file: kycFile,
        purpose: "HOST_VERIFICATION",
        resourceId: currentBusiness.id,
        documentType: docType
      });
      setStagedDocs((prev) => [
        ...prev,
        {
          documentType: docType,
          fileKey: uploaded.fileKey,
          fileName: kycFile.name,
          fileSize: kycFile.size,
          mimeType: kycFile.type
        }
      ]);
      setKycFile(null);
      setSuccessMsg(`Uploaded "${kycFile.name}" directly to secure storage.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "KYC document upload failed.");
    } finally {
      setUploadingKyc(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!currentBusiness || stagedDocs.length === 0) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await submitVerificationMutation.mutateAsync({
        businessId: currentBusiness.id,
        data: { documents: stagedDocs }
      });
      setStagedDocs([]);
      setSuccessMsg("Verification dossier submitted for Superadmin compliance review.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit verification dossier.");
    }
  };

  const verification = verificationQuery.data ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Business Profile &amp; Legal Compliance
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Corporate registration certificate (BRN), Sri Lanka TIN/VAT status, KYC documents, and LKR bank payout settings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {currentBusiness ? (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-sand-100 text-navy-800 border border-sand-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Status: {currentBusiness.status}</span>
              </span>
            ) : (
              <>
                {showDemo && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-sand-100 text-navy-800 border border-sand-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-terracotta-600" />
                    <span>KYC Profile Preview (Demo Simulation)</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalError(null);
                    setShowCreateModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold shadow-sm transition"
                >
                  Register Host Business
                </button>
              </>
            )}
          </div>
        </div>

        {isAuthenticated && businesses.length > 1 && (
          <div className="mt-4 pt-4 border-t border-sand-100 flex items-center gap-3 text-xs">
            <label className="font-bold text-navy-800">Active Business:</label>
            <select
              aria-label="Active Business"
              value={currentBusiness?.id ?? ""}
              onChange={(e) => setStoredBusinessId(e.target.value)}
              className="rounded-xl border border-sand-300 px-3 py-1.5 font-semibold"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.legalBusinessName} ({b.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Honest Prototype Notice */}
      {showDemo && (
        <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
          <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-navy-950">Business Profile &amp; KYC (Demo Simulation):</strong>{" "}
            Corporate entities, tax identifiers (BRN/TIN), and verification records displayed here are sample fixtures for demo preview.
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <Alert variant="danger" title="Business Settings Error">
          {errorMsg}
        </Alert>
      )}

      {isAuthenticated && businessesQuery.isError && (
        <HostQueryErrorAlert
          message={
            businessesQuery.error instanceof Error
              ? businessesQuery.error.message
              : "Could not load host businesses."
          }
          onRetry={() => void businessesQuery.refetch()}
        />
      )}

      {isAuthenticated && businessesQuery.isLoading ? (
        <Card className="p-6 space-y-4">
          <LoadingSkeleton variant="text" className="w-56 h-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LoadingSkeleton className="h-14 w-full" />
            <LoadingSkeleton className="h-14 w-full" />
          </div>
        </Card>
      ) : currentBusiness ? (
        <>
          {/* Live Corporate Profile */}
          <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy-950">Corporate Registration Certificate</h2>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-sand-100 text-navy-800 border border-sand-300">
                  {currentBusiness.entityType.replace(/_/g, " ")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTradeName(currentBusiness.tradeName);
                    setContactEmail(currentBusiness.contactEmail);
                    setContactPhone(currentBusiness.contactPhone);
                    setCity(currentBusiness.city ?? "");
                    setAddressLine1(currentBusiness.addressLine1 ?? "");
                    setEditingProfile((prev) => !prev);
                  }}
                  className="px-3 py-1 rounded-lg border border-sand-300 text-xs font-bold text-navy-800 hover:bg-sand-50"
                >
                  {editingProfile ? "Cancel Edit" : "Edit Contact"}
                </button>
              </div>
            </div>

            {editingProfile ? (
              <form onSubmit={handleSaveProfileUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-navy-900 mb-1">Trade Name</label>
                  <input
                    type="text"
                    required
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    className="w-full rounded-xl border border-sand-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-navy-900 mb-1">Contact Email</label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full rounded-xl border border-sand-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-navy-900 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full rounded-xl border border-sand-300 px-3 py-2"
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
                  <label className="block font-bold text-navy-900 mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className="w-full rounded-xl border border-sand-300 px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={updateBusinessMutation.isPending}
                    className="px-4 py-2 rounded-xl bg-terracotta-500 text-white font-bold"
                  >
                    {updateBusinessMutation.isPending ? "Saving..." : "Save Profile Changes"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-navy-500">Registered Legal Entity:</span>
                  <p className="font-bold text-navy-950">{currentBusiness.legalBusinessName}</p>
                </div>
                <div>
                  <span className="text-navy-500">Trade / Display Name:</span>
                  <p className="font-bold text-navy-950">{currentBusiness.tradeName}</p>
                </div>
                <div>
                  <span className="text-navy-500">Registrar of Companies BRN:</span>
                  <p className="font-mono font-bold text-navy-950">
                    {currentBusiness.businessRegistrationNumber || "Pending submission"}
                  </p>
                </div>
                <div>
                  <span className="text-navy-500">Inland Revenue Department TIN:</span>
                  <p className="font-mono font-bold text-navy-950">
                    {currentBusiness.taxIdentifier || "Not registered"}
                  </p>
                </div>
                <div>
                  <span className="text-navy-500">Business Contact Email:</span>
                  <p className="font-medium text-navy-900">{currentBusiness.contactEmail}</p>
                </div>
                <div>
                  <span className="text-navy-500">Business Contact Phone:</span>
                  <p className="font-medium text-navy-900">{currentBusiness.contactPhone}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-navy-500">Registered Office Address:</span>
                  <p className="font-medium text-navy-900">
                    {currentBusiness.addressLine1 || "Colombo"}, {currentBusiness.city || "Sri Lanka"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Live KYC Verification & Document Upload */}
          <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm text-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy-950">KYC Verification &amp; Compliance Documents</h2>
              <span className="px-2.5 py-1 rounded-full font-bold bg-sand-100 border border-sand-300 text-navy-900">
                Verification: {verification?.status ?? "NOT_SUBMITTED"}
              </span>
            </div>

            {verification?.rejectionReason && (
              <Alert variant="warning" title="Compliance Review Note">
                {verification.rejectionReason}
              </Alert>
            )}

            {verification && verification.documents.length > 0 && (
              <div className="space-y-2">
                {verification.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-sand-50 border border-sand-200"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-terracotta-600" />
                      <div>
                        <p className="font-bold text-navy-900">{doc.fileName}</p>
                        <p className="text-[10px] text-navy-500">
                          {doc.documentType} • {doc.mimeType} • {Math.ceil(doc.fileSize / 1024)} KB
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sand-100 border border-sand-300 text-navy-800">
                      {doc.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {(!verification ||
              verification.status === "REJECTED" ||
              verification.status === "INFORMATION_REQUESTED") && (
              <div className="pt-3 border-t border-sand-100 space-y-3">
                <p className="font-bold text-navy-900">Upload &amp; Submit KYC Document Package</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block font-bold text-navy-800 mb-1">Document Type</label>
                    <select
                      aria-label="KYC Document Type"
                      value={docType}
                      onChange={(e) => setDocType(e.target.value as HostDocumentType)}
                      className="w-full rounded-xl border border-sand-300 px-3 py-2"
                    >
                      {HOST_DOCUMENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-navy-800 mb-1">Select File</label>
                    <input
                      type="file"
                      aria-label="Upload KYC File"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(e) => setKycFile(e.target.files?.[0] ?? null)}
                      className="w-full rounded-xl border border-sand-300 px-3 py-1.5 bg-sand-50"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!kycFile || uploadingKyc}
                    onClick={() => void handleUploadKyc()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-navy-900 text-white font-bold disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{uploadingKyc ? "Uploading..." : "Upload File"}</span>
                  </button>
                </div>

                {stagedDocs.length > 0 && (
                  <div className="space-y-2">
                    {stagedDocs.map((doc, idx) => (
                      <div
                        key={`${doc.fileKey}-${idx}`}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 border border-emerald-200"
                      >
                        <span className="font-bold text-emerald-950">
                          {doc.fileName} ({doc.documentType})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setStagedDocs((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-red-700 font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={submitVerificationMutation.isPending}
                      onClick={() => void handleSubmitVerification()}
                      className="px-4 py-2 rounded-xl bg-terracotta-500 text-white font-bold disabled:opacity-50"
                    >
                      {submitVerificationMutation.isPending
                        ? "Submitting..."
                        : "Submit KYC Documents for Review"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payout Bank Settlement Card */}
          <form
            onSubmit={handleSavePayoutDetails}
            className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm text-xs"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy-950">Payout Settlement Bank Details</h2>
              {payoutQuery.data?.payoutAccountNumberMasked && (
                <span className="font-mono font-bold text-navy-800">
                  Account: {payoutQuery.data.payoutAccountNumberMasked}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-navy-900 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Commercial Bank of Ceylon"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Branch Code</label>
                <input
                  type="text"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  placeholder="e.g. 001 (Colombo Fort)"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Account Holder Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Account Number (Enter to Set / Rotate)
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="•••• •••• ••••"
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={updateBusinessMutation.isPending}
                className="px-4 py-2 rounded-xl bg-navy-900 text-white font-bold disabled:opacity-50"
              >
                Save Payout Bank Details
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          {showDemo ? (
            <>
              <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-navy-950">Corporate Registration Certificate</h2>
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-sand-100 text-navy-800 border border-sand-300">
                    Sample Fixture
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-navy-500">Registered Legal Entity:</span>
                    <p className="font-bold text-navy-950">Ceylon Transit Hospitality (Pvt) Ltd</p>
                  </div>
                  <div>
                    <span className="text-navy-500">Registrar of Companies BRN:</span>
                    <p className="font-mono font-bold text-navy-950">PV-00294812</p>
                  </div>
                  <div>
                    <span className="text-navy-500">Inland Revenue Department TIN:</span>
                    <p className="font-mono font-bold text-navy-950">TIN-10928472-0001</p>
                  </div>
                  <div>
                    <span className="text-navy-500">VAT Status:</span>
                    <p className="font-bold text-emerald-700">Registered (VAT-10928472-7000)</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-navy-500">Registered Office Address:</span>
                    <p className="font-medium text-navy-900">
                      Level 4, East Tower, World Trade Center, Colombo 01, Sri Lanka
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-4 shadow-sm">
                <h2 className="text-sm font-bold text-navy-950">Verified Compliance Documentation</h2>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-sand-50 border border-sand-200">
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-terracotta-600" />
                      <div>
                        <p className="font-bold text-navy-900">
                          Certificate of Incorporation (Form 1 / Form 20)
                        </p>
                        <p className="text-[10px] text-navy-500">
                          Verified by Superadmin Compliance
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-navy-700 bg-sand-100 px-2 py-0.5 rounded border border-sand-300">
                      Sample Verification Status
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-sand-50 border border-sand-200">
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-terracotta-600" />
                      <div>
                        <p className="font-bold text-navy-900">
                          Commercial Premises Lease &amp; Insurance Cover
                        </p>
                        <p className="text-[10px] text-navy-500">
                          LKR 10,000,000 Public Liability Insurance Policy
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-navy-700 bg-sand-100 px-2 py-0.5 rounded border border-sand-300">
                      Sample Verification Status
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              mascot="salute"
              title="No Host Business Registered Yet"
              description="To operate storage locations, publish listings, and receive traveller payouts in Sri Lanka (LKR), you must register a Host Business entity."
              action={
                <>
                  {isAuthenticated && (
                    <Link
                      to="/host/onboarding"
                      className="px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold transition shadow-sm"
                    >
                      Launch Onboarding Wizard
                    </Link>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setCreateModalError(null);
                      setShowCreateModal(true);
                    }}
                  >
                    Start Business Registration
                  </Button>
                </>
              }
            />
          )}
        </>
      )}

      {/* Modal: Register Host Business */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        closeLabel="Close register host business modal"
        size="md"
        title="Register New Host Business"
      >
        <form onSubmit={handleCreateBusiness} className="space-y-4 text-xs">
          {createModalError && <Alert variant="danger">{createModalError}</Alert>}

          <div className="space-y-3">
            <div>
              <label className="block font-bold text-navy-900 mb-1">
                Legal Registered Entity Name
              </label>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full rounded-xl border border-sand-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-navy-900 mb-1">Trade / Brand Name</label>
              <input
                type="text"
                required
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                className="w-full rounded-xl border border-sand-300 px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <label className="block font-bold text-navy-900 mb-1">BRN (Optional)</label>
                <input
                  type="text"
                  value={brn}
                  onChange={(e) => setBrn(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-navy-900 mb-1">TIN (Optional)</label>
                <input
                  type="text"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Contact Phone</label>
                <input
                  type="text"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-navy-900 mb-1">Contact Email</label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full rounded-xl border border-sand-300 px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-navy-900 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-navy-900 mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="w-full rounded-xl border border-sand-300 px-3 py-2"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={createBusinessMutation.isPending}>
              {createBusinessMutation.isPending ? "Registering..." : "Create Business"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
