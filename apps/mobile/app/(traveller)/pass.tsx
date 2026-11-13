import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { BookingDetail, CustodyPassResponse } from "@luggage-storage/contracts";
import { DEMO_BOOKINGS, TravellerBookingItem } from "../../src/data/mock-marketplace";
import { Card, Button, Badge, MobileIcon, MascotIllustration } from "../../src/components";
import { mobileColors, mobileRadius, mobileTypography } from "../../src/lib/theme";
import { useAuthStore } from "../../src/store/useAuthStore";
import { marketplaceApi } from "../../src/services/marketplace-api";

const PASS_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function TravellerCustodyPassScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string; bookingId?: string }>();
  const { isAuthenticated } = useAuthStore();

  const demoBooking: TravellerBookingItem =
    DEMO_BOOKINGS.find((b) => b.reference === params.ref) || DEMO_BOOKINGS[0];

  const [liveBooking, setLiveBooking] = useState<BookingDetail | null>(null);
  const [issuedPass, setIssuedPass] = useState<CustodyPassResponse | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);

  useEffect(() => {
    const targetId = params.bookingId;
    if (!isAuthenticated || !targetId || !PASS_UUID_REGEX.test(targetId)) return;
    let mounted = true;
    marketplaceApi
      .getBookingDetail(targetId)
      .then(async (detail) => {
        if (!mounted) return;
        setLiveBooking(detail);
        if (detail.status === "CONFIRMED" || detail.status === "IN_STORAGE") {
          const pass = await marketplaceApi.issueCustodyPass(targetId, {
            operation: detail.status === "IN_STORAGE" ? "COLLECTION" : "CHECK_IN"
          });
          if (mounted) setIssuedPass(pass);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, params.bookingId]);

  const booking: TravellerBookingItem = liveBooking
    ? {
        ...demoBooking,
        id: liveBooking.id,
        reference: `#${liveBooking.referenceCode}`,
        locationName: liveBooking.location.name,
        totalBags: liveBooking.totalBags,
        pickUpTime: new Date(liveBooking.collectionAt).toLocaleString(),
        pinFallback: issuedPass
          ? `${issuedPass.verificationPin.slice(0, 3)} ${issuedPass.verificationPin.slice(3)}`
          : "Pending Payment",
        exactAddress: liveBooking.location.addressDisclosed
          ? `${liveBooking.location.addressLine1 || ""}, ${liveBooking.location.city}`
          : `${liveBooking.location.approximateArea} (Unlocks after payment)`,
        landmark: liveBooking.location.approximateArea
      }
    : demoBooking;

  return (
    <View style={styles.screenWrapper}>
      {/* Top Header */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/(traveller)/bookings")}
          accessibilityRole="button"
          accessibilityLabel="Back to Bookings"
        >
          <MobileIcon name="chevron-left" size={20} color={mobileColors.white} />
          <Text style={styles.backButtonText}>Bookings</Text>
        </TouchableOpacity>
        <Text style={styles.topNavTitle}>Digital Custody Pass</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Confirmed Celebration Banner */}
        <View style={styles.celebrationBanner}>
          <Text style={styles.celebrationTitle}>Booking Confirmed & Active</Text>
          <Text style={styles.celebrationSubtitle}>
            Present this pass to partner counter staff for check-in or bag pickup.
          </Text>
        </View>

        {/* High-Contrast Ticket Container */}
        <Card style={styles.ticketCard} variant="elevated">
          {/* Ticket Header */}
          <View style={styles.ticketHeader}>
            <View>
              <Text style={styles.ticketAgency}>CEYLON LUGGAGE MARKETPLACE</Text>
              <Text style={styles.ticketRef}>{booking.reference}</Text>
            </View>
            <Badge label="VERIFIED PASS" variant="success" size="sm" />
          </View>

          {/* QR Code Container */}
          <View style={styles.qrContainer}>
            {/* High-density SVG representation of QR pass */}
            <View style={styles.qrBox}>
              <MobileIcon name="qr-code" size={160} color={mobileColors.navy[950]} />
            </View>
            <Text style={styles.qrSubtext}>
              Digital Custody QR Pass • Prototype Display
            </Text>
          </View>

          {/* 6-Digit PIN Fallback (DEC-005) */}
          <View style={styles.pinFallbackBox}>
            <Text style={styles.pinLabel}>6-DIGIT FALLBACK PIN (WHEN QR UNAVAILABLE)</Text>
            <Text style={styles.pinDigits}>{booking.pinFallback}</Text>
            <Text style={styles.pinHelp}>
              Provide this PIN to counter staff if camera scanning is offline.
            </Text>
          </View>

          {/* Custody Breakdown */}
          <View style={styles.custodySpecs}>
            <View style={styles.specRow}>
              <Text style={styles.specKey}>Vault Zone:</Text>
              <Text style={styles.specVal}>{booking.zoneCode}</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specKey}>Serialized Seals:</Text>
              <Text style={styles.specVal}>
                {booking.seals.length > 0 ? booking.seals.join(", ") : "Assigned at Counter"}
              </Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specKey}>Bags in Custody:</Text>
              <Text style={styles.specVal}>{booking.totalBags} Luggage Items</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specKey}>Pickup Deadline:</Text>
              <Text style={styles.specVal}>{booking.pickUpTime}</Text>
            </View>
          </View>

          {/* Exact Address & Contact */}
          <View style={styles.addressBox}>
            <Text style={styles.addressLabel}>EXACT PARTNER COUNTER ADDRESS</Text>
            <Text style={styles.exactAddressText}>{booking.exactAddress}</Text>
            <Text style={styles.landmarkText}>Landmark: {booking.landmark}</Text>

            <TouchableOpacity
              style={styles.callHotlineBtn}
              onPress={() => alert(`Calling host counter: ${booking.hostPhone}`)}
            >
              <MobileIcon name="phone" size={16} color={mobileColors.navy[900]} />
              <Text style={styles.callHotlineText}>
                Call Host Counter ({booking.hostPhone})
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Offline Caching Notice (TSK-2C-014) */}
        <Card style={styles.offlineCard} variant="outlined">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <MobileIcon name="shield" size={20} color={mobileColors.emerald[700]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineTitle}>
                {savedOffline ? "Cached for Offline Access ✓" : "Offline Storage Protection"}
              </Text>
              <Text style={styles.offlineDesc}>
                This ticket and PIN are stored locally on your device. You can access it without
                cellular data or WiFi roaming.
              </Text>
            </View>
          </View>
          <Button
            title={savedOffline ? "Saved to Device Storage ✓" : "Cache Pass Offline (Prototype)"}
            variant={savedOffline ? "outline" : "secondary"}
            size="sm"
            onPress={() => setSavedOffline(true)}
            style={{ marginTop: 10 }}
          />
        </Card>

        {/* Counter Arrival Instructions */}
        <Card style={styles.instructionsCard}>
          <Text style={styles.instTitle}>Arrival Instructions at Counter</Text>
          <View style={styles.instSteps}>
            <Text style={styles.instStep}>
              1. Show this QR code or recite PIN ({booking.pinFallback}) to staff.
            </Text>
            <Text style={styles.instStep}>
              2. Staff inspects luggage exterior and attaches tamper-evident seals.
            </Text>
            <Text style={styles.instStep}>
              3. Bags are securely locked in Vault Zone {booking.zoneCode}.
            </Text>
            <Text style={styles.instStep}>
              4. Return before {booking.pickUpTime} to collect your luggage.
            </Text>
          </View>
        </Card>

        <MascotIllustration
          mascot="jump"
          size="sm"
          caption="Booking secured! Explore Sri Lanka freely while your luggage is in safe hands."
        />
      </ScrollView>
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
  container: {
    padding: 16,
    paddingBottom: 40
  },
  celebrationBanner: {
    backgroundColor: mobileColors.navy[900],
    borderRadius: mobileRadius.lg,
    padding: 16,
    marginBottom: 14,
    alignItems: "center"
  },
  celebrationTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: mobileColors.white
  },
  celebrationSubtitle: {
    fontSize: 12,
    color: mobileColors.sand[300],
    textAlign: "center",
    marginTop: 4
  },
  ticketCard: {
    padding: 20,
    backgroundColor: mobileColors.white,
    borderWidth: 2,
    borderColor: mobileColors.sand[300],
    marginBottom: 14
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[200],
    paddingBottom: 12,
    marginBottom: 14
  },
  ticketAgency: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: mobileColors.sand[600]
  },
  ticketRef: {
    ...mobileTypography.codeMono,
    fontSize: 16,
    fontWeight: "800",
    color: mobileColors.navy[900]
  },
  qrContainer: {
    alignItems: "center",
    paddingVertical: 12
  },
  qrBox: {
    backgroundColor: mobileColors.sand[50],
    borderWidth: 2,
    borderColor: mobileColors.navy[900],
    borderRadius: mobileRadius.lg,
    padding: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  qrSubtext: {
    fontSize: 10,
    color: mobileColors.sand[600],
    marginTop: 8
  },
  pinFallbackBox: {
    backgroundColor: mobileColors.terracotta[50],
    borderWidth: 1,
    borderColor: mobileColors.terracotta[200],
    borderRadius: mobileRadius.md,
    padding: 14,
    alignItems: "center",
    marginVertical: 12
  },
  pinLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: mobileColors.terracotta[700],
    letterSpacing: 0.5
  },
  pinDigits: {
    ...mobileTypography.codeMono,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 4,
    color: mobileColors.terracotta[600],
    marginVertical: 4
  },
  pinHelp: {
    fontSize: 11,
    color: mobileColors.sand[700],
    textAlign: "center"
  },
  custodySpecs: {
    backgroundColor: mobileColors.sand[50],
    borderRadius: mobileRadius.md,
    padding: 12,
    gap: 6,
    marginBottom: 14
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  specKey: {
    fontSize: 12,
    color: mobileColors.sand[600]
  },
  specVal: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  addressBox: {
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[200],
    paddingTop: 12
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: mobileColors.sand[600],
    letterSpacing: 0.5,
    marginBottom: 4
  },
  exactAddressText: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  landmarkText: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2
  },
  callHotlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.sand[100],
    borderRadius: mobileRadius.md,
    paddingVertical: 10,
    gap: 8,
    marginTop: 10
  },
  callHotlineText: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  offlineCard: {
    padding: 14,
    marginBottom: 14
  },
  offlineTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  offlineDesc: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2
  },
  instructionsCard: {
    padding: 16,
    marginBottom: 14
  },
  instTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 8
  },
  instSteps: {
    gap: 6
  },
  instStep: {
    fontSize: 12,
    color: mobileColors.sand[700],
    lineHeight: 16
  }
});
