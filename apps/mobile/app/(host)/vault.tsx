import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { BookingDetail } from "@luggage-storage/contracts";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  StatusBadge,
  TextInput,
  formatColomboDateTime
} from "../../src/components";
import {
  useCompleteCollectionMutation,
  useCustodyDetailQuery,
  useHostBookingsQuery,
  useHostLocationDetailQuery
} from "../../src/hooks";
import { normalizeApiError } from "../../src/services/api-client";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

type VaultTab = "ACTIVE" | "OVERDUE" | "RELEASED";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function HostVaultScreen() {
  const params = useLocalSearchParams<{
    bookingId?: string;
    qrToken?: string;
    pin?: string;
  }>();

  const bookingsQuery = useHostBookingsQuery({ limit: 50 }, true);
  const collectionMutation = useCompleteCollectionMutation();

  const [activeTab, setActiveTab] = useState<VaultTab>("ACTIVE");
  const [selectedBooking, setSelectedBooking] = useState<BookingDetail | null>(null);
  const [qrTokenInput, setQrTokenInput] = useState(
    typeof params.qrToken === "string" ? params.qrToken : ""
  );
  const [pinInput, setPinInput] = useState(typeof params.pin === "string" ? params.pin : "");
  const [releasedBagCountText, setReleasedBagCountText] = useState("");
  const [exceptionNotes, setExceptionNotes] = useState("");
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [releaseSuccess, setReleaseSuccess] = useState<string | null>(null);

  const custodyQuery = useCustodyDetailQuery(selectedBooking?.id, Boolean(selectedBooking?.id));
  const locationQuery = useHostLocationDetailQuery(
    selectedBooking?.locationId,
    Boolean(selectedBooking?.locationId)
  );
  const zoneNameById = useMemo(
    () => new Map((locationQuery.data?.zones ?? []).map((z) => [z.id, z.name])),
    [locationQuery.data]
  );

  const bookings = useMemo(() => bookingsQuery.data?.bookings ?? [], [bookingsQuery.data]);
  const nowMs = Date.now();

  const activeStored = useMemo(
    () => bookings.filter((b) => b.status === "IN_STORAGE"),
    [bookings]
  );
  const overdueItems = useMemo(
    () => activeStored.filter((b) => new Date(b.collectionAt).getTime() < nowMs),
    [activeStored, nowMs]
  );
  const releasedItems = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.status === "COMPLETED" || b.custodySummary?.status === "RELEASED_TO_TRAVELLER"
      ),
    [bookings]
  );

  useEffect(() => {
    if (typeof params.bookingId === "string" && UUID_REGEX.test(params.bookingId)) {
      const target = bookings.find((b) => b.id === params.bookingId && b.status === "IN_STORAGE");
      if (target) {
        setSelectedBooking(target);
        setReleasedBagCountText(String(target.totalBags));
      }
    }
  }, [params.bookingId, bookings]);

  const listForTab =
    activeTab === "ACTIVE"
      ? activeStored
      : activeTab === "OVERDUE"
        ? overdueItems
        : releasedItems;

  const openReleaseSheet = (booking: BookingDetail) => {
    setSelectedBooking(booking);
    setReleasedBagCountText(String(booking.totalBags));
    setExceptionNotes("");
    setReleaseError(null);
  };

  const handleConfirmRelease = async () => {
    if (!selectedBooking) {
      return;
    }
    setReleaseError(null);

    const count = Number(releasedBagCountText);
    if (!Number.isInteger(count) || count < 0) {
      setReleaseError("Enter a valid released bag count.");
      return;
    }

    const cleanQr = qrTokenInput.trim();
    const cleanPin = pinInput.replace(/\s+/g, "");
    if (!cleanQr && !/^\d{6}$/.test(cleanPin)) {
      setReleaseError("Enter the traveller's 6-digit collection PIN or scan their collection QR.");
      return;
    }

    const expectedCount =
      custodyQuery.data?.checkedInBagCount ?? selectedBooking.totalBags;
    if (count !== expectedCount && exceptionNotes.trim().length < 3) {
      setReleaseError(
        `Count differs from ${expectedCount} bag(s) in custody. Provide handover exception notes.`
      );
      return;
    }

    try {
      const res = await collectionMutation.mutateAsync({
        bookingId: selectedBooking.id,
        data: {
          ...(cleanQr ? { qrToken: cleanQr } : { verificationPin: cleanPin }),
          releasedBagCount: count,
          ...(exceptionNotes.trim() ? { exceptionNotes: exceptionNotes.trim() } : {})
        }
      });

      const overdueNote =
        res.overdueMinutes > 0
          ? ` (${res.overdueMinutes} min overdue recorded for platform ledger — luggage released unconditionally.)`
          : "";
      setReleaseSuccess(
        `Released #${selectedBooking.referenceCode} (${count} bag(s))${overdueNote}`
      );
      setSelectedBooking(null);
      setQrTokenInput("");
      setPinInput("");
    } catch (err) {
      setReleaseError(normalizeApiError(err).message);
    }
  };

  return (
    <ScreenContainer
      header={
        <SafeHeader
          title="Vault Luggage Inventory"
          subtitle="Current Stored Luggage & Collection Release"
        />
      }
      refreshing={bookingsQuery.isRefetching}
      onRefresh={() => {
        void bookingsQuery.refetch();
      }}
      testID="host-vault-screen"
    >
      <View style={styles.stack}>
        <Card variant="outlined" style={styles.noLienBanner}>
          <View style={styles.bannerHeader}>
            <MobileIcon name="shield-check" size={18} color={mobileStatusTokens.infoIcon} />
            <Text style={styles.bannerTitle}>Unconditional Release & No-Lien Policy</Text>
          </View>
          <Text style={styles.bannerBody}>
            Luggage return is never delayed or withheld over overdue fees. Any overdue duration is
            logged automatically to the ledger upon release.
          </Text>
        </Card>

        {releaseSuccess ? (
          <Badge label={releaseSuccess} variant="success" icon="check-circle" />
        ) : null}

        <View style={styles.tabsRow}>
          {(
            [
              { key: "ACTIVE", label: `Active Vault (${activeStored.length})` },
              { key: "OVERDUE", label: `Overdue (${overdueItems.length})` },
              { key: "RELEASED", label: `Released (${releasedItems.length})` }
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

        {bookingsQuery.isLoading ? (
          <LoadingSkeleton count={3} />
        ) : bookingsQuery.isError ? (
          <ErrorState
            title="Unable to Load Vault Inventory"
            message={normalizeApiError(bookingsQuery.error).message}
            onRetry={() => {
              void bookingsQuery.refetch();
            }}
          />
        ) : listForTab.length === 0 ? (
          <EmptyState
            mascot="suitcase-hug"
            title={`No ${activeTab.toLowerCase()} luggage`}
            description="Current stored luggage awaiting pickup or overdue alert follow-up appears here."
          />
        ) : (
          <View style={styles.listGap}>
            {listForTab.map((booking) => {
              const isOverdue =
                booking.status === "IN_STORAGE" &&
                new Date(booking.collectionAt).getTime() < nowMs;
              return (
                <Card key={booking.id} variant="elevated" style={styles.cardGap}>
                  <View style={styles.cardHeader}>
                    <View style={styles.flexCol}>
                      <Text style={styles.refCode}>#{booking.referenceCode}</Text>
                      <Text style={styles.locName}>{booking.location.name}</Text>
                    </View>
                    <StatusBadge status={booking.status} size="sm" />
                  </View>

                  {isOverdue ? (
                    <Badge
                      label="Baggage Overdue — Release Unconditionally"
                      variant="warning"
                      icon="alert-triangle"
                      size="sm"
                    />
                  ) : null}

                  <Text style={styles.metaText}>
                    Scheduled Collection: {formatColomboDateTime(new Date(booking.collectionAt))}
                  </Text>
                  <Text style={styles.metaText}>
                    Bag Count: {booking.totalBags} bag(s)
                  </Text>

                  {booking.status === "IN_STORAGE" ? (
                    <Button
                      title="Verify PIN / QR & Release Luggage"
                      size="sm"
                      onPress={() => openReleaseSheet(booking)}
                    />
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </View>

      <BottomSheet
        visible={Boolean(selectedBooking)}
        title={`Release Luggage #${selectedBooking?.referenceCode ?? ""}`}
        subtitle="Verify seals and complete collection handover."
        onClose={() => setSelectedBooking(null)}
      >
        <View style={styles.sheetStack}>
          {custodyQuery.isLoading ? (
            <LoadingSkeleton count={1} />
          ) : custodyQuery.data?.bags && custodyQuery.data.bags.length > 0 ? (
            <View style={styles.sealsBox}>
              <Text style={styles.sealsTitle}>
                Recorded Tags & Security Seals ({custodyQuery.data.bags.length})
              </Text>
              {custodyQuery.data.bags.map((bag) => (
                <Text key={bag.id} style={styles.sealLine}>
                  • {bag.bagTagCode} ({bag.bagCategory})
                  {bag.securitySealNumber ? ` • Seal ${bag.securitySealNumber}` : ""}
                  {bag.zoneId && zoneNameById.get(bag.zoneId)
                    ? ` • ${zoneNameById.get(bag.zoneId)}`
                    : ""}
                </Text>
              ))}
            </View>
          ) : null}

          {!qrTokenInput ? (
            <TextInput
              label="Traveller 6-Digit Collection PIN"
              required
              keyboardType="numeric"
              maxLength={6}
              value={pinInput}
              onChangeText={setPinInput}
              placeholder="6-digit PIN"
            />
          ) : (
            <Badge label="Verified QR Pass Attached" variant="success" icon="check-circle" />
          )}

          <TextInput
            label="Released Bag Count"
            required
            keyboardType="numeric"
            value={releasedBagCountText}
            onChangeText={setReleasedBagCountText}
          />

          <TextInput
            label="Handover / Discrepancy Notes (Optional)"
            value={exceptionNotes}
            onChangeText={setExceptionNotes}
            placeholder="Required if bag count or seal differs"
          />

          {releaseError ? <ErrorState title="Release Blocked" message={releaseError} /> : null}

          <Button
            title="Complete Collection Release"
            isLoading={collectionMutation.isPending}
            onPress={() => {
              void handleConfirmRelease();
            }}
          />
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: mobileSpacing[4]
  },
  noLienBanner: {
    backgroundColor: mobileStatusTokens.infoBg,
    borderColor: mobileStatusTokens.infoBorder,
    gap: 6
  },
  bannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  bannerTitle: {
    ...mobileTypography.headingSm,
    color: mobileColors.navy[900]
  },
  bannerBody: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileTextColors.secondary
  },
  tabsRow: {
    flexDirection: "row",
    gap: 6
  },
  tabBtn: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 6,
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
    fontSize: 11,
    fontWeight: "600",
    color: mobileTextColors.secondary,
    textAlign: "center"
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
  cardHeader: {
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
  metaText: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileTextColors.secondary
  },
  sheetStack: {
    gap: mobileSpacing[3]
  },
  sealsBox: {
    padding: mobileSpacing[3],
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.sand[50],
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    gap: 4
  },
  sealsTitle: {
    ...mobileTypography.label,
    color: mobileTextColors.primary
  },
  sealLine: {
    fontSize: 12,
    lineHeight: 16,
    color: mobileTextColors.secondary
  }
});
