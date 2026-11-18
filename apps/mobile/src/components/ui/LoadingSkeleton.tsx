import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, View, StyleSheet, type ViewStyle } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing } from "../../lib/theme";
import { Card } from "../Card";

export interface LoadingSkeletonProps {
  height?: number;
  width?: number | `${number}%`;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBlock({
  height = 16,
  width = "100%",
  borderRadius = mobileRadius.md,
  style
}: LoadingSkeletonProps) {
  const opacity = useRef(new Animated.Value(0.75)).current;

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!active || reduced) return;
        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.4,
              duration: 750,
              useNativeDriver: true
            }),
            Animated.timing(opacity, {
              toValue: 0.9,
              duration: 750,
              useNativeDriver: true
            })
          ])
        );
        animation.start();
      })
      .catch(() => {
        // Leave static opacity if accessibility query fails in SSR/test
      });

    return () => {
      active = false;
      animation?.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.block,
        {
          height,
          width,
          borderRadius,
          opacity
        },
        style
      ]}
    />
  );
}

export interface LoadingSkeletonListProps {
  count?: number;
  testID?: string;
}

export function LoadingSkeleton({ count = 3, testID }: LoadingSkeletonListProps) {
  return (
    <View style={styles.list} testID={testID ?? "loading-skeleton"} accessibilityLabel="Loading content">
      {Array.from({ length: count }, (_, idx) => (
        <Card key={idx} variant="default" style={styles.card}>
          <View style={styles.row}>
            <SkeletonBlock height={56} width={56} borderRadius={mobileRadius.lg} />
            <View style={styles.col}>
              <SkeletonBlock height={14} width="65%" />
              <SkeletonBlock height={12} width="85%" />
              <SkeletonBlock height={12} width="45%" />
            </View>
          </View>
          <View style={styles.footerRow}>
            <SkeletonBlock height={12} width="40%" />
            <SkeletonBlock height={28} width={88} borderRadius={mobileRadius.lg} />
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: mobileSpacing[3]
  },
  block: {
    backgroundColor: mobileColors.sand[200]
  },
  card: {
    gap: mobileSpacing[3]
  },
  row: {
    flexDirection: "row",
    gap: mobileSpacing[3],
    alignItems: "center"
  },
  col: {
    flex: 1,
    gap: mobileSpacing[2]
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  }
});
