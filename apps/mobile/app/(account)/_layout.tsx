import React from "react";
import { Stack } from "expo-router";

export default function AccountLayout() {
  return (
    <Stack>
      <Stack.Screen name="profile" options={{ title: "My Profile" }} />
      <Stack.Screen name="security" options={{ title: "Security & Password" }} />
      <Stack.Screen name="sessions" options={{ title: "Active Devices & Sessions" }} />
    </Stack>
  );
}

