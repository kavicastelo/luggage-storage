import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import {
  formatCurrencyMinorUnits,
  type BookingDetail,
  type CurrencyCode
} from "@luggage-storage/contracts";
import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  SelectionCard,
  StatusBadge,
  TextInput,
  formatColomboDateTime
} from "../../../src/components";
import {
  useCancelBookingMutation,
  useInfiniteMyBookingsQuery,
  useReportBookingExceptionMutation
} from "../../../src/hooks";
import { normalizeApiError } from "../../../src/services/api-client";
import { useAuthStore } from "../../../src/store/useAuthStore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../../src/lib/theme";

type BookingTab = "ACTIVE" | "COMPLETED" | "CANCELLED";

const ACTIVE_STATUSES = new Set([
  "PENDING_HOST_APPROVAL",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "IN_STORAGE",
  "DISPUTED"
]);
const COMPLETED_STATUSES = new Set(["COMPLETED"]);

const EXCEPTION_CATEGORIES = [
  { value: "DAMAGE_REPORTED", label: "Luggage Damage Reported" },
  { value: "MISSING_ITEM", label: "Missing Item" },
  { value: "OVERDUE_DISPUTE", label: "Overdue Fee Dispute" },
  { value: "HOST_NO_SHOW", label: "Host Counter Closed / No Show" },
  { value: "SAFETY_CONCERN", label: "Safety or Seal Tamper Concern" },
  { value: "OTHER", label: "Other Operational Issue" }
] as const;

