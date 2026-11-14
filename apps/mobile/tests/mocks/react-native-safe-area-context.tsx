import React from "react";
import { View, type ViewProps } from "react-native";

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const initialWindowMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, right: 0, bottom: 34, left: 0 }
};

export function SafeAreaProvider({ children }: { children?: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

export function SafeAreaView({ children, ...rest }: ViewProps) {
  return React.createElement(View, rest, children);
}

export function useSafeAreaInsets(): EdgeInsets {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

export function useSafeAreaFrame() {
  return { x: 0, y: 0, width: 390, height: 844 };
}

