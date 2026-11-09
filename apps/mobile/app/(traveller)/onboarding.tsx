import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet
} from "react-native";
import { useRouter } from "expo-router";
import { Card, Button, MascotIllustration } from "../../src/components";
import { mobileColors, mobileTypography } from "../../src/lib/theme";
import { MascotKey } from "../../src/lib/mascots";

interface OnboardingSlide {
  title: string;
  subtitle: string;
  mascot: MascotKey;
  caption: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    title: "Explore Sri Lanka Hands-Free",
    subtitle:
      "Drop heavy backpacks and suitcases at verified local luggage storage hubs steps from railway stations.",
    mascot: "wave",
    caption: "Meet Kiri, your Sri Lankan luggage storage companion!"
  },
  {
    title: "Verified Hospitality Partners",
    subtitle:
      "Every hotel, lounge, and cafe in our network undergoes rigorous identity verification, vault inspection, and CCTV compliance.",
    mascot: "suitcase-walk",
    caption: "Walk freely through tea trails, coastal ramparts, and cultural temples."
  },
  {
    title: "Sealed & Digital Passes",
    subtitle:
      "Tamper-evident seals on every zipper, verified partner counters, and offline QR passes with 6-digit PIN fallback.",
    mascot: "jump",
    caption: "Safe, hassle-free luggage storage across Sri Lanka."
  }
];

export default function TravellerOnboardingScreen() {
  const router = useRouter();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Permissions state
  const [locationPermitted, setLocationPermitted] = useState(true);
  const [cameraPermitted, setCameraPermitted] = useState(true);
  const [notificationsPermitted, setNotificationsPermitted] = useState(true);

  const activeSlide = SLIDES[currentSlideIndex];

  const handleNext = () => {
    if (currentSlideIndex < SLIDES.length - 1) {
      setCurrentSlideIndex((p) => p + 1);
    } else {
      router.replace("/(traveller)");
    }
  };

  return (
    <View style={styles.screenWrapper}>
      {/* Top Brand Banner */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Welcome to Luggage Storage</Text>
        <Text style={styles.headerSubtitle}>
          Sri Lanka's Verified Intercity Transit Storage Platform
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Slide Carousel Card */}
        <Card style={styles.carouselCard} variant="elevated">
          <MascotIllustration
            mascot={activeSlide.mascot}
            size="lg"
            caption={activeSlide.caption}
          />

          <Text style={styles.slideTitle}>{activeSlide.title}</Text>
          <Text style={styles.slideSubtitle}>{activeSlide.subtitle}</Text>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {SLIDES.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.dot, currentSlideIndex === idx && styles.dotActive]}
                onPress={() => setCurrentSlideIndex(idx)}
              />
            ))}
          </View>
        </Card>

        {/* Permissions & Trust Explanation (TM-003) */}
        {currentSlideIndex === SLIDES.length - 1 && (
          <Card style={styles.permsCard}>
            <Text style={styles.permsHeading}>Contextual Device Permissions</Text>
            <Text style={styles.permsSubtitle}>
              We request permissions only for essential travel security features:
            </Text>

            <TouchableOpacity
              style={styles.permRow}
              onPress={() => setLocationPermitted((p) => !p)}
            >
              <View style={[styles.permCheck, locationPermitted && styles.permCheckActive]}>
                <Text style={styles.permCheckText}>{locationPermitted ? "✓" : ""}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.permTitle}>GPS Location</Text>
                <Text style={styles.permDesc}>Find nearest storage hubs near current transit station</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.permRow}
              onPress={() => setCameraPermitted((p) => !p)}
            >
              <View style={[styles.permCheck, cameraPermitted && styles.permCheckActive]}>
                <Text style={styles.permCheckText}>{cameraPermitted ? "✓" : ""}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.permTitle}>Camera Access</Text>
                <Text style={styles.permDesc}>Scan host counter QR code for rapid check-in</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.permRow}
              onPress={() => setNotificationsPermitted((p) => !p)}
            >
              <View style={[styles.permCheck, notificationsPermitted && styles.permCheckActive]}>
                <Text style={styles.permCheckText}>{notificationsPermitted ? "✓" : ""}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.permTitle}>SLA & Reminder Notifications</Text>
                <Text style={styles.permDesc}>Receive 30-minute pickup warnings and delay alerts</Text>
              </View>
            </TouchableOpacity>
          </Card>
        )}
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        {currentSlideIndex > 0 ? (
          <Button
            title="← Back"
            variant="ghost"
            onPress={() => setCurrentSlideIndex((p) => p - 1)}
          />
        ) : (
          <Button
            title="Skip"
            variant="ghost"
            onPress={() => router.replace("/(traveller)")}
          />
        )}

        <Button
          title={currentSlideIndex === SLIDES.length - 1 ? "Start Exploring Sri Lanka" : "Next →"}
          variant="primary"
          onPress={handleNext}
          style={{ flex: 1, marginLeft: 12 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  header: {
    backgroundColor: mobileColors.navy[900],
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20
  },
  headerTitle: {
    ...mobileTypography.headingLg,
    color: mobileColors.white
  },
  headerSubtitle: {
    ...mobileTypography.bodySm,
    color: mobileColors.sand[400],
    marginTop: 2
  },
  container: {
    padding: 16,
    paddingBottom: 90
  },
  carouselCard: {
    padding: 20,
    alignItems: "center"
  },
  slideTitle: {
    ...mobileTypography.headingMd,
    color: mobileColors.navy[900],
    textAlign: "center",
    marginTop: 16,
    marginBottom: 8
  },
  slideSubtitle: {
    fontSize: 13,
    color: mobileColors.sand[700],
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: mobileColors.sand[300]
  },
  dotActive: {
    width: 24,
    backgroundColor: mobileColors.terracotta[500]
  },
  permsCard: {
    padding: 16,
    marginTop: 14
  },
  permsHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  permsSubtitle: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2,
    marginBottom: 12
  },
  permRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[100]
  },
  permCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: mobileColors.sand[400],
    justifyContent: "center",
    alignItems: "center"
  },
  permCheckActive: {
    backgroundColor: mobileColors.terracotta[500],
    borderColor: mobileColors.terracotta[500]
  },
  permCheckText: {
    color: mobileColors.white,
    fontSize: 13,
    fontWeight: "700"
  },
  permTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: mobileColors.navy[900]
  },
  permDesc: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 1
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: mobileColors.white,
    borderTopWidth: 1,
    borderTopColor: mobileColors.sand[200],
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  }
});
