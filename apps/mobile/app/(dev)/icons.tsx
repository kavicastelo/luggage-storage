import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Redirect, useRouter } from "expo-router";
import {
  ALL_MOBILE_ICON_NAMES,
  Card,
  IconButton,
  MobileIcon,
  QrCodeMatrix,
  SafeHeader,
  ScreenContainer,
  SearchInput,
  type MobileIconSizeToken
} from "../../src/components";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../src/lib/theme";

const SIZE_TOKENS: readonly MobileIconSizeToken[] = ["xs", "sm", "md", "lg", "xl", "2xl"];

export default function DevIconCatalogueScreen() {
  const router = useRouter();
  const [filterText, setFilterText] = useState("");
  const [surfaceMode, setSurfaceMode] = useState<"light" | "navy">("light");

  const filteredIcons = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) {
      return ALL_MOBILE_ICON_NAMES;
    }
    return ALL_MOBILE_ICON_NAMES.filter((name) => name.includes(q));
  }, [filterText]);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  const isNavy = surfaceMode === "navy";

  return (
    <ScreenContainer
      header={
        <SafeHeader
          title="Vector Icon Catalogue"
          subtitle={`${ALL_MOBILE_ICON_NAMES.length} Lucide icons (DEV only)`}
          variant="navy"
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          rightAction={
            <IconButton
              icon="sun"
              accessibilityLabel="Toggle light or navy preview surface"
              variant="navy"
              onPress={() => setSurfaceMode((prev) => (prev === "light" ? "navy" : "light"))}
            />
          }
        />
      }
      testID="dev-icon-catalogue-screen"
    >
      <SearchInput
        value={filterText}
        onChangeText={setFilterText}
        placeholder="Filter icon registry..."
        style={styles.search}
      />

      <Card variant="default" style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Standard Icon Size Scale</Text>
        <View style={styles.scaleRow}>
          {SIZE_TOKENS.map((sizeToken) => (
            <View key={sizeToken} style={styles.scaleItem}>
              <MobileIcon name="shield-check" size={sizeToken} variant="primary" />
              <Text style={styles.scaleLabel}>{sizeToken}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card variant="default" style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>SVG QR Code Matrix Sample</Text>
        <View style={styles.qrCenter}>
          <QrCodeMatrix
            value="LGS-PASS:demo-dev-preview-token-0123456789abcdef"
            size={148}
          />
        </View>
      </Card>

      <Card variant={isNavy ? "navy" : "default"} style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, isNavy ? styles.inverseText : null]}>
          Registered Icons ({filteredIcons.length})
        </Text>
        <View style={styles.grid}>
          {filteredIcons.map((name) => (
            <View
              key={name}
              style={[styles.tile, isNavy ? styles.tileNavy : styles.tileLight]}
            >
              <MobileIcon
                name={name}
                size="lg"
                variant={isNavy ? "inverse" : "default"}
              />
              <Text
                style={[styles.tileLabel, isNavy ? styles.inverseSubtext : null]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  search: {
    marginBottom: mobileSpacing[4]
  },
  sectionCard: {
    marginBottom: mobileSpacing[4],
    gap: mobileSpacing[3]
  },
  sectionTitle: {
    ...mobileTypography.headingSm
  },
  scaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end"
  },
  scaleItem: {
    alignItems: "center",
    gap: mobileSpacing[1]
  },
  scaleLabel: {
    ...mobileTypography.bodySm
  },
  qrCenter: {
    alignItems: "center"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing[2]
  },
  tile: {
    width: "31%",
    minWidth: 96,
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    paddingVertical: mobileSpacing[3],
    paddingHorizontal: mobileSpacing[2],
    alignItems: "center",
    gap: mobileSpacing[2]
  },
  tileLight: {
    backgroundColor: mobileColors.canvas,
    borderColor: mobileColors.border
  },
  tileNavy: {
    backgroundColor: mobileColors.navy[800],
    borderColor: mobileColors.navy[700]
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: mobileTextColors.secondary,
    textAlign: "center"
  },
  inverseText: {
    color: mobileColors.white
  },
  inverseSubtext: {
    color: mobileColors.sand[200]
  }
});

