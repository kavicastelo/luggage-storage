import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type {
  GeographicCoordinate,
  RouteManeuverType,
  RouteResult,
  RouteStep,
  TravelMode
} from "@luggage-storage/contracts";
import {
  Button,
  Card,
  InteractiveMobileMap,
  MobileIcon,
  SafeHeader,
  ScreenContainer
} from "../../src/components";
import { marketplaceApi } from "../../src/services/marketplace-api";
import { getCurrentDeviceLocation } from "../../src/lib/geolocation";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} mins`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs} hr ${remMins > 0 ? `${remMins} min` : ""}`.trim();
}

function calculateDistanceMeters(
  start: GeographicCoordinate,
  end: GeographicCoordinate
): number {
  const R = 6371000;
  const dLat = ((end.latitude - start.latitude) * Math.PI) / 180;
  const dLng = ((end.longitude - start.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((start.latitude * Math.PI) / 180) *
      Math.cos((end.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function getManeuverIcon(type?: RouteManeuverType): string {
  switch (type) {
    case "TURN_LEFT":
    case "SHARP_LEFT":
    case "SLIGHT_LEFT":
      return "chevron-left";
    case "TURN_RIGHT":
    case "SHARP_RIGHT":
    case "SLIGHT_RIGHT":
      return "chevron-right";
    case "U_TURN":
      return "refresh-cw";
    case "ARRIVE":
      return "check-circle";
    case "DEPART":
    case "CONTINUE":
    default:
      return "arrow-up";
  }
}

export default function MobileNavigationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    bookingId?: string;
    destinationLat?: string;
    destinationLng?: string;
    destinationTitle?: string;
    destinationAddress?: string;
    travelMode?: TravelMode;
  }>();

  const bookingId = typeof params.bookingId === "string" ? params.bookingId : undefined;
  const destinationLat = Number(params.destinationLat);
  const destinationLng = Number(params.destinationLng);
  const destinationTitle = params.destinationTitle || "Storage Facility";
  const destinationAddress = params.destinationAddress || "";

  const isValidDestination =
    Number.isFinite(destinationLat) &&
    Number.isFinite(destinationLng) &&
    destinationLat >= -90 &&
    destinationLat <= 90 &&
    destinationLng >= -180 &&
    destinationLng <= 180;

  const destinationCoord: GeographicCoordinate = useMemo(
    () => ({ latitude: destinationLat, longitude: destinationLng }),
    [destinationLat, destinationLng]
  );

  // Navigation State
  const [currentLocation, setCurrentLocation] = useState<GeographicCoordinate | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>(
    params.travelMode === "driving" || params.travelMode === "cycling"
      ? params.travelMode
      : "walking"
  );
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(true);
  const [isRerouting, setIsRerouting] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isVoiceMuted, setIsVoiceMuted] = useState<boolean>(false);
  const [hasArrived, setHasArrived] = useState<boolean>(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  const offRouteCountRef = useRef<number>(0);
  const lastSpokenStepRef = useRef<number>(-1);

  // Announce turn instructions via speech synthesis
  const speakInstruction = useCallback(
    (text: string) => {
      if (isVoiceMuted) return;
      if (Platform.OS === "web" && typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.0;
          window.speechSynthesis.speak(utterance);
        } catch {
          // Ignore audio synthesis errors on unsupported browsers
        }
      }
    },
    [isVoiceMuted]
  );

  // Calculate or recalculate route
  const fetchRoute = useCallback(
    async (origin: GeographicCoordinate, mode: TravelMode, rerouting = false) => {
      if (!isValidDestination) return;
      if (rerouting) setIsRerouting(true);
      else setIsLoadingRoute(true);
      setRouteError(null);

      try {
        const result = await marketplaceApi.calculateRoute({
          origin,
          destination: destinationCoord,
          travelMode: mode,
          alternatives: false
        });
        setRoute(result);
        setCurrentStepIndex(0);
        offRouteCountRef.current = 0;

        const firstStep = result.legs[0]?.steps[0];
        if (firstStep) {
          speakInstruction(firstStep.instruction);
          lastSpokenStepRef.current = 0;
        }
      } catch (err: unknown) {
        setRouteError(err instanceof Error ? err.message : "Route calculation failed");
      } finally {
        setIsLoadingRoute(false);
        setIsRerouting(false);
      }
    },
    [destinationCoord, isValidDestination, speakInstruction]
  );

  // Initial user location resolution
  useEffect(() => {
    let isMounted = true;
    async function initLocation() {
      const res = await getCurrentDeviceLocation(5000);
      if (!isMounted) return;
      if (res.ok) {
        setLocationNotice(null);
        const origin: GeographicCoordinate = { latitude: res.latitude, longitude: res.longitude };
        setCurrentLocation(origin);
        void fetchRoute(origin, travelMode);
      } else {
        setLocationNotice(
          res.denied
            ? "Location permission was denied. Navigation is active using Colombo Central as a demo origin."
            : "Device GPS signal unavailable. Navigation is active using Colombo Central as a demo origin."
        );
        const fallback: GeographicCoordinate = { latitude: 6.9344, longitude: 79.8519 };
        setCurrentLocation(fallback);
        void fetchRoute(fallback, travelMode);
      }
    }
    void initLocation();
    return () => {
      isMounted = false;
    };
  }, [fetchRoute, travelMode]);

  // Periodic GPS watch & turn progression
  useEffect(() => {
    if (!route || hasArrived) return;

    const interval = setInterval(async () => {
      const res = await getCurrentDeviceLocation(3000);
      if (!res.ok) return;

      const userPos: GeographicCoordinate = { latitude: res.latitude, longitude: res.longitude };
      setCurrentLocation(userPos);

      // Check arrival (< 25m to destination)
      const distToDestination = calculateDistanceMeters(userPos, destinationCoord);
      if (distToDestination <= 25) {
        setHasArrived(true);
        speakInstruction("You have arrived at your luggage storage facility.");
        return;
      }

      // Check maneuver progression
      const currentStep = route.legs[0]?.steps[currentStepIndex];
      if (currentStep) {
        const distToStepEnd = calculateDistanceMeters(userPos, currentStep.maneuver.location);
        if (distToStepEnd < 20 && currentStepIndex < (route.legs[0]?.steps.length ?? 1) - 1) {
          const nextIdx = currentStepIndex + 1;
          setCurrentStepIndex(nextIdx);
          const nextStep = route.legs[0]?.steps[nextIdx];
          if (nextStep && lastSpokenStepRef.current !== nextIdx) {
            speakInstruction(nextStep.instruction);
            lastSpokenStepRef.current = nextIdx;
          }
        }
      }

      // Check off-route deviation (> 45m from nearest route geometry point)
      if (route.geometry && route.geometry.length > 0) {
        let minGeometryDist = Infinity;
        for (const pt of route.geometry) {
          const d = calculateDistanceMeters(userPos, pt);
          if (d < minGeometryDist) minGeometryDist = d;
        }

        if (minGeometryDist > 45) {
          offRouteCountRef.current += 1;
          if (offRouteCountRef.current >= 2 && !isRerouting) {
            speakInstruction("Rerouting to storage facility");
            void fetchRoute(userPos, travelMode, true);
          }
        } else {
          offRouteCountRef.current = 0;
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [route, currentStepIndex, destinationCoord, fetchRoute, travelMode, hasArrived, speakInstruction, isRerouting]);

  // Handle travel mode change
  const handleModeChange = (mode: TravelMode) => {
    if (mode === travelMode) return;
    setTravelMode(mode);
    if (currentLocation) {
      void fetchRoute(currentLocation, mode);
    }
  };

  // External Navigation Fallback
  const handleOpenExternalNav = () => {
    const lat = destinationCoord.latitude;
    const lng = destinationCoord.longitude;

    if (Platform.OS === "android") {
      void Linking.openURL(`google.navigation:q=${lat},${lng}&mode=w`).catch(() => {
        void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
      });
    } else if (Platform.OS === "ios") {
      void Linking.openURL(`maps://?daddr=${lat},${lng}&dirflg=w`).catch(() => {
        void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
      });
    } else {
      void Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`
      );
    }
  };

  // Exit Navigation
  const handleEndNavigation = () => {
    if (bookingId) {
      router.replace({ pathname: "/(traveller)/pass", params: { bookingId } });
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(traveller)/bookings");
    }
  };

  if (!isValidDestination) {
    return (
      <ScreenContainer
        header={
          <SafeHeader
            title="In-App Navigation"
            onBack={() => (router.canGoBack() ? router.back() : router.replace("/(traveller)/bookings"))}
          />
        }
        testID="navigation-invalid"
      >
        <Card style={styles.errorCard}>
          <MobileIcon name="alert-circle" size={32} color={mobileColors.rose[500]} />
          <Text style={styles.errorTitle}>Invalid Navigation Destination</Text>
          <Text style={styles.errorDescription}>
            The storage facility coordinates could not be resolved. Please return to your booking.
          </Text>
          <Button title="Return to Bookings" onPress={() => router.replace("/(traveller)/bookings")} />
        </Card>
      </ScreenContainer>
    );
  }

  const currentStep: RouteStep | undefined = route?.legs[0]?.steps[currentStepIndex];
  const nextStep: RouteStep | undefined = route?.legs[0]?.steps[currentStepIndex + 1];

  return (
    <ScreenContainer
      scrollable={false}
      header={
        <SafeHeader
          title="In-App Navigation"
          subtitle={destinationTitle}
          onBack={handleEndNavigation}
          rightAction={
            <TouchableOpacity
              onPress={() => setIsVoiceMuted((m) => !m)}
              style={styles.voiceMuteButton}
              accessibilityLabel={isVoiceMuted ? "Unmute voice guidance" : "Mute voice guidance"}
            >
              <MobileIcon
                name={isVoiceMuted ? "volume-x" : "volume-2"}
                size={18}
                color={mobileColors.white}
              />
            </TouchableOpacity>
          }
        />
      }
      testID="navigation-active-screen"
    >
      <View style={styles.screenWrapper}>
        {/* Top Maneuver HUD Banner */}
        <View style={styles.maneuverHud} testID="navigation-maneuver-hud">
          {isRerouting ? (
            <View style={styles.reroutingRow}>
              <MobileIcon name="refresh-cw" size={18} color={mobileColors.terracotta[500]} />
              <Text style={styles.reroutingText}>Recalculating route...</Text>
            </View>
          ) : currentStep ? (
            <View style={styles.maneuverContent}>
              <View style={styles.maneuverIconBox}>
                <MobileIcon
                  name={getManeuverIcon(currentStep.maneuver.type) as any}
                  size={24}
                  color={mobileColors.white}
                />
              </View>
              <View style={styles.maneuverTextCol}>
                <Text style={styles.maneuverInstruction} numberOfLines={2}>
                  {currentStep.instruction}
                </Text>
                {currentStep.distanceMeters > 0 && (
                  <Text style={styles.maneuverDistance}>
                    in {formatDistance(currentStep.distanceMeters)}
                  </Text>
                )}
                {nextStep && (
                  <Text style={styles.maneuverNextPreview} numberOfLines={1}>
                    Then: {nextStep.instruction}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.maneuverContent}>
              <MobileIcon name="navigation" size={20} color={mobileColors.sky[500]} />
              <Text style={styles.maneuverInstruction}>Calculating route to storage hub...</Text>
            </View>
          )}
        </View>

        {/* Location / Demo Origin Notice */}
        {locationNotice && (
          <View style={styles.noticeBanner} testID="navigation-location-notice">
            <MobileIcon name="alert-circle" size={14} color={mobileColors.amber[600]} />
            <Text style={styles.noticeText}>{locationNotice}</Text>
          </View>
        )}

        {/* Full-Screen Interactive Map Canvas */}
        <View style={styles.mapContainer}>
          <InteractiveMobileMap
            locations={[
              {
                id: "destination",
                name: destinationTitle,
                city: destinationAddress || "Storage Hub",
                latitude: destinationLat,
                longitude: destinationLng
              }
            ]}
            selectedLocationId="destination"
            userLocation={currentLocation}
            activeRoute={route}
            height={360}
            showControls={true}
          />
        </View>

        {/* Bottom Navigation Control Sheet */}
        <Card style={styles.bottomSheet} testID="navigation-bottom-sheet">
          {/* Trip Summary (Distance, ETA, Mode) */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Remaining</Text>
              <Text style={styles.summaryValue}>
                {route ? formatDistance(route.distanceMeters) : "..."}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Est. Arrival</Text>
              <Text style={[styles.summaryValue, { color: mobileColors.terracotta[500] }]}>
                {route ? formatDuration(route.durationSeconds) : "..."}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            {/* Travel Mode Pills */}
            <View style={styles.modeSelector}>
              {(
                [
                  { mode: "walking", icon: "footprints" },
                  { mode: "driving", icon: "car" },
                  { mode: "cycling", icon: "bike" }
                ] as const
              ).map(({ mode, icon }) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => handleModeChange(mode)}
                  style={[styles.modeButton, travelMode === mode && styles.modeButtonActive]}
                  accessibilityLabel={`Switch to ${mode}`}
                >
                  <MobileIcon
                    name={icon as any}
                    size={14}
                    color={travelMode === mode ? mobileColors.white : mobileColors.sand[400]}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Action Buttons: End Navigation + External App Fallback */}
          <View style={styles.actionsRow}>
            <Button
              variant="outline"
              title="End Navigation"
              onPress={handleEndNavigation}
              style={styles.endNavButton}
              testID="end-navigation-btn"
            />
            <TouchableOpacity
              onPress={handleOpenExternalNav}
              style={styles.externalNavButton}
              accessibilityLabel="Open in external navigation app"
              activeOpacity={0.8}
            >
              <MobileIcon name="external-link" size={14} color={mobileColors.navy[900]} />
              <Text style={styles.externalNavText}>External App</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Arrival Overlay Banner */}
        {hasArrived && (
          <View style={styles.arrivalOverlay} testID="navigation-arrival-banner">
            <View style={styles.arrivalCard}>
              <View style={styles.arrivalIconCircle}>
                <MobileIcon name="check-circle" size={32} color={mobileColors.white} />
              </View>
              <Text style={styles.arrivalTitle}>You Have Arrived!</Text>
              <Text style={styles.arrivalDescription}>
                You are at {destinationTitle}. Ready to complete luggage drop-off?
              </Text>
              <Button
                title="View Digital Custody Pass"
                onPress={() => {
                  if (bookingId) {
                    router.replace({ pathname: "/(traveller)/pass", params: { bookingId } });
                  } else {
                    router.replace("/(traveller)/bookings");
                  }
                }}
                testID="arrival-pass-action-btn"
              />
            </View>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    position: "relative",
    justifyContent: "space-between"
  },
  voiceMuteButton: {
    padding: mobileSpacing[1]
  },
  maneuverHud: {
    backgroundColor: mobileColors.navy[900],
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.navy[800],
    paddingHorizontal: mobileSpacing[4],
    paddingVertical: mobileSpacing[2],
    zIndex: 50
  },
  maneuverContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[2]
  },
  maneuverIconBox: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.terracotta[500],
    alignItems: "center",
    justifyContent: "center"
  },
  maneuverTextCol: {
    flex: 1
  },
  maneuverInstruction: {
    fontSize: 15,
    fontWeight: "700",
    color: mobileColors.white
  },
  maneuverDistance: {
    fontSize: 12,
    fontWeight: "500",
    color: mobileColors.sand[300],
    marginTop: 2
  },
  maneuverNextPreview: {
    fontSize: 11,
    fontWeight: "400",
    color: mobileColors.sand[400],
    marginTop: 2
  },
  reroutingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[2],
    paddingVertical: mobileSpacing[1]
  },
  reroutingText: {
    fontSize: 14,
    fontWeight: "700",
    color: mobileColors.terracotta[500]
  },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[2],
    backgroundColor: mobileColors.amber[50],
    borderWidth: 1,
    borderColor: mobileColors.amber[100],
    paddingHorizontal: mobileSpacing[3],
    paddingVertical: mobileSpacing[2],
    marginHorizontal: mobileSpacing[3],
    marginVertical: mobileSpacing[1],
    borderRadius: mobileRadius.md
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
    color: mobileColors.amber[700]
  },
  mapContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: mobileColors.navy[950]
  },
  bottomSheet: {
    backgroundColor: mobileColors.white,
    borderTopLeftRadius: mobileRadius.xl,
    borderTopRightRadius: mobileRadius.xl,
    padding: mobileSpacing[4],
    gap: mobileSpacing[4],
    borderWidth: 1,
    borderColor: mobileColors.sand[200]
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  summaryCol: {
    alignItems: "center"
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: mobileTextColors.muted,
    textTransform: "uppercase"
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileTextColors.primary,
    marginTop: 2
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: mobileColors.sand[300]
  },
  modeSelector: {
    flexDirection: "row",
    backgroundColor: mobileColors.sand[100],
    borderRadius: mobileRadius.md,
    padding: 2
  },
  modeButton: {
    width: 28,
    height: 28,
    borderRadius: mobileRadius.sm,
    alignItems: "center",
    justifyContent: "center"
  },
  modeButtonActive: {
    backgroundColor: mobileColors.navy[900]
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[2]
  },
  endNavButton: {
    flex: 1
  },
  externalNavButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: mobileSpacing[2],
    paddingVertical: mobileSpacing[2],
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.sand[300]
  },
  externalNavText: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  arrivalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10, 25, 47, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: mobileSpacing[6],
    zIndex: 100
  },
  arrivalCard: {
    backgroundColor: mobileColors.white,
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing[5],
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    gap: mobileSpacing[2]
  },
  arrivalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: mobileColors.emerald[500],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: mobileSpacing[1]
  },
  arrivalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: mobileTextColors.primary
  },
  arrivalDescription: {
    fontSize: 13,
    fontWeight: "400",
    color: mobileTextColors.secondary,
    textAlign: "center"
  },
  errorCard: {
    margin: mobileSpacing[5],
    padding: mobileSpacing[5],
    alignItems: "center",
    gap: mobileSpacing[4]
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileTextColors.primary
  },
  errorDescription: {
    fontSize: 13,
    fontWeight: "400",
    color: mobileTextColors.secondary,
    textAlign: "center"
  }
});
