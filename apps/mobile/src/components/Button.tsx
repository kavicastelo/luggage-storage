import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp
} from "react-native";
import { mobileColors, mobileRadius } from "../lib/theme";

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
  leftIcon,
  rightIcon
}: ButtonProps) {
  const variantContainerStyle = {
    primary: styles.btnPrimary,
    secondary: styles.btnSecondary,
    outline: styles.btnOutline,
    ghost: styles.btnGhost,
    danger: styles.btnDanger
  }[variant];

  const variantTextStyle = {
    primary: styles.textPrimary,
    secondary: styles.textSecondary,
    outline: styles.textOutline,
    ghost: styles.textGhost,
    danger: styles.textDanger
  }[variant];

  const sizeContainerStyle = {
    sm: styles.sizeSm,
    md: styles.sizeMd,
    lg: styles.sizeLg
  }[size];

  const sizeTextStyle = {
    sm: styles.textSizeSm,
    md: styles.textSizeMd,
    lg: styles.textSizeLg
  }[size];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantContainerStyle,
        sizeContainerStyle,
        disabled && styles.disabledContainer,
        style
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "danger" ? mobileColors.white : mobileColors.navy[900]}
        />
      ) : (
        <>
          {leftIcon ? <>{leftIcon}</> : null}
          <Text
            style={[
              styles.baseText,
              variantTextStyle,
              sizeTextStyle,
              disabled && styles.disabledText,
              Boolean(leftIcon) && { marginLeft: 8 },
              Boolean(rightIcon) && { marginRight: 8 },
              textStyle
            ]}
          >
            {title}
          </Text>
          {rightIcon ? <>{rightIcon}</> : null}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: mobileRadius.lg,
    minHeight: 48, // Minimum 44pt touch target (48px)
    paddingHorizontal: 20
  },
  baseText: {
    fontWeight: "600",
    textAlign: "center"
  },
  btnPrimary: {
    backgroundColor: mobileColors.terracotta[500], // #C55013 (WCAG AA >= 4.5:1 with white)
    borderWidth: 0
  },
  textPrimary: {
    color: mobileColors.white
  },
  btnSecondary: {
    backgroundColor: mobileColors.navy[900], // #0A192F
    borderWidth: 0
  },
  textSecondary: {
    color: mobileColors.white
  },
  btnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: mobileColors.navy[900]
  },
  textOutline: {
    color: mobileColors.navy[900]
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 0
  },
  textGhost: {
    color: mobileColors.navy[900]
  },
  btnDanger: {
    backgroundColor: mobileColors.rose[600],
    borderWidth: 0
  },
  textDanger: {
    color: mobileColors.white
  },
  sizeSm: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  sizeMd: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 20
  },
  sizeLg: {
    minHeight: 54,
    paddingVertical: 16,
    paddingHorizontal: 28
  },
  textSizeSm: {
    fontSize: 13,
    lineHeight: 18
  },
  textSizeMd: {
    fontSize: 15,
    lineHeight: 20
  },
  textSizeLg: {
    fontSize: 16,
    lineHeight: 22
  },
  disabledContainer: {
    opacity: 0.5,
    backgroundColor: mobileColors.sand[200]
  },
  disabledText: {
    color: mobileColors.sand[600]
  }
});
