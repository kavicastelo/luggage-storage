import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal
} from "react-native";
import { useRouter } from "expo-router";
import { DEMO_BOOKINGS, TravellerBookingItem } from "../../src/data/mock-marketplace";
import { Card, Button, Badge, MobileIcon, MascotIllustration } from "../../src/components";
import { mobileColors, mobileRadius, mobileTypography } from "../../src/lib/theme";

const SUB_TABS = ["Active", "Upcoming", "Completed", "Cancelled"] as const;

export default function TravellerBookingsHubScreen() {
  const router = useRouter();
  const [selectedSubTab, setSelectedSubTab] = useState<typeof SUB_TABS[number]>("Active");

  // Live Active Custody Countdown Timer State (seconds remaining)
  // Initial: 2 hours 15 minutes = 8100 seconds
  const [secondsRemaining, setSecondsRemaining] = useState<number>(8100);

  // Extension Modal State
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [extensionHours, setExtensionHours] = useState<number>(1);
  const [extensionFeedback, setExtensionFeedback] = useState<string | null>(null);

  // Cancellation Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelBookingTarget, setCancelBookingTarget] = useState<TravellerBookingItem | null>(null);
  const [refundStage, setRefundStage] = useState<number>(1);
  const [cancelledSuccess, setCancelledSuccess] = useState(false);

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Timer Tick Effect
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  };

  // Color Shift based on remaining time
  const isUrgent = secondsRemaining > 0 && secondsRemaining <= 1800; // <= 30 mins
  const isOverdue = secondsRemaining === 0;

  const timerColor = isOverdue
    ? mobileColors.rose[600]
    : isUrgent
    ? mobileColors.amber[600]
    : mobileColors.emerald[600];

  const activeBooking = DEMO_BOOKINGS.find((b) => b.status === "IN_STORAGE");
  const upcomingBookings = DEMO_BOOKINGS.filter((b) => b.status === "CONFIRMED");
  const completedBookings = DEMO_BOOKINGS.filter((b) => b.status === "COMPLETED");
  const cancelledBookings = DEMO_BOOKINGS.filter((b) => b.status === "CANCELLED");

  return (
    <View style={styles.screenWrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Coastal Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Luggage Storage</Text>
          <Text style={styles.headerSubtitle}>
            Live Custody Monitoring, Digital Passes & History
          </Text>

          {/* Sub-tab pills */}
          <View style={styles.subTabRow}>
            {SUB_TABS.map((tab) => {
              const isActive = selectedSubTab === tab;
              const count =
                tab === "Active"
                  ? activeBooking ? 1 : 0
                  : tab === "Upcoming"
                  ? upcomingBookings.length
                  : tab === "Completed"
                  ? completedBookings.length
                  : cancelledBookings.length;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.subTabPill, isActive && styles.subTabPillActive]}
                  onPress={() => setSelectedSubTab(tab)}
                >
                  <Text
                    style={[
                      styles.subTabPillText,
                      isActive && styles.subTabPillTextActive
                    ]}
                  >
                    {tab} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Tab 1: Active Custody */}
        {selectedSubTab === "Active" && (
          <View style={styles.tabContent}>
            {activeBooking ? (
              <>
                {/* Live Countdown Timer Card */}
                <Card style={styles.timerCard} variant="elevated">
                  <View style={styles.timerTopRow}>
                    <View>
                      <Text style={styles.timerLabel}>CURRENT CUSTODY SESSION</Text>
                      <Text style={styles.timerRef}>{activeBooking.reference}</Text>
                    </View>
                    <Badge
                      label={isOverdue ? "OVERDUE" : isUrgent ? "TIME SENSITIVE" : "IN STORAGE"}
                      variant={isOverdue ? "warning" : isUrgent ? "warning" : "success"}
                    />
                  </View>

                  <View style={styles.timerCenter}>
                    <Text style={[styles.timerDigits, { color: timerColor }]}>
                      {formatTimer(secondsRemaining)}
                    </Text>
                    <Text style={styles.timerDesc}>
                      {isOverdue
                        ? "Storage duration exceeded. Late fee policy active."
                        : `Scheduled pickup by ${activeBooking.pickUpTime}`}
                    </Text>
                  </View>

                  {/* Tamper Evident Seals & Compartment Info */}
                  <View style={styles.custodySpecsBox}>
                    <View style={styles.custodySpecRow}>
                      <Text style={styles.specKey}>Vault Zone:</Text>
                      <Text style={styles.specVal}>{activeBooking.zoneCode}</Text>
                    </View>
                    <View style={styles.custodySpecRow}>
                      <Text style={styles.specKey}>Security Seals:</Text>
                      <Text style={styles.specVal}>
                        {activeBooking.seals.join(", ")}
                      </Text>
                    </View>
                    <View style={styles.custodySpecRow}>
                      <Text style={styles.specKey}>Photo Evidence:</Text>
                      <Text style={styles.specVal}>
                        {activeBooking.photoLogged ? "Logged at Check-in ✓" : "Standard Policy"}
                      </Text>
                    </View>
                    <View style={styles.custodySpecRow}>
                      <Text style={styles.specKey}>Bags in Custody:</Text>
                      <Text style={styles.specVal}>
                        {activeBooking.totalBags} Bags (1 Cabin, 1 Check-in)
                      </Text>
                    </View>
                  </View>

                  {/* Primary Actions */}
                  <View style={styles.timerActions}>
                    <Button
                      title="Show Custody Pass & PIN"
                      variant="primary"
                      leftIcon={<MobileIcon name="qr-code" size={16} color={mobileColors.white} />}
                      onPress={() =>
                        router.push({
                          pathname: "/(traveller)/pass",
                          params: { ref: activeBooking.reference }
                        })
                      }
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Extend"
                      variant="outline"
                      onPress={() => setExtensionModalOpen(true)}
                    />
                  </View>

                  {/* Venue Contact & Location */}
                  <View style={styles.venueInfoRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.venueName}>{activeBooking.locationName}</Text>
                      <Text style={styles.venueAddress}>{activeBooking.exactAddress}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.callHostBtn}
                      onPress={() => alert(`Calling host partner: ${activeBooking.hostPhone}`)}
                    >
                      <MobileIcon name="phone" size={16} color={mobileColors.navy[900]} />
                      <Text style={styles.callHostText}>Call</Text>
                    </TouchableOpacity>
                  </View>
                </Card>

                {/* Overdue Policy Transparency Notice */}
                <Card style={styles.policyNoticeCard} variant="outlined">
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <MobileIcon name="info" size={16} color={mobileColors.navy[900]} />
                    <Text style={styles.policyNoticeTitle}>Pre-Disclosed Overdue Policy</Text>
                  </View>
                  <Text style={styles.policyNoticeText}>
                    30-minute grace period applies to all Sri Lanka rail hubs. Any overdue time is
                    charged at LKR 250/hr per bag via transparent in-app payment. Luggage is NEVER
                    held hostage.
                  </Text>
                </Card>
              </>
            ) : (
              <Card style={styles.emptyCard}>
                <MobileIcon name="briefcase" size={36} color={mobileColors.sand[400]} />
                <Text style={styles.emptyTitle}>No Active Storage Session</Text>
                <Text style={styles.emptyDesc}>
                  You do not currently have luggage stored at a partner vault.
                </Text>
                <Button
                  title="Find Storage Nearby"
                  variant="primary"
                  onPress={() => router.push("/(traveller)")}
                  style={{ marginTop: 12 }}
                />
              </Card>
            )}
          </View>
        )}

        {/* Tab 2: Upcoming Bookings */}
        {selectedSubTab === "Upcoming" && (
          <View style={styles.tabContent}>
            {upcomingBookings.map((b) => (
              <Card key={b.id} style={styles.bookingCard}>
                <View style={styles.bookingCardHeader}>
                  <Text style={styles.bookingRef}>{b.reference}</Text>
                  <Badge label="CONFIRMED" variant="success" size="sm" />
                </View>
                <Text style={styles.bookingVenue}>{b.locationName}</Text>
                <Text style={styles.bookingDate}>Drop-off: {b.dropOffTime}</Text>
                <Text style={styles.bookingBags}>{b.totalBags} Bags • Total LKR {b.totalLkr}</Text>

                <View style={styles.bookingActionsRow}>
                  <Button
                    title="View Custody Pass"
                    variant="primary"
                    size="sm"
                    onPress={() =>
                      router.push({
                        pathname: "/(traveller)/pass",
                        params: { ref: b.reference }
                      })
                    }
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Cancel Booking"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      setCancelBookingTarget(b);
                      setCancelModalOpen(true);
                    }}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Tab 3: Completed Bookings */}
        {selectedSubTab === "Completed" && (
          <View style={styles.tabContent}>
            {completedBookings.map((b) => (
              <Card key={b.id} style={styles.bookingCard}>
                <View style={styles.bookingCardHeader}>
                  <Text style={styles.bookingRef}>{b.reference}</Text>
                  <Badge label="COMPLETED" variant="neutral" size="sm" />
                </View>
                <Text style={styles.bookingVenue}>{b.locationName}</Text>
                <Text style={styles.bookingDate}>Stored on {b.dropOffTime}</Text>
                <Text style={styles.bookingBags}>{b.totalBags} Bags • Picked up safely</Text>

                <View style={styles.completedReviewBox}>
                  <Text style={styles.reviewLabel}>Your Verified Review:</Text>
                  <Text style={styles.reviewStars}>★★★★★ 5.0</Text>
                  <Text style={styles.reviewComment}>
                    "Left luggage for 6 hours while visiting Temple of Tooth. Excellent service and secure!"
                  </Text>
                </View>

                <Button
                  title="Write Another Review"
                  variant="outline"
                  size="sm"
                  onPress={() => setReviewModalOpen(true)}
                  style={{ marginTop: 8 }}
                />
              </Card>
            ))}
          </View>
        )}

        {/* Tab 4: Cancelled Bookings */}
        {selectedSubTab === "Cancelled" && (
          <View style={styles.tabContent}>
            {cancelledBookings.map((b) => (
              <Card key={b.id} style={styles.bookingCard}>
                <View style={styles.bookingCardHeader}>
                  <Text style={styles.bookingRef}>{b.reference}</Text>
                  <Badge label="REFUNDED" variant="info" size="sm" />
                </View>
                <Text style={styles.bookingVenue}>{b.locationName}</Text>
                <Text style={styles.bookingDate}>Cancelled prior to drop-off</Text>
                <Text style={styles.bookingBags}>
                  LKR {b.refundAmountLkr} Refund Processed (100% Policy Window)
                </Text>

                {/* 7-Stage Refund Tracker */}
                <View style={styles.refundTrackerBox}>
                  <Text style={styles.refundTrackerTitle}>
                    7-Stage Settlement Tracker: Completed
                  </Text>
                  <Text style={styles.refundTrackerStep}>
                    1. Requested ✓ → 2. Policy Window Checked (100%) ✓ → 3. Capacity Released ✓ →
                    4. Ledger Reversed ✓ → 5. PayHere Dispatched ✓ → 6. Bank Processing (CEFT) ✓
                    → 7. Card Credited ✓
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Storage Extension Modal */}
      <Modal visible={extensionModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Extend Storage Duration</Text>
              <TouchableOpacity onPress={() => setExtensionModalOpen(false)}>
                <MobileIcon name="x" size={20} color={mobileColors.navy[900]} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select additional hours needed at Colombo Fort Vault:
            </Text>

            <View style={styles.extensionPillsRow}>
              {[1, 2, 4].map((hrs) => (
                <TouchableOpacity
                  key={hrs}
                  style={[
                    styles.extensionPill,
                    extensionHours === hrs && styles.extensionPillActive
                  ]}
                  onPress={() => setExtensionHours(hrs)}
                >
                  <Text
                    style={[
                      styles.extensionPillText,
                      extensionHours === hrs && styles.extensionPillTextActive
                    ]}
                  >
                    +{hrs} {hrs === 1 ? "Hour" : "Hours"}
                  </Text>
                  <Text style={styles.extensionPillPrice}>
                    LKR {hrs * 250 * 2}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.extensionNote}>
              Rate: LKR 250/hr per bag × 2 bags = LKR {extensionHours * 500}. Charges are processed
              in-app.
            </Text>

            {extensionFeedback && (
              <View style={styles.feedbackSuccess}>
                <MobileIcon name="check" size={16} color={mobileColors.emerald[700]} />
                <Text style={styles.feedbackSuccessText}>{extensionFeedback}</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setExtensionModalOpen(false)}
              />
              <Button
                title={`Confirm +${extensionHours}h Extension`}
                variant="primary"
                onPress={() => {
                  setSecondsRemaining((p) => p + extensionHours * 3600);
                  setExtensionFeedback(
                    `Successfully extended by +${extensionHours}h! New pickup time updated.`
                  );
                  setTimeout(() => {
                    setExtensionFeedback(null);
                    setExtensionModalOpen(false);
                  }, 1200);
                }}
                style={{ flex: 1, marginLeft: 12 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancellation Modal */}
      <Modal visible={cancelModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cancel Booking</Text>
              <TouchableOpacity onPress={() => setCancelModalOpen(false)}>
                <MobileIcon name="x" size={20} color={mobileColors.navy[900]} />
              </TouchableOpacity>
            </View>

            {!cancelledSuccess ? (
              <>
                <Text style={styles.cancelPolicyHeadline}>
                  Transparent Sri Lanka Cancellation Policy
                </Text>
                <View style={styles.policyTierBox}>
                  <View style={styles.policyTierItem}>
                    <Text style={styles.policyTierTime}>&gt; 24 Hours Before Drop-off:</Text>
                    <Text style={styles.policyTierRefund}>100% Full Refund in LKR</Text>
                  </View>
                  <View style={styles.policyTierItem}>
                    <Text style={styles.policyTierTime}>&lt; 24 Hours Before Drop-off:</Text>
                    <Text style={styles.policyTierRefund}>50% Partial Refund in LKR</Text>
                  </View>
                  <View style={styles.policyTierItem}>
                    <Text style={styles.policyTierTime}>After Scheduled Drop-off:</Text>
                    <Text style={styles.policyTierRefund}>Non-refundable (host committed)</Text>
                  </View>
                </View>

                <Text style={styles.cancelEstimate}>
                  Your estimated refund:{" "}
                  <Text style={{ fontWeight: "800", color: mobileColors.emerald[700] }}>
                    LKR {cancelBookingTarget?.totalLkr || 1700} (100% Eligible)
                  </Text>
                </Text>

                <View style={styles.modalActions}>
                  <Button
                    title="Keep Booking"
                    variant="ghost"
                    onPress={() => setCancelModalOpen(false)}
                  />
                  <Button
                    title="Confirm Cancellation"
                    variant="danger"
                    onPress={() => {
                      setCancelledSuccess(true);
                      setRefundStage(3); // Capacity released & ledger reversed
                    }}
                    style={{ flex: 1, marginLeft: 12 }}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={{ alignItems: "center", marginVertical: 12 }}>
                  <MobileIcon name="check" size={40} color={mobileColors.emerald[600]} />
                  <Text style={styles.cancelSuccessTitle}>Booking Successfully Cancelled</Text>
                  <Text style={styles.cancelSuccessDesc}>
                    Capacity pool released immediately. 7-stage refund initiated to your payment
                    method.
                  </Text>
                </View>

                {/* 7-Stage Stepper Preview */}
                <View style={styles.stepperContainer}>
                  <Text style={styles.stepperTitle}>Refund Progress (Stage {refundStage} of 7)</Text>
                  <View style={styles.stepperBar}>
                    {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                      <View
                        key={s}
                        style={[
                          styles.stepperNode,
                          s <= refundStage ? styles.stepperNodeActive : null
                        ]}
                      />
                    ))}
                  </View>
                </View>

                <Button
                  title="Done"
                  variant="primary"
                  onPress={() => {
                    setCancelModalOpen(false);
                    setCancelledSuccess(false);
                  }}
                  style={{ marginTop: 16 }}
                />
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Review Modal */}
      <Modal visible={reviewModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate Your Experience</Text>
              <TouchableOpacity onPress={() => setReviewModalOpen(false)}>
                <MobileIcon name="x" size={20} color={mobileColors.navy[900]} />
              </TouchableOpacity>
            </View>

            {!reviewSubmitted ? (
              <>
                <MascotIllustration
                  mascot="high-five"
                  size="sm"
                  caption="Your feedback helps fellow travellers and verified Sri Lankan hosts!"
                />
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((st) => (
                    <TouchableOpacity key={st} onPress={() => setReviewRating(st)}>
                      <MobileIcon
                        name="star"
                        size={32}
                        color={st <= reviewRating ? mobileColors.amber[500] : mobileColors.sand[300]}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <Button
                  title={`Submit ${reviewRating}-Star Rating`}
                  variant="primary"
                  onPress={() => setReviewSubmitted(true)}
                  style={{ marginTop: 16 }}
                />
              </>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <MobileIcon name="check" size={36} color={mobileColors.emerald[600]} />
                <Text style={styles.cancelSuccessTitle}>Thank you for your review!</Text>
                <Text style={styles.cancelSuccessDesc}>
                  Your feedback has been verified and published to the partner profile.
                </Text>
                <Button
                  title="Close"
                  variant="primary"
                  onPress={() => {
                    setReviewModalOpen(false);
                    setReviewSubmitted(false);
                  }}
                  style={{ marginTop: 16, width: "100%" }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  container: {
    paddingBottom: 40
  },
  header: {
    backgroundColor: mobileColors.navy[900],
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20
  },
  headerTitle: {
    ...mobileTypography.headingLg,
    color: mobileColors.white
  },
  headerSubtitle: {
    ...mobileTypography.bodySm,
    color: mobileColors.sand[400],
    marginTop: 2
  },
  subTabRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14
  },
  subTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.navy[800]
  },
  subTabPillActive: {
    backgroundColor: mobileColors.terracotta[500]
  },
  subTabPillText: {
    fontSize: 12,
    color: mobileColors.sand[300],
    fontWeight: "600"
  },
  subTabPillTextActive: {
    color: mobileColors.white
  },
  tabContent: {
    padding: 16,
    gap: 12
  },
  timerCard: {
    padding: 16
  },
  timerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: mobileColors.sand[600]
  },
  timerRef: {
    ...mobileTypography.codeMono,
    color: mobileColors.navy[900]
  },
  timerCenter: {
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: mobileColors.sand[100]
  },
  timerDigits: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 1
  },
  timerDesc: {
    fontSize: 12,
    color: mobileColors.sand[700],
    marginTop: 4
  },
  custodySpecsBox: {
    backgroundColor: mobileColors.sand[50],
    borderRadius: mobileRadius.md,
    padding: 12,
    marginVertical: 12,
    gap: 6
  },
  custodySpecRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  specKey: {
    fontSize: 12,
    color: mobileColors.sand[600]
  },
  specVal: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  timerActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12
  },
  venueInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[100],
    paddingTop: 10
  },
  venueName: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  venueAddress: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2
  },
  callHostBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.sand[100],
    gap: 4
  },
  callHostText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  policyNoticeCard: {
    padding: 14
  },
  policyNoticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  policyNoticeText: {
    fontSize: 12,
    color: mobileColors.sand[700],
    marginTop: 4,
    lineHeight: 17
  },
  emptyCard: {
    padding: 32,
    alignItems: "center"
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginTop: 8
  },
  emptyDesc: {
    fontSize: 12,
    color: mobileColors.sand[600],
    textAlign: "center",
    marginTop: 4
  },
  bookingCard: {
    padding: 16
  },
  bookingCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  bookingRef: {
    ...mobileTypography.codeMono,
    color: mobileColors.navy[900]
  },
  bookingVenue: {
    fontSize: 15,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 2
  },
  bookingDate: {
    fontSize: 12,
    color: mobileColors.sand[600],
    marginBottom: 4
  },
  bookingBags: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileColors.terracotta[600],
    marginBottom: 10
  },
  bookingActionsRow: {
    flexDirection: "row",
    gap: 10
  },
  completedReviewBox: {
    backgroundColor: mobileColors.sand[50],
    borderRadius: mobileRadius.md,
    padding: 10,
    marginTop: 8
  },
  reviewLabel: {
    fontSize: 10,
    color: mobileColors.sand[600],
    fontWeight: "700"
  },
  reviewStars: {
    color: mobileColors.amber[600],
    fontSize: 13,
    fontWeight: "700",
    marginVertical: 2
  },
  reviewComment: {
    fontSize: 12,
    color: mobileColors.sand[700],
    fontStyle: "italic"
  },
  refundTrackerBox: {
    backgroundColor: mobileColors.sky[50],
    borderRadius: mobileRadius.md,
    padding: 10,
    marginTop: 8
  },
  refundTrackerTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.sky[700]
  },
  refundTrackerStep: {
    fontSize: 10,
    color: mobileColors.navy[900],
    marginTop: 4,
    lineHeight: 15
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 25, 47, 0.6)",
    justifyContent: "flex-end"
  },
  modalContent: {
    backgroundColor: mobileColors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[200],
    paddingBottom: 12,
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  modalSubtitle: {
    fontSize: 12,
    color: mobileColors.sand[600],
    marginBottom: 12
  },
  extensionPillsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12
  },
  extensionPill: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: mobileRadius.lg,
    borderWidth: 1.5,
    borderColor: mobileColors.sand[300],
    backgroundColor: mobileColors.sand[50]
  },
  extensionPillActive: {
    borderColor: mobileColors.terracotta[500],
    backgroundColor: mobileColors.terracotta[50]
  },
  extensionPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  extensionPillTextActive: {
    color: mobileColors.terracotta[600]
  },
  extensionPillPrice: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2
  },
  extensionNote: {
    fontSize: 11,
    color: mobileColors.sand[700],
    marginBottom: 12
  },
  feedbackSuccess: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mobileColors.emerald[50],
    borderRadius: mobileRadius.md,
    padding: 10,
    gap: 8,
    marginBottom: 12
  },
  feedbackSuccessText: {
    fontSize: 12,
    color: mobileColors.emerald[700],
    fontWeight: "600"
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[200],
    paddingTop: 14
  },
  cancelPolicyHeadline: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 8
  },
  policyTierBox: {
    backgroundColor: mobileColors.sand[50],
    borderRadius: mobileRadius.md,
    padding: 12,
    gap: 8,
    marginBottom: 12
  },
  policyTierItem: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  policyTierTime: {
    fontSize: 12,
    color: mobileColors.sand[700]
  },
  policyTierRefund: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  cancelEstimate: {
    fontSize: 13,
    color: mobileColors.navy[900],
    marginBottom: 16
  },
  cancelSuccessTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginTop: 8
  },
  cancelSuccessDesc: {
    fontSize: 12,
    color: mobileColors.sand[600],
    textAlign: "center",
    marginTop: 4,
    lineHeight: 17
  },
  stepperContainer: {
    backgroundColor: mobileColors.sand[50],
    padding: 12,
    borderRadius: mobileRadius.md,
    marginVertical: 12
  },
  stepperTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 6
  },
  stepperBar: {
    flexDirection: "row",
    gap: 4
  },
  stepperNode: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: mobileColors.sand[300]
  },
  stepperNodeActive: {
    backgroundColor: mobileColors.emerald[500]
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginVertical: 12
  }
});
