import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from "react-native";
import { mobileColors, mobileRadius, mobileShadows } from "../lib/theme";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "elevated" | "outlined" | "accent";
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function Card({
  children,
  style,
  variant = "default",
  onPress,
  accessibilityLabel
}: CardProps) {
  const variantStyles = {
    default: styles.variantDefault,
    elevated: styles.variantElevated,
    outlined: styles.variantOutlined,
    accent: styles.variantAccent
  }[variant];

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.base, variantStyles, style]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.base, variantStyles, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: mobileColors.white,
    borderRadius: mobileRadius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  variantDefault: {
    backgroundColor: mobileColors.white,
    borderColor: mobileColors.sand[200],
    ...mobileShadows.sm
  },
  variantElevated: {
    backgroundColor: mobileColors.white,
    borderColor: mobileColors.sand[200],
    ...mobileShadows.md
  },
  variantOutlined: {
    backgroundColor: mobileColors.sand[50],
    borderColor: mobileColors.sand[300]
  },
  variantAccent: {
    backgroundColor: mobileColors.terracotta[50],
    borderColor: mobileColors.terracotta[200]
  }
});
