import React from "react";
import { View, TouchableOpacity, StyleSheet, type ViewStyle } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing, mobileShadows } from "../lib/theme";

export type CardVariant = "default" | "elevated" | "outlined" | "accent" | "navy";

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export function Card({
  children,
  variant = "default",
  style,
  onPress,
  accessibilityLabel,
  testID
}: CardProps) {
  const variantStyles: ViewStyle = {
    default: styles.variantDefault,
    elevated: styles.variantElevated,
    outlined: styles.variantOutlined,
    accent: styles.variantAccent,
    navy: styles.variantNavy
  }[variant];

  if (onPress) {
    return (
      <TouchableOpacity
        testID={testID}
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[styles.base, variantStyles, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View testID={testID} style={[styles.base, variantStyles, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing[4]
  },
  variantDefault: {
    backgroundColor: mobileColors.card,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  variantElevated: {
    backgroundColor: mobileColors.card,
    borderWidth: 1,
    borderColor: mobileColors.border,
    ...mobileShadows.sm
  },
  variantOutlined: {
    backgroundColor: mobileColors.canvas,
    borderWidth: 1.5,
    borderColor: mobileColors.border
  },
  variantAccent: {
    backgroundColor: mobileColors.terracotta[50],
    borderWidth: 1,
    borderColor: mobileColors.terracotta[200]
  },
  variantNavy: {
    backgroundColor: mobileColors.navy[900],
    borderWidth: 1,
    borderColor: mobileColors.navy[800]
  }
});
