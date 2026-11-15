import type {
  BagCategory,
  BookingDetail,
  BookingStatus,
  DiscoverySortOption
} from "@luggage-storage/contracts";
import { DISCOVERY_SORT_OPTIONS } from "@luggage-storage/contracts";
import {
  getColomboDefaultSchedule,
  toIsoOffsetFromLocalInput,
  toLocalInputFromIso
} from "@/lib/formatters";

export type TravellerBagCounts = Record<BagCategory, number>;

export const DEFAULT_BAG_COUNTS: TravellerBagCounts = {
  BAG_SMALL: 0,
  BAG_MEDIUM: 1,
  BAG_LARGE: 0,
  BAG_OVERSIZED: 0
};

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined | null): value is string {
  return Boolean(value && UUID_PATTERN.test(value.trim()));
}

export interface ParsedTravellerSearchParams {
  city: string;
  searchTerm: string;
  dropOffIso: string;
  collectionIso: string;
  dropOffLocal: string;
  collectionLocal: string;
  bags: TravellerBagCounts;
  acceptsOversized: boolean;
  sortBy?: DiscoverySortOption;
  latitude?: number;
  longitude?: number;
}

function parseNonNegativeInt(raw: string | null, fallback = 0): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 50) : fallback;
}

function parseOptionalCoord(raw: string | null, min: number, max: number): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
}

export function parseTravellerScheduleParams(
  search: string,
  nowMs?: number
): ParsedTravellerSearchParams {
  const params = new URLSearchParams(search);
  const defaults = getColomboDefaultSchedule(nowMs);

  const rawDropOff = params.get("dropOffAt");
  const rawCollection = params.get("collectionAt");

  const resolvedDropOffIso = rawDropOff
    ? toIsoOffsetFromLocalInput(rawDropOff) || defaults.dropOffIso
    : defaults.dropOffIso;

  let resolvedCollectionIso = rawCollection
    ? toIsoOffsetFromLocalInput(rawCollection) || defaults.collectionIso
    : defaults.collectionIso;

  if (new Date(resolvedCollectionIso).getTime() <= new Date(resolvedDropOffIso).getTime()) {
    resolvedCollectionIso = defaults.collectionIso;
    if (new Date(resolvedCollectionIso).getTime() <= new Date(resolvedDropOffIso).getTime()) {
      const shifted = new Date(new Date(resolvedDropOffIso).getTime() + 6 * 3600_000).toISOString();
      resolvedCollectionIso = shifted;
    }
  }

  const hasExplicitBagParam =
    params.has("smallBags") ||
    params.has("mediumBags") ||
    params.has("largeBags") ||
    params.has("oversizedBags");

  const bags: TravellerBagCounts = hasExplicitBagParam
    ? {
        BAG_SMALL: parseNonNegativeInt(params.get("smallBags"), 0),
        BAG_MEDIUM: parseNonNegativeInt(params.get("mediumBags"), 0),
        BAG_LARGE: parseNonNegativeInt(params.get("largeBags"), 0),
        BAG_OVERSIZED: parseNonNegativeInt(params.get("oversizedBags"), 0)
      }
    : { ...DEFAULT_BAG_COUNTS };

  const sortRaw = params.get("sortBy") ?? undefined;
  const sortBy = DISCOVERY_SORT_OPTIONS.includes(sortRaw as DiscoverySortOption)
    ? (sortRaw as DiscoverySortOption)
    : undefined;

  const acceptsOversizedRaw = params.get("acceptsOversized");
  const acceptsOversized =
    acceptsOversizedRaw === "true" || acceptsOversizedRaw === "1" || bags.BAG_OVERSIZED > 0;

  return {
    city: params.get("city")?.trim() ?? "",
    searchTerm: params.get("searchTerm")?.trim() ?? "",
    dropOffIso: resolvedDropOffIso,
    collectionIso: resolvedCollectionIso,
    dropOffLocal: toLocalInputFromIso(resolvedDropOffIso) || defaults.dropOffLocal,
    collectionLocal: toLocalInputFromIso(resolvedCollectionIso) || defaults.collectionLocal,
    bags,
    acceptsOversized,
    sortBy,
    latitude: parseOptionalCoord(params.get("latitude"), -90, 90),
    longitude: parseOptionalCoord(params.get("longitude"), -180, 180)
  };
}

