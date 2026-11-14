import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Ban,
  Bell,
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Clock,
  ClockAlert,
  Compass,
  Copy,
  CreditCard,
  DollarSign,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Globe,
  Heart,
  HelpCircle,
  Home,
  Image,
  Inbox,
  Info,
  Key,
  Laptop,
  Layers,
  Lock,
  LogOut,
  Luggage,
  Mail,
  Map,
  MapPin,
  Minus,
  Navigation,
  PackageCheck,
  Pencil,
  Phone,
  PieChart,
  Plus,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Star,
  Sun,
  Trash2,
  Upload,
  User,
  Users,
  Wallet,
  Wrench,
  X,
  type LucideIcon
} from "lucide-react-native";
import {
  mobileColors,
  mobileIconSizes,
  mobileIconStrokeWidths,
  mobileStatusTokens,
  mobileTextColors
} from "../lib/theme";

const ICON_REGISTRY = {
  search: Search,
  briefcase: Briefcase,
  bookmark: Bookmark,
  heart: Heart,
  "help-circle": HelpCircle,
  user: User,
  shield: Shield,
  star: Star,
  clock: Clock,
  "map-pin": MapPin,
  phone: Phone,
  "chevron-right": ChevronRight,
  "chevron-left": ChevronLeft,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  plus: Plus,
  minus: Minus,
  x: X,
  check: Check,
  lock: Lock,
  filter: Filter,
  share: Share2,
  bell: Bell,
  calendar: Calendar,
  map: Map,
  "qr-code": QrCode,
  refresh: RefreshCw,
  info: Info,
  "alert-triangle": AlertTriangle,
  award: Award,
  camera: Camera,
  compass: Compass,
  wallet: Wallet,
  layers: Layers,
  "arrow-right": ArrowRight,
  "arrow-left": ArrowLeft,
  "check-circle": CheckCircle2,
  "alert-circle": AlertCircle,
  "pie-chart": PieChart,
  "credit-card": CreditCard,
  users: Users,
  settings: Settings,
  sun: Sun,
  key: Key,
  inbox: Inbox,
  home: Home,
  luggage: Luggage,
  upload: Upload,
  "file-text": FileText,
  building: Building2,
  trash: Trash2,
  edit: Pencil,
  eye: Eye,
  "eye-off": EyeOff,
  "external-link": ExternalLink,
  "log-out": LogOut,
  smartphone: Smartphone,
  laptop: Laptop,
  copy: Copy,
  sliders: SlidersHorizontal,
  ban: Ban,
  "dollar-sign": DollarSign,
  image: Image,
  navigation: Navigation,
  globe: Globe,
  mail: Mail,
  wrench: Wrench,
  "scan-line": ScanLine,
  "shield-check": ShieldCheck,
  "circle-dot": CircleDot,
  "clock-alert": ClockAlert,
  "package-check": PackageCheck
} as const satisfies Record<string, LucideIcon>;

export type MobileIconName = keyof typeof ICON_REGISTRY;
export type IconName = MobileIconName;
export type MobileIconSizeToken = keyof typeof mobileIconSizes;
export type MobileIconVariant =
  | "default"
  | "muted"
  | "primary"
  | "inverse"
  | "success"
  | "warning"
  | "danger"
  | "info";

export const ALL_MOBILE_ICON_NAMES = Object.keys(ICON_REGISTRY) as readonly MobileIconName[];

const VARIANT_COLORS: Record<MobileIconVariant, string> = {
  default: mobileColors.navy[900],
  muted: mobileTextColors.muted,
  primary: mobileColors.terracotta[500],
  inverse: mobileColors.white,
  success: mobileStatusTokens.successIcon,
  warning: mobileStatusTokens.warningIcon,
  danger: mobileStatusTokens.dangerIcon,
  info: mobileStatusTokens.infoIcon
};

export interface MobileIconProps {
  name: MobileIconName;
  size?: number | MobileIconSizeToken;
  variant?: MobileIconVariant;
  color?: string;
  strokeWidth?: number;
  accessibilityLabel?: string;
  testID?: string;
}

export function resolveIconSize(size: number | MobileIconSizeToken = "md"): number {
  if (typeof size === "number") {
    return size;
  }
  return mobileIconSizes[size];
}

export function getIconComponent(name: MobileIconName): LucideIcon {
  const IconComp = ICON_REGISTRY[name];
  if (!IconComp) {
    throw new Error(`Unknown MobileIcon name: "${String(name)}"`);
  }
  return IconComp;
}

export function MobileIcon({
  name,
  size = "md",
  variant = "default",
  color,
  strokeWidth = mobileIconStrokeWidths.regular,
  accessibilityLabel,
  testID
}: MobileIconProps) {
  const IconComp = ICON_REGISTRY[name];
  if (!IconComp) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      throw new Error(`MobileIcon received unknown icon name: "${String(name)}"`);
    }
    return null;
  }

  const resolvedSize = resolveIconSize(size);
  const resolvedColor = color ?? VARIANT_COLORS[variant];
  const isAccessible = Boolean(accessibilityLabel);

  return (
    <IconComp
      size={resolvedSize}
      color={resolvedColor}
      strokeWidth={strokeWidth}
      testID={testID ?? `mobile-icon-${name}`}
      accessible={isAccessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={isAccessible ? "image" : undefined}
    />
  );
}
