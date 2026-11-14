import React from "react";
import { View } from "react-native";

export interface DateTimePickerEvent {
  type: "set" | "dismissed" | "neutralButtonPressed";
  nativeEvent: { timestamp: number };
}

export interface DateTimePickerProps {
  value: Date;
  mode?: "date" | "time" | "datetime" | "countdown";
  minimumDate?: Date;
  maximumDate?: Date;
  onChange?: (event: DateTimePickerEvent, date?: Date) => void;
  testID?: string;
}

export default function MockDateTimePicker({ testID }: DateTimePickerProps) {
  return React.createElement(View, { testID: testID ?? "mock-datetimepicker" });
}

