import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import {
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTypography
} from "../../lib/theme";
import { Card } from "../Card";

export interface FormSectionProps {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  errorText?: string | null;
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function FormSection({
  title,
  subtitle,
  rightSlot,
  errorText,
  children,
  style,
  testID
}: FormSectionProps) {
  return (
    <Card variant="default" style={style} testID={testID}>
      <View style={styles.header}>
        <View style={styles.titleCol}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {rightSlot ?? null}
      </View>

      {errorText ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : null}

      <View style={styles.content}>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: mobileSpacing[2],
    marginBottom: mobileSpacing[3]
  },
  titleCol: {
    flex: 1,
    gap: 2
  },
  title: {
    ...mobileTypography.headingSm
  },
  subtitle: {
    ...mobileTypography.bodySm
  },
  errorBanner: {
    backgroundColor: mobileStatusTokens.dangerBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.dangerBorder,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing[3],
    marginBottom: mobileSpacing[3]
  },
  errorText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.danger,
    fontWeight: "600"
  },
  content: {
    gap: mobileSpacing[2]
  }
});
