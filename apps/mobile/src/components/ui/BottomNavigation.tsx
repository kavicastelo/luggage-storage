import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  mobileColors,
  mobileControlSizes,
  mobileRadius,
  mobileSpacing,
  mobileTextColors
} from "../../lib/theme";
import { MobileIcon, type MobileIconName } from "../MobileIcon";

export interface BottomNavItem {
  key: string;
  label: string;
  icon: MobileIconName;
  badgeCount?: number;
  testID?: string;
}

export interface BottomNavigationProps {
  items: readonly BottomNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  testID?: string;
}

export function BottomNavigation({
  items,
  activeKey,
  onSelect,
  testID
}: BottomNavigationProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, mobileSpacing[2])
        }
      ]}
      accessibilityRole="tablist"
    >
      {items.map((item) => {
        const isSelected = item.key === activeKey;
        const iconColor = isSelected ? mobileColors.terracotta[500] : mobileTextColors.muted;

        return (
          <TouchableOpacity
            key={item.key}
            testID={item.testID ?? `bottom-nav-${item.key}`}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(item.key)}
            activeOpacity={0.8}
            style={[styles.tabButton, isSelected ? styles.tabButtonActive : null]}
          >
            <View style={styles.iconContainer}>
              <MobileIcon name={item.icon} size="md" color={iconColor} />
              {typeof item.badgeCount === "number" && item.badgeCount > 0 ? (
                <View style={styles.badgeDot}>
                  <Text style={styles.badgeText}>
                    {item.badgeCount > 99 ? "99+" : String(item.badgeCount)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[styles.label, isSelected ? styles.labelActive : null]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: mobileColors.card,
    borderTopWidth: 1,
    borderTopColor: mobileColors.border,
    paddingTop: mobileSpacing[2],
    paddingHorizontal: mobileSpacing[2],
    minHeight: mobileControlSizes.tabBarMinHeight
  },
  tabButton: {
    flex: 1,
    minHeight: mobileControlSizes.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: mobileRadius.lg,
    paddingVertical: mobileSpacing[1],
    paddingHorizontal: mobileSpacing[1]
  },
  tabButtonActive: {
    backgroundColor: mobileColors.terracotta[50]
  },
  iconContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  badgeDot: {
    position: "absolute",
    top: -5,
    right: -11,
    minWidth: 16,
    height: 16,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.terracotta[500],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3
  },
  badgeText: {
    color: mobileColors.white,
    fontSize: 9,
    fontWeight: "700"
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: mobileTextColors.muted
  },
  labelActive: {
    color: mobileColors.terracotta[600],
    fontWeight: "700"
  }
});

