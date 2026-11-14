import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
  type TextStyle,
  type AccessibilityProps
} from "react-native";
import {
  mobileColors,
  mobileControlSizes,
  mobileRadius,
  mobileSpacing,
  mobileTextColors
} from "../lib/theme";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "ocean";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends AccessibilityProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  isLoading?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  isLoading = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
  testID,
  accessibilityLabel,
  accessibilityHint,
  ...a11yProps
}: ButtonProps) {
  const busy = Boolean(isLoading || loading);
  const isDisabled = disabled || busy;

  const variantContainerStyle: ViewStyle = {
    primary: styles.primaryContainer,
    secondary: styles.secondaryContainer,
    ocean: styles.oceanContainer,
    outline: styles.outlineContainer,
    ghost: styles.ghostContainer,
    danger: styles.dangerContainer
  }[variant];

  const variantTextStyle: TextStyle = {
    primary: styles.primaryText,
    secondary: styles.secondaryText,
    ocean: styles.oceanText,
    outline: styles.outlineText,
    ghost: styles.ghostText,
    danger: styles.dangerText
  }[variant];

  const sizeContainerStyle: ViewStyle = {
    sm: styles.sizeSm,
    md: styles.sizeMd,
    lg: styles.sizeLg
  }[size];

  const sizeTextStyle: TextStyle = {
    sm: styles.textSizeSm,
    md: styles.textSizeMd,
    lg: styles.textSizeLg
  }[size];

  const spinnerColor =
    variant === "outline" || variant === "ghost"
      ? mobileColors.navy[900]
      : mobileColors.white;

  return (
    <TouchableOpacity
      {...a11yProps}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy }}
      style={[
        styles.base,
        variantContainerStyle,
        sizeContainerStyle,
        fullWidth ? styles.fullWidth : null,
        isDisabled ? styles.disabled : null,
        style
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.82}
    >
      {busy ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
          <Text
            style={[styles.baseText, variantTextStyle, sizeTextStyle, textStyle]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: mobileRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row"
  },
  fullWidth: {
    width: "100%"
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  iconLeft: {
    marginRight: mobileSpacing[2]
  },
  iconRight: {
    marginLeft: mobileSpacing[2]
  },
  baseText: {
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.1
  },
  primaryContainer: {
    backgroundColor: mobileColors.ctaBg
  },
  primaryText: {
    color: mobileColors.ctaText
  },
  secondaryContainer: {
    backgroundColor: mobileColors.navy[900]
  },
  secondaryText: {
    color: mobileColors.white
  },
  oceanContainer: {
    backgroundColor: mobileColors.navy[800]
  },
  oceanText: {
    color: mobileColors.white
  },
  outlineContainer: {
    backgroundColor: mobileColors.card,
    borderWidth: 1.5,
    borderColor: mobileColors.navy[900]
  },
  outlineText: {
    color: mobileColors.navy[900]
  },
  ghostContainer: {
    backgroundColor: "transparent"
  },
  ghostText: {
    color: mobileTextColors.heading
  },
  dangerContainer: {
    backgroundColor: mobileColors.rose[600]
  },
  dangerText: {
    color: mobileColors.white
  },
  disabled: {
    opacity: 0.55
  },
  sizeSm: {
    minHeight: mobileControlSizes.buttonSm,
    paddingHorizontal: mobileSpacing[3],
    paddingVertical: mobileSpacing[2]
  },
  sizeMd: {
    minHeight: mobileControlSizes.buttonMd,
    paddingHorizontal: mobileSpacing[5],
    paddingVertical: mobileSpacing[3]
  },
  sizeLg: {
    minHeight: mobileControlSizes.buttonLg,
    paddingHorizontal: mobileSpacing[6],
    paddingVertical: mobileSpacing[4]
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
  }
});
