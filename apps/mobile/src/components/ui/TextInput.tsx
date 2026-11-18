import React, { useState } from "react";
import {
  View,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  StyleSheet,
  type TextInputProps as RNTextInputProps,
  type ViewStyle
} from "react-native";
import {
  mobileColors,
  mobileControlSizes,
  mobileRadius,
  mobileSpacing,
  mobileStatusTokens,
  mobileTextColors,
  mobileTypography
} from "../../lib/theme";
import { MobileIcon, type MobileIconName } from "../MobileIcon";

export interface TextInputProps extends Omit<RNTextInputProps, "style"> {
  label?: string;
  required?: boolean;
  helperText?: string;
  errorText?: string | null;
  leftIcon?: MobileIconName;
  rightAction?: React.ReactNode;
  enablePasswordToggle?: boolean;
  containerStyle?: ViewStyle;
}

export const TextInput = React.forwardRef<React.ComponentRef<typeof RNTextInput>, TextInputProps>(
  function TextInput(
  {
    label,
    required = false,
    helperText,
    errorText,
    leftIcon,
    rightAction,
    enablePasswordToggle = false,
    secureTextEntry,
    editable = true,
    containerStyle,
    testID,
    multiline,
    ...rest
  },
  ref
) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordHidden, setIsPasswordHidden] = useState(Boolean(secureTextEntry));
  const effectiveSecure = enablePasswordToggle ? isPasswordHidden : Boolean(secureTextEntry);

  const hasError = Boolean(errorText);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.requiredMark}> *</Text> : null}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputRow,
          multiline ? styles.inputRowMultiline : null,
          isFocused ? styles.inputRowFocused : null,
          hasError ? styles.inputRowError : null,
          !editable ? styles.inputRowDisabled : null
        ]}
      >
        {leftIcon ? (
          <View style={styles.leftIconWrap}>
            <MobileIcon
              name={leftIcon}
              size="sm"
              color={hasError ? mobileStatusTokens.dangerIcon : mobileTextColors.muted}
            />
          </View>
        ) : null}

        <RNTextInput
          ref={ref}
          {...rest}
          testID={testID}
          editable={editable}
          secureTextEntry={effectiveSecure}
          multiline={multiline}
          placeholderTextColor={mobileColors.sand[600]}
          onFocus={(e) => {
            setIsFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            rest.onBlur?.(e);
          }}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          style={[
            styles.input,
            multiline ? styles.inputMultiline : null,
            !editable ? styles.inputDisabled : null
          ]}
        />

        {enablePasswordToggle ? (
          <TouchableOpacity
            onPress={() => setIsPasswordHidden((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={effectiveSecure ? "Show password" : "Hide password"}
            style={styles.toggleButton}
            testID={testID ? `${testID}-toggle` : undefined}
          >
            <MobileIcon
              name={effectiveSecure ? "eye" : "eye-off"}
              size="sm"
              color={mobileTextColors.muted}
            />
          </TouchableOpacity>
        ) : (
          rightAction ?? null
        )}
      </View>

      {hasError ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {errorText}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: mobileSpacing[4]
  },
  label: {
    ...mobileTypography.label,
    marginBottom: mobileSpacing[1]
  },
  requiredMark: {
    color: mobileStatusTokens.danger
  },
  inputRow: {
    minHeight: mobileControlSizes.inputHeight,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: mobileColors.card,
    borderWidth: 1.5,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.lg,
    paddingHorizontal: mobileSpacing[3]
  },
  inputRowMultiline: {
    minHeight: 96,
    alignItems: "flex-start",
    paddingVertical: mobileSpacing[2]
  },
  inputRowFocused: {
    borderColor: mobileColors.borderFocus
  },
  inputRowError: {
    borderColor: mobileStatusTokens.danger,
    backgroundColor: mobileStatusTokens.dangerBg
  },
  inputRowDisabled: {
    backgroundColor: mobileColors.sand[100],
    borderColor: mobileColors.borderDisabled
  },
  leftIconWrap: {
    marginRight: mobileSpacing[2]
  },
  input: {
    flex: 1,
    minHeight: 44,
    fontSize: 15,
    color: mobileTextColors.primary,
    paddingVertical: mobileSpacing[2]
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top"
  },
  inputDisabled: {
    color: mobileTextColors.muted
  },
  toggleButton: {
    minWidth: mobileControlSizes.minTouchTarget,
    minHeight: mobileControlSizes.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -mobileSpacing[2]
  },
  helperText: {
    ...mobileTypography.bodySm,
    marginTop: mobileSpacing[1],
    color: mobileTextColors.muted
  },
  errorText: {
    ...mobileTypography.bodySm,
    marginTop: mobileSpacing[1],
    color: mobileStatusTokens.danger,
    fontWeight: "600"
  }
});

