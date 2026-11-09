import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal } from "react-native";
import { TRAVELLER_MOBILE_SCREENS } from "../data/mock-marketplace";
import { mobileColors, mobileRadius } from "../lib/theme";

interface MobileDevDrawerProps {
  onSelectScreen?: (screenId: string) => void;
  activeScreenId?: string;
}

export function MobileDevDrawer({ onSelectScreen, activeScreenId }: MobileDevDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // In production builds where __DEV__ is false, do not render
  if (typeof __DEV__ !== "undefined" && !__DEV__) {
    return null;
  }

  return (
    <>
      {/* Discreet floating developer pill */}
      <TouchableOpacity
        style={styles.floatingPill}
        onPress={() => setIsOpen(true)}
        accessibilityLabel="Developer Audit Drawer"
      >
        <Text style={styles.floatingPillText}>DEV • QA</Text>
      </TouchableOpacity>

      <Modal visible={isOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Developer & QA Drawer</Text>
                <Text style={styles.modalSubtitle}>
                  39 Registered Traveller Screens (Isolated from Consumer View)
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setIsOpen(false)}
              >
                <Text style={styles.closeBtnText}>✕ Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.screenList}>
              {TRAVELLER_MOBILE_SCREENS.map((scr) => {
                const isActive = scr.id === activeScreenId;
                return (
                  <TouchableOpacity
                    key={scr.id}
                    style={[styles.screenRow, isActive && styles.screenRowActive]}
                    onPress={() => {
                      if (onSelectScreen) onSelectScreen(scr.id);
                      setIsOpen(false);
                    }}
                  >
                    <View style={styles.rowTop}>
                      <Text style={styles.codeTag}>{scr.id}</Text>
                      <Text style={styles.categoryTag}>{scr.category}</Text>
                    </View>
                    <Text style={styles.screenName}>{scr.name}</Text>
                    <Text style={styles.summaryText} numberOfLines={2}>
                      {scr.summary}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingPill: {
    position: "absolute",
    bottom: 74,
    right: 12,
    backgroundColor: mobileColors.navy[900],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: mobileRadius.full,
    borderWidth: 1,
    borderColor: mobileColors.terracotta[400],
    zIndex: 9999,
    opacity: 0.85
  },
  floatingPillText: {
    color: mobileColors.terracotta[300],
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 25, 47, 0.6)",
    justifyContent: "flex-end"
  },
  modalContent: {
    backgroundColor: mobileColors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "75%",
    padding: 16
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.sand[200],
    paddingBottom: 12,
    marginBottom: 8
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  modalSubtitle: {
    fontSize: 11,
    color: mobileColors.sand[600],
    marginTop: 2
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: mobileColors.sand[100],
    borderRadius: 8
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.navy[900]
  },
  screenList: {
    flex: 1
  },
  screenRow: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: mobileColors.sand[200],
    marginBottom: 8,
    backgroundColor: mobileColors.sand[50]
  },
  screenRowActive: {
    borderColor: mobileColors.terracotta[500],
    backgroundColor: mobileColors.terracotta[50]
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4
  },
  codeTag: {
    fontSize: 10,
    fontWeight: "800",
    color: mobileColors.terracotta[600]
  },
  categoryTag: {
    fontSize: 10,
    color: mobileColors.sand[600]
  },
  screenName: {
    fontSize: 13,
    fontWeight: "700",
    color: mobileColors.navy[900],
    marginBottom: 2
  },
  summaryText: {
    fontSize: 11,
    color: mobileColors.sand[700]
  }
});
