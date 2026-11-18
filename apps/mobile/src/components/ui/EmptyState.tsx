import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../lib/theme";
import type { MascotKey } from "../../lib/mascots";
import { MascotIllustration } from "../MascotIllustration";
import { MobileIcon, type MobileIconName } from "../MobileIcon";
import { Button } from "../Button";
import { Card } from "../Card";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: MobileIconName;
  mascot?: MascotKey;
  actionTitle?: string;
  onAction?: () => void;
  testID?: string;
}

export function EmptyState({
  title,
  description,
  icon = "inbox",
  mascot,
  actionTitle,
  onAction,
  testID
}: EmptyStateProps) {
  return (
    <Card variant="outlined" style={styles.container} testID={testID}>
      {mascot ? (
        <MascotIllustration mascot={mascot} size="md" variant="bare" decorative />
      ) : (
        <View style={styles.iconCircle}>
          <MobileIcon name={icon} size="xl" color={mobileColors.navy[700]} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} size="md" style={styles.cta} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: mobileSpacing[6],
    paddingHorizontal: mobileSpacing[5],
    gap: mobileSpacing[2]
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: mobileSpacing[2]
  },
  title: {
    ...mobileTypography.headingMd,
    textAlign: "center"
  },
  description: {
    ...mobileTypography.bodyMd,
    textAlign: "center",
    color: mobileTextColors.muted
  },
  cta: {
    marginTop: mobileSpacing[3]
  }
});

