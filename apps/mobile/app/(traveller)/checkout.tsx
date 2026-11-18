import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, AppState, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BAG_CATEGORIES,
  BookingDetail,
  BookingQuoteResponse,
  CheckoutCustomerDetails,
  CheckoutStatusResponse,
  PaymentIntent,
  formatCurrencyMinorUnits,
  type BagCategory,
  type CurrencyCode
} from "@luggage-storage/contracts";
import {
  Badge,
  Button,
  Card,
  DateTimeSelector,
  EmptyState,
  ErrorState,
  FormSection,
  LoadingSkeleton,
  MobileIcon,
  PaymentStatusPanel,
  PriceSummary,
  SafeHeader,
  ScreenContainer,
  StatusBadge,
  TextInput
} from "../../src/components";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useBookingDetailQuery, usePublicLocationDetailQuery } from "../../src/hooks";
import { marketplaceApi } from "../../src/services/marketplace-api";
import { normalizeApiError } from "../../src/services/api-client";
import {
  isPayHereNativeSdkHandoff,
  isPayHereWebPostHandoff,
  saveMobilePendingCheckoutContext,
  submitPayHereWebCheckoutForm
} from "../../src/lib/payment-handoff";
import { launchPayHereNativeCheckout } from "../../src/lib/payhere-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function defaultDropOffDate(): Date {
  const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date;
}

function defaultCollectionDate(from: Date): Date {
  return new Date(from.getTime() + 8 * 60 * 60 * 1000);
}

