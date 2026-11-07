import React from "react";
import { Stack } from "expo-router";

export default function HostLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Host Operations Hub" }} />
      <Stack.Screen name="scanner" options={{ title: "QR / PIN Handover Scanner" }} />
    </Stack>
  );
}
