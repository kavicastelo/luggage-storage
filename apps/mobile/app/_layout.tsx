import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "../src/store/useAuthStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

function RootNavigation() {
  const { initAuth, isInitializing } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Initializing secure session...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(account)" options={{ headerShown: false }} />
      <Stack.Screen name="(traveller)" options={{ headerShown: false }} />
      <Stack.Screen name="(host)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <RootNavigation />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc"
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500"
  }
});
