import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from "react-native";
import { useRouter } from "expo-router";
import { ALL_MOBILE_SCREENS } from "../data/mock-marketplace";
import { mobileColors, mobileControlSizes, mobileRadius, mobileSpacing } from "../lib/theme";
import { MobileIcon } from "./MobileIcon";
import { IconButton } from "./ui/IconButton";

export interface MobileDevDrawerProps {
  onSelectScreen?: (screenId: string) => void;
  activeScreenId?: string;
}

export function MobileDevDrawer({ onSelectScreen, activeScreenId }: MobileDevDrawerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  if (!__DEV__) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open developer inspection drawer"
      >
        <MobileIcon name="wrench" size="xs" color={mobileColors.white} />
        <Text style={styles.fabText}>DEV</Text>
      </TouchableOpacity>

      <Modal visible={isOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.drawerPanel}>
            <View style={styles.drawerHeader}>
              <View>
                <Text style={styles.drawerTitle}>Developer Tools</Text>
                <Text style={styles.drawerSubtitle}>__DEV__ only · Screen & Icon Inspector</Text>
              </View>
              <IconButton
                icon="x"
                onPress={() => setIsOpen(false)}
                accessibilityLabel="Close developer drawer"
                variant="subtle"
                iconSize="sm"
              />
            </View>

            <TouchableOpacity
              style={styles.catalogBtn}
              onPress={() => {
                setIsOpen(false);
                router.push("/(dev)/icons");
              }}
              accessibilityRole="button"
              accessibilityLabel="Open vector icon catalogue"
            >
              <MobileIcon name="layers" size="sm" color={mobileColors.white} />
              <Text style={styles.catalogBtnText}>Vector Icon Catalogue (C2)</Text>
            </TouchableOpacity>

            <ScrollView style={styles.list}>
              {ALL_MOBILE_SCREENS.map((scr) => {
                const isActive = scr.id === activeScreenId;
                return (
                  <TouchableOpacity
                    key={scr.id}
                    style={[styles.item, isActive ? styles.activeItem : null]}
                    onPress={() => {
                      onSelectScreen?.(scr.id);
                      setIsOpen(false);
                    }}
                    disabled={!onSelectScreen}
                  >
                    <Text style={[styles.itemId, isActive ? styles.activeItemText : null]}>
                      {scr.id}
                    </Text>
                    <Text style={[styles.itemTitle, isActive ? styles.activeItemText : null]}>
                      {scr.name}
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
  fab: {
    position: "absolute",
    right: 16,
    bottom: 84,
    backgroundColor: mobileColors.navy[900],
    borderRadius: mobileRadius.full,
    paddingHorizontal: mobileSpacing[3],
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing[1],
    zIndex: 99,
    borderWidth: 1,
    borderColor: mobileColors.terracotta[400]
  },
  fabText: {
    color: mobileColors.white,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(7, 14, 26, 0.56)",
    justifyContent: "flex-end"
  },
  drawerPanel: {
    height: "75%",
    backgroundColor: mobileColors.card,
    borderTopLeftRadius: mobileRadius["2xl"],
    borderTopRightRadius: mobileRadius["2xl"],
    padding: mobileSpacing[5],
    gap: mobileSpacing[3]
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: mobileSpacing[3],
    borderBottomWidth: 1,
    borderBottomColor: mobileColors.border
  },
  drawerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: mobileColors.navy[950]
  },
  drawerSubtitle: {
    fontSize: 12,
    color: mobileColors.secondaryText
  },
  catalogBtn: {
    minHeight: mobileControlSizes.minTouchTarget,
    backgroundColor: mobileColors.terracotta[500],
    borderRadius: mobileRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing[2],
    paddingHorizontal: mobileSpacing[4]
  },
  catalogBtnText: {
    color: mobileColors.white,
    fontWeight: "700",
    fontSize: 14
  },
  list: {
    flex: 1
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: mobileSpacing[3],
    paddingHorizontal: mobileSpacing[3],
    borderRadius: mobileRadius.lg,
    marginBottom: 4
  },
  activeItem: {
    backgroundColor: mobileColors.terracotta[50]
  },
  itemId: {
    width: 68,
    fontSize: 12,
    fontWeight: "700",
    color: mobileColors.secondaryText
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    color: mobileColors.navy[950]
  },
  activeItemText: {
    color: mobileColors.terracotta[600],
    fontWeight: "700"
  }
});
