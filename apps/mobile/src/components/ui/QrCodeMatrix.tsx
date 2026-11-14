import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import QRCode from "qrcode";
import { mobileColors, mobileRadius, mobileSpacing, mobileStatusTokens, mobileTypography } from "../../lib/theme";

export interface QrCodeMatrixProps {
  value: string;
  size?: number;
  quietZoneModules?: number;
  color?: string;
  backgroundColor?: string;
  accessibilityLabel?: string;
  testID?: string;
}

export interface QrMatrixBuildResult {
  moduleCount: number;
  totalViewBoxSize: number;
  pathData: string;
}

export function buildQrMatrixPath(value: string, quietZoneModules = 2): QrMatrixBuildResult {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("QR code payload value cannot be empty.");
  }

  const qr = QRCode.create(trimmed, { errorCorrectionLevel: "M" });
  const moduleCount = qr.modules.size;
  const data = qr.modules.data;
  const pathSegments: string[] = [];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (data[row * moduleCount + col]) {
        const x = col + quietZoneModules;
        const y = row + quietZoneModules;
        pathSegments.push(`M${x} ${y}h1v1h-1z`);
      }
    }
  }

  return {
    moduleCount,
    totalViewBoxSize: moduleCount + quietZoneModules * 2,
    pathData: pathSegments.join("")
  };
}

export function QrCodeMatrix({
  value,
  size = 200,
  quietZoneModules = 2,
  color = mobileColors.navy[950],
  backgroundColor = mobileColors.white,
  accessibilityLabel = "Scannable custody QR code pass",
  testID = "custody-qr-matrix"
}: QrCodeMatrixProps) {
  const matrix = useMemo(() => {
    try {
      return { ok: true as const, data: buildQrMatrixPath(value, quietZoneModules) };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Unable to encode QR payload"
      };
    }
  }, [value, quietZoneModules]);

  if (!matrix.ok) {
    return (
      <View
        style={[styles.errorContainer, { width: size, height: size }]}
        accessibilityRole="alert"
        testID={`${testID}-error`}
      >
        <Text style={styles.errorText}>{matrix.error}</Text>
      </View>
    );
  }

  const { totalViewBoxSize, pathData } = matrix.data;

  return (
    <View
      style={[styles.frame, { width: size + 16, height: size + 16, backgroundColor }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${totalViewBoxSize} ${totalViewBoxSize}`}
      >
        <Rect
          x={0}
          y={0}
          width={totalViewBoxSize}
          height={totalViewBoxSize}
          fill={backgroundColor}
        />
        <Path d={pathData} fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileColors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: mobileSpacing[2]
  },
  errorContainer: {
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileStatusTokens.dangerBorder,
    backgroundColor: mobileStatusTokens.dangerBg,
    alignItems: "center",
    justifyContent: "center",
    padding: mobileSpacing[4]
  },
  errorText: {
    ...mobileTypography.bodySm,
    color: mobileStatusTokens.danger,
    textAlign: "center"
  }
});

