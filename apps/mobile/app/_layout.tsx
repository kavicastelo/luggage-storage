import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "../src/store/useAuthStore";
import { mobileColors } from "../src/lib/theme";
import { mobileQueryClient } from "../src/lib/query-client";

export default function RootLayout() {
  const { isInitializing, initAuth } = useAuthStore();

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={mobileQueryClient}>
        <StatusBar style="dark" />
        {isInitializing ? (
          <View style={styles.bootContainer} accessibilityLabel="Initializing application">
            <ActivityIndicator size="large" color={mobileColors.terracotta[500]} />
          </View>
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: mobileColors.canvas }
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(account)" />
            <Stack.Screen name="(traveller)" />
            <Stack.Screen name="(host)" />
            <Stack.Screen name="(dev)" />
            <Stack.Screen name="booking/confirm" />
          </Stack>
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: mobileColors.canvas
  }
});
