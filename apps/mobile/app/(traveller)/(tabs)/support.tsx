import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  SUPPORT_TICKET_CATEGORIES,
  type SupportTicketCategory
} from "@luggage-storage/contracts";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormSection,
  LoadingSkeleton,
  MascotIllustration,
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
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../../src/lib/theme";

type SupportModeTab = "TICKETS" | "EXCEPTION" | "FAQS";

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

  const [activeTab, setActiveTab] = useState<SupportModeTab>("TICKETS");
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
      <View style={styles.modeTabsRow} accessibilityRole="tablist">
        {(
          [
            { key: "TICKETS", label: "My Tickets" },
            { key: "EXCEPTION", label: "Report Issue" },
            { key: "FAQS", label: "FAQs" }
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.modeTabBtn, active ? styles.modeTabBtnActive : null]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.modeTabText, active ? styles.modeTabTextActive : null]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === "TICKETS" ? (
        <View style={styles.sectionStack}>
          <FormSection
            title="Support Tickets"
            subtitle="Create a support inquiry and track replies from our Sri Lanka operations desk."
          >
            {!isAuthenticated || !user ? (
              <EmptyState
                mascot="phone"
                title="Sign In to Track Tickets"
                description="Sign in to submit and track your persisted support ticket conversations."
                actionTitle="Sign In"
                onAction={() => router.push("/(auth)/login")}
              />
            ) : (
              <View style={styles.formStack}>
                <Text style={styles.fieldLabel}>Topic</Text>
                <View style={styles.chipWrap}>
                  {SUPPORT_TICKET_CATEGORIES.map((cat) => {
                    const selected = ticketCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.topicChip, selected ? styles.topicChipActive : null]}
                        onPress={() => setTicketCategory(cat)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[
                            styles.topicChipText,
                            selected ? styles.topicChipTextActive : null
                          ]}
                        >
                          {cat.replace(/_/g, " ")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

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
                  multiline
                  placeholder="Share details so our support team can assist quickly..."
                  value={ticketMessage}
                  onChangeText={setTicketMessage}
                />

                {ticketError ? <ErrorState title="Ticket Error" message={ticketError} /> : null}
                {ticketSuccess ? (
                  <View style={styles.successBanner} accessibilityRole="alert">
                    <MobileIcon
                      name="check-circle"
                      size={16}
                      color={mobileStatusTokens.successIcon}
                    />
                    <Text style={styles.successBannerText}>{ticketSuccess}</Text>
                  </View>
                ) : null}

                <Button
                  title="Submit Support Ticket"
                  isLoading={createTicketMutation.isPending}
                  onPress={() => {
                    setTicketError(null);
                    setTicketSuccess(null);
                    if (ticketSubject.trim().length < 3 || ticketMessage.trim().length < 10) {
                      setTicketError("Enter a subject (3+ chars) and message (10+ chars).");
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
              </View>
            )}
          </FormSection>

          {isAuthenticated && user ? (
            <FormSection title={`My Tickets (${ticketsQuery.data?.length ?? 0})`}>
              {ticketsQuery.isLoading ? (
                <LoadingSkeleton count={2} />
              ) : ticketsQuery.error ? (
                <ErrorState
                  title="Unable to Load Tickets"
                  message={normalizeApiError(ticketsQuery.error).message}
                  onRetry={() => void ticketsQuery.refetch()}
                />
              ) : (ticketsQuery.data?.length ?? 0) === 0 ? (
                <View style={styles.emptyTicketsWrap}>
                  <MascotIllustration mascot="phone" size="sm" variant="bare" decorative />
                  <Text style={styles.mutedNote}>No support tickets submitted yet.</Text>
                </View>
              ) : (
                <View style={styles.formStack}>
                  {(ticketsQuery.data ?? []).map((t) => (
                    <SelectionCard
                      key={t.id}
                      title={`${t.referenceCode} • ${t.subject}`}
                      subtitle={`${t.status} • ${t.category.replace(/_/g, " ")}`}
                      selected={selectedTicketId === t.id}
                      onPress={() => setSelectedTicketId(t.id)}
                    />
                  ))}
                </View>
              )}

              {selectedTicketId && ticketDetailQuery.data ? (
                <Card variant="outlined" style={styles.ticketThreadCard}>
                  <View style={styles.ticketThreadHeader}>
                    <Text style={styles.faqTitle}>
                      {ticketDetailQuery.data.referenceCode} • {ticketDetailQuery.data.subject}
                    </Text>
                    <StatusBadge status={ticketDetailQuery.data.status} size="sm" />
                  </View>
                  {ticketDetailQuery.data.messages.map((m) => (
                    <View key={m.id} style={styles.threadMessage}>
                      <Text style={styles.mutedNote}>
                        {m.senderDisplayName} ({m.senderRole}):
                      </Text>
                      <Text style={styles.threadMessageBody}>{m.body}</Text>
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
                </Card>
              ) : null}
            </FormSection>
          ) : null}
        </View>
      ) : null}

      {activeTab === "EXCEPTION" ? (
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
            <EmptyState
              mascot="thinking"
              title="No Eligible Bookings Found"
              description="Active or completed bookings appear here for incident reporting."
            />
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
              <View style={styles.chipWrap}>
                {EXCEPTION_CATEGORIES.map((cat) => {
                  const selected = category === cat.value;
                  return (
                    <TouchableOpacity
                      key={cat.value}
                      style={[styles.topicChip, selected ? styles.topicChipActive : null]}
                      onPress={() => setCategory(cat.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.topicChipText,
                          selected ? styles.topicChipTextActive : null
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                label="What Happened?"
                required
                multiline
                placeholder="Describe damage, missing item, or counter delay..."
                value={reason}
                onChangeText={setReason}
              />

              {submitError ? <ErrorState title="Submission Error" message={submitError} /> : null}
              {submitSuccess ? (
                <View style={styles.successBanner} accessibilityRole="alert">
                  <MobileIcon
                    name="check-circle"
                    size={16}
                    color={mobileStatusTokens.successIcon}
                  />
                  <Text style={styles.successBannerText}>{submitSuccess}</Text>
                </View>
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
      ) : null}

      {activeTab === "FAQS" ? (
        <Card variant="default" style={styles.sectionCard}>
          <View style={styles.faqHeroRow}>
            <MascotIllustration mascot="thinking" size="xs" variant="bare" decorative />
            <Text style={styles.sectionHeading}>Marketplace Safeguards & FAQs</Text>
          </View>
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
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  modeTabsRow: {
    flexDirection: "row",
    gap: mobileSpacing[2],
    marginBottom: mobileSpacing[4]
  },
  modeTabBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.white,
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: mobileSpacing[2]
  },
  modeTabBtnActive: {
    backgroundColor: mobileColors.navy[900],
    borderColor: mobileColors.navy[900]
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileTextColors.secondary
  },
  modeTabTextActive: {
    color: mobileColors.white
  },
  sectionStack: {
    gap: mobileSpacing[4]
  },
  sectionCard: {
    gap: mobileSpacing[4]
  },
  faqHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[3]
  },
  sectionHeading: {
    ...mobileTypography.headingMd,
    color: mobileTextColors.primary,
    flex: 1
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing[2]
  },
  topicChip: {
    minHeight: 40,
    paddingHorizontal: mobileSpacing[3],
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    justifyContent: "center",
    alignItems: "center"
  },
  topicChipActive: {
    backgroundColor: mobileColors.navy[900],
    borderColor: mobileColors.navy[900]
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: mobileTextColors.primary
  },
  topicChipTextActive: {
    color: mobileColors.white
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: mobileSpacing[2],
    backgroundColor: mobileStatusTokens.successBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.successBorder,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing[3]
  },
  successBannerText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.success,
    fontWeight: "600",
    flex: 1
  },
  emptyTicketsWrap: {
    alignItems: "center",
    gap: mobileSpacing[2],
    paddingVertical: mobileSpacing[3]
  },
  ticketThreadCard: {
    gap: mobileSpacing[2],
    marginTop: mobileSpacing[2]
  },
  ticketThreadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: mobileSpacing[2]
  },
  threadMessage: {
    paddingVertical: 4,
    gap: 2
  },
  threadMessageBody: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.secondary
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
