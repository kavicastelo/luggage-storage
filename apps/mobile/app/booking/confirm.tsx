import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckoutStatusResponse } from "@luggage-storage/contracts";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PaymentStatusPanel,
  SafeHeader,
  ScreenContainer
} from "../../src/components";
import { useAuthStore } from "../../src/store/useAuthStore";
import { marketplaceApi } from "../../src/services/marketplace-api";
import { normalizeApiError } from "../../src/services/api-client";
import {
  clearMobilePendingCheckoutContext,
  loadMobilePendingCheckoutContext,
  parseMobileCheckoutReturnQuery
} from "../../src/lib/payment-handoff";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function MobileBookingConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    bookingId?: string;
    order_id?: string;
    orderId?: string;
    cancelled?: string;
  }>();
  const { isAuthenticated } = useAuthStore();

  const returnHints = useMemo(() => {
    const queryHints =
      typeof window !== "undefined" && typeof window.location?.search === "string"
        ? parseMobileCheckoutReturnQuery(window.location.search)
        : {
            bookingId: null,
            orderId: null,
            cancelledHint: false,
            ignoredQueryPaymentClaim: false
          };
    const pendingCtx = loadMobilePendingCheckoutContext();

    const paramBooking =
      typeof params.bookingId === "string" && UUID_REGEX.test(params.bookingId.trim())
        ? params.bookingId.trim()
        : null;
    const queryBooking =
      queryHints.bookingId && UUID_REGEX.test(queryHints.bookingId) ? queryHints.bookingId : null;
    const ctxBooking =
      pendingCtx?.bookingId && UUID_REGEX.test(pendingCtx.bookingId) ? pendingCtx.bookingId : null;

    const paramOrder =
      typeof params.order_id === "string"
        ? params.order_id.trim()
        : typeof params.orderId === "string"
          ? params.orderId.trim()
          : null;

    return {
      bookingId: paramBooking || queryBooking || ctxBooking,
      orderId: paramOrder || queryHints.orderId || pendingCtx?.orderId || null,
      cancelledHint:
        params.cancelled === "1" || params.cancelled === "true" || queryHints.cancelledHint,
      ignoredQueryPaymentClaim: queryHints.ignoredQueryPaymentClaim
    };
  }, [params.bookingId, params.cancelled, params.orderId, params.order_id]);

  const [statusData, setStatusData] = useState<CheckoutStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollCountRef = useRef(0);

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated || (!returnHints.bookingId && !returnHints.orderId)) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const nextStatus = await marketplaceApi.getCheckoutStatus({
        ...(returnHints.bookingId ? { bookingId: returnHints.bookingId } : {}),
        ...(!returnHints.bookingId && returnHints.orderId ? { orderId: returnHints.orderId } : {})
      });
      setStatusData(nextStatus);
      if (
        nextStatus.bookingStatus === "CONFIRMED" ||
        nextStatus.bookingStatus === "IN_STORAGE" ||
        nextStatus.bookingStatus === "COMPLETED"
      ) {
        clearMobilePendingCheckoutContext();
      }
    } catch (err: unknown) {
      setErrorMessage(normalizeApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, returnHints.bookingId, returnHints.orderId]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!isAuthenticated || !statusData) {
      return;
    }
    if (statusData.bookingStatus !== "PENDING_PAYMENT") {
      return;
    }
    const timer = setInterval(() => {
      if (pollCountRef.current >= 12) {
        clearInterval(timer);
        return;
      }
      pollCountRef.current += 1;
      void fetchStatus();
    }, 3000);
    return () => clearInterval(timer);
  }, [isAuthenticated, statusData, fetchStatus]);

  const resolvedBookingId = statusData?.bookingId ?? returnHints.bookingId;

  return (
    <ScreenContainer scrollable>
      <SafeHeader
        title="Payment Return"
        subtitle="Verified against server settlement records"
        onBack={() => router.replace("/(traveller)/(tabs)/bookings")}
      />

      {!isAuthenticated ? (
        <EmptyState
          title="Sign in to view booking status"
          description="Your account session is required before confirming settlement and unlocking the custody pass."
          actionTitle="Sign In"
          onAction={() => router.push("/(auth)/login")}
        />
      ) : !returnHints.bookingId && !returnHints.orderId ? (
        <EmptyState
          title="No active payment return reference"
          description="We could not locate a booking or order reference in this return link. Open My Storage to inspect your bookings."
          actionTitle="Open My Storage"
          onAction={() => router.replace("/(traveller)/(tabs)/bookings")}
        />
      ) : isLoading && !statusData ? (
        <LoadingSkeleton count={3} />
      ) : errorMessage && !statusData ? (
        <ErrorState
          title="Could not verify payment status"
          message={errorMessage}
          onRetry={() => {
            void fetchStatus();
          }}
        />
      ) : statusData ? (
        <View style={styles.stack}>
          {returnHints.cancelledHint && statusData.bookingStatus === "PENDING_PAYMENT" ? (
            <Card variant="outlined" style={styles.bannerCard}>
              <Text style={styles.bannerTitle}>Checkout closed before confirmation</Text>
              <Text style={styles.bannerText}>
                You returned from PayHere without verified webhook settlement yet. You can refresh
                status or resume checkout below.
              </Text>
            </Card>
          ) : null}

          {returnHints.ignoredQueryPaymentClaim ? (
            <Card variant="outlined" style={styles.bannerCard}>
              <Text style={styles.bannerText}>
                URL status parameters are ignored. Booking state reflects signed PayHere webhook
                verification only.
              </Text>
            </Card>
          ) : null}

          <PaymentStatusPanel
            bookingStatus={statusData.bookingStatus}
            paymentStatus={statusData.paymentIntent?.status ?? "PENDING_GATEWAY"}
            providerLabel="PayHere Lanka"
            amountMinor={statusData.paymentIntent?.amountMinor ?? 0}
            currency={statusData.paymentIntent?.currency ?? "LKR"}
            expiresAt={statusData.paymentIntent?.expiresAt ?? statusData.holdExpiresAt}
            errorMessage={errorMessage}
            isChecking={isLoading}
            onCheckStatus={() => {
              void fetchStatus();
            }}
            onRetryCheckout={
              resolvedBookingId && statusData.bookingStatus === "PENDING_PAYMENT"
                ? () =>
                    router.replace({
                      pathname: "/(traveller)/checkout",
                      params: { bookingId: resolvedBookingId }
                    })
                : undefined
            }
          />

          <View style={styles.actions}>
            {statusData.custodyReady && resolvedBookingId ? (
              <Button
                title="Open Custody Pass"
                variant="primary"
                onPress={() =>
                  router.replace({
                    pathname: "/(traveller)/pass",
                    params: { bookingId: resolvedBookingId, ref: statusData.referenceCode }
                  })
                }
              />
            ) : null}

            <Button
              title="Refresh Payment Status"
              variant="secondary"
              isLoading={isLoading}
              onPress={() => {
                void fetchStatus();
              }}
            />

            {resolvedBookingId && statusData.bookingStatus === "PENDING_PAYMENT" ? (
              <Button
                title="Return to Checkout"
                variant="outline"
                onPress={() =>
                  router.replace({
                    pathname: "/(traveller)/checkout",
                    params: { bookingId: resolvedBookingId }
                  })
                }
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: mobileSpacing[4],
    paddingBottom: mobileSpacing[10]
  },
  bannerCard: {
    backgroundColor: mobileColors.container,
    borderRadius: mobileRadius.lg,
    gap: mobileSpacing[2]
  },
  bannerTitle: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  bannerText: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary
  },
  actions: {
    gap: mobileSpacing[3]
  }
});

