import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type {
  BagCategory,
  BookingQuoteResponse,
  CheckoutCustomerDetails
} from "@luggage-storage/contracts";
import { BAG_CATEGORIES } from "@luggage-storage/contracts";
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Luggage,
  ShieldCheck,
  Sparkles,
  UserCheck
} from "lucide-react";
import { DEMO_LOCATIONS, formatLkr } from "@/data/mock-marketplace";
import { isDemoPreviewActive } from "@/config/demo-preview";
import { useAuthStore } from "@/store/useAuthStore";
import { usePublicLocationDetail } from "@/hooks/queries/use-discovery";
import {
  useCreateBookingMutation,
  useCreatePaymentIntentMutation
} from "@/hooks/queries/use-traveller-bookings";
import { marketplaceApi } from "@/services/marketplace-api";
import {
  formatBagCategoryLabel,
  formatLkrMinor,
  toIsoOffsetFromLocalInput
} from "@/lib/formatters";
import {
  isPayHerePostHandoff,
  savePendingCheckoutContext,
  submitPayHereCheckoutForm
} from "@/lib/payment-handoff";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { MascotIllustration } from "@/components/ui/MascotIllustration";
import { Textarea } from "@/components/ui/Textarea";
import {
  clearCheckoutDraft,
  countTotalBags,
  EMPTY_BILLING_STATE,
  isUuid,
  loadCheckoutDraft,
  parseTravellerScheduleParams,
  saveCheckoutDraft,
  type CheckoutBillingState,
  type TravellerBagCounts
} from "./traveller-utils";

const CHECKOUT_BAG_LABELS: Record<BagCategory, { title: string; hint: string }> = {
  BAG_SMALL: { title: "Small / Daypack", hint: "Backpacks, camera bags, laptop totes" },
  BAG_MEDIUM: { title: "Medium / Cabin Roller", hint: "Standard carry-on suitcase (up to 55cm)" },
  BAG_LARGE: { title: "Large / Check-In Case", hint: "Full-size travel trunk or suitcase" },
  BAG_OVERSIZED: { title: "Oversized Gear", hint: "Surfboards, bicycles, prams (hub permitting)" }
};

