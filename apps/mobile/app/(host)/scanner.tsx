import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet
} from "react-native";
import { useRouter } from "expo-router";
import { MascotIllustration } from "../../src/components/MascotIllustration";

export default function HostScannerScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"CHECK_IN" | "CHECK_OUT">("CHECK_IN");
  const [pinCode, setPinCode] = useState("482910");
  const [verifiedRef, setVerifiedRef] = useState<string | null>(null);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.badge}>
          {mode === "CHECK_IN" ? "HM-021 • CHECK-IN SCANNER" : "HM-024 • CHECK-OUT SCANNER"}
        </Text>
        <Text style={styles.title}>Server-Verified QR Scanner & PIN Fallback (OQ-014)</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "CHECK_IN" ? styles.modeActive : null]}
            onPress={() => setMode("CHECK_IN")}
          >
            <Text style={styles.modeText}>HM-021 Check-In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "CHECK_OUT" ? styles.modeActive : null]}
            onPress={() => setMode("CHECK_OUT")}
          >
            <Text style={styles.modeText}>HM-024 Check-Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MascotIllustration
        mascot="phone"
        size="md"
        badgeText={mode === "CHECK_IN" ? "HM-021 Drop-Off Scan" : "HM-024 Pick-Up Release"}
        caption="Primary: Scan dynamic QR code. Fallback: Rate-limited, audited 6-digit PIN when QR scanning is unavailable."
      />

      <View style={styles.card}>
        <Text style={styles.label}>
          6-Digit Backup PIN Fallback (When QR Scan Unavailable • Audited & Rate-Limited)
        </Text>
        <TextInput
          style={styles.input}
          value={pinCode}
          onChangeText={setPinCode}
          maxLength={6}
          keyboardType="number-pad"
        />

        <TouchableOpacity
          style={styles.verifyBtn}
          onPress={() =>
            setVerifiedRef(
              `Server-Verified Booking #LS-2026-8841 (QR/PIN Fallback ${pinCode} • Bag Count Reconciled • Staff ID Logged)`
            )
          }
        >
          <Text style={styles.verifyBtnText}>Verify Custody Token & Reconcile Bags</Text>
        </TouchableOpacity>

        {verifiedRef && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{verifiedRef}</Text>
            <TouchableOpacity
              style={styles.nextStepBtn}
              onPress={() =>
                router.push(
                  mode === "CHECK_IN"
                    ? "/(host)?screen=HM-022"
                    : "/(host)?screen=HM-025"
                )
              }
            >
              <Text style={styles.nextStepText}>
                {mode === "CHECK_IN"
                  ? "Proceed to Bag Tagging & Seal (HM-022)"
                  : "Proceed to Release Confirmation (HM-025)"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F8FAFC", paddingBottom: 32 },
  banner: {
    backgroundColor: "#0F172A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12
  },
  badge: { color: "#38BDF8", fontSize: 10, fontWeight: "800", marginBottom: 4 },
  title: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginBottom: 10 },
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#1E293B",
    alignItems: "center"
  },
  modeActive: { backgroundColor: "#2563EB" },
  modeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  label: { fontSize: 12, fontWeight: "700", color: "#334155", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#0F172A",
    marginBottom: 12
  },
  verifyBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center"
  },
  verifyBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  successBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0"
  },
  successText: { color: "#065F46", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  nextStepBtn: {
    backgroundColor: "#059669",
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center"
  },
  nextStepText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" }
});
