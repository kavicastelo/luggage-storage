import React from "react";
import { TouchableOpacity, View, Text, StyleSheet, type ViewStyle } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../lib/theme";
import { MobileIcon, type MobileIconName } from "../MobileIcon";

export interface SelectionCardProps {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  icon?: MobileIconName;
  trailingText?: string;
  role?: "radio" | "checkbox";
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function SelectionCard({
  title,
  subtitle,
  selected,
  onPress,
  icon,
  trailingText,
  role = "radio",
  disabled = false,
  style,
  testID
}: SelectionCardProps) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole={role}
      accessibilityState={
        role === "checkbox"
          ? { checked: selected, disabled }
          : { selected, disabled }
      }
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.82}
      style={[
        styles.card,
        selected ? styles.cardSelected : styles.cardUnselected,
        disabled ? styles.disabled : null,
        style
      ]}
    >
      {icon ? (
        <View style={[styles.iconBox, selected ? styles.iconBoxSelected : null]}>
          <MobileIcon
            name={icon}
            size="md"
            color={selected ? mobileColors.terracotta[600] : mobileColors.navy[900]}
          />
        </View>
      ) : null}

      <View style={styles.textWrap}>
        <Text style={[styles.title, selected ? styles.titleSelected : null]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {trailingText ? <Text style={styles.trailingText}>{trailingText}</Text> : null}

      <View style={[styles.indicator, selected ? styles.indicatorSelected : null]}>
        {selected ? <MobileIcon name="check" size="xs" color={mobileColors.white} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing[3],
    borderWidth: 1.5,
    gap: mobileSpacing[3]
  },
  cardUnselected: {
    backgroundColor: mobileColors.card,
    borderColor: mobileColors.border
  },
  cardSelected: {
    backgroundColor: mobileColors.terracotta[50],
    borderColor: mobileColors.terracotta[500]
  },
  disabled: {
    opacity: 0.5
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: mobileRadius.lg,
    backgroundColor: mobileColors.sand[100],
    alignItems: "center",
    justifyContent: "center"
  },
  iconBoxSelected: {
    backgroundColor: mobileColors.terracotta[100]
  },
  textWrap: {
    flex: 1
  },
  title: {
    ...mobileTypography.headingSm
  },
  titleSelected: {
    color: mobileColors.terracotta[700]
  },
  subtitle: {
    ...mobileTypography.bodySm,
    marginTop: 2
  },
  trailingText: {
    ...mobileTypography.label,
    color: mobileTextColors.heading
  },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: mobileRadius.full,
    borderWidth: 2,
    borderColor: mobileColors.sand[400],
    alignItems: "center",
    justifyContent: "center"
  },
  indicatorSelected: {
    backgroundColor: mobileColors.terracotta[500],
    borderColor: mobileColors.terracotta[500]
  }
});

