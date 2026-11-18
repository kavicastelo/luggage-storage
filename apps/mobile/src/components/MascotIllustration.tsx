import React from "react";
import { View, Image, Text, StyleSheet, type ViewStyle } from "react-native";
import { getMobileMascotMeta, MascotKey } from "../lib/mascots";
import { mobileColors, mobileRadius, mobileSpacing, mobileTextColors } from "../lib/theme";

export interface MobileMascotIllustrationProps {
  mascot: MascotKey;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "bare" | "card" | "hero";
  badgeText?: string;
  caption?: string;
  decorative?: boolean;
  style?: ViewStyle;
}

const DIMENSIONS: Record<NonNullable<MobileMascotIllustrationProps["size"]>, number> = {
  xs: 48,
  sm: 72,
  md: 104,
  lg: 140,
  xl: 176
};

export function MascotIllustration({
  mascot,
  size = "md",
  variant = "bare",
  badgeText,
  caption,
  decorative = false,
  style
}: MobileMascotIllustrationProps) {
  const meta = getMobileMascotMeta(mascot);
  const px = DIMENSIONS[size];
  const isHero = variant === "hero";
  const isCard = variant === "card";

  return (
    <View
      style={[
        styles.base,
        isCard ? styles.cardContainer : null,
        isHero ? styles.heroContainer : null,
        style
      ]}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : "image"}
      accessibilityLabel={decorative ? undefined : meta.alt}
    >
      {badgeText ? (
        <View style={[styles.badge, isHero ? styles.heroBadge : null]}>
          <Text style={[styles.badgeText, isHero ? styles.heroBadgeText : null]}>{badgeText}</Text>
        </View>
      ) : null}
      <Image
        source={meta.source}
        style={{ width: px, height: px }}
        resizeMode="contain"
        accessible={!decorative}
        accessibilityLabel={decorative ? undefined : meta.alt}
      />
      {caption ? (
        <Text style={[styles.caption, isHero ? styles.heroCaption : null]}>{caption}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center"
  },
  cardContainer: {
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing[3],
    marginVertical: mobileSpacing[2]
  },
  heroContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing[3]
  },
  badge: {
    backgroundColor: mobileColors.terracotta[100],
    paddingHorizontal: mobileSpacing[3],
    paddingVertical: 3,
    borderRadius: mobileRadius.full,
    marginBottom: mobileSpacing[2]
  },
  heroBadge: {
    backgroundColor: "rgba(232, 111, 44, 0.22)"
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: mobileColors.terracotta[700],
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  heroBadgeText: {
    color: mobileColors.terracotta[200]
  },
  caption: {
    marginTop: mobileSpacing[2],
    fontSize: 12,
    color: mobileTextColors.secondary,
    textAlign: "center",
    lineHeight: 17
  },
  heroCaption: {
    color: mobileColors.sand[200]
  }
});
