import React from "react";
import { View, Text, Platform, StyleSheet } from "react-native";

export type IconName =
  | "search"
  | "briefcase"
  | "bookmark"
  | "heart"
  | "help-circle"
  | "user"
  | "shield"
  | "star"
  | "clock"
  | "map-pin"
  | "phone"
  | "chevron-right"
  | "chevron-left"
  | "plus"
  | "minus"
  | "x"
  | "check"
  | "lock"
  | "filter"
  | "share"
  | "bell"
  | "calendar"
  | "map"
  | "qr-code"
  | "refresh"
  | "info"
  | "alert-triangle"
  | "award"
  | "camera"
  | "compass";

interface MobileIconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Canonical SVG paths (aligned with Lucide 24x24 grid)
const ICON_PATHS: Record<IconName, string[]> = {
  search: [
    "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
    "m21 21-4.35-4.35"
  ],
  briefcase: [
    "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
    "rect:2:7:20:14:2",
    "M12 12h.01"
  ],
  bookmark: [
    "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
  ],
  heart: [
    "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
  ],
  "help-circle": [
    "circle:12:12:10",
    "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",
    "M12 17h.01"
  ],
  user: [
    "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",
    "circle:12:7:4"
  ],
  shield: [
    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
  ],
  star: [
    "polygon:12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
  ],
  clock: [
    "circle:12:12:10",
    "M12 6v6l4 2"
  ],
  "map-pin": [
    "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z",
    "circle:12:10:3"
  ],
  phone: [
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
  ],
  "chevron-right": [
    "m9 18 6-6-6-6"
  ],
  "chevron-left": [
    "m15 18-6-6 6-6"
  ],
  plus: [
    "M5 12h14",
    "M12 5v14"
  ],
  minus: [
    "M5 12h14"
  ],
  x: [
    "M18 6 6 18",
    "m6 6 12 12"
  ],
  check: [
    "M20 6 9 17l-5-5"
  ],
  lock: [
    "rect:3:11:18:11:2",
    "M7 11V7a5 5 0 0 1 10 0v4"
  ],
  filter: [
    "polygon:22,3 2,3 10,12.46 10,19 14,21 14,12.46"
  ],
  share: [
    "circle:18:5:3",
    "circle:6:12:3",
    "circle:18:19:3",
    "M8.59 13.51l6.83 3.98",
    "M15.41 6.51l-6.82 3.98"
  ],
  bell: [
    "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9",
    "M10.3 21a1.94 1.94 0 0 0 3.4 0"
  ],
  calendar: [
    "rect:3:4:18:18:2",
    "M16 2v4",
    "M8 2v4",
    "M3 10h18"
  ],
  map: [
    "polygon:3,6 9,3 15,6 21,3 21,18 15,21 9,18 3,21",
    "M9 3v15",
    "M15 6v15"
  ],
  "qr-code": [
    "rect:3:3:7:7:0",
    "rect:14:3:7:7:0",
    "rect:3:14:7:7:0",
    "M14 14h.01",
    "M17 14h3v3",
    "M14 17v3h3",
    "M20 20h.01"
  ],
  refresh: [
    "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
    "M21 3v5h-5",
    "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
    "M3 21v-5h5"
  ],
  info: [
    "circle:12:12:10",
    "M12 16v-4",
    "M12 8h.01"
  ],
  "alert-triangle": [
    "polygon:12,2 1,21 23,21",
    "M12 9v4",
    "M12 17h.01"
  ],
  award: [
    "circle:12:8:7",
    "polyline:8.21,13.89 7,23 12,20 17,23 15.79,13.88"
  ],
  camera: [
    "path:M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z",
    "circle:12:13:4"
  ],
  compass: [
    "circle:12:12:10",
    "polygon:16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"
  ]
};

export function MobileIcon({
  name,
  size = 20,
  color = "#0A192F",
  strokeWidth = 2
}: MobileIconProps) {
  const paths = ICON_PATHS[name] || ICON_PATHS.info;

  // On Web / React Native Web, render standard SVG
  if (Platform.OS === "web") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
      >
        {paths.map((p, idx) => {
          if (p.startsWith("circle:")) {
            const [, cx, cy, r] = p.split(":");
            return <circle key={idx} cx={cx} cy={cy} r={r} />;
          }
          if (p.startsWith("rect:")) {
            const [, x, y, w, h, rx] = p.split(":");
            return <rect key={idx} x={x} y={y} width={w} height={h} rx={rx || "0"} />;
          }
          if (p.startsWith("polygon:")) {
            const pts = p.replace("polygon:", "");
            return <polygon key={idx} points={pts} fill={name === "star" ? color : "none"} />;
          }
          if (p.startsWith("polyline:")) {
            const pts = p.replace("polyline:", "");
            return <polyline key={idx} points={pts} />;
          }
          if (p.startsWith("path:")) {
            const d = p.replace("path:", "");
            return <path key={idx} d={d} />;
          }
          return <path key={idx} d={p} />;
        })}
      </svg>
    );
  }

  // Mobile / Native fallback
  return (
    <View style={[styles.fallbackContainer, { width: size, height: size }]}>
      <Text style={{ fontSize: size * 0.75, color, lineHeight: size, textAlign: "center" }}>
        {name === "search" ? "🔍" : name === "star" ? "★" : "•"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    justifyContent: "center",
    alignItems: "center"
  }
});
