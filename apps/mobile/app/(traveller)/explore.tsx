import React from "react";
import { useLocalSearchParams } from "expo-router";
import { DiscoveryView } from "../../src/components/DiscoveryView";

export default function TravellerExploreScreen() {
  const params = useLocalSearchParams<{ city?: string; q?: string }>();
  return (
    <DiscoveryView
      headerTitle="Explore Hubs"
      initialCity={params.city}
      initialSearchTerm={params.q}
    />
  );
}
