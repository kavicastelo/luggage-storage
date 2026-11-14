import React from "react";
import { View, StyleSheet } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import {
  BottomNavigation,
  SafeHeader,
  type BottomNavItem
} from "../../src/components";
import { mobileColors } from "../../src/lib/theme";

const ACCOUNT_TABS: readonly BottomNavItem[] = [
  { key: "profile", label: "Profile", icon: "user" },
  { key: "security", label: "Security", icon: "lock" },
  { key: "sessions", label: "Devices", icon: "smartphone" }
];

export default function AccountLayout() {
  const router = useRouter();
  const pathname = usePathname();

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
      <BottomNavigation
        items={ACCOUNT_TABS}
        activeKey={activeKey}
        onSelect={handleSelect}
      />
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
  }
});
