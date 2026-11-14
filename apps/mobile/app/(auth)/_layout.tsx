import React from "react";
import { Stack } from "expo-router";
import { mobileColors } from "../../src/lib/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: mobileColors.canvas }
      }}
    />
  );
}
