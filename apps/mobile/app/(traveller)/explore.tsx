import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { MascotIllustration } from "../../src/components/MascotIllustration";

const MOBILE_HUBS = [
  {
    id: "loc-cmb-fort-01",
    city: "Colombo Fort",
    name: "Colombo Fort Station Heritage Vault",
    rate: "LKR 250/hr • Cap LKR 1,450",
    coords: "6.9344° N, 79.8501° E",
    slots: "52 / 80 Open"
  },
  {
    id: "loc-ella-02",
    city: "Ella",
    name: "Ella Railway & Nine Arch Trail Hub",
    rate: "LKR 220/hr • Cap LKR 1,300",
    coords: "6.8756° N, 81.0463° E",
    slots: "19 / 45 Open"
  },
  {
    id: "loc-kandy-03",
    city: "Kandy",
    name: "Kandy Lake & Temple Quarter Concierge",
    rate: "LKR 240/hr • Cap LKR 1,400",
    coords: "7.2936° N, 80.6413° E",
    slots: "41 / 60 Open"
  },
  {
    id: "loc-galle-04",
    city: "Galle Fort",
    name: "Galle Fort Dutch Hospital Safe Keep",
    rate: "LKR 260/hr • Cap LKR 1,500",
    coords: "6.0269° N, 80.2170° E",
    slots: "33 / 50 Open"
  }
];

export default function TravellerExploreScreen() {
  const router = useRouter();
  const [selectedHub, setSelectedHub] = useState(MOBILE_HUBS[0]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.badge}>TM-012 • GEOSPATIAL MAP DISCOVERY (WF-007)</Text>
        <Text style={styles.title}>Sri Lanka Storage Hub Map</Text>
        <Text style={styles.subtitle}>
          Select a transit pin to inspect live rack capacity and book in LKR.
        </Text>
      </View>

      <MascotIllustration
        mascot="map"
        size="md"
        badgeText="TM-012 MapLibre Pin Explorer"
        caption={`Selected Pin: ${selectedHub.name} (${selectedHub.coords})`}
      />

      <View style={styles.list}>
        {MOBILE_HUBS.map((hub) => {
          const active = hub.id === selectedHub.id;
          return (
            <TouchableOpacity
              key={hub.id}
              style={[styles.card, active ? styles.cardActive : null]}
              onPress={() => setSelectedHub(hub)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cityTag}>{hub.city}</Text>
                <Text style={styles.slotsTag}>{hub.slots}</Text>
              </View>
              <Text style={styles.hubName}>{hub.name}</Text>
              <Text style={styles.rateText}>{hub.rate}</Text>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.outlineBtn}
                  onPress={() => router.push("/(traveller)?screen=TM-015")}
                >
                  <Text style={styles.outlineBtnText}>Details (TM-015)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.fillBtn}
                  onPress={() => router.push("/(traveller)?screen=TM-018")}
                >
                  <Text style={styles.fillBtnText}>Book Bags (TM-018)</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
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
  badge: { color: "#FBBF24", fontSize: 10, fontWeight: "800", marginBottom: 4 },
  title: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  subtitle: { color: "#CBD5E1", fontSize: 12, marginTop: 4 },
  list: { gap: 10, marginTop: 8 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  cardActive: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  cityTag: { fontSize: 11, fontWeight: "800", color: "#2563EB" },
  slotsTag: { fontSize: 11, fontWeight: "700", color: "#059669" },
  hubName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  rateText: { fontSize: 12, color: "#475569", marginTop: 2, marginBottom: 10 },
  actionsRow: { flexDirection: "row", gap: 8 },
  outlineBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    backgroundColor: "#FFFFFF"
  },
  outlineBtnText: { fontSize: 11, fontWeight: "700", color: "#1E293B" },
  fillBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2563EB",
    alignItems: "center"
  },
  fillBtnText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" }
});
