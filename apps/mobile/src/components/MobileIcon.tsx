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
  | "compass"
  | "wallet"
  | "layers"
  | "arrow-right"
  | "arrow-left"
  | "check-circle"
  | "alert-circle"
  | "pie-chart"
  | "credit-card"
  | "users"
  | "settings"
  | "sun"
  | "key"
  | "inbox";

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
    "path:M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
  ],
  star: [
    "polygon:12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
  ],
  clock: [
    "circle:12:12:10",
    "polyline:12,6 12,12 16,14"
  ],
  "map-pin": [
    "path:M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z",
    "circle:12:10:3"
  ],
  phone: [
    "path:M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
  ],
  "chevron-right": [
    "polyline:9,18 15,12 9,6"
  ],
  "chevron-left": [
    "polyline:15,18 9,12 15,6"
  ],
  plus: [
    "M12 5v14",
    "M5 12h14"
  ],
  minus: [
    "M5 12h14"
  ],
  x: [
    "M18 6 6 18",
    "M6 6l12 12"
  ],
  check: [
    "polyline:20,6 9,17 4,12"
  ],
  lock: [
    "rect:3:11:18:11:2",
    "path:M7 11V7a5 5 0 0 1 10 0v4"
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
    "path:M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9",
    "path:M13.73 21a2 2 0 0 1-3.46 0"
  ],
  calendar: [
    "rect:3:4:18:18:2",
    "M16 2v4",
    "M8 2v4",
    "M3 10h18"
  ],
  map: [
    "polygon:1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2",
    "M8 2v16",
    "M16 6v16"
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
  ],
  wallet: [
    "path:M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
    "path:M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"
  ],
  layers: [
    "path:m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",
    "path:m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65",
    "path:m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"
  ],
  "arrow-right": [
    "M5 12h14",
    "polyline:12,5 19,12 12,19"
  ],
  "arrow-left": [
    "polyline:12,19 5,12 12,5",
    "M19 12H5"
  ],
  "check-circle": [
    "circle:12:12:10",
    "polyline:9,12 12,15 16,10"
  ],
  "alert-circle": [
    "circle:12:12:10",
    "M12 8v4",
    "M12 16h.01"
  ],
  "pie-chart": [
    "path:M21.21 15.89A10 10 0 1 1 8 2.83",
    "path:M22 12A10 10 0 0 0 12 2v10z"
  ],
  "credit-card": [
    "rect:2:5:20:14:2",
    "M2 10h20"
  ],
  users: [
    "path:M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "circle:9:7:4",
    "path:M22 21v-2a4 4 0 0 0-3-3.87",
    "path:M16 3.13a4 4 0 0 1 0 7.75"
  ],
  settings: [
    "circle:12:12:3",
    "path:M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
  ],
  sun: [
    "circle:12:12:4",
    "M12 2v2",
    "M12 20v2",
    "M4.93 4.93l1.41 1.41",
    "M17.66 17.66l1.41 1.41",
    "M2 12h2",
    "M20 12h2",
    "M6.34 17.66l-1.41 1.41",
    "M19.07 4.93l-1.41 1.41"
  ],
  key: [
    "circle:7.5:15.5:5.5",
    "M21 2l-9.6 9.6",
    "m15.5 7.5 3 3L22 7l-3-3"
  ],
  inbox: [
    "polyline:22,12 16,12 14,15 10,15 8,12 2,12",
    "path:M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
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
