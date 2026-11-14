import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import { getMobileMascotMeta, MascotKey } from "../lib/mascots";
import { mobileColors, mobileRadius, mobileSpacing, mobileTextColors } from "../lib/theme";

export interface MobileMascotIllustrationProps {
  mascot: MascotKey;
  size?: "sm" | "md" | "lg";
  badgeText?: string;
  caption?: string;
}

const DIMENSIONS: Record<NonNullable<MobileMascotIllustrationProps["size"]>, number> = {
  sm: 64,
  md: 96,
  lg: 132
};

export function MascotIllustration({
  mascot,
  size = "md",
  badgeText,
  caption
}: MobileMascotIllustrationProps) {
  const meta = getMobileMascotMeta(mascot);
  const px = DIMENSIONS[size];

  return (
    <View style={styles.container} accessibilityRole="image" accessibilityLabel={meta.alt}>
      {badgeText ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      ) : null}
      <Image
        source={meta.source}
        style={{ width: px, height: px }}
        resizeMode="contain"
        accessibilityLabel={meta.alt}
      />
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: mobileColors.canvas,
    borderWidth: 1,
    borderColor: mobileColors.amber[100],
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing[3],
    marginVertical: mobileSpacing[2]
  },
  badge: {
    backgroundColor: mobileColors.amber[100],
    paddingHorizontal: mobileSpacing[3],
    paddingVertical: 3,
    borderRadius: mobileRadius.full,
    marginBottom: mobileSpacing[2]
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: mobileColors.amber[700],
    textTransform: "uppercase"
  },
  caption: {
    marginTop: mobileSpacing[2],
    fontSize: 12,
    color: mobileTextColors.secondary,
    textAlign: "center",
    lineHeight: 17
  }
});
