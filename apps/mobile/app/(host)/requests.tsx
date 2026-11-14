import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  formatCurrencyMinorUnits,
  type BookingDetail,
  type CurrencyCode,
  type RecordBookingExceptionRequest
} from "@luggage-storage/contracts";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  SafeHeader,
  ScreenContainer,
  SelectionCard,
  StatusBadge,
  TextInput,
  formatColomboDateTime
} from "../../src/components";
import {
  useAcceptHostBookingMutation,
  useHostBookingsQuery,
  useHostCancelBookingMutation,
  useRejectHostBookingMutation,
  useReportBookingExceptionMutation
} from "../../src/hooks";
import { normalizeApiError } from "../../src/services/api-client";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

type RequestTab = "PENDING" | "UPCOMING" | "ACTIVE" | "PAST";
type HostExceptionCategory = NonNullable<RecordBookingExceptionRequest["category"]>;

const HOST_EXCEPTION_CATEGORIES: Array<{ value: HostExceptionCategory; label: string }> = [
  { value: "DAMAGE_REPORTED", label: "Damage Reported" },
  { value: "MISSING_ITEM", label: "Missing Item" },
  { value: "OVERDUE_DISPUTE", label: "Overdue / Collection Dispute" },
  { value: "HOST_NO_SHOW", label: "Counter Handover Issue" },
  { value: "SAFETY_CONCERN", label: "Safety / Prohibited Item" },
  { value: "OTHER", label: "Other Operational Incident" }
];

const PAST_STATUSES = new Set([
  "COMPLETED",
  "RELEASED_TO_TRAVELLER",
  "CANCELLED_BY_TRAVELLER",
  "CANCELLED_BY_HOST",
  "CANCELLED_BY_PLATFORM",
  "REJECTED",
  "EXPIRED"
]);

