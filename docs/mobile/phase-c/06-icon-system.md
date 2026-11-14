# Stage C2 — Mobile Vector Icon System & SVG QR Matrix

## 1. Icon Architecture (`apps/mobile/src/components/MobileIcon.tsx`)
Replaced the prior defective native fallback (`"•"` bullets, `"🔍"` / `"★"` emoji glyphs, and silent `ICON_PATHS[name] || ICON_PATHS.info` substitution) with a single uniform `lucide-react-native` vector family backed by `react-native-svg`.

- **Icon Family:** `lucide-react-native@1.73.0` + `react-native-svg@15.16.0`
- **Type Safety:** Strict `MobileIconName` union derived from `ICON_REGISTRY` (`72` icons), exported alongside backwards-compatible `IconName` and `ALL_MOBILE_ICON_NAMES`.
- **Fail-Fast Behavior:** Unknown icon names throw in `__DEV__` and return `null` cleanly otherwise — **zero silent substitution** and **zero bullet/emoji fallbacks**.
- **Standard Size Tokens (`mobileIconSizes`):** `xs: 14`, `sm: 16`, `md: 20`, `lg: 24`, `xl: 28`, `"2xl": 36`.
- **Semantic Color Variants:** `default`, `muted`, `primary`, `inverse`, `success`, `warning`, `danger`, `info`.
- **Accessibility:** Sets `accessible={true}` + `accessibilityRole="image"` when `accessibilityLabel` is supplied; decorative icons remain hidden from screen readers.

## 2. Scannable Custody QR Rendering (`apps/mobile/src/components/ui/QrCodeMatrix.tsx`)
- Replaces the legacy `<MobileIcon name="qr-code" />` decorative icon on the Traveller Custody Pass screen (`pass.tsx`) with an actual ISO QR Code matrix computed via `qrcode` (`QRCode.create(value, { errorCorrectionLevel: "M" })`) and rendered into a crisp compound `<Svg><Rect /><Path /></Svg>` element with a quiet zone and high-contrast `#0A192F` modules on `#FFFFFF`.
- Renders an explicit accessible error panel if an empty payload is ever passed.

## 3. Raw Unicode & Emoji Cleanup
Removed raw inline symbol hacks across Entry Gateway, Dev Drawer, Auth, Account & UI components (`📱`, `💻`, `✓`, `←`, `✕`), replacing them with crisp vector icons (`smartphone`, `laptop`, `check-circle`, `arrow-left`, `x`).

## 4. Development Icon Catalogue (`apps/mobile/app/(dev)/icons.tsx`)
- Strictly gated behind `__DEV__` (redirects to `/` outside development builds) and linked from `MobileDevDrawer.tsx`.
- Previews all `72` icons on both light (`Sunlit Sand`) and dark (`Coastal Navy`) surfaces alongside the size scale and live `QrCodeMatrix` sample.

