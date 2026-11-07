import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function HostScannerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Handover QR Scanner</Text>
      <Text style={styles.paragraph}>Camera scanning & PIN entry placeholder for Phase 1B.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", alignItems: "center" },
  heading: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  paragraph: { fontSize: 14, color: "#64748b", textAlign: "center" }
});