export function countTotalBags(bags: TravellerBagCounts): number {
  return bags.BAG_SMALL + bags.BAG_MEDIUM + bags.BAG_LARGE + bags.BAG_OVERSIZED;
}

export function buildTravellerScheduleQuery(params: {
  city?: string;
  searchTerm?: string;
  dropOffAt?: string;
  collectionAt?: string;
  bags?: Partial<TravellerBagCounts>;
  acceptsOversized?: boolean;
  sortBy?: DiscoverySortOption;
  latitude?: number;
  longitude?: number;
  preserveDemoPreview?: boolean;
}): string {
  const query = new URLSearchParams();
  if (params.city) query.set("city", params.city);
  if (params.searchTerm) query.set("searchTerm", params.searchTerm);
  if (params.dropOffAt) query.set("dropOffAt", params.dropOffAt);
  if (params.collectionAt) query.set("collectionAt", params.collectionAt);
  if (params.bags) {
    if (params.bags.BAG_SMALL !== undefined) query.set("smallBags", String(params.bags.BAG_SMALL));
    if (params.bags.BAG_MEDIUM !== undefined) query.set("mediumBags", String(params.bags.BAG_MEDIUM));
    if (params.bags.BAG_LARGE !== undefined) query.set("largeBags", String(params.bags.BAG_LARGE));
    if (params.bags.BAG_OVERSIZED !== undefined) {
      query.set("oversizedBags", String(params.bags.BAG_OVERSIZED));
    }
  }
  if (params.acceptsOversized) query.set("acceptsOversized", "true");
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.latitude !== undefined && params.longitude !== undefined) {
    query.set("latitude", params.latitude.toFixed(4));
    query.set("longitude", params.longitude.toFixed(4));
  }
  if (params.preserveDemoPreview) {
    query.set("preview", "demo");
  }
  return query.toString();
}

export interface CheckoutBillingState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
}

export const EMPTY_BILLING_STATE: CheckoutBillingState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: ""
};

export interface CheckoutDraftState {
  locId: string;
  dropOffLocal: string;
  collectionLocal: string;
  bags: TravellerBagCounts;
  travellerNotes: string;
  billing: CheckoutBillingState;
  savedAt: string;
}

function getCheckoutDraftKey(locId: string): string {
  return `luggage_checkout_draft_v1:${locId}`;
}

export function saveCheckoutDraft(
  draft: CheckoutDraftState,
  storage?: Pick<Storage, "setItem">
): void {
  const target = storage ?? (typeof window !== "undefined" ? window.sessionStorage : undefined);
  if (!target || !draft.locId) return;
  try {
    target.setItem(getCheckoutDraftKey(draft.locId), JSON.stringify(draft));
  } catch {
    // Ignore restricted sessionStorage errors
  }
}

