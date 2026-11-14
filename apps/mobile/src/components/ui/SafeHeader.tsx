import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  mobileColors,
  mobileControlSizes,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../lib/theme";
import { IconButton } from "./IconButton";

export interface SafeHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backAccessibilityLabel?: string;
  rightAction?: React.ReactNode;
  variant?: "light" | "navy";
  testID?: string;
}

export function SafeHeader({
  title,
  subtitle,
  onBack,
  backAccessibilityLabel = "Go back",
  rightAction,
  variant = "light",
  testID
}: SafeHeaderProps) {
  const insets = useSafeAreaInsets();
  const isNavy = variant === "navy";

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        isNavy ? styles.navyContainer : styles.lightContainer,
        { paddingTop: Math.max(insets.top, mobileSpacing[2]) }
      ]}
    >
      <View style={styles.bar}>
        <View style={styles.leftSlot}>
          {onBack ? (
            <IconButton
              icon="arrow-left"
              onPress={onBack}
              accessibilityLabel={backAccessibilityLabel}
              variant={isNavy ? "navy" : "subtle"}
              testID={testID ? `${testID}-back` : "safe-header-back"}
            />
          ) : null}
        </View>
        <View style={styles.titleWrap}>
          <Text
            style={[styles.title, isNavy ? styles.navyTitle : null]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, isNavy ? styles.navySubtitle : null]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.rightSlot}>{rightAction ?? null}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingHorizontal: mobileSpacing[4],
    paddingBottom: mobileSpacing[2]
  },
  lightContainer: {
    backgroundColor: mobileColors.card,
    borderBottomColor: mobileColors.border
  },
  navyContainer: {
    backgroundColor: mobileColors.navy[900],
    borderBottomColor: mobileColors.navy[800]
  },
  bar: {
    minHeight: mobileControlSizes.headerBarHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing[2]
  },
  leftSlot: {
    minWidth: mobileControlSizes.iconButton,
    alignItems: "flex-start",
    justifyContent: "center"
  },
  titleWrap: {
    flex: 1,
    justifyContent: "center"
  },
  title: {
    ...mobileTypography.headingMd
  },
  navyTitle: {
    color: mobileColors.white
  },
  subtitle: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.muted,
    marginTop: 2
  },
  navySubtitle: {
    color: mobileColors.sand[200]
  },
  rightSlot: {
    minWidth: mobileControlSizes.iconButton,
    alignItems: "flex-end",
    justifyContent: "center"
  }
});

