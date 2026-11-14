import React from "react";
import { TouchableOpacity, StyleSheet, type ViewStyle } from "react-native";
import {
  mobileColors,
  mobileControlSizes,
  mobileRadius
} from "../../lib/theme";
import {
  MobileIcon,
  type MobileIconName,
  type MobileIconSizeToken
} from "../MobileIcon";

export type IconButtonVariant = "default" | "subtle" | "primary" | "navy" | "ghost" | "danger";

export interface IconButtonProps {
  icon: MobileIconName;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  variant?: IconButtonVariant;
  iconSize?: number | MobileIconSizeToken;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  variant = "subtle",
  iconSize = "md",
  disabled = false,
  style,
  testID
}: IconButtonProps) {
  const variantConfig = {
    default: {
      container: styles.defaultContainer,
      iconColor: mobileColors.navy[900]
    },
    subtle: {
      container: styles.subtleContainer,
      iconColor: mobileColors.navy[900]
    },
    primary: {
      container: styles.primaryContainer,
      iconColor: mobileColors.white
    },
    navy: {
      container: styles.navyContainer,
      iconColor: mobileColors.white
    },
    ghost: {
      container: styles.ghostContainer,
      iconColor: mobileColors.navy[900]
    },
    danger: {
      container: styles.dangerContainer,
      iconColor: mobileColors.rose[700]
    }
  }[variant];

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      activeOpacity={0.78}
      style={[
        styles.base,
        variantConfig.container,
        disabled ? styles.disabled : null,
        style
      ]}
    >
      <MobileIcon name={icon} size={iconSize} color={variantConfig.iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: mobileControlSizes.iconButton,
    minHeight: mobileControlSizes.iconButton,
    borderRadius: mobileRadius.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  defaultContainer: {
    backgroundColor: mobileColors.card,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  subtleContainer: {
    backgroundColor: mobileColors.sand[100]
  },
  primaryContainer: {
    backgroundColor: mobileColors.terracotta[500]
  },
  navyContainer: {
    backgroundColor: mobileColors.navy[900]
  },
  ghostContainer: {
    backgroundColor: "transparent"
  },
  dangerContainer: {
    backgroundColor: mobileColors.rose[50],
    borderWidth: 1,
    borderColor: mobileColors.rose[100]
  },
  disabled: {
    opacity: 0.48
  }
});

