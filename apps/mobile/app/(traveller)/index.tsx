import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MascotIllustration } from "../../src/components/MascotIllustration";
import {
  TRAVELLER_MOBILE_SCREENS,
  MobileScreenSpec
} from "../../src/data/mock-marketplace";
import { authApi } from "../../src/services/auth-api";

const CATEGORIES = [
  "ALL",
  "Onboarding & Auth",
  "Discovery & Search",
  "Booking & Checkout",
  "Active Custody & Refunds",
  "Profile, Support & Settings"
] as const;

export default function TravellerMobileHubScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ screen?: string; token?: string; email?: string }>();
  const initialScreenId = params.screen || "TM-011";

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [activeScreenId, setActiveScreenId] = useState<string>(initialScreenId);

  // Interactive states across Traveller Mobile workflows
  const [selectedLang, setSelectedLang] = useState<"EN" | "SI" | "TA">("EN");
  const [otpValue, setOtpValue] = useState(params.token || "");
  const [verifyEmailAddr, setVerifyEmailAddr] = useState(params.email || "");
  const [verifyFeedback, setVerifyFeedback] = useState<string | null>(null);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [bagCounts, setBagCounts] = useState({ SMALL: 1, MEDIUM: 2, LARGE: 0, OVERSIZED: 0 });
  const [starRating, setStarRating] = useState(5);
  const [ticketDraft, setTicketDraft] = useState(
    "Need 1-hour extension on Colombo Fort Vault booking #LS-2026-8841"
  );

  const activeScreen: MobileScreenSpec = useMemo(() => {
    return (
      TRAVELLER_MOBILE_SCREENS.find((s) => s.id === activeScreenId) ||
      TRAVELLER_MOBILE_SCREENS.find((s) => s.id === "TM-011") ||
      TRAVELLER_MOBILE_SCREENS[0]
    );
  }, [activeScreenId]);

  const filteredScreens = useMemo(() => {
    if (selectedCategory === "ALL") return TRAVELLER_MOBILE_SCREENS;
    return TRAVELLER_MOBILE_SCREENS.filter((s) => s.category === selectedCategory);
  }, [selectedCategory]);

  const totalBags =
    bagCounts.SMALL + bagCounts.MEDIUM + bagCounts.LARGE + bagCounts.OVERSIZED;
  const totalLkr =
    bagCounts.SMALL * 900 +
    bagCounts.MEDIUM * 1450 +
    bagCounts.LARGE * 1950 +
    bagCounts.OVERSIZED * 2800;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Top Surface Bar */}
      <View style={styles.headerBanner}>
        <View style={styles.headerRow}>
          <Text style={styles.surfaceTag}>TRAVELLER MOBILE • 39 ACTIVE SCREENS</Text>
          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => router.push("/")}
          >
            <Text style={styles.switchBtnText}>Switch Role</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>
          {activeScreen.id} — {activeScreen.name}
        </Text>
        <Text style={styles.headerSubtitle}>{activeScreen.summary}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>Scope: {activeScreen.actorScope}</Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>
              Workflows: {activeScreen.workflows.join(", ")}
            </Text>
          </View>
          <View
            style={[
              styles.metaChip,
              activeScreen.backendDependency === "LIVE_PHASE_1B"
                ? styles.liveChip
                : styles.previewChip
            ]}
          >
            <Text style={styles.metaChipText}>{activeScreen.backendDependency}</Text>
          </View>
        </View>
      </View>

      {/* Active Screen Interactive Viewport */}
      <View style={styles.viewportCard}>
        <MascotIllustration
          mascot={activeScreen.mascot}
          size="md"
          badgeText={`${activeScreen.id} • ${activeScreen.category}`}
          caption={activeScreen.summary}
        />

        {/* Contextual Interactive Controls per Screen Family */}
        {activeScreen.id === "TM-004" && (
          <View style={styles.interactiveBox}>
            <Text style={styles.boxTitle}>Select Language & Currency (LKR Default)</Text>
            <View style={styles.rowGap}>
              {(["EN", "SI", "TA"] as const).map((lng) => (
                <TouchableOpacity
                  key={lng}
                  style={[
                    styles.pillBtn,
                    selectedLang === lng ? styles.pillBtnActive : null
                  ]}
                  onPress={() => setSelectedLang(lng)}
                >
                  <Text
                    style={
                      selectedLang === lng
                        ? styles.pillBtnTextActive
                        : styles.pillBtnText
                    }
                  >
                    {lng === "EN" ? "English" : lng === "SI" ? "සිංහල (SI)" : "தமிழ் (TA)"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {activeScreen.id === "TM-008" && (
          <View style={styles.interactiveBox}>
            <Text style={styles.boxTitle}>Self-Service Email Verification (TM-008)</Text>
            <Text style={styles.sealText}>
              Paste your single-use verification token sent on registration to activate your account.
            </Text>
            <TextInput
              style={styles.input}
              value={otpValue}
              onChangeText={setOtpValue}
              placeholder="Paste verification token..."
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.primaryCta, verifySubmitting ? { opacity: 0.7 } : null]}
              disabled={verifySubmitting}
              onPress={async () => {
                if (!otpValue.trim()) {
                  setVerifyFeedback("Please enter a valid verification token.");
                  return;
                }
                setVerifySubmitting(true);
                setVerifyFeedback(null);
                try {
                  const res = await authApi.verifyEmail({ token: otpValue.trim() });
                  setVerifyFeedback(`${res.message} (${res.user?.status ?? "ACTIVE"})`);
                } catch (err) {
                  setVerifyFeedback(
                    err instanceof Error ? err.message : "Verification token invalid or expired."
                  );
                } finally {
                  setVerifySubmitting(false);
                }
              }}
            >
              <Text style={styles.primaryCtaText}>
                {verifySubmitting ? "Verifying..." : "Verify Email Token"}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.boxTitle, { marginTop: 12 }]}>
              Resend Verification Instructions
            </Text>
            <TextInput
              style={styles.input}
              value={verifyEmailAddr}
              onChangeText={setVerifyEmailAddr}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity
              style={[styles.secondaryBtn, { marginTop: 8 }]}
              disabled={verifySubmitting}
              onPress={async () => {
                if (!verifyEmailAddr.trim()) {
                  setVerifyFeedback("Please enter your registered email address.");
                  return;
                }
                setVerifySubmitting(true);
                setVerifyFeedback(null);
                try {
                  const res = await authApi.resendVerification({
                    email: verifyEmailAddr.trim()
                  });
                  setVerifyFeedback(res.message);
                } catch (err) {
                  setVerifyFeedback(
                    err instanceof Error ? err.message : "Failed to resend verification email."
                  );
                } finally {
                  setVerifySubmitting(false);
                }
              }}
            >
              <Text style={styles.secondaryBtnText}>Resend Verification Email</Text>
            </TouchableOpacity>
            {verifyFeedback && (
              <Text style={[styles.sealText, { marginTop: 8, fontWeight: "600" }]}>
                {verifyFeedback}
              </Text>
            )}
          </View>
        )}

        {(activeScreen.id === "TM-018" || activeScreen.id === "TM-019") && (
          <View style={styles.interactiveBox}>
            <Text style={styles.boxTitle}>
              Bag Category Counter ({totalBags} Bags • LKR {totalLkr})
            </Text>
            {(["SMALL", "MEDIUM", "LARGE", "OVERSIZED"] as const).map((tier) => (
              <View key={tier} style={styles.counterRow}>
                <Text style={styles.counterLabel}>{tier}</Text>
                <View style={styles.counterActions}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() =>
                      setBagCounts((p) => ({ ...p, [tier]: Math.max(0, p[tier] - 1) }))
                    }
                  >
                    <Text style={styles.counterBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterVal}>{bagCounts[tier]}</Text>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => setBagCounts((p) => ({ ...p, [tier]: p[tier] + 1 }))}
                  >
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <Text style={styles.sealText}>
              Pre-Checkout Late Collection Policy Disclosure (OQ-015): Configurable per location
              (illustrative demo: 30m grace, then disclosed late rate). In-app payment only; no
              silent charges; never blocks luggage return.
            </Text>
            <TouchableOpacity
              style={styles.primaryCta}
              onPress={() => setActiveScreenId("TM-024")}
            >
              <Text style={styles.primaryCtaText}>
                Proceed to Confirmed Custody Pass (TM-024)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {(activeScreen.id === "TM-024" ||
          activeScreen.id === "TM-027" ||
          activeScreen.id === "TM-028" ||
          activeScreen.id === "TM-029" ||
          activeScreen.id === "TM-030") && (
          <View style={styles.interactiveBox}>
            <Text style={styles.boxTitle}>
              Server-Verified QR Pass & 6-Digit PIN Fallback (OQ-014) • Ref #LS-2026-8841
            </Text>
            <Text style={styles.qrPayloadText}>
              Primary QR Token: LS-CUSTODY://LS-2026-8841/HMAC-9F8A72B
            </Text>
            <Text style={styles.pinHighlight}>
              Fallback PIN (When QR Unavailable): 482 910
            </Text>
            <Text style={styles.sealText}>
              Reconciled Bags: 3 • Seals: SEAL-LK-90211, SEAL-LK-90212 • Zone RACK-A • Photo
              Evidence: Configurable per Location
            </Text>
          </View>
        )}

        {activeScreen.id === "TM-033" && (
          <View style={styles.interactiveBox}>
            <Text style={styles.boxTitle}>7-Stage Refund Settlement Tracker</Text>
            <Text style={styles.sealText}>
              1. Requested ✓ → 2. Policy Window (100%) ✓ → 3. Capacity Released ✓ → 4. Ledger
              Reversed ✓ → 5. PayHere Dispatched ✓ → 6. Bank Processing ✓ → 7. Card Credit
              (Pending)
            </Text>
          </View>
        )}

        {activeScreen.id === "TM-034" && (
          <View style={styles.interactiveBox}>
            <Text style={styles.boxTitle}>Rate Your Storage Experience ({starRating}/5 ★)</Text>
            <View style={styles.rowGap}>
              {[1, 2, 3, 4, 5].map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[styles.pillBtn, starRating >= st ? styles.pillBtnActive : null]}
                  onPress={() => setStarRating(st)}
                >
                  <Text
                    style={
                      starRating >= st ? styles.pillBtnTextActive : styles.pillBtnText
                    }
                  >
                    {st} ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {(activeScreen.id === "TM-040" || activeScreen.id === "TM-041") && (
          <View style={styles.interactiveBox}>
            <Text style={styles.boxTitle}>Support Ticket #TKT-9042</Text>
            <TextInput
              style={styles.input}
              value={ticketDraft}
              onChangeText={setTicketDraft}
            />
          </View>
        )}

        {/* Direct Route Launchers for Dedicated Auth / Account / Map Screens */}
        <View style={styles.quickRoutesRow}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/(traveller)/explore")}
          >
            <Text style={styles.secondaryBtnText}>Open Map View (TM-012)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.secondaryBtnText}>Live Auth (TM-005)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/(account)/profile")}
          >
            <Text style={styles.secondaryBtnText}>Live Profile (TM-042)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Filter Tabs */}
      <Text style={styles.sectionHeader}>
        Browse All 39 Registered Traveller Mobile Screens
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.catTab,
              selectedCategory === cat ? styles.catTabActive : null
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text
              style={
                selectedCategory === cat ? styles.catTabTextActive : styles.catTabText
              }
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Screen Registry Cards */}
      <View style={styles.screenGrid}>
        {filteredScreens.map((scr) => {
          const isSelected = scr.id === activeScreen.id;
          return (
            <TouchableOpacity
              key={scr.id}
              style={[styles.screenCard, isSelected ? styles.screenCardActive : null]}
              onPress={() => setActiveScreenId(scr.id)}
            >
              <View style={styles.screenCardTop}>
                <Text style={styles.screenIdBadge}>{scr.id}</Text>
                <Text style={styles.screenCategoryText}>{scr.category}</Text>
              </View>
              <Text style={styles.screenName}>{scr.name}</Text>
              <Text style={styles.screenDesc} numberOfLines={2}>
                {scr.summary}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#F8FAFC",
    paddingBottom: 40
  },
  headerBanner: {
    backgroundColor: "#0F172A",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  surfaceTag: {
    color: "#FBBF24",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6
  },
  switchBtn: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  switchBtnText: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "600"
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4
  },
  headerSubtitle: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  metaChip: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  liveChip: {
    backgroundColor: "#065F46"
  },
  previewChip: {
    backgroundColor: "#1E40AF"
  },
  metaChipText: {
    color: "#F8FAFC",
    fontSize: 10,
    fontWeight: "700"
  },
  viewportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 18
  },
  interactiveBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 8
  },
  boxTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8
  },
  rowGap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#E2E8F0"
  },
  pillBtnActive: {
    backgroundColor: "#2563EB"
  },
  pillBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155"
  },
  pillBtnTextActive: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0F172A"
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6
  },
  counterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  counterActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center"
  },
  counterBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14
  },
  counterVal: {
    fontSize: 13,
    fontWeight: "700",
    minWidth: 18,
    textAlign: "center"
  },
  primaryCta: {
    marginTop: 10,
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center"
  },
  primaryCtaText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  pinHighlight: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E40AF",
    marginBottom: 4
  },
  qrPayloadText: {
    fontSize: 11,
    color: "#475569",
    marginBottom: 4
  },
  sealText: {
    fontSize: 11,
    color: "#0F172A",
    lineHeight: 16
  },
  quickRoutesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  secondaryBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  secondaryBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E293B"
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8
  },
  categoryScroll: {
    gap: 8,
    paddingBottom: 12
  },
  catTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E2E8F0"
  },
  catTabActive: {
    backgroundColor: "#0F172A"
  },
  catTabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569"
  },
  catTabTextActive: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  screenGrid: {
    gap: 8
  },
  screenCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  screenCardActive: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF"
  },
  screenCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  screenIdBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB"
  },
  screenCategoryText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600"
  },
  screenName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2
  },
  screenDesc: {
    fontSize: 11,
    color: "#475569"
  }
});
