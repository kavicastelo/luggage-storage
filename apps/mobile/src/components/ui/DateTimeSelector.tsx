import React, { useState } from "react";
import { View, Text, TouchableOpacity, Platform, StyleSheet } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent
} from "@react-native-community/datetimepicker";
import {
  mobileColors,
  mobileControlSizes,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../lib/theme";
import { MobileIcon } from "../MobileIcon";
import { Button } from "../Button";
import { BottomSheet } from "./BottomSheet";

export interface DateTimeSelectorProps {
  label: string;
  value: Date;
  minimumDate?: Date;
  timezone?: string;
  onChange: (nextDate: Date) => void;
  errorText?: string | null;
  testID?: string;
}

export function formatColomboDateTime(date: Date, timezone = "Asia/Colombo"): string {
  try {
    return new Intl.DateTimeFormat("en-LK", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function DateTimeSelector({
  label,
  value,
  minimumDate,
  timezone = "Asia/Colombo",
  onChange,
  errorText,
  testID
}: DateTimeSelectorProps) {
  const [nativeMode, setNativeMode] = useState<"date" | "time" | null>(null);
  const [iosDraftDate, setIosDraftDate] = useState<Date>(value);
  const [webModalVisible, setWebModalVisible] = useState(false);

  const clampDate = (candidate: Date): Date => {
    if (minimumDate && candidate.getTime() < minimumDate.getTime()) {
      return new Date(minimumDate.getTime());
    }
    return candidate;
  };

  const applyClampedDate = (candidate: Date) => {
    onChange(clampDate(candidate));
  };

  const handleAndroidNativeChange = (event: DateTimePickerEvent, selected?: Date) => {
    const activeMode = nativeMode;
    setNativeMode(null);
    if (event.type === "dismissed" || !selected) {
      return;
    }
    const merged = new Date(value.getTime());
    if (activeMode === "date") {
      merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    } else if (activeMode === "time") {
      merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    }
    applyClampedDate(merged);
  };

  const handleIosDraftChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) return;
    const merged = new Date(iosDraftDate.getTime());
    if (nativeMode === "date") {
      merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    } else if (nativeMode === "time") {
      merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    }
    setIosDraftDate(clampDate(merged));
  };

  const openPicker = (mode: "date" | "time") => {
    if (Platform.OS === "web") {
      setWebModalVisible(true);
      return;
    }
    if (Platform.OS === "ios") {
      setIosDraftDate(value);
    }
    setNativeMode(mode);
  };

  const shiftMinutes = (deltaMinutes: number) => {
    applyClampedDate(new Date(value.getTime() + deltaMinutes * 60_000));
  };

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.displayBox, errorText ? styles.displayBoxError : null]}>
        <View style={styles.valueRow}>
          <MobileIcon name="calendar" size="sm" color={mobileColors.terracotta[500]} />
          <Text style={styles.valueText}>{formatColomboDateTime(value, timezone)}</Text>
        </View>
        <Text style={styles.tzHint}>Sri Lanka time ({timezone})</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.chipButton}
            accessibilityRole="button"
            accessibilityLabel={`${label} change date`}
            onPress={() => openPicker("date")}
            testID={testID ? `${testID}-date-btn` : undefined}
          >
            <MobileIcon name="calendar" size="xs" color={mobileColors.navy[900]} />
            <Text style={styles.chipText}>Date</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chipButton}
            accessibilityRole="button"
            accessibilityLabel={`${label} change time`}
            onPress={() => openPicker("time")}
            testID={testID ? `${testID}-time-btn` : undefined}
          >
            <MobileIcon name="clock" size="xs" color={mobileColors.navy[900]} />
            <Text style={styles.chipText}>Time</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chipButton}
            accessibilityRole="button"
            accessibilityLabel={`${label} minus 1 hour`}
            onPress={() => shiftMinutes(-60)}
          >
            <Text style={styles.chipText}>-1h</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chipButton}
            accessibilityRole="button"
            accessibilityLabel={`${label} plus 1 hour`}
            onPress={() => shiftMinutes(60)}
          >
            <Text style={styles.chipText}>+1h</Text>
          </TouchableOpacity>
        </View>
      </View>

      {errorText ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {errorText}
        </Text>
      ) : null}

      {Platform.OS === "android" && nativeMode ? (
        <DateTimePicker
          value={value}
          mode={nativeMode}
          minimumDate={minimumDate}
          onChange={handleAndroidNativeChange}
          testID={testID ? `${testID}-native-picker` : undefined}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <BottomSheet
          visible={nativeMode !== null}
          title={nativeMode === "date" ? `${label} — Date` : `${label} — Time`}
          subtitle={`Sri Lanka time (${timezone})`}
          onClose={() => setNativeMode(null)}
        >
          {nativeMode ? (
            <View style={styles.sheetGrid}>
              <DateTimePicker
                value={iosDraftDate}
                mode={nativeMode}
                display="spinner"
                minimumDate={minimumDate}
                onChange={handleIosDraftChange}
                testID={testID ? `${testID}-native-picker` : undefined}
              />
              <Button
                title="Confirm"
                onPress={() => {
                  applyClampedDate(iosDraftDate);
                  setNativeMode(null);
                }}
                fullWidth
              />
            </View>
          ) : null}
        </BottomSheet>
      ) : null}

      <BottomSheet
        visible={webModalVisible}
        title={label}
        subtitle={`Adjust date and time (${timezone})`}
        onClose={() => setWebModalVisible(false)}
      >
        <View style={styles.sheetGrid}>
          <Text style={styles.sheetPreview}>{formatColomboDateTime(value, timezone)}</Text>
          <View style={styles.presetRow}>
            <Button
              title="-1 Day"
              size="sm"
              variant="outline"
              onPress={() => shiftMinutes(-24 * 60)}
            />
            <Button
              title="+1 Day"
              size="sm"
              variant="outline"
              onPress={() => shiftMinutes(24 * 60)}
            />
          </View>
          <View style={styles.presetRow}>
            <Button
              title="-30 Min"
              size="sm"
              variant="outline"
              onPress={() => shiftMinutes(-30)}
            />
            <Button
              title="+30 Min"
              size="sm"
              variant="outline"
              onPress={() => shiftMinutes(30)}
            />
            <Button
              title="+2 Hours"
              size="sm"
              variant="outline"
              onPress={() => shiftMinutes(120)}
            />
          </View>
          <Button
            title="Done"
            onPress={() => setWebModalVisible(false)}
            fullWidth
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: mobileSpacing[3]
  },
  label: {
    ...mobileTypography.label,
    marginBottom: mobileSpacing[1]
  },
  displayBox: {
    backgroundColor: mobileColors.card,
    borderWidth: 1.5,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing[3]
  },
  displayBoxError: {
    borderColor: mobileStatusTokens.danger,
    backgroundColor: mobileStatusTokens.dangerBg
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[2]
  },
  valueText: {
    ...mobileTypography.headingSm,
    flex: 1
  },
  tzHint: {
    ...mobileTypography.bodySm,
    marginTop: 2,
    marginBottom: mobileSpacing[2]
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing[2]
  },
  chipButton: {
    minHeight: mobileControlSizes.minTouchTarget,
    minWidth: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing[1],
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.lg,
    paddingHorizontal: mobileSpacing[3]
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  errorText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.danger,
    fontWeight: "600",
    marginTop: mobileSpacing[1]
  },
  sheetGrid: {
    gap: mobileSpacing[3]
  },
  sheetPreview: {
    ...mobileTypography.headingMd,
    textAlign: "center",
    color: mobileTextColors.heading,
    paddingVertical: mobileSpacing[2]
  },
  presetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: mobileSpacing[2]
  }
});
