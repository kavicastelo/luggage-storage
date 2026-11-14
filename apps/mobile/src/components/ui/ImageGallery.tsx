import React from "react";
import { View, Text, ScrollView, Image, StyleSheet } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTextColors,
  mobileTypography
} from "../../lib/theme";
import { MobileIcon } from "../MobileIcon";

export interface GalleryImageItem {
  id: string;
  url: string;
  caption?: string | null;
  isPrimary?: boolean;
}

export interface ImageGalleryProps {
  images: readonly GalleryImageItem[];
  emptyLabel?: string;
  height?: number;
  testID?: string;
}

export function ImageGallery({
  images,
  emptyLabel = "No facility photos uploaded yet",
  height = 200,
  testID
}: ImageGalleryProps) {
  if (images.length === 0) {
    return (
      <View
        style={[styles.emptyBox, { height }]}
        testID={testID ? `${testID}-empty` : "image-gallery-empty"}
      >
        <MobileIcon name="image" size="xl" color={mobileTextColors.muted} />
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.track}
      testID={testID ?? "image-gallery"}
    >
      {images.map((item, idx) => (
        <View key={item.id} style={[styles.slide, { height }]}>
          <Image
            source={{ uri: item.url }}
            style={[styles.photo, { height }]}
            resizeMode="cover"
            accessibilityLabel={item.caption ?? `Location photo ${idx + 1}`}
          />
          {item.caption || images.length > 1 ? (
            <View style={styles.captionOverlay}>
              <Text style={styles.captionText} numberOfLines={1}>
                {item.caption ?? `Photo ${idx + 1} of ${images.length}`}
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyBox: {
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: mobileSpacing[2],
    padding: mobileSpacing[4]
  },
  emptyText: {
    ...mobileTypography.bodySm,
    color: mobileTextColors.muted,
    textAlign: "center"
  },
  track: {
    gap: mobileSpacing[3]
  },
  slide: {
    width: 290,
    borderRadius: mobileRadius.xl,
    overflow: "hidden",
    backgroundColor: mobileColors.sand[100],
    borderWidth: 1,
    borderColor: mobileColors.border,
    position: "relative"
  },
  photo: {
    width: 290
  },
  captionOverlay: {
    position: "absolute",
    left: mobileSpacing[2],
    right: mobileSpacing[2],
    bottom: mobileSpacing[2],
    backgroundColor: "rgba(10, 25, 47, 0.78)",
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing[2],
    paddingVertical: 4
  },
  captionText: {
    color: mobileColors.white,
    fontSize: 12,
    fontWeight: "600"
  }
});

