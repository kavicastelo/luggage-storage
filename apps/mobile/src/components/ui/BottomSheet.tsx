import React from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileSurfaces,
  mobileTypography
} from "../../lib/theme";
import { IconButton } from "./IconButton";

export interface BottomSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
}

export function BottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  testID
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID ?? "bottom-sheet"}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable
          style={styles.backdropTap}
          onPress={onClose}
          accessibilityLabel={`Dismiss ${title}`}
          accessibilityRole="button"
        />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, mobileSpacing[5]) }
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <IconButton
              icon="x"
              onPress={onClose}
              accessibilityLabel={`Close ${title}`}
              variant="subtle"
              iconSize="sm"
              testID={testID ? `${testID}-close` : "bottom-sheet-close"}
            />
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: mobileSurfaces.overlay,
    justifyContent: "flex-end"
  },
  backdropTap: {
    flex: 1
  },
  sheet: {
    backgroundColor: mobileColors.card,
    borderTopLeftRadius: mobileRadius["2xl"],
    borderTopRightRadius: mobileRadius["2xl"],
    paddingTop: mobileSpacing[3],
    paddingHorizontal: mobileSpacing[5],
    maxHeight: "88%",
    borderTopWidth: 1,
    borderColor: mobileColors.border
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: mobileRadius.full,
    backgroundColor: mobileColors.sand[300],
    alignSelf: "center",
    marginBottom: mobileSpacing[3]
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: mobileSpacing[3],
    paddingBottom: mobileSpacing[3],
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[100]
  },
  titleWrap: {
    flex: 1
  },
  title: {
    ...mobileTypography.headingMd
  },
  subtitle: {
    ...mobileTypography.bodySm,
    marginTop: 2
  },
  scroll: {
    flexGrow: 0
  },
  body: {
    paddingTop: mobileSpacing[4],
    paddingBottom: mobileSpacing[2]
  }
});
