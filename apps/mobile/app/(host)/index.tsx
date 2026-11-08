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
import { HOST_MOBILE_SCREENS, MobileScreenSpec } from "../../src/data/mock-marketplace";
import { useAuthStore } from "../../src/store/useAuthStore";

const HOST_CATEGORIES = [
  "ALL",
  "Host Onboarding & Auth",
  "Location & Schedule Config",
  "Custody & Handover Operations",
  "Overdue & Mandatory Release",
  "Finance, Staff & Settings"
] as const;

export default function HostMobileHubScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ screen?: string }>();
  const initialScreenId = params.screen || "HM-006";
  const { user, isAuthenticated } = useAuthStore();

  const [previewHostRole, setPreviewHostRole] = useState<"HOST_OWNER" | "HOST_STAFF">("HOST_OWNER");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [activeScreenId, setActiveScreenId] = useState<string>(initialScreenId);

  const isHostAuthorized =
    user?.roles?.includes("HOST_OWNER") ||
    user?.roles?.includes("HOST_STAFF") ||
    user?.roles?.includes("SUPERADMIN");

  const hostRole: "HOST_OWNER" | "HOST_STAFF" =
    isAuthenticated && user
      ? user.roles?.includes("HOST_OWNER") || user.roles?.includes("SUPERADMIN")
        ? "HOST_OWNER"
        : "HOST_STAFF"
      : previewHostRole;

  // Interactive operational states
  const [slaDecision, setSlaDecision] = useState<"PENDING" | "APPROVED" | "DECLINED">(
    "PENDING"
  );
  const [sealNumber, setSealNumber] = useState("SEAL-LK-90211");
  const [assignedZone, setAssignedZone] = useState("RACK-A");
  const [disputedReleased, setDisputedReleased] = useState(false);

  const activeScreen: MobileScreenSpec = useMemo(() => {
    return (
      HOST_MOBILE_SCREENS.find((s) => s.id === activeScreenId) ||
      HOST_MOBILE_SCREENS.find((s) => s.id === "HM-006") ||
      HOST_MOBILE_SCREENS[0]
    );
  }, [activeScreenId]);

  const filteredScreens = useMemo(() => {
    if (selectedCategory === "ALL") return HOST_MOBILE_SCREENS;
    return HOST_MOBILE_SCREENS.filter((s) => s.category === selectedCategory);
  }, [selectedCategory]);

  const isOwnerRestricted =
    hostRole === "HOST_STAFF" && activeScreen.actorScope === "Host Owner";

  if (isAuthenticated && !isHostAuthorized) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.restrictedCard}>
          <MascotIllustration
            mascot="key"
            size="md"
            badgeText="RBAC Guard Active: Host Role Required"
            caption={`Authenticated account (${user?.email}) does not hold HOST_OWNER, HOST_STAFF, or SUPERADMIN permissions.`}
          />
          <TouchableOpacity
            style={styles.primaryCta}
            onPress={() => router.replace("/(traveller)")}
          >
            <Text style={styles.primaryCtaText}>Return to Traveller Mode</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Top Host Surface Banner */}
      <View style={styles.headerBanner}>
        <View style={styles.headerRow}>
          <Text style={styles.surfaceTag}>HOST MOBILE • 31 ACTIVE SCREENS</Text>
          <TouchableOpacity style={styles.switchBtn} onPress={() => router.push("/")}>
            <Text style={styles.switchBtnText}>Switch Surface</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.headerTitle}>
          {activeScreen.id} — {activeScreen.name}
        </Text>
        <Text style={styles.headerSubtitle}>{activeScreen.summary}</Text>

        {/* Role Switcher: Demo Preview only; locked when authenticated */}
        {!isAuthenticated ? (
          <View style={styles.roleToggleRow}>
            <TouchableOpacity
              style={[
                styles.roleBtn,
                hostRole === "HOST_OWNER" ? styles.roleBtnActive : null
              ]}
              onPress={() => setPreviewHostRole("HOST_OWNER")}
            >
              <Text
                style={
                  hostRole === "HOST_OWNER"
                    ? styles.roleBtnTextActive
                    : styles.roleBtnText
                }
              >
                Role: HOST_OWNER
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleBtn,
                hostRole === "HOST_STAFF" ? styles.roleBtnStaffActive : null
              ]}
              onPress={() => setPreviewHostRole("HOST_STAFF")}
            >
              <Text
                style={
                  hostRole === "HOST_STAFF"
                    ? styles.roleBtnTextActive
                    : styles.roleBtnText
                }
              >
                Role: HOST_STAFF
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.roleToggleRow}>
            <View style={[styles.roleBtn, styles.roleBtnActive]}>
              <Text style={styles.roleBtnTextActive}>
                Authenticated Role: {hostRole}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Active Screen Viewport */}
      {isOwnerRestricted ? (
        <View style={styles.restrictedCard}>
          <MascotIllustration
            mascot="key"
            size="md"
            badgeText="RBAC Guard Active: HOST_OWNER Required"
            caption={`Screen ${activeScreen.id} (${activeScreen.name}) is restricted to HOST_OWNER accounts. Counter staff (${hostRole}) cannot modify pricing, bank accounts, or staff RBAC.`}
          />
          {!isAuthenticated && (
            <TouchableOpacity
              style={styles.primaryCta}
              onPress={() => setPreviewHostRole("HOST_OWNER")}
            >
              <Text style={styles.primaryCtaText}>Elevate Preview to HOST_OWNER</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.viewportCard}>
          <MascotIllustration
            mascot={activeScreen.mascot}
            size="md"
            badgeText={`${activeScreen.id} • ${activeScreen.actorScope}`}
            caption={activeScreen.summary}
          />

          {/* Contextual Interactive Controls */}
          {(activeScreen.id === "HM-018" || activeScreen.id === "HM-019") && (
            <View style={styles.interactiveBox}>
              <Text style={styles.boxTitle}>
                15m SLA Request #LS-2026-8843 (11m Left • Status: {slaDecision})
              </Text>
              <View style={styles.rowGap}>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => setSlaDecision("APPROVED")}
                >
                  <Text style={styles.btnWhiteText}>Approve Booking</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => setSlaDecision("DECLINED")}
                >
                  <Text style={styles.btnWhiteText}>Decline Request</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {(activeScreen.id === "HM-022" || activeScreen.id === "HM-023") && (
            <View style={styles.interactiveBox}>
              <Text style={styles.boxTitle}>
                Mandatory Bag-Count Reconciliation, Seal & Configurable Photo Evidence (OQ-014)
              </Text>
              <Text style={styles.invariantNote}>
                Photo evidence is optional by default and configurable as mandatory per location.
                Check-in timestamp and responsible staff ID are recorded server-side.
              </Text>
              <TextInput
                style={styles.input}
                value={sealNumber}
                onChangeText={setSealNumber}
                placeholder="Tamper-Evident Seal ID"
              />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={assignedZone}
                onChangeText={setAssignedZone}
                placeholder="Storage Rack Zone Code"
              />
            </View>
          )}

          {(activeScreen.id === "HM-026" || activeScreen.id === "HM-027") && (
            <View style={styles.interactiveBox}>
              <Text style={styles.boxTitle}>
                Configurable Overdue Grace & In-App Late Fee Request (OQ-015)
              </Text>
              <Text style={styles.invariantNote}>
                Grace periods and late fees are configurable per location (illustrative demo: 30m
                grace / 1.5x daily rate) and disclosed before checkout. Travellers review and pay
                in-app—no silent charges and no cash at counter.
              </Text>
            </View>
          )}

          {activeScreen.id === "HM-028" && (
            <View style={styles.interactiveBox}>
              <Text style={styles.boxTitle}>
                OQ-015 & Invariant BR-035: Decoupled Custody & Disputed Release Handover
              </Text>
              <Text style={styles.invariantNote}>
                Physical luggage custody and overdue fee settlement are strictly separate. Hosts are
                prohibited from holding luggage hostage over unpaid or disputed late fees
                (configurable per location; illustrative demo: 1.5x daily rate). Release bags
                immediately upon QR/PIN verification and escalate fee recovery to Platform Support.
              </Text>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => setDisputedReleased(true)}
              >
                <Text style={styles.btnWhiteText}>
                  {disputedReleased
                    ? "Bags Released & Claim Escalated ✓"
                    : "Execute Mandatory Release & Log Claim"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.quickRoutesRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push("/(host)/scanner")}
            >
              <Text style={styles.secondaryBtnText}>
                Open QR / PIN Scanner (HM-021)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setActiveScreenId("HM-028")}
            >
              <Text style={styles.secondaryBtnText}>
                Disputed Release (HM-028)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setActiveScreenId("HM-029")}
            >
              <Text style={styles.secondaryBtnText}>Host Earnings (HM-029)</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Category Filter */}
      <Text style={styles.sectionHeader}>
        Browse All 31 Registered Host Mobile Screens
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {HOST_CATEGORIES.map((cat) => (
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
          const lockedForStaff =
            hostRole === "HOST_STAFF" && scr.actorScope === "Host Owner";
          return (
            <TouchableOpacity
              key={scr.id}
              style={[styles.screenCard, isSelected ? styles.screenCardActive : null]}
              onPress={() => setActiveScreenId(scr.id)}
            >
              <View style={styles.screenCardTop}>
                <Text style={styles.screenIdBadge}>{scr.id}</Text>
                <Text style={styles.screenScopeText}>
                  {lockedForStaff ? "🔒 HOST_OWNER ONLY" : scr.actorScope}
                </Text>
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
  container: { padding: 16, backgroundColor: "#F8FAFC", paddingBottom: 40 },
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
    color: "#38BDF8",
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
  switchBtnText: { color: "#E2E8F0", fontSize: 11, fontWeight: "600" },
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
    marginBottom: 12
  },
  roleToggleRow: { flexDirection: "row", gap: 8 },
  roleBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#1E293B",
    alignItems: "center"
  },
  roleBtnActive: { backgroundColor: "#2563EB" },
  roleBtnStaffActive: { backgroundColor: "#D97706" },
  roleBtnText: { color: "#94A3B8", fontSize: 11, fontWeight: "700" },
  roleBtnTextActive: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  restrictedCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 18
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
  invariantNote: {
    fontSize: 11,
    color: "#475569",
    marginBottom: 10,
    lineHeight: 16
  },
  rowGap: { flexDirection: "row", gap: 8 },
  approveBtn: {
    flex: 1,
    backgroundColor: "#059669",
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center"
  },
  declineBtn: {
    flex: 1,
    backgroundColor: "#DC2626",
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center"
  },
  btnWhiteText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
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
  primaryCta: {
    marginTop: 8,
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center"
  },
  primaryCtaText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
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
  secondaryBtnText: { fontSize: 11, fontWeight: "700", color: "#1E293B" },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8
  },
  categoryScroll: { gap: 8, paddingBottom: 12 },
  catTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E2E8F0"
  },
  catTabActive: { backgroundColor: "#0F172A" },
  catTabText: { fontSize: 11, fontWeight: "600", color: "#475569" },
  catTabTextActive: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
  screenGrid: { gap: 8 },
  screenCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  screenCardActive: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  screenCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  screenIdBadge: { fontSize: 11, fontWeight: "800", color: "#2563EB" },
  screenScopeText: { fontSize: 10, color: "#64748B", fontWeight: "700" },
  screenName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2
  },
  screenDesc: { fontSize: 11, color: "#475569" }
});