export default function TravellerBookingsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [activeTab, setActiveTab] = useState<BookingTab>("ACTIVE");
  const [cancelTarget, setCancelTarget] = useState<BookingDetail | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [exceptionTarget, setExceptionTarget] = useState<BookingDetail | null>(null);
  const [exceptionCategory, setExceptionCategory] =
    useState<(typeof EXCEPTION_CATEGORIES)[number]["value"]>("OTHER");
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionError, setExceptionError] = useState<string | null>(null);

  const [actionBanner, setActionBanner] = useState<string | null>(null);

  const bookingsQuery = useInfiniteMyBookingsQuery({ limit: 20 }, isAuthenticated);
  const cancelMutation = useCancelBookingMutation();
  const reportExceptionMutation = useReportBookingExceptionMutation();

  const allBookings = useMemo(
    () => bookingsQuery.data?.pages.flatMap((page) => page.bookings) ?? [],
    [bookingsQuery.data]
  );

  const filteredBookings = useMemo(() => {
    if (activeTab === "ACTIVE") {
      return allBookings.filter((b) => ACTIVE_STATUSES.has(b.status));
    }
    if (activeTab === "COMPLETED") {
      return allBookings.filter((b) => COMPLETED_STATUSES.has(b.status));
    }
    return allBookings.filter((b) => !ACTIVE_STATUSES.has(b.status) && !COMPLETED_STATUSES.has(b.status));
  }, [activeTab, allBookings]);

  const handleConfirmCancel = async () => {
    if (!cancelTarget) {
      return;
    }
    if (cancelReason.trim().length < 3) {
      setCancelError("Enter a cancellation reason (at least 3 characters).");
      return;
    }
    setCancelError(null);
    try {
      const updated = await cancelMutation.mutateAsync({
        bookingId: cancelTarget.id,
        data: { reason: cancelReason.trim() }
      });
      setCancelTarget(null);
      setCancelReason("");
      setActionBanner(
        updated.refundSummary
          ? `Booking #${updated.referenceCode} cancelled (${updated.refundSummary.refundPercentage}% refund ${updated.refundSummary.status}).`
          : `Booking #${updated.referenceCode} cancelled successfully.`
      );
    } catch (err: unknown) {
      setCancelError(normalizeApiError(err).message);
    }
  };

  const handleSubmitException = async () => {
    if (!exceptionTarget) {
      return;
    }
    if (exceptionReason.trim().length < 5) {
      setExceptionError("Provide at least 5 characters describing the issue.");
      return;
    }
    setExceptionError(null);
    try {
      const updated = await reportExceptionMutation.mutateAsync({
        bookingId: exceptionTarget.id,
        data: {
          category: exceptionCategory,
          reason: exceptionReason.trim()
        }
      });
      setExceptionTarget(null);
      setExceptionReason("");
      setActionBanner(
        `Incident recorded on #${updated.referenceCode}. Host settlement is placed on hold pending review.`
      );
    } catch (err: unknown) {
      setExceptionError(normalizeApiError(err).message);
    }
  };

  if (!isAuthenticated) {
    return (
      <ScreenContainer
        header={<SafeHeader title="My Storage" />}
        testID="traveller-bookings-guest"
      >
        <EmptyState
          mascot="suitcase-walk"
          title="Sign in to View Reservations"
          description="Track upcoming check-ins, PayHere payment status, refunds, and custody QR passes across your devices."
          actionTitle="Sign In"
          onAction={() => router.push("/(auth)/login")}
        />
      </ScreenContainer>
    );
  }

  const handleEndReached = useCallback(() => {
    if (bookingsQuery.hasNextPage && !bookingsQuery.isFetchingNextPage) {
      void bookingsQuery.fetchNextPage();
    }
  }, [bookingsQuery]);

  const renderListHeader = useCallback(
    () => (
      <View style={{ gap: mobileSpacing[3], marginBottom: mobileSpacing[4] }}>
        <View style={styles.tabsRow}>
          {(
            [
              { key: "ACTIVE", label: "Active" },
              { key: "COMPLETED", label: "Completed" },
              { key: "CANCELLED", label: "Cancelled" }
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {actionBanner ? (
          <View style={styles.actionBannerBox} accessibilityRole="alert">
            <MobileIcon name="check-circle" size={16} color={mobileStatusTokens.successIcon} />
            <Text style={styles.actionBannerText}>{actionBanner}</Text>
          </View>
        ) : null}
      </View>
    ),
    [activeTab, actionBanner]
  );

  const renderBookingCard = useCallback(
    ({ item: booking }: { item: BookingDetail }) => {
      const currency = (booking.currency || "LKR") as CurrencyCode;
      const canCancel =
        booking.status === "PENDING_HOST_APPROVAL" ||
        booking.status === "PENDING_PAYMENT" ||
        booking.status === "CONFIRMED";
      const hasPass =
        booking.status === "CONFIRMED" || booking.status === "IN_STORAGE";

      return (
        <Card variant="elevated" style={styles.bookingCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.titleCol}>
              <Text style={styles.refCode}>#{booking.referenceCode}</Text>
              <Text style={styles.locName}>{booking.location.name}</Text>
            </View>
            <StatusBadge status={booking.status} size="sm" />
          </View>

          <Text style={styles.areaLine}>
            {booking.location.approximateArea}, {booking.location.city}
          </Text>

          <View style={styles.metaGrid}>
            <Text style={styles.metaText}>
              Drop-off: {formatColomboDateTime(new Date(booking.dropOffAt))}
            </Text>
            <Text style={styles.metaText}>
              Pickup: {formatColomboDateTime(new Date(booking.collectionAt))}
            </Text>
            <Text style={styles.priceText}>
              {booking.totalBags} bag(s) •{" "}
              {formatCurrencyMinorUnits(booking.totalAmountMinor, currency)}
            </Text>
          </View>

          {booking.refundSummary ? (
            <View style={styles.refundBanner}>
              <Text style={styles.refundText}>
                Refund: {booking.refundSummary.refundPercentage}% (
                {formatCurrencyMinorUnits(booking.refundSummary.amountMinor, currency)}) •{" "}
                {booking.refundSummary.status}
              </Text>
            </View>
          ) : null}

          {booking.exceptionReason ? (
            <View style={styles.exceptionBanner}>
              <Text style={styles.exceptionText}>
                Exception noted: {booking.exceptionReason}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            {booking.status === "PENDING_PAYMENT" ? (
              <Button
                title="Complete Payment"
                size="sm"
                leftIcon={<MobileIcon name="credit-card" size={16} color={mobileColors.white} />}
                onPress={() =>
                  router.push({
                    pathname: "/(traveller)/checkout",
                    params: { locId: booking.locationId, bookingId: booking.id }
                  })
                }
                style={styles.actionFlex}
              />
            ) : null}

            {hasPass ? (
              <Button
                title="View Custody Pass"
                size="sm"
                leftIcon={<MobileIcon name="qr-code" size={16} color={mobileColors.white} />}
                onPress={() =>
                  router.push({
                    pathname: "/(traveller)/pass",
                    params: { bookingId: booking.id, ref: booking.referenceCode }
                  })
                }
                style={styles.actionFlex}
              />
            ) : null}

            {canCancel ? (
              <Button
                title="Cancel"
                variant="outline"
                size="sm"
                onPress={() => {
                  setCancelTarget(booking);
                  setCancelReason("");
                  setCancelError(null);
                }}
              />
            ) : null}

            {booking.status !== "CANCELLED_BY_TRAVELLER" &&
            booking.status !== "EXPIRED" ? (
              <Button
                title="Report Issue"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setExceptionTarget(booking);
                  setExceptionReason("");
                  setExceptionError(null);
                }}
              />
            ) : null}
          </View>
        </Card>
      );
    },
    [router]
  );

  const renderListFooter = useCallback(() => {
    if (bookingsQuery.isFetchingNextPage) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator color={mobileColors.terracotta[500]} size="small" />
          <Text style={styles.footerLoaderText}>Loading more reservations...</Text>
        </View>
      );
    }
    if (!bookingsQuery.hasNextPage && filteredBookings.length > 0) {
      return (
        <Text style={styles.footerEndText}>
          Showing all {filteredBookings.length} {activeTab.toLowerCase()} reservations
        </Text>
      );
    }
    return null;
  }, [
    bookingsQuery.isFetchingNextPage,
    bookingsQuery.hasNextPage,
    filteredBookings.length,
    activeTab
  ]);

  const renderListEmpty = useCallback(() => {
    if (bookingsQuery.isLoading) {
      return <LoadingSkeleton count={3} />;
    }
    if (bookingsQuery.isError) {
      return (
        <ErrorState
          title="Unable to fetch bookings"
          message={normalizeApiError(bookingsQuery.error).message}
          onRetry={() => {
            void bookingsQuery.refetch();
          }}
        />
      );
    }
    return (
      <EmptyState
        mascot={activeTab === "ACTIVE" ? "suitcase-walk" : "sleeping"}
        title={`No ${activeTab.toLowerCase()} bookings`}
        description="Discover verified luggage storage hubs in Colombo, Kandy, Galle, Ella, or Negombo."
        actionTitle="Explore Hubs"
        onAction={() => router.replace("/(traveller)")}
      />
    );
  }, [
    bookingsQuery.isLoading,
    bookingsQuery.isError,
    bookingsQuery.error,
    activeTab,
    router
  ]);

  return (
    <ScreenContainer
      padded={false}
      scrollable={false}
      header={<SafeHeader title="My Storage" subtitle="Live Reservations & Passes" />}
      testID="traveller-bookings-screen"
    >
      <FlatList
        data={filteredBookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBookingCard}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        ListEmptyComponent={renderListEmpty}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        initialNumToRender={5}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== "web"}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.flatListContent}
        ItemSeparatorComponent={() => <View style={{ height: mobileSpacing[4] }} />}
        refreshControl={
          <RefreshControl
            refreshing={bookingsQuery.isRefetching && !bookingsQuery.isFetchingNextPage}
            onRefresh={() => {
              void bookingsQuery.refetch();
            }}
            tintColor={mobileColors.terracotta[500]}
            colors={[mobileColors.terracotta[500]]}
          />
        }
      />

      <ConfirmDialog
        visible={Boolean(cancelTarget)}
        title={`Cancel #${cancelTarget?.referenceCode ?? ""}?`}
        description="Refunds follow STANDARD_FLEX_2H policy: 100% >2 hours before drop-off, 50% within 2 hours, 0% after drop-off start."
        confirmLabel="Confirm Cancellation"
        destructive
        isLoading={cancelMutation.isPending}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          void handleConfirmCancel();
        }}
      >
        <TextInput
          label="Cancellation Reason"
          required
          value={cancelReason}
          onChangeText={setCancelReason}
          placeholder="Change of travel plans"
          errorText={cancelError}
        />
      </ConfirmDialog>

      <BottomSheet
        visible={Boolean(exceptionTarget)}
        title={`Report Exception (#${exceptionTarget?.referenceCode ?? ""})`}
        subtitle="Creates an auditable custody incident and pauses host payout settlement."
        onClose={() => setExceptionTarget(null)}
      >
        <View style={styles.sheetStack}>
          {EXCEPTION_CATEGORIES.map((cat) => (
            <SelectionCard
              key={cat.value}
              title={cat.label}
              selected={exceptionCategory === cat.value}
              onPress={() => setExceptionCategory(cat.value)}
            />
          ))}

          <TextInput
            label="Incident Details"
            required
            value={exceptionReason}
            onChangeText={setExceptionReason}
            placeholder="Describe what happened..."
            errorText={exceptionError}
          />

          <Button
            title="Submit Exception Report"
            variant="danger"
            isLoading={reportExceptionMutation.isPending}
            onPress={() => {
              void handleSubmitException();
            }}
          />
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    flexDirection: "row",
    gap: 8
  },
  tabBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.white,
    borderWidth: 1,
    borderColor: mobileColors.sand[300]
  },
  tabBtnActive: {
    backgroundColor: mobileColors.navy[900],
    borderColor: mobileColors.navy[900]
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileTextColors.secondary
  },
  tabTextActive: {
    color: mobileColors.white
  },
  listGap: {
    gap: mobileSpacing[4]
  },
  bookingCard: {
    gap: mobileSpacing[3]
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: mobileSpacing[3]
  },
  titleCol: {
    flex: 1
  },
  refCode: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
    fontVariant: ["tabular-nums"],
    color: mobileColors.terracotta[600]
  },
  actionBannerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing[2],
    backgroundColor: mobileStatusTokens.successBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.successBorder,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[3]
  },
  actionBannerText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.success,
    fontWeight: "600",
    flex: 1
  },
  locName: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  areaLine: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileTextColors.secondary
  },
  metaGrid: {
    gap: 4
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileTextColors.secondary
  },
  priceText: {
    ...mobileTypography.label,
    color: mobileColors.navy[900],
    marginTop: 2
  },
  refundBanner: {
    backgroundColor: mobileStatusTokens.successBg,
    padding: 8,
    borderRadius: mobileRadius.md
  },
  refundText: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileStatusTokens.success,
    fontWeight: "600"
  },
  exceptionBanner: {
    backgroundColor: mobileStatusTokens.dangerBg,
    padding: 8,
    borderRadius: mobileRadius.md
  },
  exceptionText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileStatusTokens.danger
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
  },
  actionFlex: {
    flex: 1
  },
  sheetStack: {
    gap: mobileSpacing[3]
  },
  flatListContent: {
    paddingHorizontal: mobileSpacing[4],
    paddingBottom: mobileSpacing[8]
  },
  footerLoader: {
    paddingVertical: mobileSpacing[4],
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing[2]
  },
  footerLoaderText: {
    fontSize: 12,
    color: mobileTextColors.secondary
  },
  footerEndText: {
    textAlign: "center",
    paddingVertical: mobileSpacing[4],
    fontSize: 12,
    color: mobileTextColors.muted
  }
});