export function loadCheckoutDraft(
  locId: string,
  storage?: Pick<Storage, "getItem">
): CheckoutDraftState | null {
  const target = storage ?? (typeof window !== "undefined" ? window.sessionStorage : undefined);
  if (!target || !locId) return null;
  try {
    const raw = target.getItem(getCheckoutDraftKey(locId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckoutDraftState>;
    if (parsed.locId !== locId || typeof parsed.dropOffLocal !== "string") {
      return null;
    }
    return {
      locId,
      dropOffLocal: parsed.dropOffLocal,
      collectionLocal:
        typeof parsed.collectionLocal === "string" ? parsed.collectionLocal : "",
      bags: {
        BAG_SMALL: Number(parsed.bags?.BAG_SMALL ?? 0),
        BAG_MEDIUM: Number(parsed.bags?.BAG_MEDIUM ?? 0),
        BAG_LARGE: Number(parsed.bags?.BAG_LARGE ?? 0),
        BAG_OVERSIZED: Number(parsed.bags?.BAG_OVERSIZED ?? 0)
      },
      travellerNotes: typeof parsed.travellerNotes === "string" ? parsed.travellerNotes : "",
      billing: {
        firstName: parsed.billing?.firstName ?? "",
        lastName: parsed.billing?.lastName ?? "",
        email: parsed.billing?.email ?? "",
        phone: parsed.billing?.phone ?? "",
        address: parsed.billing?.address ?? "",
        city: parsed.billing?.city ?? "",
        country: parsed.billing?.country ?? ""
      },
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : ""
    };
  } catch {
    return null;
  }
}

export function clearCheckoutDraft(
  locId: string,
  storage?: Pick<Storage, "removeItem">
): void {
  const target = storage ?? (typeof window !== "undefined" ? window.sessionStorage : undefined);
  if (!target || !locId) return;
  try {
    target.removeItem(getCheckoutDraftKey(locId));
  } catch {
    // Ignore
  }
}

export interface TravellerCancellationPreview {
  cancellable: boolean;
  requiresRefund: boolean;
  refundPercentage: number;
  estimatedRefundMinor: number;
  tierLabel: string;
}

/**
 * Computes cancellation refund tier preview matching backend OQ-009 rules.
 */
export function evaluateTravellerCancellationPreview(params: {
  status: BookingStatus | string;
  dropOffAt: string;
  totalAmountMinor: number;
  paymentSucceeded: boolean;
  nowMs?: number;
}): TravellerCancellationPreview {
  if (params.status === "PENDING_HOST_APPROVAL" || params.status === "PENDING_PAYMENT") {
    return {
      cancellable: true,
      requiresRefund: false,
      refundPercentage: 0,
      estimatedRefundMinor: 0,
      tierLabel: "Unpaid hold release — no payment was captured"
    };
  }

  if (params.status !== "CONFIRMED") {
    return {
      cancellable: false,
      requiresRefund: false,
      refundPercentage: 0,
      estimatedRefundMinor: 0,
      tierLabel: "Cancellation is not available for the current booking status"
    };
  }

  if (!params.paymentSucceeded) {
    return {
      cancellable: true,
      requiresRefund: false,
      refundPercentage: 0,
      estimatedRefundMinor: 0,
      tierLabel: "Reservation hold cancellation"
    };
  }

  const dropOffMs = new Date(params.dropOffAt).getTime();
  const nowMs = params.nowMs ?? Date.now();
  const msUntilDropOff = dropOffMs - nowMs;
  const twoHoursMs = 2 * 60 * 60 * 1000;

  if (msUntilDropOff > twoHoursMs) {
    return {
      cancellable: true,
      requiresRefund: true,
      refundPercentage: 100,
      estimatedRefundMinor: params.totalAmountMinor,
      tierLabel: "Full 100% refund (>2 hours before scheduled drop-off)"
    };
  }

  if (msUntilDropOff > 0) {
    return {
      cancellable: true,
      requiresRefund: true,
      refundPercentage: 50,
      estimatedRefundMinor: Math.floor((params.totalAmountMinor * 50) / 100),
      tierLabel: "Partial 50% refund (within 2 hours of scheduled drop-off)"
    };
  }

  return {
    cancellable: true,
    requiresRefund: false,
    refundPercentage: 0,
    estimatedRefundMinor: 0,
    tierLabel: "0% refund (at or after scheduled drop-off time)"
  };
}

const ACTIVE_PORTAL_STATUSES = new Set<string>([
  "PENDING_HOST_APPROVAL",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "IN_STORAGE",
  "DISPUTED"
]);

export function classifyTravellerPortalTab(booking: BookingDetail): "active" | "past" {
  return ACTIVE_PORTAL_STATUSES.has(booking.status) ? "active" : "past";
}

export function hasBookingRefundRecord(booking: BookingDetail): boolean {
  return booking.refundSummary !== null;
}
