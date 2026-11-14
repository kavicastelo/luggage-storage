import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react-native", async () => {
  const nodeFs = await import("node:fs");
  const nodePath = await import("node:path");
  const src = nodeFs.readFileSync(
    nodePath.resolve(__dirname, "../src/components/MobileIcon.tsx"),
    "utf8"
  );
  const match = src.match(/import\s*\{([\s\S]*?)\}\s*from\s*"lucide-react-native"/);
  const exportsObj: Record<string, unknown> = { __esModule: true };
  if (match) {
    for (const raw of match[1].split(",")) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith("type ")) {
        continue;
      }
      const importedName = trimmed.split(/\s+as\s+/)[0].trim();
      if (importedName) {
        exportsObj[importedName] = function MockLucideIcon() {
          return importedName;
        };
      }
    }
  }
  return exportsObj;
});

import {
  ALL_MOBILE_ICON_NAMES,
  MobileIcon,
  getIconComponent,
  resolveIconSize
} from "../src/components/MobileIcon";
import { buildQrMatrixPath } from "../src/components/ui/QrCodeMatrix";
import {
  mobileColors,
  mobileSpacing,
  mobileStatusTokens,
  mobileTypography
} from "../src/lib/theme";

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe("Phase C — Design System, Vector Icons & QR Matrix Integrity", () => {
  const mobileRoot = path.resolve(__dirname, "..");

  it("resolves every registered MobileIcon name to a concrete Lucide component with zero bullet fallbacks", () => {
    expect(ALL_MOBILE_ICON_NAMES.length).toBeGreaterThanOrEqual(70);

    for (const iconName of ALL_MOBILE_ICON_NAMES) {
      const IconComponent = getIconComponent(iconName);
      expect(IconComponent).toBeDefined();
      const isCallableOrForwardRef =
        typeof IconComponent === "function" ||
        (typeof IconComponent === "object" &&
          IconComponent !== null &&
          "$$typeof" in IconComponent);
      expect(isCallableOrForwardRef).toBe(true);
    }

    const mobileIconSource = fs.readFileSync(
      path.join(mobileRoot, "src/components/MobileIcon.tsx"),
      "utf8"
    );
    expect(mobileIconSource).toContain('from "lucide-react-native"');
    expect(mobileIconSource).not.toContain('"\u2022"');
    expect(mobileIconSource).not.toContain("'\\u2022'");
    expect(mobileIconSource).not.toContain('return "•"');
  });

  it("maps standard MobileIconSizeToken values cleanly to positive pixel dimensions", () => {
    expect(resolveIconSize("xs")).toBe(14);
    expect(resolveIconSize("sm")).toBe(16);
    expect(resolveIconSize("md")).toBe(20);
    expect(resolveIconSize("lg")).toBe(24);
    expect(resolveIconSize("xl")).toBe(28);
    expect(resolveIconSize("2xl")).toBe(36);
    expect(resolveIconSize(22)).toBe(22);
  });

  it("generates deterministic >= 21x21 SVG path matrices from QrCodeMatrix builder and rejects empty values", () => {
    const token = "LGS-PASS:b9000001-0000-4000-8000-000000000001:sig-abc123";
    const first = buildQrMatrixPath(token, 2);
    const second = buildQrMatrixPath(token, 2);

    expect(first.moduleCount).toBeGreaterThanOrEqual(21);
    expect(first.totalViewBoxSize).toBe(first.moduleCount + 4);
    expect(first.pathData.startsWith("M")).toBe(true);
    expect(first.pathData.length).toBeGreaterThan(50);
    expect(first).toEqual(second);

    expect(() => buildQrMatrixPath("   ")).toThrow(/empty/i);
  });

  it("enforces CWCP design tokens and contains zero legacy #2563eb hex literals across app/ and src/", () => {
    expect(mobileColors.navy[900]).toBe("#0A192F");
    expect(mobileColors.navy[950]).toBe("#070E1A");
    expect(mobileColors.terracotta[500]).toBe("#C55013");
    expect(mobileColors.sand[50]).toBe("#FAF8F5");
    expect(mobileColors.canvas).toBe("#FAF8F5");
    expect(mobileColors.ctaBg).toBe("#C55013");
    expect(mobileColors.sky).toBeDefined();

    expect(mobileStatusTokens.success).toBeTruthy();
    expect(mobileStatusTokens.warning).toBeTruthy();
    expect(mobileStatusTokens.danger).toBeTruthy();
    expect(mobileStatusTokens.info).toBeTruthy();
    expect(mobileStatusTokens.neutral).toBeTruthy();

    expect(mobileSpacing[1]).toBe(4);
    expect(mobileSpacing[2]).toBe(8);
    expect(mobileSpacing[4]).toBe(16);
    expect(mobileSpacing[6]).toBe(24);
    expect(mobileTypography.headingLg.fontSize).toBeGreaterThan(mobileTypography.bodyMd.fontSize);

    const files = [
      ...collectSourceFiles(path.join(mobileRoot, "app")),
      ...collectSourceFiles(path.join(mobileRoot, "src"))
    ];
    expect(files.length).toBeGreaterThan(30);

    const offending: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      if (/#2563eb/i.test(content)) {
        offending.push(path.relative(mobileRoot, file));
      }
    }
    expect(offending).toEqual([]);
  });

  it("avoids React Native Web DOM warnings (accessible={false} on SVG icons and nested <button> in LocationCard)", () => {
    const decorativeIcon = MobileIcon({ name: "map-pin" });
    expect(decorativeIcon?.props.accessible).toBeUndefined();

    const labeledIcon = MobileIcon({ name: "map-pin", accessibilityLabel: "Location pin" });
    expect(labeledIcon?.props.accessible).toBe(true);
    expect(labeledIcon?.props.accessibilityRole).toBe("image");

    const locationCardSource = fs.readFileSync(
      path.join(mobileRoot, "src/components/ui/LocationCard.tsx"),
      "utf8"
    );
    expect(locationCardSource).not.toMatch(/<Card[^>]*onPress=/s);
    expect(locationCardSource).toContain("<IconButton");
    expect(locationCardSource).toContain("<TouchableOpacity");
  });
});
