import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { BookingDetail, CustodyPassResponse } from "@luggage-storage/contracts";
import {
  Badge,
  BookingSummary,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  MascotIllustration,
  MobileIcon,
  QrCodeMatrix,
  SafeHeader,
  ScreenContainer,
  StatusBadge
} from "../../src/components";
import { marketplaceApi } from "../../src/services/marketplace-api";
import { normalizeApiError } from "../../src/services/api-client";
import { useAuthStore } from "../../src/store/useAuthStore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

const PASS_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CachedPassSnapshot {
  booking: BookingDetail;
  pass: CustodyPassResponse;
  savedAt: string;
}

function getCacheKey(bookingId: string): string {
  return `bagbox_cached_pass_${bookingId}`;
}

function formatPin(pin: string): string {
  if (pin.length !== 6) {
    return pin;
  }
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
}

export default function TravellerCustodyPassScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string; ref?: string }>();
  const { isAuthenticated } = useAuthStore();

  const bookingId = typeof params.bookingId === "string" ? params.bookingId : undefined;
  const isValidBookingUuid = Boolean(bookingId && PASS_UUID_REGEX.test(bookingId));

  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [issuedPass, setIssuedPass] = useState<CustodyPassResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(isValidBookingUuid);
  const [isRefreshingPass, setIsRefreshingPass] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFromOfflineCache, setIsFromOfflineCache] = useState(false);
  const [savedOfflineAt, setSavedOfflineAt] = useState<string | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  const loadLiveCustodyPass = useCallback(async () => {
    if (!bookingId || !isValidBookingUuid) {
      setIsLoading(false);
      return;
    }
    if (!isAuthenticated) {
      setIsLoading(false);
      setLoadError("Sign in to unlock and inspect your live custody QR pass.");
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    setIsFromOfflineCache(false);

    try {
      const bookingDetail = await marketplaceApi.getBookingDetail(bookingId);
      setDetail(bookingDetail);

      if (bookingDetail.status === "CONFIRMED" || bookingDetail.status === "IN_STORAGE") {
        const operation = bookingDetail.status === "IN_STORAGE" ? "COLLECTION" : "CHECK_IN";
        const pass = await marketplaceApi.issueCustodyPass(bookingId, { operation });
        setIssuedPass(pass);
        const snapshot: CachedPassSnapshot = {
          booking: bookingDetail,
          pass,
          savedAt: new Date().toISOString()
        };
        await AsyncStorage.setItem(getCacheKey(bookingId), JSON.stringify(snapshot)).catch(() => {});
        setSavedOfflineAt(snapshot.savedAt);
      } else {
        setIssuedPass(null);
      }
    } catch (err: unknown) {
      const normalized = normalizeApiError(err);
      if (normalized.isNetworkError) {
        try {
          const cachedRaw = await AsyncStorage.getItem(getCacheKey(bookingId));
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw) as CachedPassSnapshot;
            if (new Date(cached.pass.expiresAt).getTime() > Date.now()) {
              setDetail(cached.booking);
              setIssuedPass(cached.pass);
              setSavedOfflineAt(cached.savedAt);
              setIsFromOfflineCache(true);
              setIsLoading(false);
              return;
            }
          }
        } catch {
          // Ignore malformed offline snapshot
        }
      }
      setLoadError(normalized.message);
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, isAuthenticated, isValidBookingUuid]);

  useEffect(() => {
    void loadLiveCustodyPass();
  }, [loadLiveCustodyPass]);

  const handleRegeneratePass = async () => {
    if (!bookingId || !detail) {
      return;
    }
    if (!(detail.status === "CONFIRMED" || detail.status === "IN_STORAGE")) {
      return;
    }
    setIsRefreshingPass(true);
    setLoadError(null);
    try {
      const operation = detail.status === "IN_STORAGE" ? "COLLECTION" : "CHECK_IN";
      const pass = await marketplaceApi.issueCustodyPass(bookingId, { operation });
      setIssuedPass(pass);
      setIsFromOfflineCache(false);
      const snapshot: CachedPassSnapshot = {
        booking: detail,
        pass,
        savedAt: new Date().toISOString()
      };
      await AsyncStorage.setItem(getCacheKey(bookingId), JSON.stringify(snapshot)).catch(() => {});
      setSavedOfflineAt(snapshot.savedAt);
    } catch (err: unknown) {
      setLoadError(normalizeApiError(err).message);
    } finally {
      setIsRefreshingPass(false);
    }
  };

  const handleOpenDirections = () => {
    if (!detail?.location.addressDisclosed) {
      return;
    }
    if (
      typeof detail.location.exactLatitude === "number" &&
      typeof detail.location.exactLongitude === "number"
    ) {
      router.push({
        pathname: "/(traveller)/navigation",
        params: {
          bookingId,
          destinationLat: String(detail.location.exactLatitude),
          destinationLng: String(detail.location.exactLongitude),
          destinationTitle: detail.location.name,
          destinationAddress: detail.location.addressLine1 || detail.location.city
        }
      });
      return;
    }
    const query = encodeURIComponent(
      `${detail.location.addressLine1 || ""} ${detail.location.city}`.trim()
    );
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const handleOpenExternalDirections = () => {
    if (!detail?.location.addressDisclosed) return;
    if (
      typeof detail.location.exactLatitude === "number" &&
      typeof detail.location.exactLongitude === "number"
    ) {
      const coords = `${detail.location.exactLatitude},${detail.location.exactLongitude}`;
      void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${coords}`);
      return;
    }
    const query = encodeURIComponent(
      `${detail.location.addressLine1 || ""} ${detail.location.city}`.trim()
    );
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const isCustodyUnlocked = Boolean(
    detail && (detail.status === "CONFIRMED" || detail.status === "IN_STORAGE")
  );

  const handleCopyOrSharePass = async () => {
    if (!detail || !issuedPass) return;
    const summaryText = `LuggageStorage Pass #${detail.referenceCode} | PIN: ${issuedPass.verificationPin}`;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(summaryText).catch(() => {});
      setCopiedNotice("Reference & PIN copied");
      setTimeout(() => setCopiedNotice(null), 2500);
      return;
    }
    await Share.share({ message: summaryText }).catch(() => {});
  };

  if (!isValidBookingUuid) {
    return (
      <ScreenContainer
        header={<SafeHeader title="Digital Custody Pass" onBack={() => router.replace("/(traveller)/bookings")} />}
        testID="traveller-pass-invalid"
      >
        <EmptyState
          mascot="suitcase-walk"
          title="No Reservation Selected"
          description="Open an active booking from My Storage to display your single-use QR handover ticket."
          actionTitle="View My Storage"
          onAction={() => router.replace("/(traveller)/bookings")}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      header={
        <SafeHeader
          title="Digital Custody Pass"
          subtitle={detail ? `#${detail.referenceCode}` : params.ref}
          onBack={() => router.replace("/(traveller)/bookings")}
        />
      }
      refreshing={isLoading}
      onRefresh={() => {
        void loadLiveCustodyPass();
      }}
      testID="traveller-custody-pass-screen"
    >
      {isLoading ? (
        <LoadingSkeleton count={3} />
      ) : loadError && !detail ? (
        <ErrorState
          title="Unable to Verify Booking"
          message={loadError}
          onRetry={() => {
            void loadLiveCustodyPass();
          }}
        />
      ) : !detail || !isCustodyUnlocked ? (
        <Card variant="elevated" style={styles.lockedCard}>
          <Badge label="PASS LOCKED" variant="warning" icon="lock" />
          <Text style={styles.lockedTitle}>
            {detail ? `Booking Status: ${detail.status}` : "Verification Required"}
          </Text>
          <Text style={styles.lockedBody}>
            Digital custody QR tokens, 6-digit PINs, and exact hub street addresses remain locked
            until payment confirmation succeeds.
          </Text>
          {detail?.status === "PENDING_PAYMENT" ? (
            <Button
              title="Complete PayHere Payment"
              leftIcon={<MobileIcon name="credit-card" size={16} color={mobileColors.white} />}
              onPress={() =>
                router.replace({
                  pathname: "/(traveller)/checkout",
                  params: { locId: detail.locationId, bookingId: detail.id }
                })
              }
            />
          ) : (
            <Button
              title="Back to My Storage"
              onPress={() => router.replace("/(traveller)/bookings")}
            />
          )}
        </Card>
      ) : (
        <View style={styles.stack}>
          {isFromOfflineCache ? (
            <Badge
              label="Viewing Cached Pass (Offline)"
              variant="warning"
              icon="clock-alert"
            />
          ) : null}

          {loadError ? <ErrorState title="Refresh Warning" message={loadError} /> : null}

          <Card variant="elevated" style={styles.ticketCard}>
            <View style={styles.ticketHeader}>
              <View>
                <Text style={styles.ticketEyebrow}>AUTHORIZED HANDOVER CREDENTIAL</Text>
                <Text style={styles.ticketRef}>#{detail.referenceCode}</Text>
              </View>
              <StatusBadge status={detail.status} />
            </View>

            {issuedPass ? (
              <>
                <TouchableOpacity
                  style={styles.qrSection}
                  onPress={() => setQrModalVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Tap to enlarge custody QR code for counter scanning"
                  testID="pass-qr-enlarge-trigger"
                >
                  <QrCodeMatrix
                    value={issuedPass.qrToken}
                    size={200}
                    accessibilityLabel={`Custody QR for booking ${detail.referenceCode}`}
                  />
                  <Text style={styles.operationBadge}>
                    Operation: {issuedPass.operation.replace("_", "-")}
                  </Text>
                  <Text style={styles.expiryNote}>
                    Expires at {new Date(issuedPass.expiresAt).toLocaleTimeString()} · Tap QR to enlarge
                  </Text>
                </TouchableOpacity>

                <View style={styles.pinBox}>
                  <Text style={styles.pinLabel}>6-DIGIT FALLBACK PIN</Text>
                  <Text style={styles.pinValue}>{formatPin(issuedPass.verificationPin)}</Text>
                  <Text style={styles.pinHelp}>
                    Provide this single-use PIN to partner counter staff if QR scanning is
                    unavailable.
                  </Text>
                </View>

                <View style={styles.passActionRow}>
                  <Button
                    title={copiedNotice ?? "Share / Copy Ref & PIN"}
                    variant="outline"
                    size="sm"
                    style={styles.passActionFlex}
                    leftIcon={<MobileIcon name="copy" size={14} color={mobileColors.navy[900]} />}
                    onPress={() => {
                      void handleCopyOrSharePass();
                    }}
                  />
                  <Button
                    title="Enlarge QR"
                    variant="outline"
                    size="sm"
                    style={styles.passActionFlex}
                    leftIcon={<MobileIcon name="qr-code" size={14} color={mobileColors.navy[900]} />}
                    onPress={() => setQrModalVisible(true)}
                  />
                </View>

                <Button
                  title="Regenerate Fresh QR & PIN"
                  variant="secondary"
                  leftIcon={<MobileIcon name="refresh" size={16} color={mobileColors.white} />}
                  isLoading={isRefreshingPass}
                  onPress={() => {
                    void handleRegeneratePass();
                  }}
                />
              </>
            ) : (
              <LoadingSkeleton count={1} />
            )}
          </Card>

          <BookingSummary booking={detail} onOpenDirections={handleOpenDirections} />

          <Card variant="outlined" style={styles.offlineCard}>
            <View style={styles.offlineRow}>
              <MobileIcon name="shield" size={20} color={mobileColors.emerald[700]} />
              <View style={styles.offlineTextCol}>
                <Text style={styles.offlineTitle}>Offline Storage Protection</Text>
                <Text style={styles.offlineDesc}>
                  This ticket and PIN are stored locally on your device for offline arrival at the
                  counter until its expiry time
                  {savedOfflineAt
                    ? ` (last synced ${new Date(savedOfflineAt).toLocaleTimeString()}).`
                    : "."}
                </Text>
              </View>
            </View>
          </Card>

          <MascotIllustration
            mascot="jump"
            size="sm"
            caption="Present this pass at check-in or pickup. Safe travels across Sri Lanka!"
          />
        </View>
      )}

      <Modal
        visible={qrModalVisible && Boolean(issuedPass && detail)}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
        testID="pass-qr-enlarged-modal"
      >
        <View style={styles.qrModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setQrModalVisible(false)}
            accessibilityLabel="Close enlarged QR pass"
            accessibilityRole="button"
          />
          <View style={styles.qrModalCard}>
            <Text style={styles.qrModalTitle}>#{detail?.referenceCode}</Text>
            <Text style={styles.qrModalSubtitle}>
              Hold steady for partner counter scanner
            </Text>
            {issuedPass ? (
              <QrCodeMatrix
                value={issuedPass.qrToken}
                size={260}
                accessibilityLabel={`Enlarged Custody QR for ${detail?.referenceCode ?? "booking"}`}
              />
            ) : null}
            {issuedPass ? (
              <Text style={styles.qrModalPin}>
                PIN: {formatPin(issuedPass.verificationPin)}
              </Text>
            ) : null}
            <Button
              title="Done"
              variant="primary"
              fullWidth
              onPress={() => setQrModalVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: mobileSpacing[4]
  },
  lockedCard: {
    gap: mobileSpacing[4]
  },
  lockedTitle: {
    ...mobileTypography.headingMd,
    color: mobileTextColors.primary
  },
  lockedBody: {
    ...mobileTypography.bodyMd,
    color: mobileTextColors.secondary
  },
  ticketCard: {
    gap: mobileSpacing[4]
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: mobileSpacing[3]
  },
  ticketEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.terracotta[600],
    letterSpacing: 0.7
  },
  ticketRef: {
    ...mobileTypography.headingMd,
    fontFamily: "monospace",
    fontVariant: ["tabular-nums"],
    color: mobileTextColors.primary
  },
  qrSection: {
    alignItems: "center",
    gap: 8,
    paddingVertical: mobileSpacing[3]
  },
  operationBadge: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  expiryNote: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileTextColors.muted
  },
  pinBox: {
    backgroundColor: mobileColors.navy[900],
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[4],
    alignItems: "center",
    gap: 6
  },
  pinLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.sand[300],
    letterSpacing: 1
  },
  pinValue: {
    fontSize: 30,
    fontWeight: "800",
    fontFamily: "monospace",
    fontVariant: ["tabular-nums"],
    color: mobileColors.white,
    letterSpacing: 4
  },
  passActionRow: {
    flexDirection: "row",
    gap: mobileSpacing[2]
  },
  passActionFlex: {
    flex: 1
  },
  qrModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(7, 14, 26, 0.84)",
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing[5]
  },
  qrModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: mobileColors.white,
    borderRadius: mobileRadius["2xl"],
    padding: mobileSpacing[5],
    alignItems: "center",
    gap: mobileSpacing[3]
  },
  qrModalTitle: {
    ...mobileTypography.headingMd,
    fontFamily: "monospace",
    fontVariant: ["tabular-nums"],
    color: mobileColors.navy[950]
  },
  qrModalSubtitle: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.muted,
    textAlign: "center"
  },
  qrModalPin: {
    fontSize: 20,
    fontWeight: "800",
    fontFamily: "monospace",
    fontVariant: ["tabular-nums"],
    letterSpacing: 3,
    color: mobileColors.navy[900]
  },
  pinHelp: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileColors.sand[200],
    textAlign: "center"
  },
  offlineCard: {
    backgroundColor: mobileStatusTokens.successBg,
    borderColor: mobileStatusTokens.successBorder
  },
  offlineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  offlineTextCol: {
    flex: 1,
    gap: 4
  },
  offlineTitle: {
    ...mobileTypography.headingSm,
    color: mobileStatusTokens.success
  },
  offlineDesc: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400",
    color: mobileColors.emerald[700]
  }
});
