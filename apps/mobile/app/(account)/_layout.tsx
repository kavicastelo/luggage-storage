import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MobileIcon,
  SafeHeader,
  type BottomNavItem
} from "../../src/components";
import { mobileColors, mobileControlSizes, mobileSpacing } from "../../src/lib/theme";

const ACCOUNT_TABS: readonly BottomNavItem[] = [
  { key: "profile", label: "Profile", icon: "user" },
  { key: "security", label: "Security", icon: "lock" },
  { key: "sessions", label: "Devices", icon: "smartphone" }
];

export default function AccountLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const activeKey = pathname.includes("/security")
    ? "security"
    : pathname.includes("/sessions")
      ? "sessions"
      : "profile";

  const handleSelect = (key: string) => {
    if (key === "security") router.replace("/(account)/security");
    else if (key === "sessions") router.replace("/(account)/sessions");
    else router.replace("/(account)/profile");
  };

  return (
    <View style={styles.root}>
      <SafeHeader
        title="Account & Security"
        subtitle="Identity, password & active sessions"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      />
      <View style={styles.content}>
        <Slot />
      </View>
      <View
        style={[
          styles.tabBar,
          {
            height: 60 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8)
          }
        ]}
        accessibilityRole="tablist"
      >
        {ACCOUNT_TABS.map((tab) => {
          const isSelected = tab.key === activeKey;
          const color = isSelected ? mobileColors.terracotta[500] : mobileColors.sand[400];
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => handleSelect(tab.key)}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isSelected }}
            >
              <MobileIcon name={tab.icon} size={20} color={color} />
              <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  content: {
    flex: 1
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: mobileColors.navy[900],
    borderTopWidth: 1,
    borderTopColor: mobileColors.navy[800],
    paddingTop: 6,
    paddingHorizontal: mobileSpacing[2]
  },
  tabItem: {
    flex: 1,
    minHeight: mobileControlSizes.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    gap: 3
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600"
  }
});
