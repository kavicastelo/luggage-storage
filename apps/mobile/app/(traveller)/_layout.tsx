import React from "react";
import { Stack } from "expo-router";

export default function TravellerLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Explore Luggage Storage" }} />
      <Stack.Screen name="explore" options={{ title: "Search Locations" }} />
    </Stack>
  );
}
