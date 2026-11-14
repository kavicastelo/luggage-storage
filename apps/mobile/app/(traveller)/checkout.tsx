import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  AppState,
  Linking
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  BookingQuoteResponse,
  CheckoutCustomerDetails,
  CheckoutStatusResponse,
  PaymentIntent
} from "@luggage-storage/contracts";
import { DEMO_LOCATIONS, StorageLocationItem } from "../../src/data/mock-marketplace";
import { Card, Button, Badge, MobileIcon } from "../../src/components";
import { mobileColors, mobileRadius, mobileTypography } from "../../src/lib/theme";
import { useAuthStore } from "../../src/store/useAuthStore";
import { marketplaceApi } from "../../src/services/marketplace-api";
import { getApiBaseUrl } from "../../src/services/api-client";
import {
  isPayHerePostHandoff,
  openExternalPayHereHandoff,
  resolveMobileHandoffUrl
} from "../../src/lib/payment-handoff";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function TravellerCheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ locId?: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const isLiveLocation = Boolean(params.locId && UUID_REGEX.test(params.locId));

  const location: StorageLocationItem =
    DEMO_LOCATIONS.find((l) => l.id === params.locId) || DEMO_LOCATIONS[0];

  // Wizard Step (1: Schedule -> 2: Bags -> 3: Review & Payment)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Schedule State
  const [dropOffHour, _setDropOffHour] = useState("09:00 AM");
  const [pickUpHour, _setPickUpHour] = useState("18:30 PM");

  // Step 2: Bag Counters State
  const [bagCounts, setBagCounts] = useState({
    SMALL: 0,
    MEDIUM: 1,
    LARGE: 1,
    OVERSIZED: 0
  });

  // Step 3: Payment & Billing State
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "LANKA_QR" | "PAYHERE">("CARD");
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveQuote, setLiveQuote] = useState<BookingQuoteResponse | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const initialNameParts = (user?.displayName ?? "").trim().split(/\s+/).filter(Boolean);
  const [billingFirstName, setBillingFirstName] = useState(initialNameParts[0] || "");
  const [billingLastName, setBillingLastName] = useState(
    initialNameParts.length > 1 ? initialNameParts.slice(1).join(" ") : ""
  );
  const [billingEmail, setBillingEmail] = useState(user?.email || "");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingCountry, setBillingCountry] = useState("");

  const [awaitingCheckout, setAwaitingCheckout] = useState<{
    bookingId: string;
    referenceCode: string;
    intent: PaymentIntent;
    handoffUrl: string;
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
    pendingBookingRef.current = null;
    draftIdempotencyKeyRef.current = null;
  }, [params.locId, dropOffHour, pickUpHour, bagCounts.SMALL, bagCounts.MEDIUM, bagCounts.LARGE, bagCounts.OVERSIZED]);

  const totalBags =
    bagCounts.SMALL + bagCounts.MEDIUM + bagCounts.LARGE + bagCounts.OVERSIZED;

  useEffect(() => {
    if (!isLiveLocation || !params.locId || totalBags === 0) {
      setLiveQuote(null);
      return;
    }
    let active = true;
    const dropOffIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const collectionIso = new Date(Date.now() + 33 * 60 * 60 * 1000).toISOString();
    const items = [
      ...(bagCounts.SMALL > 0 ? [{ bagCategory: "BAG_SMALL" as const, quantity: bagCounts.SMALL }] : []),
      ...(bagCounts.MEDIUM > 0 ? [{ bagCategory: "BAG_MEDIUM" as const, quantity: bagCounts.MEDIUM }] : []),
      ...(bagCounts.LARGE > 0 ? [{ bagCategory: "BAG_LARGE" as const, quantity: bagCounts.LARGE }] : []),
      ...(bagCounts.OVERSIZED > 0
        ? [{ bagCategory: "BAG_OVERSIZED" as const, quantity: bagCounts.OVERSIZED }]
        : [])
    ];
    marketplaceApi
      .quoteBooking({
        locationId: params.locId,
        dropOffAt: dropOffIso,
        collectionAt: collectionIso,
        items
      })
      .then((q) => {
        if (active) setLiveQuote(q);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [
    isLiveLocation,
    params.locId,
    totalBags,
    bagCounts.SMALL,
    bagCounts.MEDIUM,
    bagCounts.LARGE,
    bagCounts.OVERSIZED
  ]);

  const basePriceLkr = liveQuote
    ? Math.round(liveQuote.storageSubtotalMinor / 100)
    : bagCounts.SMALL * location.dailyCapLkr.SMALL +
      bagCounts.MEDIUM * location.dailyCapLkr.MEDIUM +
      bagCounts.LARGE * location.dailyCapLkr.LARGE +
      bagCounts.OVERSIZED * location.dailyCapLkr.OVERSIZED;

  const totalLkr = liveQuote ? Math.round(liveQuote.totalAmountMinor / 100) : basePriceLkr;

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

  const checkPayHerePaymentStatus = useCallback(async () => {
    if (!awaitingCheckout) return;
    setIsCheckingStatus(true);
    try {
      const status = await marketplaceApi.getCheckoutStatus({
        bookingId: awaitingCheckout.bookingId
      });
      setAwaitingCheckout((prev) => (prev ? { ...prev, status } : null));
      if (status.bookingStatus === "CONFIRMED" || status.bookingStatus === "IN_STORAGE") {
        router.replace({
          pathname: "/(traveller)/pass",
          params: { bookingId: status.bookingId, ref: status.referenceCode }
        });
      }
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : "Could not check payment status.");
    } finally {
      setIsCheckingStatus(false);
    }
  }, [awaitingCheckout, router]);

  useEffect(() => {
    if (!awaitingCheckout) return;

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
  }, [awaitingCheckout?.bookingId, checkPayHerePaymentStatus]);

  const handleRetryPayHereCheckout = async () => {
    if (!awaitingCheckout || isProcessing || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setIsProcessing(true);
    setCheckoutError(null);
    try {
      const freshIntent = await marketplaceApi.createPaymentIntent({
        bookingId: awaitingCheckout.bookingId,
        idempotencyKey: `mob-retry-${awaitingCheckout.bookingId}-${Date.now()}`,
        customerDetails: buildCustomerDetails()
      });

      if (
        freshIntent.nextAction === "REDIRECT_TO_PROVIDER" &&
        isPayHerePostHandoff(freshIntent.checkoutHandoff)
      ) {
        const handoffUrl = resolveMobileHandoffUrl(
          getApiBaseUrl(),
          freshIntent.checkoutHandoff.mobileHandoffPath
        );
        pollCountRef.current = 0;
        setAwaitingCheckout((prev) =>
          prev
            ? {
                ...prev,
                intent: freshIntent,
                handoffUrl
              }
            : null
        );
        await openExternalPayHereHandoff(handoffUrl, (url) => Linking.openURL(url));
        return;
      }

      if (freshIntent.nextAction === "SANDBOX_SIMULATION") {
        await marketplaceApi.simulateSandboxPayment(freshIntent.id, { outcome: "SUCCEEDED" });
        router.replace({
          pathname: "/(traveller)/pass",
          params: {
            bookingId: awaitingCheckout.bookingId,
            ref: awaitingCheckout.referenceCode
          }
        });
      }
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : "Failed to reopen PayHere checkout.");
    } finally {
      submitInFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (totalBags === 0) {
        alert("Please select at least 1 bag to continue.");
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (isProcessing || submitInFlightRef.current) return;
      setCheckoutError(null);
      if (isLiveLocation && params.locId && isAuthenticated) {
        submitInFlightRef.current = true;
        setIsProcessing(true);
        try {
          const dropOffIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          const collectionIso = new Date(Date.now() + 33 * 60 * 60 * 1000).toISOString();
          const items = [
            ...(bagCounts.SMALL > 0 ? [{ bagCategory: "BAG_SMALL" as const, quantity: bagCounts.SMALL }] : []),
            ...(bagCounts.MEDIUM > 0 ? [{ bagCategory: "BAG_MEDIUM" as const, quantity: bagCounts.MEDIUM }] : []),
            ...(bagCounts.LARGE > 0 ? [{ bagCategory: "BAG_LARGE" as const, quantity: bagCounts.LARGE }] : []),
            ...(bagCounts.OVERSIZED > 0
              ? [{ bagCategory: "BAG_OVERSIZED" as const, quantity: bagCounts.OVERSIZED }]
              : [])
          ];
          if (!draftIdempotencyKeyRef.current) {
            draftIdempotencyKeyRef.current = `mob-chk-${params.locId}-${Date.now()}`;
          }
          const created =
            pendingBookingRef.current ??
            (await marketplaceApi.createBooking({
              locationId: params.locId,
              dropOffAt: dropOffIso,
              collectionAt: collectionIso,
              items,
              idempotencyKey: draftIdempotencyKeyRef.current
            }));

          if (created.status === "PENDING_PAYMENT") {
            pendingBookingRef.current = {
              id: created.id,
              referenceCode: created.referenceCode,
              status: created.status
            };
            const intent = await marketplaceApi.createPaymentIntent({
              bookingId: created.id,
              idempotencyKey: `mob-pay-${created.id}`,
              customerDetails: buildCustomerDetails()
            });

            if (
              intent.nextAction === "REDIRECT_TO_PROVIDER" &&
              isPayHerePostHandoff(intent.checkoutHandoff)
            ) {
              const handoffUrl = resolveMobileHandoffUrl(
                getApiBaseUrl(),
                intent.checkoutHandoff.mobileHandoffPath
              );
              pollCountRef.current = 0;
              setAwaitingCheckout({
                bookingId: created.id,
                referenceCode: created.referenceCode,
                intent,
                handoffUrl,
                status: null
              });
              try {
                await openExternalPayHereHandoff(handoffUrl, (url) => Linking.openURL(url));
              } catch (openErr: unknown) {
                setCheckoutError(
                  openErr instanceof Error
                    ? openErr.message
                    : "Unable to open browser for PayHere checkout."
                );
              }
              return;
            }

            await marketplaceApi.simulateSandboxPayment(intent.id, { outcome: "SUCCEEDED" });
            router.replace({
              pathname: "/(traveller)/pass",
              params: { bookingId: created.id, ref: created.referenceCode }
            });
            return;
          }

          if (created.status === "CONFIRMED") {
            router.replace({
              pathname: "/(traveller)/pass",
              params: { bookingId: created.id, ref: created.referenceCode }
            });
          } else {
            router.replace("/(traveller)/bookings");
          }
        } catch (err: unknown) {
          setCheckoutError(err instanceof Error ? err.message : "Failed to complete reservation.");
        } finally {
          submitInFlightRef.current = false;
          setIsProcessing(false);
        }
        return;
      }

      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        router.replace({
          pathname: "/(traveller)/pass",
          params: { ref: "#LS-2026-8841" }
        });
      }, 800);
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      router.back();
    } else {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3);
    }
  };

  return (
    <View style={styles.screenWrapper}>
      {/* Top Header */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <MobileIcon name="chevron-left" size={20} color={mobileColors.white} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.topNavTitle}>Reserve Luggage Storage</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Stepper Progress Bar */}
      <View style={styles.stepperContainer}>
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, currentStep >= 1 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, currentStep >= 1 && styles.stepNumberActive]}>
              1
            </Text>
          </View>
          <Text style={[styles.stepLabel, currentStep >= 1 && styles.stepLabelActive]}>
            Schedule
          </Text>
        </View>

        <View style={[styles.stepLine, currentStep >= 2 && styles.stepLineActive]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, currentStep >= 2 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, currentStep >= 2 && styles.stepNumberActive]}>
              2
            </Text>
          </View>
          <Text style={[styles.stepLabel, currentStep >= 2 && styles.stepLabelActive]}>
            Bags
          </Text>
        </View>

        <View style={[styles.stepLine, currentStep >= 3 && styles.stepLineActive]} />

        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, currentStep >= 3 && styles.stepCircleActive]}>
            <Text style={[styles.stepNumber, currentStep >= 3 && styles.stepNumberActive]}>
              3
            </Text>
          </View>
          <Text style={[styles.stepLabel, currentStep >= 3 && styles.stepLabelActive]}>
            Payment
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {checkoutError && (
          <Card style={{ marginBottom: 12, padding: 12 }} variant="outlined">
            <Text style={{ color: mobileColors.rose[600], fontSize: 12, fontWeight: "700" }}>
              {checkoutError}
            </Text>
          </Card>
        )}
        {/* Selected Hub Summary */}
        <Card style={styles.hubHeaderCard} variant="outlined">
          <View style={{ flex: 1 }}>
            <Badge label={location.city} variant="navy" size="sm" />
            <Text style={styles.hubName}>{location.name}</Text>
            <Text style={styles.hubLandmark}>{location.landmark}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.hubHoursLabel}>Hours Today</Text>
            <Text style={styles.hubHoursVal}>{location.openHours}</Text>
          </View>
        </Card>

        {/* STEP 1: Schedule Date & Times (TM-017) */}
        {currentStep === 1 && (
          <View style={styles.stepContent}>
            <Card style={styles.formCard}>
              <Text style={styles.cardHeading}>Select Storage Schedule</Text>
              <Text style={styles.cardSubtitle}>
                Drop off and pick up times are validated against partner hours.
              </Text>

              <Text style={styles.fieldLabel}>Drop-off Date & Time</Text>
              <View style={styles.selectorRow}>
                <View style={styles.schedulePill}>
                  <MobileIcon name="calendar" size={16} color={mobileColors.navy[900]} />
                  <Text style={styles.scheduleText}>Today • Nov 09</Text>
                </View>
                <View style={styles.schedulePill}>
                  <MobileIcon name="clock" size={16} color={mobileColors.navy[900]} />
                  <Text style={styles.scheduleText}>{dropOffHour}</Text>
                </View>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Pick-up Date & Time</Text>
              <View style={styles.selectorRow}>
                <View style={styles.schedulePill}>
                  <MobileIcon name="calendar" size={16} color={mobileColors.navy[900]} />
                  <Text style={styles.scheduleText}>Today • Nov 09</Text>
                </View>
                <View style={styles.schedulePill}>
                  <MobileIcon name="clock" size={16} color={mobileColors.navy[900]} />
                  <Text style={styles.scheduleText}>{pickUpHour}</Text>
                </View>
              </View>

              <View style={styles.durationNotice}>
                <MobileIcon name="info" size={16} color={mobileColors.navy[900]} />
                <Text style={styles.durationText}>
                  Storage Duration: <Text style={{ fontWeight: "700" }}>9 Hours 30 Mins</Text> •
                  Standard Day Rate applies with full 30m train grace period.
                </Text>
              </View>
            </Card>
          </View>
        )}

        {/* STEP 2: Bag Selection & Category Counters (TM-018) */}
        {currentStep === 2 && (
          <View style={styles.stepContent}>
            <Card style={styles.formCard}>
              <Text style={styles.cardHeading}>Select Luggage Categories</Text>
              <Text style={styles.cardSubtitle}>
                Choose bag types for accurate space allocation and serialized seal assignments.
              </Text>

              {/* Category 1: Small Bag */}
              <View style={styles.counterRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.categoryTitle}>Small Bag / Daypack</Text>
                  <Text style={styles.categoryDesc}>Handbags, daypacks up to 25L</Text>
                  <Text style={styles.categoryPrice}>
                    LKR {location.dailyCapLkr.SMALL} / day
                  </Text>
                </View>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() =>
                      setBagCounts((p) => ({ ...p, SMALL: Math.max(0, p.SMALL - 1) }))
                    }
                    accessibilityLabel="Decrease small bags"
                  >
                    <Text style={styles.counterBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterVal}>{bagCounts.SMALL}</Text>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => setBagCounts((p) => ({ ...p, SMALL: p.SMALL + 1 }))}
                    accessibilityLabel="Increase small bags"
                  >
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Category 2: Medium Cabin Bag */}
              <View style={styles.counterRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.categoryTitle}>Medium Bag (Cabin Size)</Text>
                  <Text style={styles.categoryDesc}>20-22" Rollaboard trolley up to 55L</Text>
                  <Text style={styles.categoryPrice}>
                    LKR {location.dailyCapLkr.MEDIUM} / day
                  </Text>
                </View>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() =>
                      setBagCounts((p) => ({ ...p, MEDIUM: Math.max(0, p.MEDIUM - 1) }))
                    }
                    accessibilityLabel="Decrease medium bags"
                  >
                    <Text style={styles.counterBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterVal}>{bagCounts.MEDIUM}</Text>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => setBagCounts((p) => ({ ...p, MEDIUM: p.MEDIUM + 1 }))}
                    accessibilityLabel="Increase medium bags"
                  >
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Category 3: Large Suitcase */}
              <View style={styles.counterRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.categoryTitle}>Large Suitcase (Check-in)</Text>
                  <Text style={styles.categoryDesc}>24-28" Hard-shell suitcase up to 85L</Text>
                  <Text style={styles.categoryPrice}>
                    LKR {location.dailyCapLkr.LARGE} / day
                  </Text>
                </View>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() =>
                      setBagCounts((p) => ({ ...p, LARGE: Math.max(0, p.LARGE - 1) }))
                    }
                    accessibilityLabel="Decrease large bags"
                  >
                    <Text style={styles.counterBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterVal}>{bagCounts.LARGE}</Text>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => setBagCounts((p) => ({ ...p, LARGE: p.LARGE + 1 }))}
                    accessibilityLabel="Increase large bags"
                  >
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Category 4: Oversized Baggage */}
              <View style={[styles.counterRow, { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.categoryTitle}>Oversized / Surfboards</Text>
                  <Text style={styles.categoryDesc}>Surfboards, golf bags, diving equipment</Text>
                  <Text style={styles.categoryPrice}>
                    LKR {location.dailyCapLkr.OVERSIZED} / day
                  </Text>
                </View>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() =>
                      setBagCounts((p) => ({ ...p, OVERSIZED: Math.max(0, p.OVERSIZED - 1) }))
                    }
                    accessibilityLabel="Decrease oversized bags"
                  >
                    <Text style={styles.counterBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterVal}>{bagCounts.OVERSIZED}</Text>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => setBagCounts((p) => ({ ...p, OVERSIZED: p.OVERSIZED + 1 }))}
                    accessibilityLabel="Increase oversized bags"
                  >
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* STEP 3: Price Breakdown & Payment Review (TM-019 / TM-020) */}
        {currentStep === 3 && (
          <View style={styles.stepContent}>
            {/* Itemized Price Breakdown */}
            <Card style={styles.formCard}>
              <Text style={styles.cardHeading}>Itemized Invoice Summary</Text>
              <Text style={styles.cardSubtitle}>
                Transparent breakdown of storage fees, protection, and local taxes.
              </Text>

              <View style={styles.invoiceTable}>
                {bagCounts.SMALL > 0 && (
                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceKey}>
                      Small Bags ({bagCounts.SMALL} × LKR {location.dailyCapLkr.SMALL})
                    </Text>
                    <Text style={styles.invoiceVal}>
                      LKR {bagCounts.SMALL * location.dailyCapLkr.SMALL}
                    </Text>
                  </View>
                )}
                {bagCounts.MEDIUM > 0 && (
                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceKey}>
                      Medium Bags ({bagCounts.MEDIUM} × LKR {location.dailyCapLkr.MEDIUM})
                    </Text>
                    <Text style={styles.invoiceVal}>
                      LKR {bagCounts.MEDIUM * location.dailyCapLkr.MEDIUM}
                    </Text>
                  </View>
                )}
                {bagCounts.LARGE > 0 && (
                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceKey}>
                      Large Suitcases ({bagCounts.LARGE} × LKR {location.dailyCapLkr.LARGE})
                    </Text>
                    <Text style={styles.invoiceVal}>
                      LKR {bagCounts.LARGE * location.dailyCapLkr.LARGE}
                    </Text>
                  </View>
                )}
                {bagCounts.OVERSIZED > 0 && (
                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoiceKey}>
                      Oversized Gear ({bagCounts.OVERSIZED} × LKR {location.dailyCapLkr.OVERSIZED})
                    </Text>
                    <Text style={styles.invoiceVal}>
                      LKR {bagCounts.OVERSIZED * location.dailyCapLkr.OVERSIZED}
                    </Text>
                  </View>
                )}

                <View style={styles.invoiceRow}>
                  <Text style={styles.invoiceKey}>Tamper-Evident Seals & Verification</Text>
                  <Text style={[styles.invoiceVal, { color: mobileColors.emerald[700] }]}>
                    FREE (Included)
                  </Text>
                </View>

                <View style={styles.invoiceRow}>
                  <Text style={styles.invoiceKey}>LKR 250k Guarantee Protection</Text>
                  <Text style={[styles.invoiceVal, { color: mobileColors.emerald[700] }]}>
                    FREE (Included)
                  </Text>
                </View>

                <View style={styles.invoiceTotalRow}>
                  <Text style={styles.invoiceTotalKey}>Total Amount Due:</Text>
                  <Text style={styles.invoiceTotalVal}>LKR {totalLkr}</Text>
                </View>
              </View>
            </Card>

            {/* Billing Details (for Gateway / PayHere Checkout) */}
            {!awaitingCheckout && (
              <Card style={styles.formCard}>
                <Text style={styles.cardHeading}>Billing & Contact Details</Text>
                <Text style={styles.cardSubtitle}>
                  Used for your reservation and external gateway checkout when required.
                </Text>

                <Text style={styles.fieldLabel}>First Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={billingFirstName}
                  onChangeText={setBillingFirstName}
                  placeholder="First name"
                  accessibilityLabel="First Name"
                />

                <Text style={styles.fieldLabel}>Last Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={billingLastName}
                  onChangeText={setBillingLastName}
                  placeholder="Last name"
                  accessibilityLabel="Last Name"
                />

                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  value={billingEmail}
                  onChangeText={setBillingEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  accessibilityLabel="Email"
                />

                <Text style={styles.fieldLabel}>Phone Number</Text>
                <TextInput
                  style={styles.textInput}
                  value={billingPhone}
                  onChangeText={setBillingPhone}
                  placeholder="+94 77 123 4567"
                  keyboardType="phone-pad"
                  accessibilityLabel="Phone Number"
                />

                <Text style={styles.fieldLabel}>Street Address</Text>
                <TextInput
                  style={styles.textInput}
                  value={billingAddress}
                  onChangeText={setBillingAddress}
                  placeholder="Street line & number"
                  accessibilityLabel="Street Address"
                />

                <Text style={styles.fieldLabel}>City</Text>
                <TextInput
                  style={styles.textInput}
                  value={billingCity}
                  onChangeText={setBillingCity}
                  placeholder="e.g. Colombo"
                  accessibilityLabel="City"
                />

                <Text style={styles.fieldLabel}>Country</Text>
                <TextInput
                  style={styles.textInput}
                  value={billingCountry}
                  onChangeText={setBillingCountry}
                  placeholder="e.g. Sri Lanka"
                  accessibilityLabel="Country"
                />
              </Card>
            )}

            {/* PayHere External Browser Handoff State */}
            {awaitingCheckout && (
              <Card style={styles.awaitingCard} variant="outlined">
                <Text style={styles.cardHeading}>Awaiting Payment Confirmation</Text>
                <Text style={styles.cardSubtitle}>
                  Booking #{awaitingCheckout.referenceCode} • Complete payment in your browser tab,
                  then return here to verify status and unlock your Digital Custody Pass.
                </Text>
                {awaitingCheckout.status?.paymentIntent?.failureReason && (
                  <Text style={styles.awaitingWarning}>
                    Last attempt: {awaitingCheckout.status.paymentIntent.failureReason}
                  </Text>
                )}

                <View style={styles.awaitingActions}>
                  <Button
                    title={isCheckingStatus ? "Checking Status..." : "Check Payment Status"}
                    variant="primary"
                    size="md"
                    loading={isCheckingStatus}
                    onPress={() => checkPayHerePaymentStatus()}
                  />
                  <Button
                    title="Re-open PayHere Checkout"
                    variant="secondary"
                    size="md"
                    disabled={isProcessing}
                    onPress={() =>
                      openExternalPayHereHandoff(awaitingCheckout.handoffUrl, (url) =>
                        Linking.openURL(url)
                      ).catch((err: unknown) =>
                        setCheckoutError(
                          err instanceof Error ? err.message : "Unable to reopen PayHere."
                        )
                      )
                    }
                  />
                  <Button
                    title="Retry PayHere Checkout"
                    variant="outline"
                    size="md"
                    disabled={isProcessing}
                    onPress={handleRetryPayHereCheckout}
                  />
                </View>
              </Card>
            )}

            {/* Payment Method Selector */}
            {!awaitingCheckout && (
              <Card style={styles.formCard}>
                <Text style={styles.cardHeading}>Payment Method</Text>

                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMethod === "CARD" && styles.paymentOptionActive
                  ]}
                  onPress={() => setPaymentMethod("CARD")}
                >
                  <View style={styles.radioCircle}>
                    {paymentMethod === "CARD" && <View style={styles.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentTitle}>Credit or Debit Card</Text>
                    <Text style={styles.paymentDesc}>Visa, Mastercard, or AMEX (3D Secure)</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMethod === "LANKA_QR" && styles.paymentOptionActive
                  ]}
                  onPress={() => setPaymentMethod("LANKA_QR")}
                >
                  <View style={styles.radioCircle}>
                    {paymentMethod === "LANKA_QR" && <View style={styles.radioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentTitle}>LankaQR Instant Pay</Text>
                    <Text style={styles.paymentDesc}>Scan with any Sri Lankan banking app</Text>
                  </View>
                </TouchableOpacity>
              </Card>
            )}

            {/* Overdue Policy Transparency Notice (DEC-002) */}
            <Card style={styles.policyNoticeCard} variant="outlined">
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <MobileIcon name="shield" size={16} color={mobileColors.navy[900]} />
                <Text style={styles.policyTitle}>Decoupled Custody Policy Disclosure</Text>
              </View>
              <Text style={styles.policyText}>
                {location.lateFeePolicyLabel}. Overdue payments are handled strictly via in-app
                review. No silent charges and luggage return is NEVER delayed.
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Wizard Bar */}
      {!awaitingCheckout && (
        <View style={styles.stickyBar}>
          <View>
            <Text style={styles.stickyBagsCount}>
              {totalBags} {totalBags === 1 ? "Bag" : "Bags"} Selected
            </Text>
            <Text style={styles.stickyPrice}>LKR {totalLkr}</Text>
          </View>

          <Button
            title={
              currentStep === 1
                ? "Select Bags →"
                : currentStep === 2
                ? "Review & Pay →"
                : "Proceed to Payment"
            }
            variant="primary"
            size="lg"
            loading={isProcessing}
            onPress={handleNext}
            style={{ flex: 1, marginLeft: 16 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  topNav: {
    backgroundColor: mobileColors.navy[900],
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingRight: 10
  },
  backButtonText: {
    color: mobileColors.white,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 2
  },
  topNavTitle: {
    color: mobileColors.white,
    fontSize: 15,
    fontWeight: "700"
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.navy[950],
    paddingVertical: 12,
    paddingHorizontal: 24
  },
  stepItem: {
    alignItems: "center"
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: mobileColors.navy[800],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4
  },
  stepCircleActive: {
    backgroundColor: mobileColors.terracotta[500]
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.sand[400]
  },
  stepNumberActive: {
    color: mobileColors.white
  },
  stepLabel: {
    fontSize: 10,
    color: mobileColors.sand[500],
    fontWeight: "600"
  },
  stepLabelActive: {
    color: mobileColors.white
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: mobileColors.navy[800],
    marginHorizontal: 8,
    marginBottom: 14
  },
  stepLineActive: {
    backgroundColor: mobileColors.terracotta[500]
  },
  container: {
    paddingBottom: 100
  },
  hubHeaderCard: {
    margin: 16,
    marginBottom: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  hubName: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginTop: 4
  },
  hubLandmark: {
    fontSize: 11,
    color: mobileColors.sand[600]
  },
  hubHoursLabel: {
    fontSize: 10,
    color: mobileColors.sand[500]
  },
  hubHoursVal: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.emerald[700]
  },
  stepContent: {
    paddingHorizontal: 16,
    gap: 12
  },
  formCard: {
    padding: 16
  },
  cardHeading: {
    ...mobileTypography.headingSm,
    color: mobileColors.navy[900],
    marginBottom: 2
  },
  cardSubtitle: {
    fontSize: 12,
    color: mobileColors.sand[600],
    marginBottom: 14
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 6
  },
  selectorRow: {
    flexDirection: "row",
    gap: 10
  },
  schedulePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: mobileColors.sand[50],
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    borderRadius: mobileRadius.md,
    padding: 12
  },
  scheduleText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  durationNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mobileColors.sky[50],
    borderRadius: mobileRadius.md,
    padding: 10,
    gap: 8,
    marginTop: 16
  },
  durationText: {
    fontSize: 12,
    color: mobileColors.navy[900],
    flex: 1,
    lineHeight: 16
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[100]
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  categoryDesc: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2
  },
  categoryPrice: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.terracotta[600],
    marginTop: 4
  },
  counterControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  counterBtn: {
    width: 48,
    height: 48, // 48px meets >= 44pt touch target strictly
    borderRadius: 24,
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    justifyContent: "center",
    alignItems: "center"
  },
  counterBtnText: {
    fontSize: 20,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  counterVal: {
    fontSize: 16,
    fontWeight: "800",
    color: mobileColors.navy[900],
    minWidth: 20,
    textAlign: "center"
  },
  invoiceTable: {
    backgroundColor: mobileColors.sand[50],
    borderRadius: mobileRadius.md,
    padding: 12,
    gap: 8
  },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  invoiceKey: {
    fontSize: 12,
    color: mobileColors.sand[700]
  },
  invoiceVal: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  invoiceTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[200],
    paddingTop: 8,
    marginTop: 4
  },
  invoiceTotalKey: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  invoiceTotalVal: {
    fontSize: 16,
    fontWeight: "800",
    color: mobileColors.terracotta[500]
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    marginBottom: 8,
    gap: 12
  },
  paymentOptionActive: {
    borderColor: mobileColors.terracotta[500],
    backgroundColor: mobileColors.terracotta[50]
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: mobileColors.sand[400],
    justifyContent: "center",
    alignItems: "center"
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: mobileColors.terracotta[500]
  },
  paymentTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  paymentDesc: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2
  },
  policyNoticeCard: {
    padding: 12,
    marginTop: 4
  },
  policyTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  policyText: {
    fontSize: 11,
    color: mobileColors.sand[700],
    marginTop: 4,
    lineHeight: 16
  },
  stickyBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: mobileColors.white,
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[200],
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  stickyBagsCount: {
    fontSize: 11,
    color: mobileColors.sand[600]
  },
  stickyPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: mobileColors.terracotta[500]
  },
  textInput: {
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: mobileColors.navy[900],
    marginBottom: 10
  },
  awaitingCard: {
    padding: 16,
    borderColor: mobileColors.amber[600],
    backgroundColor: mobileColors.amber[50]
  },
  awaitingWarning: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.rose[600],
    marginTop: 8
  },
  awaitingActions: {
    gap: 10,
    marginTop: 14
  }
});
