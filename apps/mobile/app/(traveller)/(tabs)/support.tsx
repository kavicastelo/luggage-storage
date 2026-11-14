import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormSection,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  SelectionCard,
  TextInput
} from "../../../src/components";
import {
  useMyBookingsQuery,
  useReportBookingExceptionMutation
} from "../../../src/hooks";
import { normalizeApiError } from "../../../src/services/api-client";
import { useAuthStore } from "../../../src/store/useAuthStore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../../src/lib/theme";

const FAQ_ITEMS = [
  {
    id: "payhere",
    title: "How does PayHere LKR checkout work on mobile?",
    body: "Bookings pay securely through an external server-signed PayHere Checkout handoff in your browser. Once PayHere finishes processing, returning to the app checks authoritative booking status before unlocking your custody QR and PIN."
  },
  {
    id: "address",
    title: "When is the exact street address revealed?",
    body: "Discovery cards only display approximate areas (~50m grid privacy) until payment confirmation succeeds. After confirmation, your exact hub street address, entrance notes, and coordinates unlock in the Digital Custody Pass."
  },
  {
    id: "cancellation",
    title: "What is the cancellation refund policy?",
    body: "Under STANDARD_FLEX_2H, cancelling more than 2 hours before drop-off yields a 100% refund; within 2 hours yields a 50% refund; cancellations after the drop-off window starts are non-refundable unless cancelled by the host (100% refund)."
  },
  {
    id: "overdue",
    title: "What happens if I arrive late for bag pickup?",
    body: "Partner counters must NEVER hold your luggage hostage. Overdue charges are recorded separately in billing—your physical bag collection always completes with your valid QR pass or 6-digit PIN."
  }
] as const;

const EXCEPTION_CATEGORIES = [
  { value: "DAMAGE_REPORTED", label: "Luggage Damage" },
  { value: "MISSING_ITEM", label: "Missing Item" },
  { value: "OVERDUE_DISPUTE", label: "Overdue Charge Dispute" },
  { value: "HOST_NO_SHOW", label: "Counter Closed / No Show" },
  { value: "SAFETY_CONCERN", label: "Safety or Seal Issue" },
  { value: "OTHER", label: "Other Operational Issue" }
] as const;

export default function TravellerSupportScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [expandedFaqId, setExpandedFaqId] = useState<string | null>("payhere");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [category, setCategory] =
    useState<(typeof EXCEPTION_CATEGORIES)[number]["value"]>("OTHER");
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const bookingsQuery = useMyBookingsQuery({ limit: 10 }, isAuthenticated);
  const reportMutation = useReportBookingExceptionMutation();

  const reportableBookings = (bookingsQuery.data?.bookings ?? []).filter(
    (b) => !["EXPIRED", "REJECTED"].includes(b.status)
  );

  const handleReportSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    if (!selectedBookingId) {
      setSubmitError("Select a reservation first.");
      return;
    }
    if (reason.trim().length < 5) {
      setSubmitError("Enter at least 5 characters describing the incident.");
      return;
    }

    try {
      const updated = await reportMutation.mutateAsync({
        bookingId: selectedBookingId,
        data: {
          category,
          reason: reason.trim()
        }
      });
      setReason("");
      setSubmitSuccess(
        `Incident logged on #${updated.referenceCode}. Host settlement is frozen while platform support reviews your case.`
      );
    } catch (err: unknown) {
      setSubmitError(normalizeApiError(err).message);
    }
  };

  return (
    <ScreenContainer
      keyboardAvoiding
      header={<SafeHeader title="Support & Policies" subtitle="Custody Standards & Incidents" />}
      testID="traveller-support-screen"
    >
      <Card variant="default" style={styles.sectionCard}>
        <Text style={styles.sectionHeading}>Marketplace Safeguards & FAQs</Text>
        <View style={styles.faqList}>
          {FAQ_ITEMS.map((item) => {
            const expanded = expandedFaqId === item.id;
            return (
              <View key={item.id} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => setExpandedFaqId(expanded ? null : item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                >
                  <Text style={styles.faqTitle}>{item.title}</Text>
                  <MobileIcon
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={mobileColors.navy[800]}
                  />
                </TouchableOpacity>
                {expanded ? <Text style={styles.faqBody}>{item.body}</Text> : null}
              </View>
            );
          })}
        </View>
      </Card>

      <Card variant="elevated" style={styles.sectionCard}>
        <FormSection
          title="Report a Booking Exception"
          subtitle="Need help with luggage handling, seals, or a counter arrival problem? Log an auditable booking exception directly."
        >
          {!isAuthenticated ? (
            <EmptyState
              mascot="thinking"
              title="Sign in to Report an Incident"
              description="Exception reports are linked directly to your verified reservation record."
              actionTitle="Sign In"
              onAction={() => router.push("/(auth)/login")}
            />
          ) : reportableBookings.length === 0 ? (
            <Text style={styles.mutedNote}>
              No eligible bookings found. Active or completed bookings appear here for incident
              reporting.
            </Text>
          ) : (
            <View style={styles.formStack}>
              <Text style={styles.fieldLabel}>Select Reservation</Text>
              {reportableBookings.map((b) => (
                <SelectionCard
                  key={b.id}
                  title={`#${b.referenceCode} • ${b.location.name}`}
                  subtitle={`${b.status} • ${b.totalBags} bag(s)`}
                  selected={selectedBookingId === b.id}
                  onPress={() => setSelectedBookingId(b.id)}
                />
              ))}

              <Text style={styles.fieldLabel}>Issue Category</Text>
              {EXCEPTION_CATEGORIES.map((cat) => (
                <SelectionCard
                  key={cat.value}
                  title={cat.label}
                  selected={category === cat.value}
                  onPress={() => setCategory(cat.value)}
                />
              ))}

              <TextInput
                label="What Happened?"
                required
                placeholder="Describe damage, missing item, or counter delay..."
                value={reason}
                onChangeText={setReason}
              />

              {submitError ? <ErrorState title="Submission Error" message={submitError} /> : null}
              {submitSuccess ? (
                <Badge label={submitSuccess} variant="success" icon="check-circle" />
              ) : null}

              <Button
                title="Submit Exception Report"
                variant="danger"
                isLoading={reportMutation.isPending}
                onPress={() => {
                  void handleReportSubmit();
                }}
              />
            </View>
          )}
        </FormSection>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    gap: mobileSpacing[4]
  },
  sectionHeading: {
    ...mobileTypography.headingMd,
    color: mobileTextColors.primary
  },
  faqList: {
    gap: mobileSpacing[3]
  },
  faqItem: {
    backgroundColor: mobileColors.sand[50],
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    overflow: "hidden"
  },
  faqHeader: {
    minHeight: 48,
    paddingHorizontal: mobileSpacing[4],
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing[3]
  },
  faqTitle: {
    ...mobileTypography.label,
    color: mobileTextColors.primary,
    flex: 1
  },
  faqBody: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary,
    paddingHorizontal: mobileSpacing[4],
    paddingBottom: mobileSpacing[4]
  },
  mutedNote: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.muted
  },
  formStack: {
    gap: mobileSpacing[3]
  },
  fieldLabel: {
    ...mobileTypography.label,
    color: mobileTextColors.primary,
    marginTop: 4
  }
});
