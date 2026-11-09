import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/useAuthStore";
import { useMobileStore } from "../../src/store/useMobileStore";
import { Card, Button, Badge, MobileIcon, MascotIllustration } from "../../src/components";
import { mobileColors, mobileRadius, mobileTypography } from "../../src/lib/theme";

export default function TravellerProfileScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { setRole } = useMobileStore();

  // Settings State (TM-004 / TM-044)
  const [selectedLang, setSelectedLang] = useState<"EN" | "SI" | "TA">("EN");
  const [selectedCurrency, setSelectedCurrency] = useState<"LKR" | "USD" | "EUR">("LKR");
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [offlinePassEnabled, setOfflinePassEnabled] = useState(true);
  const [pushAlertsEnabled, setPushAlertsEnabled] = useState(true);

  // Switch role handler
  const handleSwitchToHost = () => {
    setRole("host");
    router.replace("/(host)");
  };

  return (
    <View style={styles.screenWrapper}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Coastal Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account & Settings</Text>
          <Text style={styles.headerSubtitle}>
            Identity, Preferences, Notifications & Offline Security
          </Text>
        </View>

        {/* User Identity Card (TM-042) */}
        <Card style={styles.identityCard} variant="elevated">
          {isAuthenticated && user ? (
            <View>
              <View style={styles.identityHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {user.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.displayName}>{user.displayName}</Text>
                  <Text style={styles.emailText}>{user.email}</Text>
                  <View style={styles.roleBadgesRow}>
                    <Badge label="TRAVELLER" variant="navy" size="sm" />
                    <Badge label="VERIFIED" variant="success" size="sm" />
                  </View>
                </View>
              </View>

              <View style={styles.accountActionRow}>
                <Button
                  title="Security & Password"
                  variant="outline"
                  size="sm"
                  leftIcon={<MobileIcon name="lock" size={14} color={mobileColors.navy[900]} />}
                  onPress={() => router.push("/(account)/security")}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Sign Out"
                  variant="ghost"
                  size="sm"
                  onPress={() => logout()}
                />
              </View>
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 8 }}>
              <MascotIllustration
                mascot="wave"
                size="sm"
                caption="Sign in to save your custody passes, manage active bookings, and review partner vaults."
              />
              <View style={styles.authButtonsRow}>
                <Button
                  title="Sign In"
                  variant="primary"
                  onPress={() => router.push("/(auth)/login")}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Register"
                  variant="outline"
                  onPress={() => router.push("/(auth)/register")}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </Card>

        {/* Language & Currency Selector (TM-004) */}
        <Card style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Language & Display Currency</Text>
          <Text style={styles.sectionSubtitle}>
            Local language support and transparent Sri Lankan Rupee pricing
          </Text>

          <Text style={styles.inputLabel}>Language</Text>
          <View style={styles.pillRow}>
            {(
              [
                { id: "EN", label: "English" },
                { id: "SI", label: "සිංහල (Sinhala)" },
                { id: "TA", label: "தமிழ் (Tamil)" }
              ] as const
            ).map((lang) => (
              <TouchableOpacity
                key={lang.id}
                style={[
                  styles.optionPill,
                  selectedLang === lang.id && styles.optionPillActive
                ]}
                onPress={() => setSelectedLang(lang.id)}
              >
                <Text
                  style={[
                    styles.optionPillText,
                    selectedLang === lang.id && styles.optionPillTextActive
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Display Currency</Text>
          <View style={styles.pillRow}>
            {(["LKR", "USD", "EUR"] as const).map((curr) => (
              <TouchableOpacity
                key={curr}
                style={[
                  styles.optionPill,
                  selectedCurrency === curr && styles.optionPillActive
                ]}
                onPress={() => setSelectedCurrency(curr)}
              >
                <Text
                  style={[
                    styles.optionPillText,
                    selectedCurrency === curr && styles.optionPillTextActive
                  ]}
                >
                  {curr === "LKR" ? "LKR (Default)" : curr}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Notification Centre (TM-037) */}
        <Card style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Recent Notifications</Text>
          <Text style={styles.sectionSubtitle}>In-app custody updates and reminders</Text>

          <View style={styles.notifItem}>
            <View style={styles.notifIconCircle}>
              <MobileIcon name="clock" size={14} color={mobileColors.emerald[700]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>Storage in Progress: Colombo Fort</Text>
              <Text style={styles.notifBody}>
                Your 2 bags are safely stored in Zone RACK-A. Scheduled pickup by 18:30.
              </Text>
              <Text style={styles.notifTime}>Today • 09:30 AM</Text>
            </View>
          </View>

          <View style={styles.notifItem}>
            <View style={styles.notifIconCircle}>
              <MobileIcon name="check" size={14} color={mobileColors.sky[700]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.notifTitle}>Booking Confirmed: Ella Hub</Text>
              <Text style={styles.notifBody}>
                Partner approved reservation #LS-2026-7712 for tomorrow morning.
              </Text>
              <Text style={styles.notifTime}>Yesterday • 16:45 PM</Text>
            </View>
          </View>
        </Card>

        {/* App Settings & Hardware Controls (TM-044) */}
        <Card style={styles.cardSection}>
          <Text style={styles.sectionTitle}>App & Security Preferences</Text>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Biometric FaceID / Fingerprint</Text>
              <Text style={styles.toggleSubtitle}>Require biometric unlock to view pass PIN</Text>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={setBiometricsEnabled}
              trackColor={{ false: mobileColors.sand[300], true: mobileColors.terracotta[500] }}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Offline Pass Caching</Text>
              <Text style={styles.toggleSubtitle}>Store QR passes locally in SecureStore</Text>
            </View>
            <Switch
              value={offlinePassEnabled}
              onValueChange={setOfflinePassEnabled}
              trackColor={{ false: mobileColors.sand[300], true: mobileColors.terracotta[500] }}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>SLA Push Alerts</Text>
              <Text style={styles.toggleSubtitle}>Receive 30-minute late collection warnings</Text>
            </View>
            <Switch
              value={pushAlertsEnabled}
              onValueChange={setPushAlertsEnabled}
              trackColor={{ false: mobileColors.sand[300], true: mobileColors.terracotta[500] }}
            />
          </View>
        </Card>

        {/* Role Switching & Legal */}
        <Card style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Partner Mode & Version</Text>
          <Text style={styles.sectionSubtitle}>
            Operate a storage location or switch operational profile
          </Text>

          <Button
            title="Switch to Host Partner Portal"
            variant="secondary"
            onPress={handleSwitchToHost}
            style={{ marginTop: 10 }}
          />

          <View style={styles.legalLinksRow}>
            <TouchableOpacity onPress={() => alert("Terms of Service: Sri Lanka Luggage Marketplace")}>
              <Text style={styles.legalLink}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={{ color: mobileColors.sand[400] }}>•</Text>
            <TouchableOpacity onPress={() => alert("Privacy Policy: Decoupled Custody Guarantee")}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={{ color: mobileColors.sand[400] }}>•</Text>
            <Text style={styles.legalLink}>v0.1.0-cwcp</Text>
          </View>
        </Card>
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
  identityCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16
  },
  identityHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 14
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: mobileColors.terracotta[500],
    justifyContent: "center",
    alignItems: "center"
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: mobileColors.white
  },
  displayName: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  emailText: {
    fontSize: 12,
    color: mobileColors.sand[600],
    marginBottom: 6
  },
  roleBadgesRow: {
    flexDirection: "row",
    gap: 6
  },
  accountActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[100],
    paddingTop: 12
  },
  authButtonsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 12
  },
  cardSection: {
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
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 6
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  optionPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  optionPillActive: {
    backgroundColor: mobileColors.navy[900],
    borderColor: mobileColors.navy[900]
  },
  optionPillText: {
    fontSize: 12,
    color: mobileColors.sand[800],
    fontWeight: "600"
  },
  optionPillTextActive: {
    color: mobileColors.white
  },
  notifItem: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[100]
  },
  notifIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: mobileColors.sand[100],
    justifyContent: "center",
    alignItems: "center"
  },
  notifTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  notifBody: {
    fontSize: 11,
    color: mobileColors.sand[700],
    marginTop: 2
  },
  notifTime: {
    fontSize: 10,
    color: mobileColors.sand[500],
    marginTop: 4
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[100]
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  toggleSubtitle: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2
  },
  legalLinksRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 14
  },
  legalLink: {
    fontSize: 11,
    color: mobileColors.sand[600]
  }
});