function generateClientIdempotencyKey(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function WebCheckoutSchedulePage() {
  const { locId } = useParams<{ locId: string }>();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { user, isAuthenticated } = useAuthStore();

  const isDemoMode = isDemoPreviewActive({
    allowDemoPreview: true,
    search: routeLocation.search,
    isAuthenticated
  });

  const validLiveUuid = !isDemoMode && isUuid(locId);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Checkout & Custody Schedule — LuggageStorage";
    }
  }, []);

  const parsedInitial = useMemo(
    () => parseTravellerScheduleParams(routeLocation.search),
    [routeLocation.search]
  );

  const [dropOffLocal, setDropOffLocal] = useState(parsedInitial.dropOffLocal);
  const [collectionLocal, setCollectionLocal] = useState(parsedInitial.collectionLocal);
  const [bags, setBags] = useState<TravellerBagCounts>(parsedInitial.bags);
  const [travellerNotes, setTravellerNotes] = useState("");
  const [billing, setBilling] = useState<CheckoutBillingState>(EMPTY_BILLING_STATE);
  const [billingExpanded, setBillingExpanded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"STRIPE" | "PAYPAL" | "SANDBOX_GATEWAY">("STRIPE");

  const [liveQuote, setLiveQuote] = useState<BookingQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteRetryCounter, setQuoteRetryCounter] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const bookingMutation = useCreateBookingMutation();
  const paymentIntentMutation = useCreatePaymentIntentMutation();

  const bookingIdempotencyRef = useRef<string | null>(null);

  // Restore saved draft in browser after /login round-trip
  useEffect(() => {
    if (isDemoMode || !validLiveUuid || !locId) return;
    const saved = loadCheckoutDraft(locId);
    if (!saved) return;

    const urlParams = new URLSearchParams(routeLocation.search);
    if (!urlParams.has("dropOffAt") && saved.dropOffLocal) {
      setDropOffLocal(saved.dropOffLocal);
    }
    if (!urlParams.has("collectionAt") && saved.collectionLocal) {
      setCollectionLocal(saved.collectionLocal);
    }
    if (
      !urlParams.has("smallBags") &&
      !urlParams.has("mediumBags") &&
      !urlParams.has("largeBags") &&
      !urlParams.has("oversizedBags")
    ) {
      setBags(saved.bags);
    }
    if (saved.travellerNotes) {
      setTravellerNotes(saved.travellerNotes);
    }
    setBilling(saved.billing);
  }, [isDemoMode, validLiveUuid, locId, routeLocation.search]);

  // Pre-fill name/email strictly for authenticated users when empty
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    setBilling((prev) => {
      if (prev.firstName || prev.email) return prev;
      const parts = (user.displayName || "").trim().split(/\s+/).filter(Boolean);
      return {
        ...prev,
        firstName: prev.firstName || parts[0] || "",
        lastName: prev.lastName || parts.slice(1).join(" ") || "",
        email: prev.email || user.email || ""
      };
    });
  }, [isAuthenticated, user]);

  const locationQuery = usePublicLocationDetail(locId, { enabled: validLiveUuid });
  const liveLocation = locationQuery.data;

  const dropOffIso = toIsoOffsetFromLocalInput(dropOffLocal);
  const collectionIso = toIsoOffsetFromLocalInput(collectionLocal);
  const scheduleValid =
    Boolean(dropOffIso && collectionIso) &&
    new Date(collectionIso).getTime() > new Date(dropOffIso).getTime();
  const totalBags = countTotalBags(bags);

  const oversizedBlocked = Boolean(liveLocation && !liveLocation.acceptsOversized);
  const isHostApprovalMode = liveLocation?.bookingMode === "HOST_APPROVAL";
  const showBillingFields = !isHostApprovalMode || billingExpanded;

  // Clear oversized count cleanly if location explicitly rejects oversized bags
  useEffect(() => {
    if (oversizedBlocked && bags.BAG_OVERSIZED > 0) {
      setBags((prev) => ({ ...prev, BAG_OVERSIZED: 0 }));
    }
  }, [oversizedBlocked, bags.BAG_OVERSIZED]);

  // Debounced server-authoritative quotation (300ms)
  useEffect(() => {
    if (!validLiveUuid || !locId || !scheduleValid || totalBags === 0) {
      setLiveQuote(null);
      setQuoteError(null);
      return;
    }

    const items = BAG_CATEGORIES.filter((cat) => bags[cat] > 0).map((cat) => ({
      bagCategory: cat,
      quantity: bags[cat]
    }));
    if (items.length === 0) return;

    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);

    const timer = setTimeout(() => {
      marketplaceApi
        .quoteBooking({
          locationId: locId,
          dropOffAt: dropOffIso,
          collectionAt: collectionIso,
          items
        })
        .then((quote) => {
          if (!cancelled) {
            setLiveQuote(quote);
            setQuoteLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setQuoteError(
              err instanceof Error ? err.message : "Failed to calculate server quote."
            );
            setLiveQuote(null);
            setQuoteLoading(false);
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [validLiveUuid, locId, dropOffIso, collectionIso, scheduleValid, bags, totalBags, quoteRetryCounter]);

  const persistDraftSnapshot = (
    nextDrop = dropOffLocal,
    nextCollect = collectionLocal,
    nextBags = bags,
    nextNotes = travellerNotes,
    nextBilling = billing
  ) => {
    if (isDemoMode || !validLiveUuid || !locId) return;
    saveCheckoutDraft({
      locId,
      dropOffLocal: nextDrop,
      collectionLocal: nextCollect,
      bags: nextBags,
      travellerNotes: nextNotes,
      billing: nextBilling,
      savedAt: new Date().toISOString()
    });
  };

  const adjustBagCount = (cat: BagCategory, delta: number) => {
    if (cat === "BAG_OVERSIZED" && oversizedBlocked && delta > 0) {
      return;
    }
    const nextCount = Math.max(0, Math.min(20, bags[cat] + delta));
    const nextBags = { ...bags, [cat]: nextCount };
    bookingIdempotencyRef.current = null;
    setBags(nextBags);
    persistDraftSnapshot(dropOffLocal, collectionLocal, nextBags, travellerNotes, billing);
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const demoTarget =
      DEMO_LOCATIONS.find((l) => l.id === locId || l.slug === locId) ?? DEMO_LOCATIONS[0];
    navigate(`/booking/confirm?loc=${encodeURIComponent(demoTarget.id)}&preview=demo`);
  };

  const handleLiveCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validLiveUuid || !locId) {
      setSubmitError("Missing or invalid storage location identifier.");
      return;
    }
    if (!scheduleValid) {
      setSubmitError("Pick-up time must be strictly after drop-off time.");
      return;
    }
    if (totalBags < 1) {
      setSubmitError("Select at least one bag to continue.");
      return;
    }

    if (!isAuthenticated) {
      persistDraftSnapshot();
      navigate("/login", { state: { from: routeLocation } });
      return;
    }

    if (liveQuote && !liveQuote.available) {
      setSubmitError(
        liveQuote.unavailabilityReason ||
          "Selected dates or capacity are unavailable at this location."
      );
      return;
    }

    const items = BAG_CATEGORIES.filter((cat) => bags[cat] > 0).map((cat) => ({
      bagCategory: cat,
      quantity: bags[cat]
    }));

    const trimmedBilling: CheckoutCustomerDetails = {};
    if (billing.firstName.trim()) trimmedBilling.firstName = billing.firstName.trim();
    if (billing.lastName.trim()) trimmedBilling.lastName = billing.lastName.trim();
    if (billing.email.trim()) trimmedBilling.email = billing.email.trim();
    if (billing.phone.trim()) trimmedBilling.phone = billing.phone.trim();
    if (billing.address.trim()) trimmedBilling.address = billing.address.trim();
    if (billing.city.trim()) trimmedBilling.city = billing.city.trim();
    if (billing.country.trim()) trimmedBilling.country = billing.country.trim();

    try {
      const idempotencyKey =
        bookingIdempotencyRef.current ?? generateClientIdempotencyKey("web-bkg");
      bookingIdempotencyRef.current = idempotencyKey;

      const createdBooking = await bookingMutation.mutateAsync({
        locationId: locId,
        dropOffAt: dropOffIso,
        collectionAt: collectionIso,
        items,
        idempotencyKey,
        travellerNotes: travellerNotes.trim() || undefined
      });

      clearCheckoutDraft(locId);

      if (createdBooking.status === "PENDING_HOST_APPROVAL") {
        navigate(`/booking/confirm?bookingId=${encodeURIComponent(createdBooking.id)}`);
        return;
      }

      const currentIntent = await paymentIntentMutation.mutateAsync({
        bookingId: createdBooking.id,
        channel: "WEB",
        provider: selectedProvider,
        idempotencyKey: generateClientIdempotencyKey("web-pay"),
        ...(Object.keys(trimmedBilling).length > 0
          ? { customerDetails: trimmedBilling }
          : {})
      });

      savePendingCheckoutContext({
        bookingId: createdBooking.id,
        intentId: currentIntent.id,
        orderId: currentIntent.providerOrderId,
        provider: currentIntent.provider,
        channel: currentIntent.checkoutChannel,
        createdAt: currentIntent.createdAt
      });

      if (currentIntent.nextAction === "STRIPE_ELEMENTS_CONFIRM") {
        navigate(
          `/booking/confirm?bookingId=${encodeURIComponent(
            createdBooking.id
          )}&intentId=${encodeURIComponent(currentIntent.id)}&provider=STRIPE`
        );
        return;
      }

      if (currentIntent.nextAction === "PAYPAL_CHECKOUT_APPROVE") {
        if (
          currentIntent.checkoutHandoff.mode === "PAYPAL_CHECKOUT" &&
          currentIntent.checkoutHandoff.approveUrl
        ) {
          window.location.href = currentIntent.checkoutHandoff.approveUrl;
          return;
        }
      }

      if (
        currentIntent.checkoutChannel === "WEB" &&
        currentIntent.nextAction === "REDIRECT_TO_PROVIDER" &&
        isPayHerePostHandoff(currentIntent.checkoutHandoff)
      ) {
        submitPayHereCheckoutForm(currentIntent.checkoutHandoff);
        return;
      }

      if (currentIntent.nextAction === "SANDBOX_SIMULATION") {
        navigate(
          `/booking/confirm?bookingId=${encodeURIComponent(
            createdBooking.id
          )}&intentId=${encodeURIComponent(currentIntent.id)}`
        );
        return;
      }

      navigate(`/booking/confirm?bookingId=${encodeURIComponent(createdBooking.id)}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Checkout failed before payment handoff. Please verify details and retry."
      );
    }
  };

  const submitCtaContent = !isAuthenticated ? (
    <>
      <UserCheck className="h-4 w-4" />
      <span>Sign In &amp; Continue</span>
    </>
  ) : liveLocation?.bookingMode === "HOST_APPROVAL" ? (
    <>
      <Sparkles className="h-4 w-4" />
      <span>Submit Approval Request</span>
    </>
  ) : (
    <span>Proceed to Payment</span>
  );

  // Strict Demo Preview Mode
  if (isDemoMode) {
    const demoLoc =
      DEMO_LOCATIONS.find((loc) => loc.id === locId || loc.slug === locId) ?? DEMO_LOCATIONS[0];
    const demoTotalLkr =
      bags.BAG_SMALL * demoLoc.dailyCapLkr.SMALL +
      bags.BAG_MEDIUM * demoLoc.dailyCapLkr.MEDIUM +
      bags.BAG_LARGE * demoLoc.dailyCapLkr.LARGE +
      bags.BAG_OVERSIZED * demoLoc.dailyCapLkr.OVERSIZED;

    return (
      <div className="space-y-8 pb-24 lg:pb-12 max-w-5xl mx-auto">
        <Alert variant="info" title="Demo & Prototype Mode">
          Viewing illustrative pricing and confirmation handoff preview for{" "}
          <span className="font-bold">{demoLoc.name}</span>. Switch out of demo preview to execute
          live bookings.
        </Alert>

        <form id="demo-checkout-form" onSubmit={handleDemoSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <h1 className="text-3xl font-extrabold text-navy-950">Checkout &amp; Custody Schedule</h1>

            <Card className="p-6 bg-white space-y-4">
              <h2 className="text-lg font-extrabold text-navy-950">
                1. Drop-off &amp; Pick-up Schedule
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Drop-off Time"
                  type="datetime-local"
                  value={dropOffLocal}
                  onChange={(e) => setDropOffLocal(e.target.value)}
                />
                <Input
                  label="Pick-up Time"
                  type="datetime-local"
                  value={collectionLocal}
                  onChange={(e) => setCollectionLocal(e.target.value)}
                />
              </div>
            </Card>

            <Card className="p-6 bg-white space-y-4">
              <h2 className="text-lg font-extrabold text-navy-950">
                2. Select Bag Sizes &amp; Quantities
              </h2>
              <div className="space-y-3">
                {BAG_CATEGORIES.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-sand-200 bg-sand-50"
                  >
                    <div>
                      <p className="text-sm font-bold text-navy-950">
                        {CHECKOUT_BAG_LABELS[cat].title}
                      </p>
                      <p className="text-xs text-sand-700">{CHECKOUT_BAG_LABELS[cat].hint}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Decrease ${CHECKOUT_BAG_LABELS[cat].title}`}
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => adjustBagCount(cat, -1)}
                      >
                        -
                      </Button>
                      <span className="w-7 text-center font-mono font-bold tabular-nums">
                        {bags[cat]}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Increase ${CHECKOUT_BAG_LABELS[cat].title}`}
                        className="min-h-[44px] min-w-[44px]"
                        onClick={() => adjustBagCount(cat, 1)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-5">
            <Card className="p-6 bg-white space-y-4">
              <h2 className="text-lg font-extrabold text-navy-950">Price Breakdown</h2>
              <div className="flex justify-between text-sm pt-2 border-t border-sand-200">
                <span className="font-bold text-navy-950">Total Payable</span>
                <span className="font-black text-navy-950 tabular-nums">{formatLkr(demoTotalLkr)}</span>
              </div>
              <Button type="submit" variant="primary" className="w-full">
                Proceed to Payment
              </Button>
            </Card>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 lg:pb-12 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={validLiveUuid ? `/locations/${locId}` : "/search"}
          className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-bold text-navy-900 hover:text-terracotta-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Facility Profile
        </Link>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-navy-50 border border-navy-200 text-xs font-semibold text-navy-900"
          title="Pricing, capacity locks, and taxes are verified directly by the backend before authorization."
        >
          <ShieldCheck className="h-3.5 w-3.5 text-terracotta-600 shrink-0" />
          <span>Server-Authoritative Checkout</span>
        </div>
      </div>

      {!validLiveUuid ? (
        <Alert variant="warning" title="Invalid Storage Location">
          Select an active verified storage hub from search to begin checkout.
        </Alert>
      ) : (
        <form
          id="live-checkout-form"
          onSubmit={handleLiveCheckoutSubmit}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
        >
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-extrabold text-navy-950">
                Checkout &amp; Custody Schedule
              </h1>
              {liveLocation ? (
                <p className="text-sm text-sand-700">
                  {liveLocation.name} • {liveLocation.approximateArea}, {liveLocation.city}
                </p>
              ) : locationQuery.isLoading ? (
                <LoadingSkeleton variant="text" className="w-2/3" />
              ) : null}
            </div>

            {locationQuery.isError && (
              <Alert variant="danger" title="Unable to Load Hub Metadata">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    {locationQuery.error instanceof Error
                      ? locationQuery.error.message
                      : "Failed to verify storage location configuration."}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void locationQuery.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              </Alert>
            )}

            {/* Step 1: Drop-off & Pick-up */}
            <Card className="p-6 bg-white space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-navy-950 flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-terracotta-500" />
                  1. Drop-off &amp; Pick-up Schedule
                </h2>
                {liveLocation && (
                  <span className="text-xs font-mono text-sand-700">
                    {liveLocation.timezone}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Drop-off Date & Time"
                  type="datetime-local"
                  required
                  value={dropOffLocal}
                  onChange={(e) => {
                    bookingIdempotencyRef.current = null;
                    setDropOffLocal(e.target.value);
                    persistDraftSnapshot(e.target.value, collectionLocal);
                  }}
                />
                <Input
                  label="Pick-up Date & Time"
                  type="datetime-local"
                  required
                  value={collectionLocal}
                  onChange={(e) => {
                    bookingIdempotencyRef.current = null;
                    setCollectionLocal(e.target.value);
                    persistDraftSnapshot(dropOffLocal, e.target.value);
                  }}
                />
              </div>

              {!scheduleValid && (
                <Alert variant="warning">
                  Pick-up time must be strictly after drop-off time.
                </Alert>
              )}
            </Card>

            {/* Step 2: Bag Selectors */}
            <Card className="p-6 bg-white space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-navy-950 flex items-center gap-2">
                  <Luggage className="h-5 w-5 text-terracotta-500" />
                  2. Select Bag Sizes &amp; Quantities
                </h2>
                <Badge variant="neutral" size="sm">
                  {totalBags} selected
                </Badge>
              </div>

              <div className="rounded-xl bg-sand-50 border border-sand-200 px-3.5 py-2.5">
                <MascotIllustration
                  mascot="blank-tag"
                  size="xs"
                  variant="inline"
                  caption="Pick the closest category per bag — each item gets its own tamper-evident tag at drop-off."
                />
              </div>

              {oversizedBlocked && (
                <Alert variant="warning">
                  This storage hub accepts Standard luggage only and cannot hold oversized surfboards
                  or bicycle boxes.
                </Alert>
              )}

              <div className="space-y-3">
                {BAG_CATEGORIES.map((cat) => {
                  const isOversizedDisabled = cat === "BAG_OVERSIZED" && oversizedBlocked;
                  return (
                    <div
                      key={cat}
                      className={`flex items-center justify-between gap-3 p-4 rounded-xl border ${
                        isOversizedDisabled
                          ? "border-sand-200 bg-sand-100/70 opacity-65"
                          : "border-sand-200 bg-sand-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-navy-950">
                          {CHECKOUT_BAG_LABELS[cat].title}
                        </p>
                        <p className="text-xs text-sand-700">{CHECKOUT_BAG_LABELS[cat].hint}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Decrease ${CHECKOUT_BAG_LABELS[cat].title}`}
                          className="min-h-[44px] min-w-[44px]"
                          disabled={bags[cat] === 0}
                          onClick={() => adjustBagCount(cat, -1)}
                        >
                          -
                        </Button>
                        <span className="w-7 text-center font-mono font-bold text-navy-950 tabular-nums">
                          {bags[cat]}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Increase ${CHECKOUT_BAG_LABELS[cat].title}`}
                          className="min-h-[44px] min-w-[44px]"
                          disabled={isOversizedDisabled}
                          onClick={() => adjustBagCount(cat, 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <Textarea
                  id="traveller-handover-notes"
                  label="Handover Notes for Host (Optional)"
                  rows={2}
                  maxLength={500}
                  value={travellerNotes}
                  onChange={(e) => {
                    setTravellerNotes(e.target.value);
                    persistDraftSnapshot(
                      dropOffLocal,
                      collectionLocal,
                      bags,
                      e.target.value,
                      billing
                    );
                  }}
                  placeholder="Flight arrival time, fragile contents note..."
                />
              </div>
            </Card>

            {/* Step 3: Payment Method Selector */}
            <Card className="p-6 bg-white space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-navy-950 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-terracotta-500" />
                  3. Select Payment Method
                </h2>
                <Badge variant="success" size="sm">
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                  PCI-DSS SAQ A
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  data-testid="payment-provider-stripe"
                  onClick={() => setSelectedProvider("STRIPE")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedProvider === "STRIPE"
                      ? "border-terracotta-500 bg-terracotta-50/50 shadow-sm ring-2 ring-terracotta-500"
                      : "border-sand-200 bg-sand-50 hover:bg-white"
                  }`}
                >
                  <p className="font-bold text-sm text-navy-950">Credit / Debit Card</p>
                  <p className="text-xs text-sand-600 mt-1">Visa, Mastercard, Amex, Apple/Google Pay</p>
                  <span className="inline-block mt-2 text-[10px] uppercase font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    Stripe Primary
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="payment-provider-paypal"
                  onClick={() => setSelectedProvider("PAYPAL")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedProvider === "PAYPAL"
                      ? "border-terracotta-500 bg-terracotta-50/50 shadow-sm ring-2 ring-terracotta-500"
                      : "border-sand-200 bg-sand-50 hover:bg-white"
                  }`}
                >
                  <p className="font-bold text-sm text-navy-950">PayPal</p>
                  <p className="text-xs text-sand-600 mt-1">PayPal Wallet &amp; Pay in 4</p>
                  <span className="inline-block mt-2 text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Alternative
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="payment-provider-sandbox"
                  onClick={() => setSelectedProvider("SANDBOX_GATEWAY")}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedProvider === "SANDBOX_GATEWAY"
                      ? "border-terracotta-500 bg-terracotta-50/50 shadow-sm ring-2 ring-terracotta-500"
                      : "border-sand-200 bg-sand-50 hover:bg-white"
                  }`}
                >
                  <p className="font-bold text-sm text-navy-950">Sandbox Sim</p>
                  <p className="text-xs text-sand-600 mt-1">Instant simulator for testing</p>
                  <span className="inline-block mt-2 text-[10px] uppercase font-bold text-sand-600 bg-sand-100 px-2 py-0.5 rounded border border-sand-300">
                    Dev / Test
                  </span>
                </button>
              </div>
            </Card>

            {/* Step 4: Billing Details */}
            <Card className="p-6 bg-white space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-navy-950 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-terracotta-500" />
                  4. Traveller Billing &amp; Contact Details
                </h2>
                {isHostApprovalMode ? (
                  <button
                    type="button"
                    aria-expanded={showBillingFields}
                    onClick={() => setBillingExpanded((prev) => !prev)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sand-200 bg-sand-50 text-xs font-bold text-navy-900 hover:bg-sand-100 transition-colors"
                  >
                    <span>
                      {showBillingFields ? "Hide Billing Details" : "Add Optional Billing Details"}
                    </span>
                    {showBillingFields ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="text-xs text-sand-600">256-bit encrypted checkout</span>
                )}
              </div>

              {isHostApprovalMode && !showBillingFields && (
                <p className="text-xs text-sand-700">
                  Payment is only requested after the host approves your storage request. You can
                  optionally pre-fill billing details now.
                </p>
              )}

              {showBillingFields && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={billing.firstName}
                    onChange={(e) => {
                      const next = { ...billing, firstName: e.target.value };
                      setBilling(next);
                      persistDraftSnapshot(dropOffLocal, collectionLocal, bags, travellerNotes, next);
                    }}
                    placeholder="First name"
                  />
                  <Input
                    label="Last Name"
                    value={billing.lastName}
                    onChange={(e) => {
                      const next = { ...billing, lastName: e.target.value };
                      setBilling(next);
                      persistDraftSnapshot(dropOffLocal, collectionLocal, bags, travellerNotes, next);
                    }}
                    placeholder="Last name"
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    value={billing.email}
                    onChange={(e) => {
                      const next = { ...billing, email: e.target.value };
                      setBilling(next);
                      persistDraftSnapshot(dropOffLocal, collectionLocal, bags, travellerNotes, next);
                    }}
                    placeholder="you@example.com"
                  />
                  <Input
                    label="Phone Number"
                    type="tel"
                    value={billing.phone}
                    onChange={(e) => {
                      const next = { ...billing, phone: e.target.value };
                      setBilling(next);
                      persistDraftSnapshot(dropOffLocal, collectionLocal, bags, travellerNotes, next);
                    }}
                    placeholder="+94 7X XXX XXXX"
                  />
                  <div className="sm:col-span-2">
                    <Input
                      label="Street Address"
                      value={billing.address}
                      onChange={(e) => {
                        const next = { ...billing, address: e.target.value };
                        setBilling(next);
                        persistDraftSnapshot(
                          dropOffLocal,
                          collectionLocal,
                          bags,
                          travellerNotes,
                          next
                        );
                      }}
                      placeholder="Billing street or hotel address"
                    />
                  </div>
                  <Input
                    label="City"
                    value={billing.city}
                    onChange={(e) => {
                      const next = { ...billing, city: e.target.value };
                      setBilling(next);
                      persistDraftSnapshot(dropOffLocal, collectionLocal, bags, travellerNotes, next);
                    }}
                    placeholder="Colombo"
                  />
                  <Input
                    label="Country"
                    value={billing.country}
                    onChange={(e) => {
                      const next = { ...billing, country: e.target.value };
                      setBilling(next);
                      persistDraftSnapshot(dropOffLocal, collectionLocal, bags, travellerNotes, next);
                    }}
                    placeholder="Sri Lanka"
                  />
                </div>
              )}
            </Card>
          </div>

          {/* Right Summary Card */}
          <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
            <Card className="p-6 bg-white space-y-5 border-2 border-navy-900">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold text-navy-950">Price Breakdown</h2>
                {liveLocation && (
                  <Badge
                    variant={liveLocation.bookingMode === "INSTANT" ? "success" : "info"}
                    size="sm"
                  >
                    {liveLocation.bookingMode === "INSTANT"
                      ? "Instant Booking"
                      : "Host Approval Hold"}
                  </Badge>
                )}
              </div>

              {quoteLoading ? (
                <div className="space-y-2 py-2">
                  <LoadingSkeleton variant="text" className="w-full" />
                  <LoadingSkeleton variant="text" className="w-3/4" />
                  <LoadingSkeleton className="h-10 w-full" />
                </div>
              ) : quoteError ? (
                <Alert variant="danger" title="Quote Unavailable">
                  <div className="space-y-2">
                    <p>{quoteError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuoteRetryCounter((c) => c + 1)}
                    >
                      Retry Quote
                    </Button>
                  </div>
                </Alert>
              ) : liveQuote ? (
                <div className="space-y-3 text-sm">
                  {!liveQuote.available && (
                    <Alert variant="danger" title="Unavailable Window">
                      {liveQuote.unavailabilityReason ||
                        "Not enough open capacity slots during this window."}
                    </Alert>
                  )}

                  <div className="space-y-2">
                    {liveQuote.items.map((item) => (
                      <div key={item.bagCategory} className="flex justify-between gap-2">
                        <span className="text-sand-800">
                          {formatBagCategoryLabel(item.bagCategory)} × {item.quantity} (
                          {item.durationUnits}{" "}
                          {item.durationUnits === 1 ? "unit" : "units"} @{" "}
                          {formatLkrMinor(item.unitRateMinor, liveQuote.currency)})
                        </span>
                        <span className="font-mono font-bold text-navy-950 shrink-0 tabular-nums">
                          {formatLkrMinor(item.lineTotalMinor, liveQuote.currency)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {liveQuote.discountMinor > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount</span>
                      <span className="font-mono font-bold tabular-nums">
                        -{formatLkrMinor(liveQuote.discountMinor, liveQuote.currency)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sand-700 pt-2 border-t border-sand-200">
                    <span>Storage Subtotal</span>
                    <span className="font-mono font-semibold tabular-nums">
                      {formatLkrMinor(liveQuote.storageSubtotalMinor, liveQuote.currency)}
                    </span>
                  </div>

                  <div className="flex justify-between text-sand-700">
                    <span>
                      Taxes ({(liveQuote.taxRateBps / 100).toFixed(2).replace(/\.00$/, "")}%)
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {formatLkrMinor(liveQuote.taxAmountMinor, liveQuote.currency)}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline pt-3 border-t border-sand-300">
                    <span className="text-base font-extrabold text-navy-950">Total Payable</span>
                    <span className="text-2xl font-black text-navy-950 font-mono tabular-nums">
                      {formatLkrMinor(liveQuote.totalAmountMinor, liveQuote.currency)}
                    </span>
                  </div>

                  <div className="rounded-xl bg-sand-50 border border-sand-200 p-3 text-xs text-sand-700 space-y-1">
                    <p className="font-bold text-navy-950 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Cancellation Policy
                    </p>
                    <p>{liveQuote.cancellationPolicySummary}</p>
                    <p className="text-[11px] text-sand-600">
                      Remaining availability: {liveQuote.remainingCapacityUnits} slots
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-3 text-xs text-sand-700 flex items-center justify-between border-y border-sand-200">
                  <span>Total Payable</span>
                  <span className="font-bold text-navy-950">Computed on server quote</span>
                </div>
              )}

              {submitError && <Alert variant="danger">{submitError}</Alert>}

              {!isAuthenticated && (
                <Alert variant="info" title="Sign In Required to Confirm Hold">
                  Your selected dates, bags, and notes will be saved while you sign in and restored
                  automatically here.
                </Alert>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full py-3"
                isLoading={bookingMutation.isPending || paymentIntentMutation.isPending}
                disabled={
                  !scheduleValid ||
                  totalBags < 1 ||
                  Boolean(liveQuote && !liveQuote.available)
                }
              >
                {submitCtaContent}
              </Button>
            </Card>
          </div>
        </form>
      )}

      {/* Sticky Mobile Summary Bar */}
      {validLiveUuid && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-sand-200 px-4 py-3 shadow-lg">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-sand-600">Total Payable</p>
              <p className="text-base font-black text-navy-950 font-mono tabular-nums">
                {liveQuote
                  ? formatLkrMinor(liveQuote.totalAmountMinor, liveQuote.currency)
                  : `${totalBags} ${totalBags === 1 ? "bag" : "bags"}`}
              </p>
            </div>
            <Button
              type="submit"
              form="live-checkout-form"
              variant="primary"
              size="md"
              isLoading={bookingMutation.isPending || paymentIntentMutation.isPending}
              disabled={
                !scheduleValid ||
                totalBags < 1 ||
                Boolean(liveQuote && !liveQuote.available)
              }
            >
              {submitCtaContent}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
