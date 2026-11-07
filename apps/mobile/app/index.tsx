import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useMobileStore } from "../src/store/useMobileStore";

export default function RoleSelectScreen() {
  const router = useRouter();
  const { setRole } = useMobileStore();

  const handleSelectTraveller = () => {
    setRole("traveller");
    router.replace("/(traveller)");
  };

  const handleSelectHost = () => {
    setRole("host");
    router.replace("/(host)");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Luggage Storage</Text>
      <Text style={styles.subtitle}>Select your mobile application experience:</Text>

      <TouchableOpacity style={styles.button} onPress={handleSelectTraveller}>
        <Text style={styles.buttonText}>Continue as Traveller</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.hostButton]} onPress={handleSelectHost}>
        <Text style={styles.buttonText}>Continue as Host Partner</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8fafc"
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 32,
    textAlign: "center"
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    marginBottom: 16
  },
  hostButton: {
    backgroundColor: "#0f172a"
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600"
  }
});
