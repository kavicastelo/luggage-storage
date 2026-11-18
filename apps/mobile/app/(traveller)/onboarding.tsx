import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from "react-native";
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
  mobileLayout,
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
  const { width } = useWindowDimensions();
  const { isAuthenticated } = useAuthStore();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);

  const slideWidth = Math.max(
    260,
    Math.min(width, mobileLayout.maxContentWidth) - mobileLayout.screenPaddingHorizontal * 2
  );
  const isLast = index === SLIDES.length - 1;

  const goToSlide = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, nextIdx));
    setIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * slideWidth, animated: true });
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIdx = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
    if (nextIdx >= 0 && nextIdx < SLIDES.length) {
      setIndex(nextIdx);
    }
  };

  return (
    <ScreenContainer
      header={
        <SafeHeader
          title="Welcome to LuggageStorage"
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
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        decelerationRate="fast"
        style={{ width: slideWidth }}
      >
        {SLIDES.map((slide) => (
          <View key={slide.eyebrow} style={{ width: slideWidth }}>
            <Card variant="elevated" style={styles.slideCard}>
              <MascotIllustration mascot={slide.mascot} size="lg" />
              <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.description}>{slide.description}</Text>
            </Card>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dotsRow}>
        {SLIDES.map((s, idx) => (
          <TouchableOpacity
            key={s.eyebrow}
            onPress={() => goToSlide(idx)}
            accessibilityRole="button"
            accessibilityLabel={`Slide ${idx + 1} of ${SLIDES.length}`}
            hitSlop={8}
          >
            <View style={[styles.dot, idx === index && styles.dotActive]} />
          </TouchableOpacity>
        ))}
      </View>

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
              goToSlide(index + 1);
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
    justifyContent: "center",
    gap: 8,
    marginVertical: mobileSpacing[4]
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
