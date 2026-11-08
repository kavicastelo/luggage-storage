import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import { getMobileMascotMeta, MascotKey } from "../lib/mascots";

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
    backgroundColor: "#FFFBF5",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 16,
    padding: 14,
    marginVertical: 8
  },
  badge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400E",
    textTransform: "uppercase"
  },
  caption: {
    marginTop: 6,
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
    lineHeight: 17
  }
});

