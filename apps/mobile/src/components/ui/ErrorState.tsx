import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTypography
} from "../../lib/theme";
import { MobileIcon } from "../MobileIcon";
import { Button } from "../Button";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  testID?: string;
}

export function ErrorState({
  title = "Unable to complete request",
  message,
  onRetry,
  retryLabel = "Try Again",
  testID
}: ErrorStateProps) {
  return (
    <View style={styles.container} accessibilityRole="alert" testID={testID ?? "error-state"}>
      <View style={styles.iconCircle}>
        <MobileIcon name="alert-triangle" size="lg" color={mobileStatusTokens.dangerIcon} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button
          title={retryLabel}
          onPress={onRetry}
          variant="outline"
          size="sm"
          leftIcon={<MobileIcon name="refresh" size="sm" />}
          style={styles.retryBtn}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: mobileStatusTokens.dangerBg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.dangerBorder,
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing[5],
    alignItems: "center",
    gap: mobileSpacing[2]
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: mobileRadius.full,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    ...mobileTypography.headingSm,
    color: mobileStatusTokens.danger,
    textAlign: "center"
  },
  message: {
    ...mobileTypography.bodyMd,
    color: mobileStatusTokens.danger,
    textAlign: "center"
  },
  retryBtn: {
    marginTop: mobileSpacing[2]
  }
});

