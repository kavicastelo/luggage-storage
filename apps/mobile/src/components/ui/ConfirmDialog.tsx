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
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileSurfaces,
  mobileTypography
} from "../../lib/theme";
import { MobileIcon, type MobileIconName } from "../MobileIcon";
import { Button } from "../Button";

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: MobileIconName;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
  testID?: string;
}

export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  icon,
  isLoading = false,
  onConfirm,
  onCancel,
  children,
  testID
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      testID={testID ?? "confirm-dialog"}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (!isLoading) onCancel();
          }}
          accessibilityLabel={`Dismiss ${title}`}
          accessibilityRole="button"
        />
        <View style={styles.dialog} accessibilityRole="alert">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.dialogContent}
          >
            <View style={styles.headerRow}>
              {icon ? (
                <View
                  style={[
                    styles.iconCircle,
                    destructive ? styles.iconCircleDanger : styles.iconCirclePrimary
                  ]}
                >
                  <MobileIcon
                    name={icon}
                    size="md"
                    color={destructive ? mobileColors.rose[600] : mobileColors.terracotta[600]}
                  />
                </View>
              ) : null}
              <Text style={styles.title}>{title}</Text>
            </View>

            <Text style={styles.description}>{description}</Text>

            {children}

            <View style={styles.actions}>
              <Button
                title={cancelLabel}
                variant="outline"
                size="sm"
                onPress={onCancel}
                disabled={isLoading}
                style={styles.actionBtn}
                testID={testID ? `${testID}-cancel` : "confirm-dialog-cancel"}
              />
              <Button
                title={confirmLabel}
                variant={destructive ? "danger" : "primary"}
                size="sm"
                onPress={onConfirm}
                isLoading={isLoading}
                style={styles.actionBtn}
                testID={testID ? `${testID}-confirm` : "confirm-dialog-confirm"}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: mobileSurfaces.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing[5]
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    backgroundColor: mobileColors.card,
    borderRadius: mobileRadius["2xl"],
    padding: mobileSpacing[5],
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  dialogContent: {
    gap: mobileSpacing[3]
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[3]
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: mobileRadius.full,
    alignItems: "center",
    justifyContent: "center"
  },
  iconCirclePrimary: {
    backgroundColor: mobileColors.terracotta[50]
  },
  iconCircleDanger: {
    backgroundColor: mobileColors.rose[50]
  },
  title: {
    ...mobileTypography.headingMd,
    flex: 1
  },
  description: {
    ...mobileTypography.bodyMd
  },
  actions: {
    flexDirection: "row",
    gap: mobileSpacing[3],
    marginTop: mobileSpacing[2]
  },
  actionBtn: {
    flex: 1
  }
});
