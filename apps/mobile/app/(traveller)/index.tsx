import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function TravellerHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Traveller Experience (Phase 1A)</Text>
      <Text style={styles.paragraph}>
        Foundation active: Expo Router navigation, TanStack Query, and contracts package wired.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", alignItems: "center" },
  heading: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  paragraph: { fontSize: 14, color: "#64748b", textAlign: "center" }
});
