import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet
} from "react-native";
import { Card, Button, Badge, MobileIcon, MascotIllustration } from "../../src/components";
import { mobileColors, mobileRadius, mobileTypography } from "../../src/lib/theme";

const FAQS = [
  {
    q: "How are my bags physically secured?",
    a: "Every bag stored through our network receives a tamper-evident serialized seal tag (e.g. #SEAL-LK-90211). Bags are placed in locked vaults or monitored steel racks under 24/7 CCTV surveillance with up to LKR 250,000 platform guarantee."
  },
  {
    q: "What if my Sri Lankan train or flight is delayed?",
    a: "All partner locations offer pre-disclosed grace periods (typically 30–60 minutes). You can easily extend your storage in-app with 1 tap. Overdue hours are billed at the transparent hourly rate via in-app card checkout. Your bags are NEVER locked or withheld."
  },
  {
    q: "How does the digital custody pass work without mobile data?",
    a: "Your custody pass and 6-digit backup PIN (e.g. 482 910) are cached locally in your app. Even without international roaming or WiFi, you can show the pass at the partner counter for drop-off and pickup."
  },
  {
    q: "Can I store surfboards, backpacks, or oversized dive gear?",
    a: "Yes! Many coastal and highland hubs (such as Colombo Fort, Galle Fort, and Mirissa) feature dedicated padded bays for surfboards, trekking packs, and hard-shell suitcases."
  }
];

