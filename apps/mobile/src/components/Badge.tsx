import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileStatusTokens } from "../lib/theme";
import { MobileIcon, type MobileIconName } from "./MobileIcon";

export type BadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "terracotta"
  | "info"
  | "navy"
  | "danger";

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  icon?: MobileIconName;
  style?: ViewStyle;
  testID?: string;
}

export function Badge({
  label,
  variant = "neutral",
  size = "md",
  icon,
  style,
  testID
}: BadgeProps) {
  const variantStyles = {
    neutral: {
      container: styles.neutralContainer,
      text: styles.neutralText,
      iconColor: mobileStatusTokens.neutralIcon
    },
    success: {
      container: styles.successContainer,
      text: styles.successText,
      iconColor: mobileStatusTokens.successIcon
    },
    warning: {
      container: styles.warningContainer,
      text: styles.warningText,
      iconColor: mobileStatusTokens.warningIcon
    },
    terracotta: {
      container: styles.terracottaContainer,
      text: styles.terracottaText,
      iconColor: mobileColors.terracotta[600]
    },
    info: {
      container: styles.infoContainer,
      text: styles.infoText,
      iconColor: mobileStatusTokens.infoIcon
    },
    navy: {
      container: styles.navyContainer,
      text: styles.navyText,
      iconColor: mobileColors.navy[900]
    },
    danger: {
      container: styles.dangerContainer,
      text: styles.dangerText,
      iconColor: mobileStatusTokens.dangerIcon
    }
  }[variant];

  const sizeStyles = {
    sm: { container: styles.sizeSm, text: styles.textSizeSm, iconSize: 11 },
    md: { container: styles.sizeMd, text: styles.textSizeMd, iconSize: 13 }
  }[size];

  return (
    <View
      testID={testID}
      style={[styles.base, variantStyles.container, sizeStyles.container, style]}
      accessible
      accessibilityLabel={label}
    >
      {icon ? (
        <View style={styles.iconWrap}>
          <MobileIcon name={icon} size={sizeStyles.iconSize} color={variantStyles.iconColor} />
        </View>
      ) : null}
      <Text style={[styles.baseText, variantStyles.text, sizeStyles.text]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: mobileRadius.full,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1
  },
  iconWrap: {
    marginRight: mobileSpacing[1]
  },
  baseText: {
    fontWeight: "700",
    letterSpacing: 0.2
  },
  sizeSm: {
    paddingHorizontal: mobileSpacing[2],
    paddingVertical: 3
  },
  sizeMd: {
    paddingHorizontal: mobileSpacing[3],
    paddingVertical: 5
  },
  textSizeSm: {
    fontSize: 11,
    lineHeight: 14
  },
  textSizeMd: {
    fontSize: 12,
    lineHeight: 16
  },
  neutralContainer: {
    backgroundColor: mobileStatusTokens.neutralBg,
    borderColor: mobileStatusTokens.neutralBorder
  },
  neutralText: {
    color: mobileStatusTokens.neutral
  },
  successContainer: {
    backgroundColor: mobileStatusTokens.successBg,
    borderColor: mobileStatusTokens.successBorder
  },
  successText: {
    color: mobileStatusTokens.success
  },
  warningContainer: {
    backgroundColor: mobileStatusTokens.warningBg,
    borderColor: mobileStatusTokens.warningBorder
  },
  warningText: {
    color: mobileStatusTokens.warning
  },
  terracottaContainer: {
    backgroundColor: mobileColors.terracotta[50],
    borderColor: mobileColors.terracotta[200]
  },
  terracottaText: {
    color: mobileColors.terracotta[600]
  },
  infoContainer: {
    backgroundColor: mobileStatusTokens.infoBg,
    borderColor: mobileStatusTokens.infoBorder
  },
  infoText: {
    color: mobileStatusTokens.info
  },
  navyContainer: {
    backgroundColor: mobileColors.navy[50],
    borderColor: mobileColors.navy[100]
  },
  navyText: {
    color: mobileColors.navy[900]
  },
  dangerContainer: {
    backgroundColor: mobileStatusTokens.dangerBg,
    borderColor: mobileStatusTokens.dangerBorder
  },
  dangerText: {
    color: mobileStatusTokens.danger
  }
});
