import React from "react";
import { Redirect, Stack } from "expo-router";
import { mobileColors } from "../../src/lib/theme";

export default function DevRoutesLayout() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: mobileColors.canvas }
      }}
    />
  );
}

