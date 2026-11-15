import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { CustodyPassResponse } from "@luggage-storage/contracts";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { DEMO_BOOKINGS, DEMO_LOCATIONS, formatLkr } from "@/data/mock-marketplace";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { useAuthStore } from "@/store/useAuthStore";
import { marketplaceApi } from "@/services/marketplace-api";
import {
  useBookingDetailQuery,
  useCheckoutStatusQuery,
  useCreatePaymentIntentMutation,
  useIssueCustodyPassMutation,
  useSimulatePaymentMutation
} from "@/hooks/queries/use-traveller-bookings";
import { formatDateTimeDisplay, formatLkrMinor } from "@/lib/formatters";
import {
  clearPendingCheckoutContext,
  isPayHerePostHandoff,
  loadPendingCheckoutContext,
  parseCheckoutReturnQuery,
  savePendingCheckoutContext,
  submitPayHereCheckoutForm
} from "@/lib/payment-handoff";
import { CustodyQrPassCard } from "@/components/custody/CustodyQrPassCard";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function WebPaymentConfirmationPage() {
  const routeLocation = useLocation();
  const { isAuthenticated } = useAuthStore();

  const isDemoMode = isDemoPreviewActive({
    allowDemoPreview: true,
    search: routeLocation.search,
    isAuthenticated
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Booking Confirmation & Custody Pass — LuggageStorage";
    }
  }, []);

  const searchParams = new URLSearchParams(routeLocation.search);
  const returnFlags = useMemo(
    () => parseCheckoutReturnQuery(routeLocation.search),
    [routeLocation.search]
  );
  const isCancelRoute =
    routeLocation.pathname.endsWith("/cancel") || returnFlags.cancelledHint;
  const queryIntentId = searchParams.get("intentId")?.trim() || null;

  const [pendingContext, setPendingContext] = useState<ReturnType<typeof loadPendingCheckoutContext>>(
    null
  );
  useEffect(() => {
    setPendingContext(loadPendingCheckoutContext());
  }, []);

  const resolvedBookingId = returnFlags.bookingId || pendingContext?.bookingId || undefined;
  const resolvedOrderId = returnFlags.orderId || pendingContext?.orderId || undefined;
  const canQueryLiveStatus =
    !isDemoMode && isAuthenticated && Boolean(resolvedBookingId || resolvedOrderId);

  const checkoutStatusQuery = useCheckoutStatusQuery(
    resolvedBookingId || resolvedOrderId
      ? {
          ...(resolvedBookingId ? { bookingId: resolvedBookingId } : {}),
          ...(resolvedOrderId ? { orderId: resolvedOrderId } : {})
        }
      : null,
    {
      enabled: canQueryLiveStatus,
      refetchInterval: (queryState) => {
        const data = queryState.state.data;
        return data?.pollRecommended ? 3000 : false;
      }
    }
  );

  const effectiveBookingId =
    checkoutStatusQuery.data?.bookingId ?? resolvedBookingId;

  const bookingDetailQuery = useBookingDetailQuery(effectiveBookingId, {
    enabled: !isDemoMode && isAuthenticated && Boolean(effectiveBookingId)
  });

  const issuePassMutation = useIssueCustodyPassMutation();
  const createIntentMutation = useCreatePaymentIntentMutation();
  const simulateSandboxMutation = useSimulatePaymentMutation();

  const [issuedPass, setIssuedPass] = useState<CustodyPassResponse | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [manualVerifyStatus, setManualVerifyStatus] = useState<string | null>(null);
  const autoIssuedBookingRef = useRef<string | null>(null);

  const statusData = checkoutStatusQuery.data;
  const bookingData = bookingDetailQuery.data;
  const custodyReady =
    Boolean(statusData?.custodyReady) ||
    bookingData?.status === "CONFIRMED" ||
    bookingData?.status === "IN_STORAGE";

  const custodyOperation: "CHECK_IN" | "COLLECTION" =
    bookingData?.status === "IN_STORAGE" ? "COLLECTION" : "CHECK_IN";

  // Clear pending checkout once confirmed
  useEffect(() => {
    if (custodyReady && typeof window !== "undefined") {
      clearPendingCheckoutContext();
    }
  }, [custodyReady]);

  // Automatically issue custody pass once booking confirmation is verified
  useEffect(() => {
    if (!custodyReady || !effectiveBookingId || !isAuthenticated || isDemoMode) return;
    if (autoIssuedBookingRef.current === `${effectiveBookingId}:${custodyOperation}`) return;

    autoIssuedBookingRef.current = `${effectiveBookingId}:${custodyOperation}`;
    setPassError(null);
    issuePassMutation
      .mutateAsync({ bookingId: effectiveBookingId, operation: custodyOperation })
      .then((pass) => setIssuedPass(pass))
      .catch((err) => {
        setPassError(
          err instanceof Error ? err.message : "Could not generate custody pass automatically."
        );
      });
  }, [custodyReady, effectiveBookingId, custodyOperation, isAuthenticated, isDemoMode]);

  const handleIssueOrRegeneratePass = async () => {
    if (!effectiveBookingId) return;
    setPassError(null);
    try {
      const pass = await issuePassMutation.mutateAsync({
        bookingId: effectiveBookingId,
        operation: custodyOperation
      });
      setIssuedPass(pass);
    } catch (err) {
      setPassError(
        err instanceof Error ? err.message : "Failed to issue fresh Digital Custody Pass."
      );
    }
  };

  const handleManualStatusRefresh = async () => {
    if (!resolvedBookingId && !resolvedOrderId) return;
    setActionError(null);
    try {
      const fresh = await marketplaceApi.getCheckoutStatus({
        ...(resolvedBookingId ? { bookingId: resolvedBookingId } : {}),
        ...(resolvedOrderId ? { orderId: resolvedOrderId } : {})
      });
      setManualVerifyStatus(fresh.bookingStatus);
      await checkoutStatusQuery.refetch();
      if (effectiveBookingId) {
        await bookingDetailQuery.refetch();
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to verify latest checkout status."
      );
    }
  };

  const handleRetryPayment = async () => {
    if (!effectiveBookingId) return;
    setActionError(null);
    try {
      const intent = await createIntentMutation.mutateAsync({
        bookingId: effectiveBookingId,
        channel: "WEB"
      });
      savePendingCheckoutContext({
        bookingId: effectiveBookingId,
        intentId: intent.id,
        orderId: intent.providerOrderId,
        provider: intent.provider,
        channel: intent.checkoutChannel,
        createdAt: intent.createdAt
      });

      if (
        intent.checkoutChannel === "WEB" &&
        intent.nextAction === "REDIRECT_TO_PROVIDER" &&
        isPayHerePostHandoff(intent.checkoutHandoff)
      ) {
        submitPayHereCheckoutForm(intent.checkoutHandoff);
        return;
      }

      await checkoutStatusQuery.refetch();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to initiate retry payment session."
      );
    }
  };

  const handleCompleteSandboxPayment = async (outcome: "SUCCEEDED" | "FAILED") => {
    const activeIntentId = statusData?.paymentIntent?.id ?? queryIntentId ?? pendingContext?.intentId;
    if (!activeIntentId) return;
    setActionError(null);
    try {
      await simulateSandboxMutation.mutateAsync({
        intentId: activeIntentId,
        data: { outcome }
      });
      await checkoutStatusQuery.refetch();
      if (effectiveBookingId) {
        await bookingDetailQuery.refetch();
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Sandbox payment confirmation failed."
      );
    }
  };

  // Strict Demo Preview Rendering (only on unauthenticated ?preview=demo)
  if (isDemoMode) {
    const requestedLocId = searchParams.get("loc");
    const demoBooking = DEMO_BOOKINGS[0];
    const demoLocation =
      DEMO_LOCATIONS.find((l) => l.id === requestedLocId) ?? DEMO_LOCATIONS[0];

    return (
      <div className="space-y-8 pb-12 max-w-4xl mx-auto">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h1 className="text-2xl font-extrabold text-navy-950">
                Your Digital Custody Pass Is Ready
              </h1>
              <p className="text-sm text-emerald-900 mt-1">
                Inspection preview for {demoLocation.name} • {formatLkr(demoBooking.totalAmountLkr)}
              </p>
            </div>
          </div>
          <Badge variant="neutral" size="md">
            Demo Preview
          </Badge>
        </div>

        <CustodyQrPassCard
          referenceCode={demoBooking.reference}
          operation="CHECK_IN"
          qrPayload={demoBooking.qrPayload}
          verificationPin={demoBooking.pinCode}
          locationName={demoLocation.name}
          sealIds={["#SL-88410", ...demoBooking.sealIds]}
          zoneCode={demoBooking.zoneCode}
          isPreviewDemo={true}
        />
      </div>
    );
  }

  // Live Verification / Pending / Confirmed Experience
  const activeStatus =
    bookingData?.status ?? statusData?.bookingStatus ?? manualVerifyStatus;
  const activePaymentIntent = statusData?.paymentIntent;
  const holdDeadline = bookingData?.holdExpiresAt ?? statusData?.holdExpiresAt;

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {returnFlags.ignoredQueryPaymentClaim && (
        <Alert variant="info" title="Verifying Authoritative Payment Record">
          Payment gateway URL flags are treated strictly as return navigation hints. Booking status
          is confirmed exclusively against verified server webhook state.
        </Alert>
      )}

      {isCancelRoute && !custodyReady && (
        <Alert variant="warning" title="Checkout Session Returned Without Completion">
          No payment confirmation has been recorded yet. Your temporary capacity hold remains active
          until its deadline so you can retry payment cleanly.
        </Alert>
      )}

      {actionError && <Alert variant="danger">{actionError}</Alert>}

      {/* Server Verification Banner while status is resolving or unauthenticated SSR */}
      {!custodyReady && (
        <Card className="p-6 bg-white space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {checkoutStatusQuery.isFetching || !activeStatus ? (
                <Loader2 className="h-6 w-6 text-terracotta-500 animate-spin" />
              ) : (
                <Clock className="h-6 w-6 text-amber-600" />
              )}
              <div>
                <h1 className="text-2xl font-extrabold text-navy-950">
                  {activeStatus === "PENDING_HOST_APPROVAL"
                    ? "Awaiting Host Approval"
                    : activeStatus === "PENDING_PAYMENT"
                    ? "Payment Pending Verification"
                    : activeStatus
                    ? `Booking Status: ${activeStatus.replace(/_/g, " ")}`
                    : "Verifying Booking"}
                </h1>
                <p className="text-sm text-sand-700 mt-0.5">
                  {activeStatus === "PENDING_HOST_APPROVAL"
                    ? "The host has received your request and will approve or decline within 15 minutes."
                    : "Confirming live booking and payment settlement state with backend ledger."}
                </p>
              </div>
            </div>

            {(resolvedBookingId || resolvedOrderId) && isAuthenticated && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={checkoutStatusQuery.isFetching}
                onClick={handleManualStatusRefresh}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Status
              </Button>
            )}
          </div>

          {holdDeadline && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-950 flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Capacity Hold Expires At
              </span>
              <span className="font-mono font-bold">
                {formatDateTimeDisplay(holdDeadline)}
              </span>
            </div>
          )}

          {checkoutStatusQuery.isError && (
            <Alert variant="danger" title="Status Verification Failed">
              <div className="flex items-center justify-between gap-3">
                <span>
                  {checkoutStatusQuery.error instanceof Error
                    ? checkoutStatusQuery.error.message
                    : "Unable to query checkout verification status."}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void checkoutStatusQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            </Alert>
          )}

          {/* Sandbox Payment Action — only rendered when backend returns SANDBOX_SIMULATION */}
          {activePaymentIntent?.nextAction === "SANDBOX_SIMULATION" &&
            activeStatus === "PENDING_PAYMENT" && (
              <div className="rounded-xl border border-navy-200 bg-navy-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy-900">
                  <CreditCard className="h-4 w-4 text-terracotta-600" />
                  Sandbox Gateway Simulation ({activePaymentIntent.providerOrderId})
                </div>
                <p className="text-xs text-navy-800">
                  Authorize{" "}
                  <span className="font-mono font-bold">
                    {formatLkrMinor(
                      activePaymentIntent.amountMinor,
                      activePaymentIntent.currency
                    )}
                  </span>{" "}
                  through the development sandbox webhook simulator to finalize confirmation.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    isLoading={simulateSandboxMutation.isPending}
                    onClick={() => void handleCompleteSandboxPayment("SUCCEEDED")}
                  >
                    Authorize Sandbox Payment
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={simulateSandboxMutation.isPending}
                    onClick={() => void handleCompleteSandboxPayment("FAILED")}
                  >
                    Simulate Payment Failure
                  </Button>
                </div>
              </div>
            )}

          {(statusData?.canRetryPayment || isCancelRoute) &&
            effectiveBookingId &&
            activeStatus === "PENDING_PAYMENT" && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  isLoading={createIntentMutation.isPending}
                  onClick={handleRetryPayment}
                >
                  <CreditCard className="h-4 w-4" />
                  Retry Payment
                </Button>
                <Link
                  to="/portal/bookings"
                  className="text-sm font-bold text-navy-900 underline"
                >
                  Manage in Traveller Portal
                </Link>
              </div>
            )}
        </Card>
      )}

      {/* Confirmed / In-Storage Custody & Address Disclosure View */}
      {custodyReady && bookingData && (
        <>
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h1 className="text-2xl font-extrabold text-navy-950">
                  Your Digital Custody Pass Is Ready
                </h1>
                <p className="text-sm text-emerald-900 mt-1">
                  Reference{" "}
                  <span className="font-mono font-bold">{`#${bookingData.referenceCode}`}</span> •{" "}
                  {formatLkrMinor(bookingData.totalAmountMinor, bookingData.currency)} settled
                </p>
              </div>
            </div>
            <Link
              to="/portal/bookings"
              className="px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-bold hover:bg-navy-800"
            >
              View All Bookings
            </Link>
          </div>

          {/* Unlocked Street Address & Entry Directions (post-confirmation OQ-012) */}
          <Card className="p-6 bg-white space-y-3 border border-emerald-200">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              Unlocked Drop-Off Address &amp; Counter Directions
            </div>
            <div className="flex items-start gap-2.5 text-sm text-navy-950">
              <MapPin className="h-5 w-5 text-terracotta-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-extrabold">{bookingData.location.name}</p>
                {bookingData.location.addressDisclosed && bookingData.location.addressLine1 ? (
                  <p className="font-medium text-sand-800">
                    {bookingData.location.addressLine1}
                    {bookingData.location.addressLine2
                      ? `, ${bookingData.location.addressLine2}`
                      : ""}
                    , {bookingData.location.city}
                    {bookingData.location.postalCode ? ` ${bookingData.location.postalCode}` : ""}
                  </p>
                ) : (
                  <p className="text-sand-700">
                    {bookingData.location.approximateArea}, {bookingData.location.city}
                  </p>
                )}
                {bookingData.location.directionsNotes && (
                  <p className="text-xs text-sand-700 bg-sand-50 border border-sand-200 rounded-lg px-3 py-2">
                    <span className="font-bold text-navy-900">Directions: </span>
                    {bookingData.location.directionsNotes}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {passError && (
            <Alert variant="danger" title="Unable to Issue Custody Credential">
              <div className="flex items-center justify-between gap-3">
                <span>{passError}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleIssueOrRegeneratePass}
                >
                  Retry
                </Button>
              </div>
            </Alert>
          )}

          {issuedPass ? (
            <CustodyQrPassCard
              referenceCode={issuedPass.referenceCode}
              operation={issuedPass.operation}
              qrPayload={issuedPass.qrToken}
              verificationPin={issuedPass.verificationPin}
              expiresAt={issuedPass.expiresAt}
              locationName={bookingData.location.name}
              isRegenerating={issuePassMutation.isPending}
              onRegenerate={handleIssueOrRegeneratePass}
            />
          ) : issuePassMutation.isPending ? (
            <Card className="p-8 text-center space-y-3 bg-white">
              <Loader2 className="h-6 w-6 animate-spin text-terracotta-500 mx-auto" />
              <p className="text-sm font-semibold text-navy-950">
                Generating single-use Digital Custody Pass...
              </p>
            </Card>
          ) : (
            <Card className="p-6 bg-white flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-sand-700">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Generate your fresh single-use QR pass and 6-digit PIN when ready.</span>
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={handleIssueOrRegeneratePass}
                isLoading={issuePassMutation.isPending}
              >
                Issue Check-In Pass
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
