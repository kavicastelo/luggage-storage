import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  BAG_CATEGORIES,
  type BagCategory,
  type BagCustodyItemInput,
  type BookingDetail,
  type CustodyRecordDetail,
  type VerifyCustodyPassResponse
} from "@luggage-storage/contracts";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Info,
  RefreshCw,
  Search,
  ShieldCheck
} from "lucide-react";
import { isDemoPreviewActive } from "@/config/demo-preview";
import {
  hostQueryKeys,
  useResolvedQueryClient
} from "@/hooks/queries/query-keys";
import {
  useHostBookingDetailQuery,
  useHostBookingsQuery,
  useHostCustodyDetailQuery,
  useStorageZonesQuery
} from "@/hooks/queries/use-host-portal";
import { getBookingStatusDisplay } from "@/lib/booking-status";
import { executeCounterCustodyHandover } from "@/lib/counter-custody";
import { formatBagCategoryLabel, formatDateTimeDisplay } from "@/lib/formatters";
import { uploadFileToR2 } from "@/lib/r2-uploader";
import { marketplaceApi } from "@/services/marketplace-api";
import { useAuthStore } from "@/store/useAuthStore";
import { useHostVenue } from "./HostDashboardLayout";
import { HostQueryErrorAlert, isUuid } from "./host-helpers";

function buildDefaultBagRows(
  booking: BookingDetail | null,
  fallbackCount: number,
  sealPrefix: string,
  defaultZoneId: string
): BagCustodyItemInput[] {
  const rows: BagCustodyItemInput[] = [];
  if (booking && booking.items.length > 0) {
    let idx = 1;
    for (const item of booking.items) {
      for (let q = 0; q < item.quantity; q++) {
        rows.push({
          bagTagCode: `TAG-${String(idx).padStart(2, "0")}`,
          bagCategory: item.bagCategory,
          securitySealNumber: sealPrefix ? `${sealPrefix}-${idx}` : "",
          zoneId: defaultZoneId || null,
          photoFileKey: null,
          conditionNotes: ""
        });
        idx += 1;
      }
    }
  }
  const targetLen = booking ? rows.length : Math.max(1, fallbackCount);
  while (rows.length < targetLen) {
    const idx = rows.length + 1;
    rows.push({
      bagTagCode: `TAG-${String(idx).padStart(2, "0")}`,
      bagCategory: "BAG_MEDIUM",
      securitySealNumber: sealPrefix ? `${sealPrefix}-${idx}` : "",
      zoneId: defaultZoneId || null,
      photoFileKey: null,
      conditionNotes: ""
    });
  }
  return rows;
}

export function HostWebCheckInOutOperationsPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useResolvedQueryClient();
  const { isDemoActive, selectedLocationId } = useHostVenue();
  const { isAuthenticated, user } = useAuthStore();

  const showDemoOps =
    !isAuthenticated &&
    (isDemoActive ||
      isDemoPreviewActive({
        allowDemoPreview: true,
        search: location.search,
        isAuthenticated
      }));

  const initialRefParam = searchParams.get("ref") ?? "";
  const initialModeParam = searchParams.get("mode")?.toLowerCase();

  const [operationMode, setOperationMode] = useState<"CHECK_IN" | "CHECK_OUT">(
    initialModeParam === "checkout" ? "CHECK_OUT" : "CHECK_IN"
  );
  const [verificationMethod, setVerificationMethod] = useState<"QR_SCAN" | "PIN_FALLBACK">(
    "QR_SCAN"
  );
  const [lookupQuery, setLookupQuery] = useState(
    initialRefParam || (showDemoOps ? "LS-2026-8841" : "")
  );
  const [committedLookup, setCommittedLookup] = useState(initialRefParam);
  const [pinInput, setPinInput] = useState(showDemoOps ? "482910" : "");
  const [reconciledBags, setReconciledBags] = useState(showDemoOps ? 3 : 1);
  const [sealInput, setSealInput] = useState(showDemoOps ? "SEAL-LK-90211" : "");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [bagRows, setBagRows] = useState<BagCustodyItemInput[]>(() =>
    buildDefaultBagRows(null, 1, "", "")
  );
  const [bagCountExceptionReason, setBagCountExceptionReason] = useState("");
  const [collectionNotes, setCollectionNotes] = useState("");
  const [hasCollectionException, setHasCollectionException] = useState(false);
  const [exceptionNotes, setExceptionNotes] = useState("");

  const [manualBooking, setManualBooking] = useState<BookingDetail | null>(null);
  const [manualCustody, setManualCustody] = useState<CustodyRecordDetail | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [uploadingBagIndex, setUploadingBagIndex] = useState<number | null>(null);
  const [passVerification, setPassVerification] = useState<VerifyCustodyPassResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [handoverSuccessMessage, setHandoverSuccessMessage] = useState<string | null>(null);
  const [handoverErrorMessage, setHandoverErrorMessage] = useState<string | null>(null);

  const liveLocationId =
    isAuthenticated && !showDemoOps && isUuid(selectedLocationId)
      ? selectedLocationId
      : undefined;

  const lookupSearchParams = useMemo(() => {
    const trimmed = committedLookup.trim();
    return {
      ...(liveLocationId ? { locationId: liveLocationId } : {}),
      ...(trimmed && !isUuid(trimmed) ? { search: trimmed } : {}),
      limit: 20
    };
  }, [liveLocationId, committedLookup]);

  const bookingsQuery = useHostBookingsQuery(lookupSearchParams, {
    enabled: isAuthenticated && !showDemoOps
  });

  const cachedListBooking = useMemo(() => {
    if (!isAuthenticated || showDemoOps) return null;
    const trimmed = committedLookup.trim() || lookupQuery.trim();
    if (!trimmed) return null;

    const fromPrimary = (bookingsQuery.data?.bookings ?? []).find(
      (b) => b.id === trimmed || b.referenceCode.toUpperCase() === trimmed.toUpperCase()
    );
    if (fromPrimary) return fromPrimary;

    const cachedQueries = queryClient.getQueriesData<{ bookings: BookingDetail[] }>({
      queryKey: ["host", "bookings", "list"]
    });
    for (const [, data] of cachedQueries) {
      const hit = data?.bookings?.find(
        (b) => b.id === trimmed || b.referenceCode.toUpperCase() === trimmed.toUpperCase()
      );
      if (hit) return hit;
    }
    return null;
  }, [isAuthenticated, showDemoOps, committedLookup, lookupQuery, bookingsQuery.data, queryClient]);

  const resolvedBookingId =
    manualBooking?.id ??
    (isUuid(committedLookup.trim())
      ? committedLookup.trim()
      : cachedListBooking?.id ?? undefined);

  const bookingDetailQuery = useHostBookingDetailQuery(resolvedBookingId, {
    enabled: isAuthenticated && !showDemoOps && Boolean(resolvedBookingId)
  });
  const custodyDetailQuery = useHostCustodyDetailQuery(resolvedBookingId, {
    enabled: isAuthenticated && !showDemoOps && Boolean(resolvedBookingId)
  });

  const activeBooking: BookingDetail | null =
    manualBooking ?? bookingDetailQuery.data ?? cachedListBooking ?? null;
  const activeCustody: CustodyRecordDetail | null =
    manualCustody ?? custodyDetailQuery.data ?? null;

  const activeZoneLocationId = activeBooking?.location.id ?? liveLocationId;
  const zonesQuery = useStorageZonesQuery(activeZoneLocationId, {
    enabled: isAuthenticated && !showDemoOps && Boolean(activeZoneLocationId)
  });
  const liveZones = useMemo(
    () => (zonesQuery.data ?? []).filter((z) => z.isActive),
    [zonesQuery.data]
  );

  useEffect(() => {
    if (!activeBooking || showDemoOps) return;
    setReconciledBags(activeBooking.totalBags);
    setBagRows(buildDefaultBagRows(activeBooking, activeBooking.totalBags, sealInput, selectedZoneId));
  }, [activeBooking?.id]);

  const isBookingOverdue = useMemo(() => {
    if (!activeBooking || showDemoOps) return false;
    return (
      activeBooking.status === "IN_STORAGE" &&
      new Date(activeBooking.collectionAt).getTime() < Date.now()
    );
  }, [activeBooking, showDemoOps]);

  const resolveLiveBooking = async (rawInput: string): Promise<BookingDetail | null> => {
    const trimmed = rawInput.trim();
    const upperQuery = trimmed.toUpperCase();
    if (!trimmed) {
      throw new Error("Enter a booking reference code (e.g. LSB-...) or booking UUID first.");
    }
    if (isUuid(trimmed)) {
      const detail = await marketplaceApi.getHostBookingDetail(trimmed);
      const custody = await marketplaceApi.getCustodyDetailOrNull(detail.id);
      setManualBooking(detail);
      setManualCustody(custody);
      return detail;
    }

    const res = await marketplaceApi.getHostBookings({
      ...(liveLocationId ? { locationId: liveLocationId } : {}),
      search: trimmed,
      limit: 20
    });
    const exactMatch =
      res.bookings.find((b) => b.referenceCode.toUpperCase() === upperQuery) ??
      res.bookings[0] ??
      null;
    if (!exactMatch) {
      throw new Error(`No booking found matching "${trimmed}".`);
    }
    const detail = await marketplaceApi.getHostBookingDetail(exactMatch.id);
    const custody = await marketplaceApi.getCustodyDetailOrNull(detail.id);
    setManualBooking(detail);
    setManualCustody(custody);
    return detail;
  };

  const handleFindBooking = async () => {
    if (showDemoOps) return;
    setHandoverErrorMessage(null);
    setHandoverSuccessMessage(null);
    setPassVerification(null);
    setCommittedLookup(lookupQuery.trim());
    setLookupLoading(true);
    try {
      const detail = await resolveLiveBooking(lookupQuery);
      if (detail) {
        setReconciledBags(detail.totalBags);
        setBagRows(buildDefaultBagRows(detail, detail.totalBags, sealInput, selectedZoneId));
        if (detail.status === "IN_STORAGE" && !initialModeParam) {
          setOperationMode("CHECK_OUT");
        } else if (detail.status === "CONFIRMED" && !initialModeParam) {
          setOperationMode("CHECK_IN");
        }
      }
    } catch (err: unknown) {
      setManualBooking(null);
      setManualCustody(null);
      setHandoverErrorMessage(err instanceof Error ? err.message : "Booking lookup failed.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleBagCountChange = (nextCount: number) => {
    const safeCount = Math.min(20, Math.max(1, Number.isFinite(nextCount) ? nextCount : 1));
    setReconciledBags(safeCount);
    setBagRows((prev) => {
      if (safeCount === prev.length) return prev;
      if (safeCount < prev.length) return prev.slice(0, safeCount);
      const extended = [...prev];
      while (extended.length < safeCount) {
        const idx = extended.length + 1;
        extended.push({
          bagTagCode: `TAG-${String(idx).padStart(2, "0")}`,
          bagCategory: "BAG_MEDIUM",
          securitySealNumber: sealInput ? `${sealInput}-${idx}` : "",
          zoneId: selectedZoneId || null,
          photoFileKey: null,
          conditionNotes: ""
        });
      }
      return extended;
    });
  };

  const updateBagRow = (index: number, patch: Partial<BagCustodyItemInput>) => {
    setBagRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  const handleUploadBagEvidence = async (index: number, file: File | undefined) => {
    if (!file || !activeBooking) return;
    setHandoverErrorMessage(null);
    setUploadingBagIndex(index);
    try {
      const uploaded = await uploadFileToR2({
        file,
        purpose: "CUSTODY_EVIDENCE",
        resourceId: activeBooking.id
      });
      updateBagRow(index, { photoFileKey: uploaded.fileKey });
    } catch (err: unknown) {
      setHandoverErrorMessage(
        err instanceof Error ? err.message : "Unable to upload bag custody evidence photo."
      );
    } finally {
      setUploadingBagIndex(null);
    }
  };

  const handleVerifyPassOnly = async () => {
    setHandoverErrorMessage(null);
    setHandoverSuccessMessage(null);
    if (showDemoOps || !isAuthenticated) return;

    const trimmedCredential = pinInput.trim().replace(/\s+/g, "");
    if (!trimmedCredential) {
      setHandoverErrorMessage("Enter the traveller QR token or 6-digit PIN before verifying.");
      return;
    }

    try {
      const target = activeBooking ?? (await resolveLiveBooking(lookupQuery));
      if (!target) return;
      const result = await marketplaceApi.verifyCustodyPass(
        verificationMethod === "QR_SCAN"
          ? {
              bookingId: target.id,
              operation: operationMode === "CHECK_IN" ? "CHECK_IN" : "COLLECTION",
              qrToken: trimmedCredential
            }
          : {
              bookingId: target.id,
              operation: operationMode === "CHECK_IN" ? "CHECK_IN" : "COLLECTION",
              verificationPin: trimmedCredential
            }
      );
      setPassVerification(result);
    } catch (err: unknown) {
      setPassVerification(null);
      setHandoverErrorMessage(
        err instanceof Error ? err.message : "Unable to verify traveller custody pass."
      );
    }
  };

  const handleSimulateHandover = async () => {
    setHandoverErrorMessage(null);
    setHandoverSuccessMessage(null);
    setIsSubmitting(true);

    try {
      let targetQuery = lookupQuery.trim();
      if (!showDemoOps && isAuthenticated) {
        const resolved = activeBooking ?? (await resolveLiveBooking(targetQuery));
        if (resolved) {
          targetQuery = resolved.id;
        }
      }

      const outcome = await executeCounterCustodyHandover({
        operationMode,
        verificationMethod,
        lookupQuery: targetQuery,
        credentialInput: pinInput,
        reconciledBags,
        sealInput,
        collectionNotes,
        hasCollectionException,
        exceptionNotes,
        showDemoOps,
        isAuthenticated,
        ...(operationMode === "CHECK_IN" && !showDemoOps ? { bags: bagRows } : {}),
        ...(!showDemoOps && selectedZoneId ? { zoneId: selectedZoneId } : {}),
        ...(bagCountExceptionReason.trim()
          ? { bagCountExceptionReason: bagCountExceptionReason.trim() }
          : {})
      });

      if (outcome.kind === "validation_error" || outcome.kind === "live_error") {
        setIsSubmitting(false);
        setHandoverErrorMessage(outcome.message);
        return;
      }

      if (outcome.kind === "live_success") {
        setIsSubmitting(false);
        setHandoverSuccessMessage(outcome.message);
        setPassVerification(null);
        await queryClient.invalidateQueries({ queryKey: hostQueryKeys.all });
        if (activeBooking) {
          const refreshedCustody = await marketplaceApi.getCustodyDetailOrNull(activeBooking.id);
          const refreshedBooking = await marketplaceApi.getHostBookingDetail(activeBooking.id);
          setManualCustody(refreshedCustody);
          setManualBooking(refreshedBooking);
        }
        return;
      }

      setTimeout(() => {
        setIsSubmitting(false);
        setHandoverSuccessMessage(
          operationMode === "CHECK_IN"
            ? `Local Prototype Simulation: Custody Handover logged to workstation session for booking ${lookupQuery}. Reconciled ${reconciledBags} bags. Numbered Seal ${sealInput} logged. Acting staff: Roshan Fernando (staff-usr-204). (Requires API integration in Phase 3+)`
            : `Local Prototype Simulation: Baggage Release logged to workstation session for booking ${lookupQuery} via ${verificationMethod}. Reconciled ${reconciledBags} bags returned to guest. Custody cleared. (Requires API integration in Phase 3+)`
        );
      }, 700);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setHandoverErrorMessage(err instanceof Error ? err.message : "Counter verification failed.");
    }
  };

  return (
    <div className="space-y-6">
      {(bookingsQuery.isError || zonesQuery.isError) && (
        <HostQueryErrorAlert
          message={
            (bookingsQuery.error instanceof Error && bookingsQuery.error.message) ||
            (zonesQuery.error instanceof Error && zonesQuery.error.message) ||
            "Unable to load counter operations data."
          }
          onRetry={() => {
            void bookingsQuery.refetch();
            void zonesQuery.refetch();
          }}
        />
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl border border-sand-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Desk Counter Active
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
              Check-In &amp; Check-Out Desk
            </h1>
            <p className="text-xs text-navy-600 mt-0.5">
              Physical counter intake and release workstation with QR scan, 6-digit backup PIN,
              per-bag tagging, evidence upload, and tamper seal verification.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-sand-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setOperationMode("CHECK_IN");
                setHandoverSuccessMessage(null);
                setHandoverErrorMessage(null);
                setPassVerification(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                operationMode === "CHECK_IN"
                  ? "bg-terracotta-500 text-white shadow-xs"
                  : "text-navy-700 hover:text-navy-900"
              }`}
            >
              Intake Handover
            </button>
            <button
              type="button"
              onClick={() => {
                setOperationMode("CHECK_OUT");
                setHandoverSuccessMessage(null);
                setHandoverErrorMessage(null);
                setPassVerification(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                operationMode === "CHECK_OUT"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-navy-700 hover:text-navy-900"
              }`}
            >
              Release Pick-Up
            </button>
          </div>
        </div>
      </div>

      {/* Mode Notice */}
      <div className="rounded-xl bg-sand-100/90 border border-sand-300 p-4 text-xs text-navy-800 flex items-start gap-3">
        <Info className="h-4 w-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
        <div>
          {showDemoOps ? (
            <>
              <strong className="text-navy-950">
                Desktop Counter Workstation (Local Prototype Simulation):
              </strong>{" "}
              Supports manual barcode scanner input, booking lookup, or 6-digit backup PIN
              verification. Physical intake and releases in this demo session update client state
              only.
            </>
          ) : (
            <>
              <strong className="text-navy-950">Live Counter Custody Workstation:</strong> Look up
              by human reference code (e.g. <span className="font-mono">LSB-...</span>) or booking
              UUID, verify the traveller&apos;s QR scan token or 6-digit backup PIN, assign vault
              compartments, and record custody transitions.
            </>
          )}
        </div>
      </div>

      {/* Zero Possessory Lien Warning for Overdue Live Check-Out */}
      {!showDemoOps && operationMode === "CHECK_OUT" && isBookingOverdue && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 text-xs text-amber-950 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Zero Possessory Lien Policy — Mandatory Bag Release:</strong> This booking has
            passed its scheduled collection window. Upon valid QR or PIN verification, physical
            luggage must be released immediately without demanding off-platform cash at the counter.
          </div>
        </div>
      )}

      {/* Counter Workstation Card */}
      <div className="bg-white rounded-2xl border border-sand-200 p-6 space-y-5 shadow-sm">
        {/* Quick Demo Pre-fill */}
        {showDemoOps && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-bold text-navy-500">Quick Test Records:</span>
            <button
              type="button"
              onClick={() => {
                setLookupQuery("LS-2026-8841");
                setPinInput("482910");
                setReconciledBags(3);
                setSealInput("SEAL-LK-90211");
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 font-mono text-navy-900 font-bold"
            >
              LS-2026-8841 (Amaya)
            </button>
            <button
              type="button"
              onClick={() => {
                setLookupQuery("LS-2026-8842");
                setPinInput("739204");
                setReconciledBags(2);
                setSealInput("SEAL-LK-90214");
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 font-mono text-navy-900 font-bold"
            >
              LS-2026-8842 (Liam)
            </button>
            <button
              type="button"
              onClick={() => {
                setLookupQuery("LS-2026-8835");
                setPinInput("661928");
                setReconciledBags(2);
                setSealInput("SEAL-LK-88101");
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 font-mono text-navy-900 font-bold"
            >
              LS-2026-8835 (Henrik - Overdue)
            </button>
          </div>
        )}

        {/* Verification Method Toggle */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => setVerificationMethod("QR_SCAN")}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
              verificationMethod === "QR_SCAN"
                ? "bg-navy-900 text-white"
                : "bg-sand-100 text-navy-700 hover:bg-sand-200"
            }`}
          >
            Dynamic QR Scan Token (Primary)
          </button>
          <button
            type="button"
            onClick={() => setVerificationMethod("PIN_FALLBACK")}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
              verificationMethod === "PIN_FALLBACK"
                ? "bg-amber-600 text-white"
                : "bg-sand-100 text-navy-700 hover:bg-sand-200"
            }`}
          >
            6-Digit Backup PIN (Rate-Limited Fallback)
          </button>
        </div>

        {/* Counter Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Booking Reference or Lookup
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => {
                  setLookupQuery(e.target.value);
                  setManualBooking(null);
                  setManualCustody(null);
                }}
                placeholder={showDemoOps ? "LS-2026-8841" : "e.g. LSB-2026-... or Booking UUID"}
                className="flex-1 rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono font-bold text-navy-900"
              />
              {!showDemoOps && (
                <button
                  type="button"
                  disabled={lookupLoading}
                  onClick={() => void handleFindBooking()}
                  className="px-3 py-2 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold inline-flex items-center gap-1"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>{lookupLoading ? "..." : "Find"}</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block font-bold text-navy-900 mb-1">
              {verificationMethod === "QR_SCAN" ? "QR Token Payload" : "6-Digit Backup PIN"}
            </label>
            <input
              type="text"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder={verificationMethod === "QR_SCAN" ? "64-char QR hex token" : "6-digit PIN"}
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono font-bold text-navy-900"
            />
          </div>

          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Reconciled Physical Bag Count
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={reconciledBags}
              onChange={(e) => handleBagCountChange(Number(e.target.value))}
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono font-bold text-navy-900"
            />
          </div>
        </div>

        {/* Live Resolved Booking Summary Strip */}
        {!showDemoOps && activeBooking && (
          <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[11px] text-navy-500 font-bold uppercase">Matched Booking</span>
              <p className="font-mono font-bold text-navy-950">{activeBooking.referenceCode}</p>
              <p className="text-navy-700">
                {activeBooking.travellerDisplayName || "Verified Traveller"} •{" "}
                {getBookingStatusDisplay(activeBooking.status, {
                  collectionAt: activeBooking.collectionAt,
                  hasRefund: Boolean(activeBooking.refundSummary)
                }).label}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-navy-500 font-bold uppercase">
                Hub &amp; Collection Window
              </span>
              <p className="font-semibold text-navy-900">{activeBooking.location.name}</p>
              <p className="text-navy-600">{formatDateTimeDisplay(activeBooking.collectionAt)}</p>
            </div>
            <div>
              <span className="text-[11px] text-navy-500 font-bold uppercase">
                Booked Bag Breakdown
              </span>
              <p className="font-semibold text-navy-900">{activeBooking.totalBags} Total Bags</p>
              <p className="text-navy-600">
                {activeBooking.items
                  .map((item) => `${item.quantity}× ${formatBagCategoryLabel(item.bagCategory)}`)
                  .join(", ")}
              </p>
            </div>
          </div>
        )}

        {/* Seal and Live Storage Zone Assignment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Tamper-Evident Security Seal Serial
            </label>
            <input
              type="text"
              value={sealInput}
              onChange={(e) => setSealInput(e.target.value)}
              placeholder="e.g. SEAL-LK-90211"
              className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-mono font-bold text-navy-900"
            />
            <p className="text-[10px] text-navy-500 mt-1">
              Inspect zip tag and apply physical seal before moving to vault.
            </p>
          </div>
          <div>
            <label className="block font-bold text-navy-900 mb-1">
              Assigned Vault Compartment
            </label>
            {showDemoOps ? (
              <select
                aria-label="Assigned Vault Compartment"
                defaultValue="RACK-A"
                className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-bold text-navy-900"
              >
                <option value="RACK-A">RACK-A: Main Steel Compartment A (Slot 12)</option>
                <option value="VAULT-B">VAULT-B: Back Climate-Controlled Bay (Slot 04)</option>
                <option value="SURF-C">SURF-C: Oversized Surf / Gear Bay</option>
              </select>
            ) : (
              <select
                aria-label="Assigned Vault Compartment"
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="w-full rounded-xl border border-sand-300 px-3 py-2 text-xs font-bold text-navy-900"
              >
                <option value="">General Facility Storage (No Specific Zone)</option>
                {liveZones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name} ({zone.zoneType} • {zone.securityTier})
                  </option>
                ))}
              </select>
            )}
            <p className="text-[10px] text-navy-500 mt-1">
              {showDemoOps
                ? "Logged to staff member Roshan Fernando."
                : `Logged to counter operator ${user?.displayName || user?.email || "active session"}.`}
            </p>
          </div>
        </div>

        {/* Live Per-Bag Tagging & Evidence Upload (CHECK_IN) */}
        {!showDemoOps && operationMode === "CHECK_IN" && (
          <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-navy-950">
                Per-Bag Physical Tags, Tamper Seals &amp; Photo Evidence
              </p>
              <span className="text-[11px] text-navy-600">
                Each checked-in bag requires a unique tag code.
              </span>
            </div>

            {activeBooking && bagRows.length !== activeBooking.totalBags && (
              <div>
                <label className="block font-bold text-amber-950 mb-1">
                  Bag Count Discrepancy Reason (booked {activeBooking.totalBags}, counting{" "}
                  {bagRows.length})
                </label>
                <input
                  type="text"
                  value={bagCountExceptionReason}
                  onChange={(e) => setBagCountExceptionReason(e.target.value)}
                  placeholder="Explain why physical bag count differs from reservation (min 5 chars)"
                  className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs text-navy-900"
                />
              </div>
            )}

            <div className="space-y-2.5">
              {bagRows.map((bag, index) => (
                <div
                  key={index}
                  className="p-3 rounded-xl bg-white border border-sand-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                >
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-navy-500 mb-1">
                      Bag Tag #{index + 1}
                    </label>
                    <input
                      type="text"
                      value={bag.bagTagCode}
                      onChange={(e) => updateBagRow(index, { bagTagCode: e.target.value })}
                      className="w-full rounded-lg border border-sand-300 px-2.5 py-1.5 text-xs font-mono font-bold text-navy-900"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-navy-500 mb-1">
                      Category
                    </label>
                    <select
                      value={bag.bagCategory}
                      onChange={(e) =>
                        updateBagRow(index, { bagCategory: e.target.value as BagCategory })
                      }
                      className="w-full rounded-lg border border-sand-300 px-2 py-1.5 text-xs font-semibold text-navy-900"
                    >
                      {BAG_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {formatBagCategoryLabel(cat)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-navy-500 mb-1">
                      Seal Number
                    </label>
                    <input
                      type="text"
                      value={bag.securitySealNumber ?? ""}
                      onChange={(e) =>
                        updateBagRow(index, { securitySealNumber: e.target.value })
                      }
                      placeholder="SEAL-..."
                      className="w-full rounded-lg border border-sand-300 px-2.5 py-1.5 text-xs font-mono text-navy-900"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] font-bold text-navy-500 mb-1">
                      Condition Notes
                    </label>
                    <input
                      type="text"
                      value={bag.conditionNotes ?? ""}
                      onChange={(e) => updateBagRow(index, { conditionNotes: e.target.value })}
                      placeholder="Intact / Scuff note"
                      className="w-full rounded-lg border border-sand-300 px-2.5 py-1.5 text-xs text-navy-900"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-navy-500 mb-1">
                      Evidence Photo
                    </label>
                    <label className="inline-flex items-center justify-center w-full gap-1 px-2.5 py-1.5 rounded-lg border border-sand-300 bg-sand-50 hover:bg-sand-100 text-[11px] font-bold text-navy-900 cursor-pointer">
                      <Camera className="h-3.5 w-3.5 text-terracotta-600" />
                      <span>
                        {uploadingBagIndex === index
                          ? "Uploading..."
                          : bag.photoFileKey
                            ? "Photo Attached"
                            : "Upload"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={!activeBooking || uploadingBagIndex !== null}
                        onChange={(e) => void handleUploadBagEvidence(index, e.target.files?.[0])}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Release Notes & Explicit Exception Toggle (CHECK_OUT) */}
        {operationMode === "CHECK_OUT" && (
          <div className="rounded-xl border border-sand-200 bg-sand-50/70 p-4 space-y-3 text-xs">
            {!showDemoOps && activeCustody && (
              <div className="text-[11px] text-navy-700 pb-1 border-b border-sand-200">
                Checked-in custody record:{" "}
                <strong>{activeCustody.checkedInBagCount ?? activeCustody.expectedBagCount}</strong>{" "}
                bags • Tags:{" "}
                <span className="font-mono">
                  {activeCustody.bags.map((b) => b.bagTagCode).join(", ") || "Pending"}
                </span>
              </div>
            )}
            <div>
              <label
                htmlFor="collection-handover-notes"
                className="block font-bold text-navy-900 mb-1"
              >
                Collection Handover Notes
              </label>
              <input
                id="collection-handover-notes"
                aria-label="Collection Handover Notes"
                type="text"
                value={collectionNotes}
                onChange={(e) => setCollectionNotes(e.target.value)}
                placeholder="Optional release note (e.g., all bags verified intact at counter)"
                className="w-full rounded-xl border border-sand-300 bg-white px-3 py-2 text-xs font-medium text-navy-900"
              />
            </div>

            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 font-bold text-navy-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCollectionException}
                  onChange={(e) => {
                    setHasCollectionException(e.target.checked);
                    if (!e.target.checked) {
                      setExceptionNotes("");
                    }
                  }}
                  className="h-4 w-4 rounded border-sand-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Report custody exception or discrepancy</span>
              </label>

              {hasCollectionException && (
                <div>
                  <label
                    htmlFor="custody-exception-details"
                    className="block font-bold text-amber-950 mb-1"
                  >
                    Custody Exception Details
                  </label>
                  <input
                    id="custody-exception-details"
                    aria-label="Custody Exception Details"
                    type="text"
                    value={exceptionNotes}
                    onChange={(e) => setExceptionNotes(e.target.value)}
                    placeholder="Describe damaged seal, missing item, or guest discrepancy (min 3 characters)"
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-navy-900"
                  />
                  <p className="text-[11px] text-amber-800 mt-1">
                    Reporting a custody exception records a disputed release and holds settlement
                    for supervisor review.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {!showDemoOps && (
            <button
              type="button"
              disabled={isSubmitting || !isAuthenticated}
              onClick={() => void handleVerifyPassOnly()}
              className="px-4 py-2.5 rounded-xl border border-navy-300 bg-white hover:bg-sand-50 text-navy-900 font-bold text-xs transition inline-flex items-center gap-1.5"
            >
              <ShieldCheck className="h-4 w-4 text-navy-700" />
              <span>Verify Pass Only</span>
            </button>
          )}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSimulateHandover()}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm transition flex items-center gap-2 ${
              operationMode === "CHECK_IN"
                ? "bg-terracotta-500 hover:bg-terracotta-600 disabled:bg-sand-400"
                : "bg-emerald-600 hover:bg-emerald-700 disabled:bg-sand-400"
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Verifying Handover...</span>
              </>
            ) : operationMode === "CHECK_IN" ? (
              <>
                <Check className="h-4 w-4" />
                <span>Confirm Check-In Handover</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Verify &amp; Release Bags</span>
              </>
            )}
          </button>
        </div>

        {/* Non-Consuming Pass Pre-Verification Result */}
        {passVerification && (
          <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-sky-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                Pass Verified ({passVerification.operation}): {passVerification.referenceCode}
              </p>
              <p className="text-[11px] text-sky-900">
                Expected Bags: {passVerification.expectedBagCount} • Custody Status:{" "}
                {passVerification.custodyStatus} (credential remains valid for final handover commit)
              </p>
            </div>
          </div>
        )}

        {/* Feedback Messages */}
        {handoverErrorMessage && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-xs font-bold text-rose-950 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p>{handoverErrorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleSimulateHandover()}
              className="px-3 py-1 rounded-lg bg-white border border-rose-300 text-rose-900 font-bold hover:bg-rose-100 transition"
            >
              Retry
            </button>
          </div>
        )}
        {handoverSuccessMessage && (
          <div
            role="status"
            className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-950 flex items-start gap-2.5"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p>{handoverSuccessMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
