import React from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type ViewStyle
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { mobileColors, mobileLayout, mobileSpacing } from "../../lib/theme";

export interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  keyboardAvoiding?: boolean;
  padded?: boolean;
  edges?: Edge[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  backgroundColor?: string;
  contentStyle?: ViewStyle;
  testID?: string;
}

export function ScreenContainer({
  children,
  scrollable = true,
  keyboardAvoiding = false,
  padded = true,
  edges = ["bottom"],
  header,
  footer,
  refreshing = false,
  onRefresh,
  backgroundColor = mobileColors.canvas,
  contentStyle,
  testID
}: ScreenContainerProps) {
  const innerContent = scrollable ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.scrollContent,
        padded ? styles.padded : null,
        contentStyle
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={mobileColors.terracotta[500]}
            colors={[mobileColors.terracotta[500]]}
          />
        ) : undefined
      }
    >
      <View style={styles.maxWidthWrap}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded ? styles.padded : null, contentStyle]}>
      <View style={[styles.flex, styles.maxWidthWrap]}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView testID={testID} style={[styles.root, { backgroundColor }]} edges={edges}>
      {header}
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {innerContent}
        </KeyboardAvoidingView>
      ) : (
        innerContent
      )}
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  flex: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: mobileSpacing[8]
  },
  padded: {
    paddingHorizontal: mobileLayout.screenPaddingHorizontal,
    paddingTop: mobileSpacing[4]
  },
  maxWidthWrap: {
    width: "100%",
    maxWidth: mobileLayout.maxContentWidth,
    alignSelf: "center"
  }
});

