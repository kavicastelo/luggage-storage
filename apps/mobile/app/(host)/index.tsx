import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function HostDashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Host Partner Operations (Phase 1A)</Text>
      <Text style={styles.paragraph}>
        Foundation active: Scoped host navigation, check-in scanner route, and state isolation.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", alignItems: "center" },
  heading: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  paragraph: { fontSize: 14, color: "#64748b", textAlign: "center" }
});