export default function TravellerCheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ locId?: string; bookingId?: string }>();
  const { isAuthenticated, user } = useAuthStore();

  const locId = typeof params.locId === "string" ? params.locId : undefined;
  const existingBookingId = typeof params.bookingId === "string" ? params.bookingId : undefined;
  const hasValidLocId = Boolean(locId && UUID_REGEX.test(locId));
  const hasValidExistingBookingId = Boolean(
    existingBookingId && UUID_REGEX.test(existingBookingId)
  );

  const existingBookingQuery = useBookingDetailQuery(
    existingBookingId,
    Boolean(isAuthenticated && hasValidExistingBookingId)
  );
  const resolvedLocationId = locId || existingBookingQuery.data?.locationId;
  const locationQuery = usePublicLocationDetailQuery(resolvedLocationId);
  const location = locationQuery.data;

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(hasValidExistingBookingId ? 3 : 1);
  const [dropOffAt, setDropOffAt] = useState<Date>(() => defaultDropOffDate());
  const [collectionAt, setCollectionAt] = useState<Date>(() =>
    defaultCollectionDate(defaultDropOffDate())
  );
  const [bagCounts, setBagCounts] = useState<Record<BagCategory, number>>({
    BAG_SMALL: 0,
    BAG_MEDIUM: 1,
    BAG_LARGE: 0,
    BAG_OVERSIZED: 0
  });
  const [travellerNotes, setTravellerNotes] = useState("");
  const [billingExpanded, setBillingExpanded] = useState(false);

  const [liveQuote, setLiveQuote] = useState<BookingQuoteResponse | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const initialNameParts = (user?.displayName ?? "").trim().split(/\s+/).filter(Boolean);
  const [billingFirstName, setBillingFirstName] = useState(initialNameParts[0] || "");
  const [billingLastName, setBillingLastName] = useState(
    initialNameParts.length > 1 ? initialNameParts.slice(1).join(" ") : ""
  );
  const [billingEmail, setBillingEmail] = useState(user?.email || "");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingCountry, setBillingCountry] = useState("Sri Lanka");

  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [awaitingCheckout, setAwaitingCheckout] = useState<{
    bookingId: string;
    referenceCode: string;
    intent: PaymentIntent;
    status: CheckoutStatusResponse | null;
  } | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const submitInFlightRef = useRef(false);
  const pendingBookingRef = useRef<{ id: string; referenceCode: string; status: string } | null>(
    null
  );
  const draftIdempotencyKeyRef = useRef<string | null>(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    if (user?.email && !billingEmail) {
      setBillingEmail(user.email);
    }
    if (user?.displayName && !billingFirstName) {
      const parts = user.displayName.trim().split(/\s+/).filter(Boolean);
      setBillingFirstName(parts[0] || "");
      if (parts.length > 1) {
        setBillingLastName(parts.slice(1).join(" "));
      }
    }
  }, [user, billingEmail, billingFirstName]);

  useEffect(() => {
    if (existingBookingQuery.data) {
      pendingBookingRef.current = {
        id: existingBookingQuery.data.id,
        referenceCode: existingBookingQuery.data.referenceCode,
        status: existingBookingQuery.data.status
      };
    }
  }, [existingBookingQuery.data]);

  useEffect(() => {
    if (!hasValidExistingBookingId) {
      pendingBookingRef.current = null;
      draftIdempotencyKeyRef.current = null;
    }
  }, [
    hasValidExistingBookingId,
    resolvedLocationId,
    dropOffAt,
    collectionAt,
    bagCounts.BAG_SMALL,
    bagCounts.BAG_MEDIUM,
    bagCounts.BAG_LARGE,
    bagCounts.BAG_OVERSIZED
  ]);

  const quoteItems = useMemo(() => {
    return BAG_CATEGORIES.filter((cat) => bagCounts[cat] > 0).map((cat) => ({
      bagCategory: cat,
      quantity: bagCounts[cat]
    }));
  }, [bagCounts]);

  const totalBags = quoteItems.reduce((sum, item) => sum + item.quantity, 0);
  const isScheduleValid = collectionAt.getTime() > dropOffAt.getTime();

  useEffect(() => {
    if (hasValidExistingBookingId || !resolvedLocationId || !UUID_REGEX.test(resolvedLocationId)) {
      return;
    }
    if (!isScheduleValid || quoteItems.length === 0) {
      setLiveQuote(null);
      return;
    }

    let active = true;
    setIsQuoting(true);
    setQuoteError(null);
    marketplaceApi
      .quoteBooking({
        locationId: resolvedLocationId,
        dropOffAt: dropOffAt.toISOString(),
        collectionAt: collectionAt.toISOString(),
        items: quoteItems
      })
      .then((q) => {
        if (active) {
          setLiveQuote(q);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setLiveQuote(null);
          setQuoteError(normalizeApiError(err).message);
        }
      })
      .finally(() => {
        if (active) {
          setIsQuoting(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    hasValidExistingBookingId,
    resolvedLocationId,
    isScheduleValid,
    dropOffAt,
    collectionAt,
    quoteItems
  ]);

  const buildCustomerDetails = useCallback((): CheckoutCustomerDetails | undefined => {
    const details: CheckoutCustomerDetails = {};
    if (billingFirstName.trim()) details.firstName = billingFirstName.trim();
    if (billingLastName.trim()) details.lastName = billingLastName.trim();
    if (billingEmail.trim()) details.email = billingEmail.trim();
    if (billingPhone.trim()) details.phone = billingPhone.trim();
    if (billingAddress.trim()) details.address = billingAddress.trim();
    if (billingCity.trim()) details.city = billingCity.trim();
    if (billingCountry.trim()) details.country = billingCountry.trim();
    return Object.keys(details).length > 0 ? details : undefined;
  }, [
    billingFirstName,
    billingLastName,
    billingEmail,
    billingPhone,
    billingAddress,
    billingCity,
    billingCountry
  ]);

  const checkPayHerePaymentStatus = useCallback(
    async (overrideTarget?: { bookingId: string; referenceCode: string }) => {
      const target = overrideTarget ?? awaitingCheckout;
      if (!target) {
        return;
      }
      setIsCheckingStatus(true);
      try {
        const status = await marketplaceApi.getCheckoutStatus({
          bookingId: target.bookingId
        });
        setAwaitingCheckout((prev) => (prev ? { ...prev, status } : null));
        if (status.bookingStatus === "CONFIRMED" || status.bookingStatus === "IN_STORAGE") {
          router.replace({
            pathname: "/(traveller)/pass",
            params: { bookingId: status.bookingId, ref: status.referenceCode }
          });
        }
      } catch (err: unknown) {
        setCheckoutError(normalizeApiError(err).message);
      } finally {
        setIsCheckingStatus(false);
      }
    },
    [awaitingCheckout, router]
  );

  useEffect(() => {
    if (!awaitingCheckout) {
      return;
    }
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        checkPayHerePaymentStatus().catch(() => {});
      }
    });

    const timer = setInterval(() => {
      if (pollCountRef.current >= 10) {
        clearInterval(timer);
        return;
      }
      pollCountRef.current += 1;
      checkPayHerePaymentStatus().catch(() => {});
    }, 4000);

    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [awaitingCheckout, checkPayHerePaymentStatus]);

  const dispatchPayHereIntent = async (
    bookingId: string,
    referenceCode: string,
    intent: PaymentIntent
  ): Promise<boolean> => {
    const isWebRuntime = Platform.OS === "web";

    if (isWebRuntime) {
      if (
        intent.nextAction !== "REDIRECT_TO_PROVIDER" ||
        !isPayHereWebPostHandoff(intent.checkoutHandoff)
      ) {
        setCheckoutError(
          "Payment gateway returned an invalid web checkout handoff payload. Your booking has not been charged."
        );
        return true;
      }

      pollCountRef.current = 0;
      setAwaitingCheckout({
        bookingId,
        referenceCode,
        intent,
        status: null
      });
      saveMobilePendingCheckoutContext({
        bookingId,
        intentId: intent.id,
        orderId: intent.providerOrderId,
        provider: "PAYHERE",
        channel: "WEB",
        createdAt: new Date().toISOString()
      });

      try {
        submitPayHereWebCheckoutForm(intent.checkoutHandoff);
      } catch (openErr: unknown) {
        setCheckoutError(
          openErr instanceof Error
            ? openErr.message
            : "Unable to launch PayHere web checkout form."
        );
      }
      return true;
    }

    if (
      intent.nextAction === "LAUNCH_NATIVE_SDK" &&
      isPayHereNativeSdkHandoff(intent.checkoutHandoff)
    ) {
      pollCountRef.current = 0;
      setAwaitingCheckout({
        bookingId,
        referenceCode,
        intent,
        status: null
      });

      const outcome = await launchPayHereNativeCheckout(intent.checkoutHandoff.sdkPayload);
      if (outcome.status === "ERROR") {
        setCheckoutError(outcome.message);
      }
      await checkPayHerePaymentStatus({ bookingId, referenceCode });
      return true;
    }

    if (intent.nextAction === "REDIRECT_TO_PROVIDER") {
      setCheckoutError(
        "Server returned a web redirect handoff for a native device checkout. Tap Retry PayHere Checkout to request a mobile SDK session."
      );
      return true;
    }

    return false;
  };

  const reopenCurrentPayHereCheckout = async () => {
    if (!awaitingCheckout) {
      return;
    }
    setCheckoutError(null);
    await dispatchPayHereIntent(
      awaitingCheckout.bookingId,
      awaitingCheckout.referenceCode,
      awaitingCheckout.intent
    );
  };

  const executePaymentIntentFlow = async (bookingId: string, referenceCode: string) => {
    const channel = Platform.OS === "web" ? "WEB" : "MOBILE_APP";
    const intent = await marketplaceApi.createPaymentIntent({
      bookingId,
      channel,
      idempotencyKey: `mob-pay-${channel.toLowerCase()}-${bookingId}-${Date.now()}`,
      customerDetails: buildCustomerDetails()
    });

    if (intent.provider === "PAYHERE") {
      const handled = await dispatchPayHereIntent(bookingId, referenceCode, intent);
      if (handled) {
        return;
      }
    }

    if (
      intent.nextAction === "SANDBOX_SIMULATION" &&
      intent.checkoutHandoff.mode === "SANDBOX_SIMULATION"
    ) {
      await marketplaceApi.simulateSandboxPayment(intent.id, { outcome: "SUCCEEDED" });
      const status = await marketplaceApi.getCheckoutStatus({ bookingId });
      if (status.bookingStatus === "CONFIRMED" || status.bookingStatus === "IN_STORAGE") {
        router.replace({
          pathname: "/(traveller)/pass",
          params: { bookingId, ref: referenceCode }
        });
        return;
      }
      setCheckoutError(
        "Payment submitted, awaiting server confirmation. Use My Storage to refresh status."
      );
      return;
    }

    setCheckoutError(
      "Unsupported payment handoff mode returned by server. Failing closed without unlocking custody pass."
    );
  };

  const handleRetryPayHereCheckout = async () => {
    if (!awaitingCheckout || isProcessing || submitInFlightRef.current) {
      return;
    }
    submitInFlightRef.current = true;
    setIsProcessing(true);
    setCheckoutError(null);
    try {
      const channel = Platform.OS === "web" ? "WEB" : "MOBILE_APP";
      const freshIntent = await marketplaceApi.createPaymentIntent({
        bookingId: awaitingCheckout.bookingId,
        channel,
        idempotencyKey: `mob-retry-${channel.toLowerCase()}-${awaitingCheckout.bookingId}-${Date.now()}`,
        customerDetails: buildCustomerDetails()
      });

      if (freshIntent.provider === "PAYHERE") {
        const handled = await dispatchPayHereIntent(
          awaitingCheckout.bookingId,
          awaitingCheckout.referenceCode,
          freshIntent
        );
        if (handled) {
          return;
        }
      }

      if (
        freshIntent.nextAction === "SANDBOX_SIMULATION" &&
        freshIntent.checkoutHandoff.mode === "SANDBOX_SIMULATION"
      ) {
        await marketplaceApi.simulateSandboxPayment(freshIntent.id, { outcome: "SUCCEEDED" });
        const status = await marketplaceApi.getCheckoutStatus({
          bookingId: awaitingCheckout.bookingId
        });
        if (status.bookingStatus === "CONFIRMED" || status.bookingStatus === "IN_STORAGE") {
          router.replace({
            pathname: "/(traveller)/pass",
            params: {
              bookingId: awaitingCheckout.bookingId,
              ref: awaitingCheckout.referenceCode
            }
          });
          return;
        }
        setCheckoutError("Awaiting server confirmation. Tap Check Payment Status shortly.");
        return;
      }

      setCheckoutError("Unsupported payment action received from server.");
    } catch (err: unknown) {
      setCheckoutError(normalizeApiError(err).message);
    } finally {
      submitInFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  const checkoutRedirectPath = useMemo(() => {
    if (resolvedLocationId && UUID_REGEX.test(resolvedLocationId)) {
      return `/(traveller)/checkout?locId=${resolvedLocationId}`;
    }
    if (hasValidExistingBookingId && existingBookingId) {
      return `/(traveller)/checkout?bookingId=${existingBookingId}`;
    }
    return "/(traveller)/checkout";
  }, [existingBookingId, hasValidExistingBookingId, resolvedLocationId]);

  const handleConfirmAndPay = async () => {
    if (isProcessing || submitInFlightRef.current) {
      return;
    }
    if (!isAuthenticated) {
      router.push({
        pathname: "/(auth)/login",
        params: { redirectTo: checkoutRedirectPath }
      });
      return;
    }
    if (!resolvedLocationId || !UUID_REGEX.test(resolvedLocationId)) {
      setCheckoutError("Select a valid storage hub before booking.");
      return;
    }

    submitInFlightRef.current = true;
    setIsProcessing(true);
    setCheckoutError(null);
    try {
      let targetBooking = pendingBookingRef.current;
      if (!targetBooking) {
        if (!isScheduleValid || quoteItems.length === 0) {
          setCheckoutError("Check your schedule and bag counts before proceeding.");
          return;
        }
        if (!draftIdempotencyKeyRef.current) {
          draftIdempotencyKeyRef.current = `mob-chk-${resolvedLocationId}-${Date.now()}`;
        }
        const created: BookingDetail = await marketplaceApi.createBooking({
          locationId: resolvedLocationId,
          dropOffAt: dropOffAt.toISOString(),
          collectionAt: collectionAt.toISOString(),
          items: quoteItems,
          travellerNotes: travellerNotes.trim() || undefined,
          idempotencyKey: draftIdempotencyKeyRef.current
        });
        targetBooking = {
          id: created.id,
          referenceCode: created.referenceCode,
          status: created.status
        };
        pendingBookingRef.current = targetBooking;
      }

      if (targetBooking.status === "PENDING_HOST_APPROVAL") {
        router.replace("/(traveller)/bookings");
        return;
      }

      if (targetBooking.status === "PENDING_PAYMENT") {
        await executePaymentIntentFlow(targetBooking.id, targetBooking.referenceCode);
        return;
      }

      if (targetBooking.status === "CONFIRMED" || targetBooking.status === "IN_STORAGE") {
        router.replace({
          pathname: "/(traveller)/pass",
          params: { bookingId: targetBooking.id, ref: targetBooking.referenceCode }
        });
        return;
      }

      router.replace("/(traveller)/bookings");
    } catch (err: unknown) {
      setCheckoutError(normalizeApiError(err).message);
    } finally {
      submitInFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  if (!hasValidLocId && !hasValidExistingBookingId) {
    return (
      <ScreenContainer
        header={<SafeHeader title="Booking Checkout" onBack={() => router.back()} />}
        testID="traveller-checkout-missing"
      >
        <EmptyState
          mascot="suitcase-peek"
          title="No Storage Hub Selected"
          description="Choose a verified luggage hub from Explore to calculate your server quote and reserve storage."
          actionTitle="Explore Hubs"
          onAction={() => router.replace("/(traveller)")}
        />
      </ScreenContainer>
    );
  }

  const handleBack = () => {
    if (hasValidExistingBookingId || currentStep === 1) {
      router.back();
    } else {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3);
    }
  };

  const adjustBag = (category: BagCategory, delta: number) => {
    setBagCounts((prev) => ({
      ...prev,
      [category]: Math.max(0, Math.min(20, prev[category] + delta))
    }));
  };

  const existingBooking = existingBookingQuery.data;
  const isHostApprovalFlow = location?.bookingMode === "HOST_APPROVAL" && !existingBooking;
  const hasKnownBillingSummary = Boolean(billingFirstName.trim() || billingEmail.trim());
  const activeCurrency = ((existingBooking?.currency || liveQuote?.currency || "LKR") as CurrencyCode);
  const activeTotalMinor = existingBooking?.totalAmountMinor ?? liveQuote?.totalAmountMinor ?? null;

  const stickyFooter =
    !locationQuery.isLoading &&
    !(hasValidExistingBookingId && existingBookingQuery.isLoading) &&
    !locationQuery.isError &&
    !awaitingCheckout ? (
      <View style={styles.stickyFooter}>
        <View style={styles.stickySummaryCol}>
          <Text style={styles.stickySummaryLabel}>
            {existingBooking
              ? `${existingBooking.totalBags} bag(s)`
              : `${totalBags} bag${totalBags === 1 ? "" : "s"}`}
          </Text>
          <Text style={styles.stickySummaryValue}>
            {activeTotalMinor !== null
              ? formatCurrencyMinorUnits(activeTotalMinor, activeCurrency)
              : isQuoting
                ? "Calculating..."
                : "Quote pending"}
          </Text>
        </View>
        <View style={styles.stickyCtaWrap}>
          {currentStep === 1 && !hasValidExistingBookingId ? (
            <Button
              title="Continue to Bags"
              rightIcon={<MobileIcon name="arrow-right" size={16} color={mobileColors.white} />}
              disabled={!isScheduleValid}
              onPress={() => setCurrentStep(2)}
              fullWidth
            />
          ) : currentStep === 2 && !hasValidExistingBookingId ? (
            <Button
              title="Review & Pay"
              rightIcon={<MobileIcon name="arrow-right" size={16} color={mobileColors.white} />}
              disabled={totalBags === 0 || isQuoting || Boolean(liveQuote && !liveQuote.available)}
              onPress={() => setCurrentStep(3)}
              fullWidth
            />
          ) : (
            <Button
              title={isHostApprovalFlow ? "Submit Request" : "Confirm & Pay"}
              leftIcon={<MobileIcon name="credit-card" size={16} color={mobileColors.white} />}
              isLoading={isProcessing}
              onPress={() => {
                void handleConfirmAndPay();
              }}
              fullWidth
            />
          )}
        </View>
      </View>
    ) : undefined;

  return (
    <ScreenContainer
      keyboardAvoiding
      header={
        <SafeHeader
          title="Reserve Storage"
          subtitle={location?.name || existingBooking?.location.name || "Loading hub..."}
          onBack={handleBack}
        />
      }
      footer={stickyFooter}
      testID="traveller-checkout-screen"
    >
      {locationQuery.isLoading || (hasValidExistingBookingId && existingBookingQuery.isLoading) ? (
        <LoadingSkeleton count={3} />
      ) : locationQuery.isError ? (
        <ErrorState
          title="Could not load hub details"
          message={normalizeApiError(locationQuery.error).message}
          onRetry={() => {
            void locationQuery.refetch();
          }}
        />
      ) : awaitingCheckout ? (
        <View style={styles.stack}>
          <PaymentStatusPanel
            bookingStatus={awaitingCheckout.status?.bookingStatus ?? "PENDING_PAYMENT"}
            paymentStatus={
              awaitingCheckout.status?.paymentIntent?.status ?? awaitingCheckout.intent.status
            }
            providerLabel="PayHere Lanka"
            amountMinor={awaitingCheckout.intent.amountMinor}
            currency={awaitingCheckout.intent.currency}
            expiresAt={awaitingCheckout.intent.expiresAt}
            errorMessage={checkoutError}
            isChecking={isCheckingStatus}
            isRetrying={isProcessing}
            onCheckStatus={() => {
              void checkPayHerePaymentStatus();
            }}
            onReopenCheckout={() => {
              void reopenCurrentPayHereCheckout();
            }}
            onRetryCheckout={() => {
              void handleRetryPayHereCheckout();
            }}
          />

          <Text style={styles.handoffHint}>
            Tap Check Payment Status to sync with the server, Re-open PayHere Checkout if your
            gateway tab closed, or Retry PayHere Checkout for a fresh payment session.
          </Text>
        </View>
      ) : (
        <View style={styles.stack}>
          {!hasValidExistingBookingId ? (
            <View style={styles.stepperRow}>
              {[
                { step: 1 as const, label: "1. Schedule" },
                { step: 2 as const, label: "2. Bags" },
                { step: 3 as const, label: "3. Review & Pay" }
              ].map((item) => {
                const active = currentStep === item.step;
                const done = currentStep > item.step;
                const canJump =
                  item.step < currentStep ||
                  (item.step === 2 && isScheduleValid) ||
                  (item.step === 3 && isScheduleValid && totalBags > 0);
                return (
                  <TouchableOpacity
                    key={item.step}
                    style={[
                      styles.stepPill,
                      active && styles.stepPillActive,
                      done && styles.stepPillDone
                    ]}
                    disabled={!canJump || active}
                    onPress={() => {
                      if (canJump) {
                        setCurrentStep(item.step);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: !canJump }}
                  >
                    <Text
                      style={[
                        styles.stepPillText,
                        (active || done) && styles.stepPillTextActive
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {currentStep === 1 && !hasValidExistingBookingId ? (
            <View style={styles.stack}>
              <FormSection
                title="Storage Window"
                subtitle={`Operating timezone: ${location?.timezone || "Asia/Colombo"} (${location?.operatingHoursSummary ?? "Operating hours not configured"})`}
              >
                <DateTimeSelector
                  label="Drop-off Date & Time"
                  value={dropOffAt}
                  minimumDate={new Date()}
                  timezone={location?.timezone || "Asia/Colombo"}
                  onChange={(next) => {
                    setDropOffAt(next);
                    if (collectionAt.getTime() <= next.getTime()) {
                      setCollectionAt(defaultCollectionDate(next));
                    }
                  }}
                />
                <DateTimeSelector
                  label="Collection Date & Time"
                  value={collectionAt}
                  minimumDate={new Date(dropOffAt.getTime() + 60 * 60 * 1000)}
                  timezone={location?.timezone || "Asia/Colombo"}
                  onChange={setCollectionAt}
                  errorText={
                    !isScheduleValid ? "Collection must be strictly after drop-off." : null
                  }
                />
              </FormSection>
            </View>
          ) : null}

          {currentStep === 2 && !hasValidExistingBookingId ? (
            <View style={styles.stack}>
              <FormSection
                title="Select Luggage Quantities"
                subtitle="Prices are computed live by the marketplace pricing engine in LKR."
              >
                {(
                  [
                    {
                      key: "BAG_SMALL",
                      title: "Small Bag / Daypack",
                      hint: "Under 40 cm (1 capacity unit)"
                    },
                    {
                      key: "BAG_MEDIUM",
                      title: "Cabin Suitcase",
                      hint: "Carry-on trolley (1 capacity unit)"
                    },
                    {
                      key: "BAG_LARGE",
                      title: "Large Check-in Suitcase",
                      hint: "20-32 kg luggage (2 capacity units)"
                    },
                    {
                      key: "BAG_OVERSIZED",
                      title: "Oversized / Surfboard / Bike",
                      hint: "Specialty item (4 capacity units)"
                    }
                  ] as const
                ).map((cat) => (
                  <View key={cat.key} style={styles.bagRow}>
                    <View style={styles.bagLabelCol}>
                      <Text style={styles.bagTitle}>{cat.title}</Text>
                      <Text style={styles.bagHint}>{cat.hint}</Text>
                    </View>
                    <View style={styles.counterControls}>
                      <TouchableOpacity
                        style={styles.counterBtn}
                        onPress={() => adjustBag(cat.key, -1)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${cat.title}`}
                      >
                        <MobileIcon name="minus" size={18} color={mobileColors.navy[900]} />
                      </TouchableOpacity>
                      <Text style={styles.counterNum}>{bagCounts[cat.key]}</Text>
                      <TouchableOpacity
                        style={styles.counterBtn}
                        onPress={() => adjustBag(cat.key, 1)}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${cat.title}`}
                      >
                        <MobileIcon name="plus" size={18} color={mobileColors.navy[900]} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <TextInput
                  label="Arrival Notes (Optional)"
                  placeholder="Flight arrival, train number, fragile items..."
                  value={travellerNotes}
                  onChangeText={setTravellerNotes}
                />
              </FormSection>

              {isQuoting ? <LoadingSkeleton count={1} /> : null}
              {quoteError ? <ErrorState title="Quote Failed" message={quoteError} /> : null}
              {liveQuote ? <PriceSummary quote={liveQuote} /> : null}

              {liveQuote && !liveQuote.available ? (
                <ErrorState
                  title="Schedule Unavailable"
                  message={
                    liveQuote.unavailabilityReason ||
                    "Not enough capacity or outside operating hours for the selected window."
                  }
                />
              ) : null}
            </View>
          ) : null}

          {currentStep === 3 ? (
            <View style={styles.stack}>
              {existingBooking ? (
                <Card variant="elevated" style={styles.cardGap}>
                  <View style={styles.existingHeaderRow}>
                    <Text style={styles.existingTitle}>
                      Reservation #{existingBooking.referenceCode}
                    </Text>
                    <StatusBadge status={existingBooking.status} />
                  </View>
                  <Text style={styles.bodyText}>
                    Total payable:{" "}
                    {formatCurrencyMinorUnits(
                      existingBooking.totalAmountMinor,
                      (existingBooking.currency || "LKR") as CurrencyCode
                    )}{" "}
                    ({existingBooking.totalBags} bag(s))
                  </Text>
                </Card>
              ) : liveQuote ? (
                <PriceSummary quote={liveQuote} />
              ) : null}

              {!isAuthenticated ? (
                <Card variant="outlined" style={styles.cardGap}>
                  <Text style={styles.policyTitle}>Sign in Required to Lock Capacity</Text>
                  <Text style={styles.bodyText}>
                    Your schedule and bag count remain ready. Sign in or create an account to lock
                    storage capacity and proceed to PayHere LKR checkout.
                  </Text>
                  <Button
                    title="Sign In to Continue"
                    leftIcon={<MobileIcon name="lock" size={16} color={mobileColors.white} />}
                    onPress={() =>
                      router.push({
                        pathname: "/(auth)/login",
                        params: { redirectTo: checkoutRedirectPath }
                      })
                    }
                  />
                </Card>
              ) : null}

              {!isHostApprovalFlow ? (
                <FormSection
                  title="Billing & PayHere Contact Details"
                  subtitle="Pre-filled from your account for PayHere Checkout."
                  rightSlot={
                    <TouchableOpacity
                      style={styles.collapseToggleBtn}
                      onPress={() => setBillingExpanded((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        billingExpanded ? "Hide billing details" : "Edit billing details"
                      }
                    >
                      <Text style={styles.collapseToggleText}>
                        {billingExpanded ? "Hide" : hasKnownBillingSummary ? "Edit" : "Expand"}
                      </Text>
                    </TouchableOpacity>
                  }
                >
                  {!billingExpanded && hasKnownBillingSummary ? (
                    <Text style={styles.bodyText}>
                      {[billingFirstName, billingLastName].filter(Boolean).join(" ") || "Account holder"}
                      {billingEmail ? ` · ${billingEmail}` : ""}
                      {billingPhone ? ` · ${billingPhone}` : ""}
                    </Text>
                  ) : null}

                  {billingExpanded || !hasKnownBillingSummary ? (
                    <>
                      <TextInput
                        label="First Name"
                        value={billingFirstName}
                        onChangeText={setBillingFirstName}
                        placeholder="First name"
                      />
                      <TextInput
                        label="Last Name"
                        value={billingLastName}
                        onChangeText={setBillingLastName}
                        placeholder="Last name"
                      />
                      <TextInput
                        label="Email"
                        value={billingEmail}
                        onChangeText={setBillingEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                      <TextInput
                        label="Phone Number"
                        value={billingPhone}
                        onChangeText={setBillingPhone}
                        keyboardType="phone-pad"
                        placeholder="+94 77 000 0000"
                      />
                      <TextInput
                        label="Street Address"
                        value={billingAddress}
                        onChangeText={setBillingAddress}
                        placeholder="Colombo address or hotel"
                      />
                      <TextInput
                        label="City"
                        value={billingCity}
                        onChangeText={setBillingCity}
                        placeholder="Colombo"
                      />
                      <TextInput
                        label="Country"
                        value={billingCountry}
                        onChangeText={setBillingCountry}
                        placeholder="Sri Lanka"
                      />
                    </>
                  ) : null}
                </FormSection>
              ) : null}

              <Card variant="outlined" style={styles.policyCard}>
                <View style={styles.policyHeader}>
                  <MobileIcon name="shield-check" size={18} color={mobileColors.emerald[700]} />
                  <Text style={styles.policyTitle}>Decoupled Custody Policy Disclosure</Text>
                </View>
                <Text style={styles.bodyText}>
                  {liveQuote?.cancellationPolicySummary ||
                    "100% refund >2 hours before drop-off, 50% within 2 hours of drop-off, 0% after drop-off starts."}
                </Text>
                <Text style={styles.bodyText}>
                  Overdue payments are handled strictly via in-app billing settlement if pickup is
                  late. No silent charges and luggage return is NEVER delayed or withheld at the
                  counter.
                </Text>
                <Badge label="Authoritative PayHere Checkout" variant="info" size="sm" />
              </Card>

              {checkoutError ? (
                <ErrorState title="Checkout Blocked" message={checkoutError} />
              ) : null}
            </View>
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
    gap: mobileSpacing[4]
  },
  stepperRow: {
    flexDirection: "row",
    gap: 8
  },
  stepPill: {
    flex: 1,
    minHeight: 38,
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
  stepPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileTextColors.secondary
  },
  stepPillTextActive: {
    color: mobileColors.white
  },
  bagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[200],
    gap: mobileSpacing[3]
  },
  bagLabelCol: {
    flex: 1
  },
  bagTitle: {
    ...mobileTypography.label,
    color: mobileTextColors.primary
  },
  bagHint: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileTextColors.muted
  },
  counterControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  counterBtn: {
    width: 48,
    height: 48,
    borderRadius: mobileRadius.lg,
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    alignItems: "center",
    justifyContent: "center"
  },
  counterNum: {
    ...mobileTypography.headingSm,
    minWidth: 24,
    textAlign: "center",
    color: mobileTextColors.primary
  },
  existingHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  existingTitle: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  policyCard: {
    gap: 8,
    backgroundColor: mobileStatusTokens.successBg,
    borderColor: mobileStatusTokens.successBorder
  },
  policyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  policyTitle: {
    ...mobileTypography.headingSm,
    color: mobileColors.navy[900]
  },
  bodyText: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary
  },
  handoffHint: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.muted,
    textAlign: "center",
    paddingHorizontal: mobileSpacing[2]
  },
  collapseToggleBtn: {
    minHeight: 36,
    paddingHorizontal: mobileSpacing[3],
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.sand[100],
    justifyContent: "center",
    alignItems: "center"
  },
  collapseToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.terracotta[600]
  },
  stickyFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[3],
    backgroundColor: mobileColors.card,
    borderTopWidth: 1,
    borderTopColor: mobileColors.border,
    paddingHorizontal: mobileSpacing[4],
    paddingVertical: mobileSpacing[3]
  },
  stickySummaryCol: {
    flex: 1,
    gap: 2
  },
  stickySummaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileTextColors.muted
  },
  stickySummaryValue: {
    ...mobileTypography.headingMd,
    color: mobileColors.navy[900]
  },
  stickyCtaWrap: {
    flex: 1.2
  }
});
