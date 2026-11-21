import React from "react";
import { Stack } from "expo-router";
import { mobileColors } from "../../src/lib/theme";

export default function TravellerStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: mobileColors.canvas }
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="explore" />
      <Stack.Screen name="location" />
      <Stack.Screen name="locations/[id]" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="pass" />
      <Stack.Screen name="navigation" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
