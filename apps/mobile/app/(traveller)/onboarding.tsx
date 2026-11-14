import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  Button,
  Card,
  MascotIllustration,
  MobileIcon,
  SafeHeader,
  ScreenContainer,
  type MascotKey
} from "../../src/components";
import { useAuthStore } from "../../src/store/useAuthStore";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

const SLIDES: ReadonlyArray<{
  mascot: MascotKey;
  eyebrow: string;
  title: string;
  description: string;
}> = [
  {
    mascot: "map",
    eyebrow: "DISCOVER SRI LANKA",
    title: "Explore Hands-Free Across Sri Lanka",
    description:
      "Find verified hotels, transit shops, and partner counters near Colombo Fort, Kandy, Galle, Ella, and Negombo."
  },
  {
    mascot: "king-coconut",
    eyebrow: "TRANSPARENT LKR PRICING",
    title: "Instant Quotes & PayHere Protection",
    description:
      "Exact street addresses stay private until confirmation. Review live capacity and pay securely in LKR before arrival."
  },
  {
    mascot: "jump",
    eyebrow: "AUDITABLE HANDOVER",
    title: "QR Pass & 6-Digit Counter PIN",
    description:
      "Check in and collect bags using time-limited single-use QR passes paired with a 6-digit PIN—with offline arrival caching."
  }
];

export default function TravellerOnboardingScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [index, setIndex] = useState(0);

  const current = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <ScreenContainer
      header={
        <SafeHeader
          title="Welcome to BagBox"
          rightAction={
            <Button
              title="Skip"
              variant="ghost"
              size="sm"
              onPress={() => router.replace("/(traveller)")}
            />
          }
        />
      }
      testID="traveller-onboarding-screen"
    >
      <Card variant="elevated" style={styles.slideCard}>
        <MascotIllustration mascot={current.mascot} size="lg" />
        <Text style={styles.eyebrow}>{current.eyebrow}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.description}>{current.description}</Text>

        <View style={styles.dotsRow}>
          {SLIDES.map((s, idx) => (
            <View
              key={s.eyebrow}
              style={[styles.dot, idx === index && styles.dotActive]}
            />
          ))}
        </View>
      </Card>

      <View style={styles.actionsStack}>
        <Button
          title={isLast ? "Explore Storage Hubs" : "Next"}
          rightIcon={
            <MobileIcon
              name={isLast ? "compass" : "arrow-right"}
              size={16}
              color={mobileColors.white}
            />
          }
          onPress={() => {
            if (isLast) {
              router.replace("/(traveller)");
            } else {
              setIndex((prev) => prev + 1);
            }
          }}
        />
        {!isAuthenticated ? (
          <Button
            title="Sign In or Register"
            variant="outline"
            onPress={() => router.push("/(auth)/login")}
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  slideCard: {
    alignItems: "center",
    gap: mobileSpacing[4],
    paddingVertical: mobileSpacing[8]
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: mobileColors.terracotta[600]
  },
  title: {
    ...mobileTypography.headingLg,
    color: mobileTextColors.primary,
    textAlign: "center"
  },
  description: {
    ...mobileTypography.bodyMd,
    color: mobileTextColors.secondary,
    textAlign: "center"
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: mobileSpacing[3]
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.sand[300]
  },
  dotActive: {
    width: 24,
    backgroundColor: mobileColors.navy[900]
  },
  actionsStack: {
    gap: mobileSpacing[3]
  }
});
