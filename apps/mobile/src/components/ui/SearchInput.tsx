import React from "react";
import { View, TextInput as RNTextInput, StyleSheet, type ViewStyle } from "react-native";
import { mobileColors, mobileControlSizes, mobileRadius, mobileSpacing, mobileTextColors } from "../../lib/theme";
import { MobileIcon } from "../MobileIcon";
import { IconButton } from "./IconButton";

export interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  onClear?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
  testID?: string;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = "Search Colombo, Kandy, Galle...",
  onSubmit,
  onClear,
  style,
  accessibilityLabel = "Search storage locations",
  testID
}: SearchInputProps) {
  const handleClear = () => {
    onChangeText("");
    onClear?.();
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconWrap}>
        <MobileIcon name="search" size="md" color={mobileColors.terracotta[500]} />
      </View>
      <RNTextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={mobileColors.sand[500]}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        accessibilityLabel={accessibilityLabel}
        style={styles.input}
      />
      {value.trim().length > 0 ? (
        <IconButton
          icon="x"
          onPress={handleClear}
          accessibilityLabel="Clear search"
          variant="ghost"
          iconSize="sm"
          testID={testID ? `${testID}-clear` : "search-input-clear"}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: mobileControlSizes.inputHeight,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mobileColors.card,
    borderWidth: 1.5,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.xl,
    paddingLeft: mobileSpacing[3],
    paddingRight: mobileSpacing[1]
  },
  iconWrap: {
    marginRight: mobileSpacing[2]
  },
  input: {
    flex: 1,
    minHeight: mobileControlSizes.minTouchTarget,
    fontSize: 15,
    color: mobileTextColors.primary,
    paddingVertical: mobileSpacing[2]
  }
});

