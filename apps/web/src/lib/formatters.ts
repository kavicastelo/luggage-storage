import type { BagCategory, PricingUnit } from "@luggage-storage/contracts";

const COLOMBO_TIMEZONE = "Asia/Colombo";
const COLOMBO_UTC_OFFSET = "+05:30";

/**
 * Formats an amount stored in integer minor units (e.g., paisa / cents) as human-readable currency.
 */
export function formatLkrMinor(
  amountMinor: number,
  currency = "LKR",
  exponent = 2
): string {
  const safeMinor = Number.isFinite(amountMinor) ? amountMinor : 0;
  const divisor = Math.pow(10, exponent);
  const major = safeMinor / divisor;
  const formatted = major.toLocaleString("en-LK", {
    minimumFractionDigits: safeMinor % divisor === 0 ? 0 : exponent,
    maximumFractionDigits: exponent
  });
  return `${currency} ${formatted}`;
}

function getTimeZoneDateParts(date: Date, timeZone = COLOMBO_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
    hour: lookup("hour"),
    minute: lookup("minute")
  };
}

/**
 * Computes a default upcoming drop-off / pick-up window in Asia/Colombo time
 * so live bookings never submit stale static dates.
 */
export function getColomboDefaultSchedule(nowMs = Date.now()): {
  dropOffLocal: string;
  collectionLocal: string;
  dropOffIso: string;
  collectionIso: string;
} {
  // Round up at least 60 minutes from now to avoid immediate expiration edge cases, snapped to 30-min marks.
  const halfHourMs = 30 * 60 * 1000;
  const dropOffMs = Math.ceil((nowMs + 60 * 60 * 1000) / halfHourMs) * halfHourMs;
  const collectionMs = dropOffMs + 6 * 60 * 60 * 1000;

  const dropParts = getTimeZoneDateParts(new Date(dropOffMs));
  const collectParts = getTimeZoneDateParts(new Date(collectionMs));

  const dropOffLocal = `${dropParts.year}-${dropParts.month}-${dropParts.day}T${dropParts.hour}:${dropParts.minute}`;
  const collectionLocal = `${collectParts.year}-${collectParts.month}-${collectParts.day}T${collectParts.hour}:${collectParts.minute}`;

  return {
    dropOffLocal,
    collectionLocal,
    dropOffIso: `${dropOffLocal}:00${COLOMBO_UTC_OFFSET}`,
    collectionIso: `${collectionLocal}:00${COLOMBO_UTC_OFFSET}`
  };
}

/**
 * Converts an HTML `<input type="datetime-local">` value (`YYYY-MM-DDTHH:mm`)
 * into a strict RFC-3339 / ISO-8601 timestamp with timezone offset.
 */
export function toIsoOffsetFromLocalInput(
  localDateTime: string,
  offset = COLOMBO_UTC_OFFSET
): string {
  const trimmed = localDateTime.trim();
  if (!trimmed) return "";

  // Already includes offset or Z
  if (/([+-]\d{2}:\d{2}|Z)$/i.test(trimmed)) {
    return trimmed;
  }

  // `YYYY-MM-DDTHH:mm` -> append seconds + offset
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00${offset}`;
  }

  // `YYYY-MM-DDTHH:mm:ss` -> append offset
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}${offset}`;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

/**
 * Converts an ISO timestamp back to `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`.
 */
export function toLocalInputFromIso(
  iso: string,
  timeZone = COLOMBO_TIMEZONE
): string {
  const trimmed = iso.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const parts = getTimeZoneDateParts(parsed, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatDateTimeDisplay(
  iso: string,
  timeZone = COLOMBO_TIMEZONE
): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(parsed);
}

const ISO_WEEKDAY_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday"
};

/**
 * Maps ISO weekday (`1 = Monday` ... `7 = Sunday`) matching PostgreSQL opening_hours schema.
 */
export function formatDayOfWeek(dayOfWeek: number): string {
  return ISO_WEEKDAY_LABELS[dayOfWeek] ?? `Day ${dayOfWeek}`;
}

export function formatPricingUnitLabel(unit: PricingUnit | string): string {
  switch (unit) {
    case "PER_HOUR":
      return "per hour";
    case "PER_DAY":
      return "per day";
    default:
      return unit.toLowerCase().replace(/_/g, " ");
  }
}

export function formatBagCategoryLabel(category: BagCategory | string): string {
  switch (category) {
    case "SMALL":
      return "Small";
    case "MEDIUM":
      return "Medium";
    case "LARGE":
      return "Large";
    case "OVERSIZED":
      return "Oversized";
    default:
      return category;
  }
}

const AMENITY_LABELS: Record<string, string> = {
  "24_7_ACCESS": "24/7 Access",
  CCTV: "24/7 CCTV Monitoring",
  CLIMATE_CONTROLLED: "Climate Controlled",
  CLIMATE_CONTROL: "Climate Controlled",
  LOCKERS: "Individual Lockers",
  STAFFED_COUNTER: "Staffed Custody Counter",
  TAMPER_SEALS: "Tamper-Evident Seals",
  OVERSIZED_STORAGE: "Oversized Gear Storage",
  WHEELCHAIR_ACCESSIBLE: "Step-Free Access",
  WIFI: "Guest Wi-Fi",
  WAITING_LOUNGE: "Air-Conditioned Lounge"
};

export function formatAmenityLabel(amenity: string): string {
  const key = amenity.trim().toUpperCase();
  if (AMENITY_LABELS[key]) {
    return AMENITY_LABELS[key];
  }
  return key
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRefundStatusDisplay(status: string): {
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
} {
  switch (status.toUpperCase()) {
    case "SUCCEEDED":
      return { label: "Refund Settled", tone: "success" };
    case "PROCESSING":
      return { label: "Bank / Gateway Processing", tone: "info" };
    case "INITIATED":
      return { label: "Dispatched to Gateway", tone: "info" };
    case "AUTHORIZED":
      return { label: "Authorized for Refund", tone: "info" };
    case "REQUESTED":
      return { label: "Refund Requested", tone: "warning" };
    case "MANUAL_REVIEW_REQUIRED":
      return { label: "Manual Review Required", tone: "warning" };
    case "FAILED":
      return { label: "Refund Failed", tone: "danger" };
    default:
      return { label: status.replace(/_/g, " "), tone: "neutral" };
  }
}
