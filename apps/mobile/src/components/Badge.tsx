import React from "react";
import { View, Text, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { mobileColors, mobileRadius } from "../lib/theme";

interface BadgeProps {
  label: string;
  variant?: "neutral" | "success" | "warning" | "terracotta" | "info" | "navy";
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
}

export function Badge({
  label,
  variant = "neutral",
  size = "md",
  style,
  icon
}: BadgeProps) {
  const variantStyles = {
    neutral: { container: styles.containerNeutral, text: styles.textNeutral },
    success: { container: styles.containerSuccess, text: styles.textSuccess },
    warning: { container: styles.containerWarning, text: styles.textWarning },
    terracotta: { container: styles.containerTerracotta, text: styles.textTerracotta },
    info: { container: styles.containerInfo, text: styles.textInfo },
    navy: { container: styles.containerNavy, text: styles.textNavy }
  }[variant];

  const sizeStyles = {
    sm: { container: styles.sizeSm, text: styles.textSizeSm },
    md: { container: styles.sizeMd, text: styles.textSizeMd }
  }[size];

  return (
    <View style={[styles.base, variantStyles.container, sizeStyles.container, style]}>
      {icon ? <View style={{ marginRight: 4 }}>{icon}</View> : null}
      <Text style={[styles.baseText, variantStyles.text, sizeStyles.text]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: mobileRadius.full,
    alignSelf: "flex-start"
  },
  baseText: {
    fontWeight: "700"
  },
  sizeSm: {
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  sizeMd: {
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  textSizeSm: {
    fontSize: 10,
    lineHeight: 14
  },
  textSizeMd: {
    fontSize: 12,
    lineHeight: 16
  },
  containerNeutral: {
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  textNeutral: {
    color: mobileColors.sand[700]
  },
  containerSuccess: {
    backgroundColor: mobileColors.emerald[50],
    borderWidth: 1,
    borderColor: mobileColors.emerald[100]
  },
  textSuccess: {
    color: mobileColors.emerald[700]
  },
  containerWarning: {
    backgroundColor: mobileColors.amber[50],
    borderWidth: 1,
    borderColor: mobileColors.amber[100]
  },
  textWarning: {
    color: mobileColors.amber[700]
  },
  containerTerracotta: {
    backgroundColor: mobileColors.terracotta[50],
    borderWidth: 1,
    borderColor: mobileColors.terracotta[100]
  },
  textTerracotta: {
    color: mobileColors.terracotta[600]
  },
  containerInfo: {
    backgroundColor: mobileColors.sky[50],
    borderWidth: 1,
    borderColor: mobileColors.sky[100]
  },
  textInfo: {
    color: mobileColors.sky[700]
  },
  containerNavy: {
    backgroundColor: mobileColors.navy[50],
    borderWidth: 1,
    borderColor: mobileColors.navy[100]
  },
  textNavy: {
    color: mobileColors.navy[900]
  }
});