export default function HostRequestsScreen() {
  const router = useRouter();
  const bookingsQuery = useHostBookingsQuery({ limit: 50 }, true);
  const acceptMutation = useAcceptHostBookingMutation();
  const rejectMutation = useRejectHostBookingMutation();
  const cancelMutation = useHostCancelBookingMutation();
  const reportExceptionMutation = useReportBookingExceptionMutation();

  const [activeTab, setActiveTab] = useState<RequestTab>("PENDING");
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<BookingDetail | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [cancelTarget, setCancelTarget] = useState<BookingDetail | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [exceptionTarget, setExceptionTarget] = useState<BookingDetail | null>(null);
  const [exceptionCategory, setExceptionCategory] =
    useState<HostExceptionCategory>("DAMAGE_REPORTED");
  const [exceptionReason, setExceptionReason] = useState("");

  const allBookings = useMemo(() => bookingsQuery.data?.bookings ?? [], [bookingsQuery.data]);

  const filtered = useMemo(() => {
    switch (activeTab) {
      case "PENDING":
        return allBookings.filter((b) => b.status === "PENDING_HOST_APPROVAL");
      case "UPCOMING":
        return allBookings.filter(
          (b) => b.status === "PENDING_PAYMENT" || b.status === "CONFIRMED"
        );
      case "ACTIVE":
        return allBookings.filter((b) => b.status === "IN_STORAGE");
      case "PAST":
        return allBookings.filter((b) => PAST_STATUSES.has(b.status));
    }
  }, [allBookings, activeTab]);

  const handleAccept = async (booking: BookingDetail) => {
    setActionError(null);
    setActionBanner(null);
    try {
      await acceptMutation.mutateAsync({ bookingId: booking.id, data: {} });
      setActionBanner(`Approved #${booking.referenceCode}. Traveller can now complete LKR payment.`);
    } catch (err) {
      setActionError(normalizeApiError(err).message);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) {
      return;
    }
    if (rejectReason.trim().length < 3) {
      setActionError("Provide a rejection reason (at least 3 characters).");
      return;
    }
    setActionError(null);
    try {
      await rejectMutation.mutateAsync({
        bookingId: rejectTarget.id,
        data: { reason: rejectReason.trim() }
      });
      setActionBanner(`Rejected booking #${rejectTarget.referenceCode}.`);
      setRejectTarget(null);
      setRejectReason("");
    } catch (err) {
      setActionError(normalizeApiError(err).message);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) {
      return;
    }
    if (cancelReason.trim().length < 3) {
      setActionError("Provide a host cancellation reason (at least 3 characters).");
      return;
    }
    setActionError(null);
    try {
      await cancelMutation.mutateAsync({
        bookingId: cancelTarget.id,
        data: { reason: cancelReason.trim() }
      });
      setActionBanner(`Cancelled #${cancelTarget.referenceCode} and initiated traveller refund.`);
      setCancelTarget(null);
      setCancelReason("");
    } catch (err) {
      setActionError(normalizeApiError(err).message);
    }
  };

  const handleSubmitException = async () => {
    if (!exceptionTarget) {
      return;
    }
    if (exceptionReason.trim().length < 5) {
      setActionError("Provide incident details (at least 5 characters).");
      return;
    }
    setActionError(null);
    try {
      await reportExceptionMutation.mutateAsync({
        bookingId: exceptionTarget.id,
        data: {
          category: exceptionCategory,
          reason: exceptionReason.trim()
        }
      });
      setActionBanner(`Recorded custody exception for #${exceptionTarget.referenceCode}.`);
      setExceptionTarget(null);
      setExceptionReason("");
    } catch (err) {
      setActionError(normalizeApiError(err).message);
    }
  };

  return (
    <ScreenContainer
      header={
        <SafeHeader
          title="Booking Requests & Queue"
          subtitle="Live Partner Approvals & Counter Check-In"
        />
      }
      refreshing={bookingsQuery.isRefetching}
      onRefresh={() => {
        void bookingsQuery.refetch();
      }}
      testID="host-requests-screen"
    >
      <View style={styles.tabsRow}>
        {(
          [
            { key: "PENDING", label: "Pending" },
            { key: "UPCOMING", label: "Upcoming" },
            { key: "ACTIVE", label: "Active" },
            { key: "PAST", label: "Past" }
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

      {actionBanner ? <Badge label={actionBanner} variant="success" icon="check-circle" /> : null}
      {actionError ? <ErrorState title="Action Failed" message={actionError} /> : null}

      {bookingsQuery.isLoading ? (
        <LoadingSkeleton count={3} />
      ) : bookingsQuery.isError ? (
        <ErrorState
          title="Unable to Fetch Partner Bookings"
          message={normalizeApiError(bookingsQuery.error).message}
          onRetry={() => {
            void bookingsQuery.refetch();
          }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          mascot="suitcase-walk"
          title={`No ${activeTab.toLowerCase()} bookings`}
          description="Incoming traveller requests, upcoming confirmed check-ins, and active custody items appear here."
        />
      ) : (
        <View style={styles.listGap}>
          {filtered.map((booking) => {
            const currency = (booking.currency || "LKR") as CurrencyCode;
            const canCancel =
              booking.status === "CONFIRMED" || booking.status === "PENDING_PAYMENT";

            return (
              <Card key={booking.id} variant="elevated" style={styles.cardGap}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.flexCol}>
                    <Text style={styles.refCode}>#{booking.referenceCode}</Text>
                    <Text style={styles.locName}>{booking.location.name}</Text>
                  </View>
                  <StatusBadge status={booking.status} size="sm" />
                </View>

                <Text style={styles.metaLine}>
                  Drop-off: {formatColomboDateTime(new Date(booking.dropOffAt))}
                </Text>
                <Text style={styles.metaLine}>
                  Pickup: {formatColomboDateTime(new Date(booking.collectionAt))}
                </Text>
                <Text style={styles.priceLine}>
                  {booking.totalBags} bag(s) •{" "}
                  {formatCurrencyMinorUnits(booking.totalAmountMinor, currency)}
                </Text>

                {booking.status === "PENDING_HOST_APPROVAL" ? (
                  <View style={styles.actionsRow}>
                    <Button
                      title="Approve Request"
                      size="sm"
                      isLoading={acceptMutation.isPending}
                      onPress={() => {
                        void handleAccept(booking);
                      }}
                      style={styles.flexBtn}
                    />
                    <Button
                      title="Reject"
                      size="sm"
                      variant="danger"
                      onPress={() => {
                        setRejectTarget(booking);
                        setRejectReason("");
                      }}
                      style={styles.flexBtn}
                    />
                  </View>
                ) : null}

                {booking.status === "CONFIRMED" ? (
                  <View style={styles.actionsRow}>
                    <Button
                      title="Scan Pass"
                      size="sm"
                      variant="outline"
                      onPress={() =>
                        router.push({
                          pathname: "/(host)/scanner",
                          params: { bookingId: booking.id }
                        })
                      }
                      style={styles.flexBtn}
                    />
                    <Button
                      title="Start Check-In"
                      size="sm"
                      onPress={() =>
                        router.push({
                          pathname: "/(host)/intake",
                          params: { bookingId: booking.id }
                        })
                      }
                      style={styles.flexBtn}
                    />
                  </View>
                ) : null}

                {booking.status === "IN_STORAGE" ? (
                  <View style={styles.actionsRow}>
                    <Button
                      title="Manage in Vault"
                      size="sm"
                      onPress={() =>
                        router.push({
                          pathname: "/(host)/vault",
                          params: { bookingId: booking.id }
                        })
                      }
                      style={styles.flexBtn}
                    />
                    <Button
                      title="Report Exception"
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        setExceptionTarget(booking);
                        setExceptionReason("");
                      }}
                      style={styles.flexBtn}
                    />
                  </View>
                ) : null}

                {canCancel ? (
                  <Button
                    title="Host Cancel (Refunds Traveller)"
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      setCancelTarget(booking);
                      setCancelReason("");
                    }}
                  />
                ) : null}
              </Card>
            );
          })}
        </View>
      )}

      <BottomSheet
        visible={Boolean(rejectTarget)}
        title={`Reject #${rejectTarget?.referenceCode ?? ""}`}
        subtitle="Releases held capacity immediately."
        onClose={() => setRejectTarget(null)}
      >
        <View style={styles.sheetStack}>
          <TextInput
            label="Rejection Reason"
            required
            value={rejectReason}
            onChangeText={setRejectReason}
            placeholder="Counter capacity unavailable for oversized trunks"
          />
          <Button
            title="Confirm Rejection"
            variant="danger"
            isLoading={rejectMutation.isPending}
            onPress={() => {
              void handleConfirmReject();
            }}
          />
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={Boolean(cancelTarget)}
        title={`Cancel #${cancelTarget?.referenceCode ?? ""}?`}
        description="Host cancellation triggers a 100% traveller refund policy review."
        confirmLabel="Cancel Booking"
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
          placeholder="Unexpected facility maintenance"
        />
      </ConfirmDialog>

      <BottomSheet
        visible={Boolean(exceptionTarget)}
        title={`Custody Exception #${exceptionTarget?.referenceCode ?? ""}`}
        subtitle="Logs an operational incident and places payout settlement on review hold."
        onClose={() => setExceptionTarget(null)}
      >
        <View style={styles.sheetStack}>
          {HOST_EXCEPTION_CATEGORIES.map((cat) => (
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
            placeholder="Describe seal, count, or arrival mismatch..."
          />
          <Button
            title="Submit Exception"
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
    gap: 6
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
    fontSize: 12,
    fontWeight: "600",
    color: mobileTextColors.secondary
  },
  tabTextActive: {
    color: mobileColors.white
  },
  listGap: {
    gap: mobileSpacing[4]
  },
  cardGap: {
    gap: mobileSpacing[2]
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: mobileSpacing[2]
  },
  flexCol: {
    flex: 1
  },
  refCode: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.terracotta[600]
  },
  locName: {
    ...mobileTypography.headingSm,
    color: mobileTextColors.primary
  },
  metaLine: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileTextColors.secondary
  },
  priceLine: {
    ...mobileTypography.label,
    color: mobileColors.navy[900],
    marginTop: 2
  },
  actionsRow: {
    flexDirection: "row",
    gap: mobileSpacing[2],
    marginTop: 4
  },
  flexBtn: {
    flex: 1
  },
  sheetStack: {
    gap: mobileSpacing[3]
  }
});