export default function TravellerSupportScreen() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [ticketTopic, setTicketTopic] = useState("Train Delay / Storage Extension");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  const toggleFaq = (idx: number) => {
    setExpandedFaq((prev) => (prev === idx ? null : idx));
  };

  return (
    <View style={styles.screenWrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Coastal Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Help & Support Centre</Text>
          <Text style={styles.headerSubtitle}>
            24/7 Traveller Assistance & Custody Escalation
          </Text>
        </View>

        {/* Emergency Hotline Card */}
        <Card style={styles.hotlineCard} variant="elevated">
          <View style={styles.hotlineTop}>
            <View style={styles.hotlineIcon}>
              <MobileIcon name="phone" size={20} color={mobileColors.terracotta[500]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hotlineTitle}>24/7 Dedicated Custody Hotline</Text>
              <Text style={styles.hotlineSubtitle}>
                Immediate assistance for late arrivals or partner counter inquiries
              </Text>
            </View>
          </View>
          <Button
            title="Call +94 11 234 5678"
            variant="primary"
            onPress={() => alert("Calling platform custody helpline: +94 11 234 5678")}
            style={{ marginTop: 12 }}
          />
        </Card>

        {/* Active Support Conversation Thread (TM-041) */}
        <Card style={styles.threadCard}>
          <View style={styles.threadHeader}>
            <View>
              <Text style={styles.threadRef}>Ticket #TKT-9042</Text>
              <Text style={styles.threadSubject}>Colombo Fort 1-hour delay notification</Text>
            </View>
            <Badge label="IN PROGRESS" variant="info" size="sm" />
          </View>

          <View style={styles.messageBubbleUser}>
            <Text style={styles.bubbleSender}>You • 10:14 AM</Text>
            <Text style={styles.bubbleText}>
              "Hi, my Badulla express train was delayed by 30 mins. Will arrive at Colombo Fort around 18:45."
            </Text>
          </View>

          <View style={styles.messageBubbleAgent}>
            <Text style={styles.bubbleSender}>Kavindi (Platform Support) • 10:18 AM</Text>
            <Text style={styles.bubbleText}>
              "Ayubowan! We have noted your delay. Colombo Fort Vault is open 24/7 and your booking includes a 30m grace period. Your bags remain securely sealed in Zone RACK-A."
            </Text>
          </View>
        </Card>

        {/* Frequently Asked Questions (TM-039) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        </View>

        <View style={styles.faqList}>
          {FAQS.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            return (
              <Card key={idx} style={styles.faqCard}>
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => toggleFaq(idx)}
                >
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <MobileIcon
                    name={isExpanded ? "chevron-left" : "chevron-right"}
                    size={16}
                    color={mobileColors.navy[900]}
                  />
                </TouchableOpacity>
                {isExpanded && <Text style={styles.faqAnswer}>{faq.a}</Text>}
              </Card>
            );
          })}
        </View>

        {/* Create Support Ticket Form (TM-040) */}
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Submit a New Inquiry</Text>
          <Text style={styles.formSubtitle}>
            Our team responds within 15 minutes during operating hours.
          </Text>

          {!ticketSubmitted ? (
            <>
              <Text style={styles.inputLabel}>Inquiry Topic</Text>
              <View style={styles.topicPillsRow}>
                {[
                  "Train Delay / Storage Extension",
                  "Digital Pass & PIN Issue",
                  "Cancellation & Refund",
                  "Luggage Seal Verification"
                ].map((top) => (
                  <TouchableOpacity
                    key={top}
                    style={[
                      styles.topicPill,
                      ticketTopic === top && styles.topicPillActive
                    ]}
                    onPress={() => setTicketTopic(top)}
                  >
                    <Text
                      style={[
                        styles.topicPillText,
                        ticketTopic === top && styles.topicPillTextActive
                      ]}
                    >
                      {top}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Message Details</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={3}
                placeholder="Describe your question or provide booking reference..."
                placeholderTextColor={mobileColors.sand[600]}
                value={ticketMessage}
                onChangeText={setTicketMessage}
              />

              <Button
                title="Send Message to Support"
                variant="primary"
                onPress={() => setTicketSubmitted(true)}
                style={{ marginTop: 12 }}
              />
            </>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              <MobileIcon name="check" size={32} color={mobileColors.emerald[600]} />
              <Text style={styles.ticketSuccessTitle}>Ticket Submitted Successfully</Text>
              <Text style={styles.ticketSuccessDesc}>
                Reference: #TKT-9043. A support concierge has been notified and will message you shortly.
              </Text>
              <Button
                title="Send Another Inquiry"
                variant="outline"
                size="sm"
                onPress={() => {
                  setTicketMessage("");
                  setTicketSubmitted(false);
                }}
                style={{ marginTop: 12 }}
              />
            </View>
          )}
        </Card>

        {/* Mascot note */}
        <View style={{ paddingHorizontal: 16 }}>
          <MascotIllustration
            mascot="thinking"
            size="sm"
            caption="Need assistance? Our local support team is ready to help across all Sri Lankan provinces."
          />
        </View>
      </ScrollView>
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
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 16
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
  hotlineCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    backgroundColor: mobileColors.white
  },
  hotlineTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  hotlineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: mobileColors.terracotta[50],
    justifyContent: "center",
    alignItems: "center"
  },
  hotlineTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  hotlineSubtitle: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2
  },
  threadCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14
  },
  threadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[100],
    paddingBottom: 8,
    marginBottom: 10
  },
  threadRef: {
    ...mobileTypography.codeMono,
    fontSize: 12,
    color: mobileColors.navy[900]
  },
  threadSubject: {
    fontSize: 12,
    color: mobileColors.sand[600]
  },
  messageBubbleUser: {
    backgroundColor: mobileColors.terracotta[50],
    borderRadius: mobileRadius.md,
    padding: 10,
    marginBottom: 8,
    alignSelf: "flex-end",
    maxWidth: "88%"
  },
  messageBubbleAgent: {
    backgroundColor: mobileColors.sand[100],
    borderRadius: mobileRadius.md,
    padding: 10,
    alignSelf: "flex-start",
    maxWidth: "88%"
  },
  bubbleSender: {
    fontSize: 10,
    fontWeight: "700",
    color: mobileColors.sand[700],
    marginBottom: 2
  },
  bubbleText: {
    fontSize: 12,
    color: mobileColors.navy[900],
    lineHeight: 16
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 10
  },
  sectionTitle: {
    ...mobileTypography.headingSm,
    color: mobileColors.navy[900]
  },
  faqList: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 14
  },
  faqCard: {
    padding: 14
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900],
    flex: 1,
    paddingRight: 8
  },
  faqAnswer: {
    fontSize: 12,
    color: mobileColors.sand[700],
    marginTop: 8,
    lineHeight: 17
  },
  formCard: {
    marginHorizontal: 16,
    padding: 16,
    marginBottom: 14
  },
  formTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  formSubtitle: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2,
    marginBottom: 12
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 6
  },
  topicPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12
  },
  topicPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  topicPillActive: {
    backgroundColor: mobileColors.navy[900],
    borderColor: mobileColors.navy[900]
  },
  topicPillText: {
    fontSize: 11,
    color: mobileColors.sand[800],
    fontWeight: "600"
  },
  topicPillTextActive: {
    color: mobileColors.white
  },
  textArea: {
    backgroundColor: mobileColors.sand[50],
    borderWidth: 1,
    borderColor: mobileColors.sand[300],
    borderRadius: mobileRadius.md,
    padding: 10,
    fontSize: 12,
    color: mobileColors.navy[900],
    textAlignVertical: "top",
    minHeight: 70
  },
  ticketSuccessTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginTop: 6
  },
  ticketSuccessDesc: {
    fontSize: 12,
    color: mobileColors.sand[600],
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 12
  }
});
