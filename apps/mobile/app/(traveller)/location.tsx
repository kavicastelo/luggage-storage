import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { DEMO_LOCATIONS, StorageLocationItem } from "../../src/data/mock-marketplace";
import { Card, Button, Badge, MobileIcon, MascotIllustration } from "../../src/components";
import { mobileColors, mobileRadius, mobileTypography } from "../../src/lib/theme";

export default function TravellerLocationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [selectedPhotoTab, setSelectedPhotoTab] = useState<number>(0);

  const location: StorageLocationItem =
    DEMO_LOCATIONS.find((l) => l.id === params.id) || DEMO_LOCATIONS[0];

  const photoSlides = [
    { title: "Storefront & Counter", subtitle: "Main entrance facing station clock tower" },
    { title: "Secure Steel Rack Vault", subtitle: "Dedicated individual compartment racks" },
    { title: "Tamper-Evident Seals", subtitle: "Numbered seals applied at check-in" }
  ];

  return (
    <View style={styles.screenWrapper}>
      {/* Top Navigation Bar with Back Button */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to Explore"
        >
          <MobileIcon name="chevron-left" size={20} color={mobileColors.white} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.topNavTitle} numberOfLines={1}>
          {location.name}
        </Text>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => alert(`Share storage spot: ${location.name}`)}
        >
          <MobileIcon name="share" size={18} color={mobileColors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Photo Gallery Box */}
        <View style={styles.photoGalleryBox}>
          <View style={styles.photoHeader}>
            <Text style={styles.photoTitle}>{photoSlides[selectedPhotoTab].title}</Text>
            <Text style={styles.photoSubtitle}>
              {photoSlides[selectedPhotoTab].subtitle}
            </Text>
          </View>
          <View style={styles.photoIndicatorRow}>
            {photoSlides.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.photoDot,
                  selectedPhotoTab === idx && styles.photoDotActive
                ]}
                onPress={() => setSelectedPhotoTab(idx)}
              />
            ))}
          </View>
        </View>

        {/* Location Identity Header */}
        <Card style={styles.dossierCard} variant="elevated">
          <View style={styles.badgeRow}>
            <Badge label={location.city} variant="navy" size="sm" />
            {location.is24Hours ? (
              <Badge label="24/7 OPEN NOW" variant="success" size="sm" />
            ) : (
              <Badge label={location.openHours} variant="neutral" size="sm" />
            )}
            <Badge
              label={`${location.availableCapacity} / ${location.totalCapacity} Spots`}
              variant="info"
              size="sm"
            />
          </View>

          <Text style={styles.locationTitle}>{location.name}</Text>
          <Text style={styles.landmark}>
            <MobileIcon name="map-pin" size={13} color={mobileColors.sand[600]} />{" "}
            {location.landmark}
          </Text>

          <View style={styles.verifiedHostRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <MobileIcon name="shield" size={16} color={mobileColors.emerald[700]} />
              <View>
                <Text style={styles.hostName}>{location.verifiedHost}</Text>
                <Text style={styles.hostSubtitle}>Verified Hospitality Partner</Text>
              </View>
            </View>
            <View style={styles.ratingBadge}>
              <MobileIcon name="star" size={14} color={mobileColors.amber[600]} />
              <Text style={styles.ratingText}>
                {location.rating} ({location.reviewCount})
              </Text>
            </View>
          </View>

          <Text style={styles.descriptionText}>{location.description}</Text>
        </Card>

        {/* Security & Custody Checklist */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Physical Security & Guarantee</Text>
          <Text style={styles.sectionSubtitle}>
            Verified platform protection standards for every bag
          </Text>

          <View style={styles.checklist}>
            <View style={styles.checkItem}>
              <View style={styles.checkCircle}>
                <MobileIcon name="check" size={14} color={mobileColors.emerald[700]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkTitle}>Tamper-Evident Serialized Seals</Text>
                <Text style={styles.checkDesc}>
                  Serialized numbered seal attached to zippers upon counter arrival.
                </Text>
              </View>
            </View>

            <View style={styles.checkItem}>
              <View style={styles.checkCircle}>
                <MobileIcon name="check" size={14} color={mobileColors.emerald[700]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkTitle}>24/7 Monitored CCTV Vault</Text>
                <Text style={styles.checkDesc}>
                  Continuous recording covering storage zone and handover counter.
                </Text>
              </View>
            </View>

            <View style={styles.checkItem}>
              <View style={styles.checkCircle}>
                <MobileIcon name="check" size={14} color={mobileColors.emerald[700]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkTitle}>Illustrative Custody Guarantee (Demo)</Text>
                <Text style={styles.checkDesc}>
                  Complimentary protection included with verified booking tier.
                </Text>
              </View>
            </View>

            <View style={styles.checkItem}>
              <View style={styles.checkCircle}>
                <MobileIcon name="check" size={14} color={mobileColors.emerald[700]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkTitle}>Digital QR & PIN Pass Verification</Text>
                <Text style={styles.checkDesc}>
                  Dual verification token ensures only you can release your bags.
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Transparent Rates by Category */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Transparent Hourly & Daily Rates</Text>
          <Text style={styles.sectionSubtitle}>
            All fees displayed in Sri Lankan Rupees (LKR) with daily price caps
          </Text>

          <View style={styles.rateTable}>
            <View style={styles.rateRow}>
              <View>
                <Text style={styles.rateCategory}>Small Bag / Backpack</Text>
                <Text style={styles.rateDims}>Up to 25L • Handbags, daypacks</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.ratePrice}>
                  LKR {location.hourlyRateLkr.SMALL}/hr
                </Text>
                <Text style={styles.rateCap}>Cap LKR {location.dailyCapLkr.SMALL}/day</Text>
              </View>
            </View>

            <View style={styles.rateRow}>
              <View>
                <Text style={styles.rateCategory}>Medium Bag (Cabin Size)</Text>
                <Text style={styles.rateDims}>20-22" Trolley • Up to 55L</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.ratePrice}>
                  LKR {location.hourlyRateLkr.MEDIUM}/hr
                </Text>
                <Text style={styles.rateCap}>Cap LKR {location.dailyCapLkr.MEDIUM}/day</Text>
              </View>
            </View>

            <View style={styles.rateRow}>
              <View>
                <Text style={styles.rateCategory}>Large Suitcase (Check-in)</Text>
                <Text style={styles.rateDims}>24-28" Suitcase • Up to 85L</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.ratePrice}>
                  LKR {location.hourlyRateLkr.LARGE}/hr
                </Text>
                <Text style={styles.rateCap}>Cap LKR {location.dailyCapLkr.LARGE}/day</Text>
              </View>
            </View>

            <View style={[styles.rateRow, { borderBottomWidth: 0 }]}>
              <View>
                <Text style={styles.rateCategory}>Oversized / Surfboards</Text>
                <Text style={styles.rateDims}>Surfboards, golf bags, trekking gear</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.ratePrice}>
                  LKR {location.hourlyRateLkr.OVERSIZED}/hr
                </Text>
                <Text style={styles.rateCap}>
                  Cap LKR {location.dailyCapLkr.OVERSIZED}/day
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Operating Hours & Address */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Operating Hours & Counter Address</Text>
          <View style={styles.hoursBox}>
            <View style={styles.hoursRow}>
              <Text style={styles.hoursDay}>Every Day (Mon – Sun):</Text>
              <Text style={styles.hoursVal}>{location.openHours}</Text>
            </View>
            <View style={styles.hoursRow}>
              <Text style={styles.hoursDay}>Arrival Notice:</Text>
              <Text style={styles.hoursVal}>Immediate counter check-in</Text>
            </View>
          </View>
          <Text style={styles.maskedAddressText}>
            Area Address: {location.addressMasked}
          </Text>
          <Text style={styles.exactAddressNote}>
            (Exact street entrance unlocked upon booking confirmation)
          </Text>
        </Card>

        {/* Verified Reviews (TM-016) */}
        <Card style={styles.sectionCard}>
          <View style={styles.reviewHeader}>
            <Text style={styles.sectionTitle}>Verified Traveller Reviews</Text>
            <Text style={styles.reviewScore}>★ {location.rating} / 5.0</Text>
          </View>

          <View style={styles.reviewItem}>
            <View style={styles.reviewMeta}>
              <Text style={styles.reviewerName}>Sarah M. (United Kingdom)</Text>
              <Text style={styles.reviewDate}>02 Nov 2026</Text>
            </View>
            <Text style={styles.reviewBody}>
              "Stored our two large bags for 7 hours while exploring Pettah and the Dutch Hospital.
              Seals were checked in front of us and pickup was seamless. Highly recommended!"
            </Text>
          </View>

          <View style={styles.reviewItem}>
            <View style={styles.reviewMeta}>
              <Text style={styles.reviewerName}>Chaminda P. (Sri Lanka)</Text>
              <Text style={styles.reviewDate}>28 Oct 2026</Text>
            </View>
            <Text style={styles.reviewBody}>
              "Super close to Colombo Fort Platform 1. Very professional staff and fast QR scanning."
            </Text>
          </View>
        </Card>

        <MascotIllustration
          mascot="suitcase-walk"
          size="sm"
          caption="Ready to travel hands-free? Reserve your storage spot in under 2 minutes."
        />
      </ScrollView>

      {/* Sticky Bottom Booking Bar */}
      <View style={styles.stickyBookingBar}>
        <View>
          <Text style={styles.barLabel}>Starting From</Text>
          <Text style={styles.barPrice}>
            LKR {location.hourlyRateLkr.MEDIUM}
            <Text style={styles.barUnit}> / hr</Text>
          </Text>
          <Text style={styles.barCap}>Max LKR {location.dailyCapLkr.MEDIUM}/day</Text>
        </View>

        <Button
          title="Select Bags & Book"
          variant="primary"
          size="lg"
          onPress={() =>
            router.push({
              pathname: "/(traveller)/checkout",
              params: { locId: location.id }
            })
          }
          style={{ flex: 1, marginLeft: 16 }}
        />
      </View>
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
    flex: 1,
    color: mobileColors.white,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginHorizontal: 8
  },
  shareBtn: {
    padding: 6
  },
  container: {
    paddingBottom: 100
  },
  photoGalleryBox: {
    backgroundColor: mobileColors.navy[950],
    paddingVertical: 24,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center"
  },
  photoHeader: {
    alignItems: "center",
    marginBottom: 12
  },
  photoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.white
  },
  photoSubtitle: {
    fontSize: 12,
    color: mobileColors.sand[400],
    marginTop: 4,
    textAlign: "center"
  },
  photoIndicatorRow: {
    flexDirection: "row",
    gap: 8
  },
  photoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: mobileColors.sand[600]
  },
  photoDotActive: {
    backgroundColor: mobileColors.terracotta[500],
    width: 20
  },
  dossierCard: {
    margin: 16,
    marginTop: -16,
    padding: 16
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8
  },
  locationTitle: {
    ...mobileTypography.headingMd,
    color: mobileColors.navy[900],
    marginBottom: 4
  },
  landmark: {
    fontSize: 12,
    color: mobileColors.sand[700],
    marginBottom: 12
  },
  verifiedHostRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: mobileColors.sand[100],
    marginBottom: 12
  },
  hostName: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  hostSubtitle: {
    fontSize: 11,
    color: mobileColors.sand[600]
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  descriptionText: {
    fontSize: 13,
    color: mobileColors.sand[800],
    lineHeight: 18
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  sectionSubtitle: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2,
    marginBottom: 12
  },
  checklist: {
    gap: 12
  },
  checkItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: mobileColors.emerald[50],
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2
  },
  checkTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  checkDesc: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2,
    lineHeight: 15
  },
  rateTable: {
    backgroundColor: mobileColors.sand[50],
    borderRadius: mobileRadius.md,
    padding: 10
  },
  rateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[200]
  },
  rateCategory: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  rateDims: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2
  },
  ratePrice: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.terracotta[500]
  },
  rateCap: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2
  },
  hoursBox: {
    backgroundColor: mobileColors.sand[50],
    borderRadius: mobileRadius.md,
    padding: 10,
    marginBottom: 8
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4
  },
  hoursDay: {
    fontSize: 12,
    color: mobileColors.sand[700]
  },
  hoursVal: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  maskedAddressText: {
    fontSize: 12,
    color: mobileColors.sand[800],
    marginTop: 6
  },
  exactAddressNote: {
    fontSize: 11,
    color: mobileColors.sand[500],
    fontStyle: "italic",
    marginTop: 2
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  reviewScore: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.amber[600]
  },
  reviewItem: {
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[100],
    paddingVertical: 10
  },
  reviewMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  reviewerName: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  reviewDate: {
    fontSize: 10,
    color: mobileColors.sand[500]
  },
  reviewBody: {
    fontSize: 12,
    color: mobileColors.sand[700],
    lineHeight: 16
  },
  stickyBookingBar: {
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
  barLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: mobileColors.sand[600]
  },
  barPrice: {
    fontSize: 18,
    fontWeight: "800",
    color: mobileColors.terracotta[500]
  },
  barUnit: {
    fontSize: 12,
    fontWeight: "500",
    color: mobileColors.sand[700]
  },
  barCap: {
    fontSize: 10,
    color: mobileColors.sand[500]
  }
});
