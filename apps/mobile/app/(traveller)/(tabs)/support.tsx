import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  SUPPORT_TICKET_CATEGORIES,
  type SupportTicketCategory
} from "@luggage-storage/contracts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormSection,
  LoadingSkeleton,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  SelectionCard,
  StatusBadge,
  TextInput
} from "../../../src/components";
import {
  useCreateSupportTicketMutation,
  useMyBookingsQuery,
  useMySupportTicketDetailQuery,
  useMySupportTicketsQuery,
  useReplyMySupportTicketMutation,
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
  const { isAuthenticated, user } = useAuthStore();

  const [expandedFaqId, setExpandedFaqId] = useState<string | null>("payhere");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [category, setCategory] =
    useState<(typeof EXCEPTION_CATEGORIES)[number]["value"]>("OTHER");
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const [ticketCategory, setTicketCategory] =
    useState<SupportTicketCategory>("GENERAL_INQUIRY");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);

  const bookingsQuery = useMyBookingsQuery({ limit: 10 }, isAuthenticated);
  const reportMutation = useReportBookingExceptionMutation();
  const ticketsQuery = useMySupportTicketsQuery(isAuthenticated);
  const ticketDetailQuery = useMySupportTicketDetailQuery(
    selectedTicketId ?? undefined,
    isAuthenticated && Boolean(selectedTicketId)
  );
  const createTicketMutation = useCreateSupportTicketMutation();
  const replyTicketMutation = useReplyMySupportTicketMutation();

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

      <Card variant="default" style={styles.sectionCard}>
        <FormSection
          title="Support Tickets"
          subtitle="Create a support inquiry and track replies from our Sri Lanka operations desk."
        >
          {!isAuthenticated || !user ? (
            <EmptyState
              mascot="thinking"
              title="Sign In to Track Tickets"
              description="Sign in to submit and track your persisted support ticket conversations."
              actionTitle="Sign In"
              onAction={() => router.push("/(auth)/login")}
            />
          ) : (
            <View style={styles.formStack}>
              <Text style={styles.fieldLabel}>Topic</Text>
              {SUPPORT_TICKET_CATEGORIES.map((cat) => (
                <SelectionCard
                  key={cat}
                  title={cat.replace(/_/g, " ")}
                  selected={ticketCategory === cat}
                  onPress={() => setTicketCategory(cat)}
                />
              ))}

              <TextInput
                label="Subject"
                required
                placeholder="Short summary of your inquiry"
                value={ticketSubject}
                onChangeText={setTicketSubject}
              />
              <TextInput
                label="Message"
                required
                placeholder="Share details so our support team can assist quickly..."
                value={ticketMessage}
                onChangeText={setTicketMessage}
              />

              {ticketError ? <ErrorState title="Ticket Error" message={ticketError} /> : null}
              {ticketSuccess ? (
                <Badge label={ticketSuccess} variant="success" icon="check-circle" />
              ) : null}

              <Button
                title="Submit Support Ticket"
                isLoading={createTicketMutation.isPending}
                onPress={() => {
                  setTicketError(null);
                  setTicketSuccess(null);
                  if (ticketSubject.trim().length < 3 || ticketMessage.trim().length < 10) {
                    setTicketError(
                      "Enter a subject (3+ chars) and message (10+ chars)."
                    );
                    return;
                  }
                  void createTicketMutation
                    .mutateAsync({
                      requesterName: user.displayName,
                      requesterEmail: user.email,
                      category: ticketCategory,
                      subject: ticketSubject.trim(),
                      message: ticketMessage.trim()
                    })
                    .then((created) => {
                      setTicketSubject("");
                      setTicketMessage("");
                      setSelectedTicketId(created.id);
                      setTicketSuccess(`Ticket ${created.referenceCode} created.`);
                    })
                    .catch((err) => setTicketError(normalizeApiError(err).message));
                }}
              />

              <Text style={styles.fieldLabel}>
                My Tickets ({ticketsQuery.data?.length ?? 0})
              </Text>
              {ticketsQuery.isLoading ? (
                <LoadingSkeleton count={2} />
              ) : ticketsQuery.error ? (
                <ErrorState
                  title="Unable to Load Tickets"
                  message={normalizeApiError(ticketsQuery.error).message}
                  onRetry={() => void ticketsQuery.refetch()}
                />
              ) : (ticketsQuery.data?.length ?? 0) === 0 ? (
                <Text style={styles.mutedNote}>No support tickets submitted yet.</Text>
              ) : (
                (ticketsQuery.data ?? []).map((t) => (
                  <SelectionCard
                    key={t.id}
                    title={`${t.referenceCode} • ${t.subject}`}
                    subtitle={`${t.status} • ${t.category.replace(/_/g, " ")}`}
                    selected={selectedTicketId === t.id}
                    onPress={() => setSelectedTicketId(t.id)}
                  />
                ))
              )}

              {selectedTicketId && ticketDetailQuery.data ? (
                <Card variant="outlined" style={styles.faqItem}>
                  <View style={{ padding: 12, gap: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={styles.faqTitle}>
                        {ticketDetailQuery.data.referenceCode} • {ticketDetailQuery.data.subject}
                      </Text>
                      <StatusBadge status={ticketDetailQuery.data.status} size="sm" />
                    </View>
                    {ticketDetailQuery.data.messages.map((m) => (
                      <View key={m.id} style={{ paddingVertical: 4 }}>
                        <Text style={styles.mutedNote}>
                          {m.senderDisplayName} ({m.senderRole}):
                        </Text>
                        <Text style={styles.faqBody}>{m.body}</Text>
                      </View>
                    ))}
                    <TextInput
                      label="Reply"
                      placeholder="Write a follow-up message..."
                      value={replyMessage}
                      onChangeText={setReplyMessage}
                    />
                    {replyError ? <ErrorState title="Reply Error" message={replyError} /> : null}
                    <Button
                      title="Send Reply"
                      size="sm"
                      isLoading={replyTicketMutation.isPending}
                      onPress={() => {
                        setReplyError(null);
                        if (replyMessage.trim().length < 2) {
                          setReplyError("Enter a reply message.");
                          return;
                        }
                        void replyTicketMutation
                          .mutateAsync({
                            ticketId: selectedTicketId,
                            data: { message: replyMessage.trim() }
                          })
                          .then(() => setReplyMessage(""))
                          .catch((err) => setReplyError(normalizeApiError(err).message));
                      }}
                    />
                  </View>
                </Card>
              ) : null}
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
