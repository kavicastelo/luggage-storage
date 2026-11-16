import type { BagCustodyItemInput } from "@luggage-storage/contracts";
import { marketplaceApi } from "../services/marketplace-api";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CounterCustodyHandoverParams {
  operationMode: "CHECK_IN" | "CHECK_OUT";
  verificationMethod: "QR_SCAN" | "PIN_FALLBACK";
  lookupQuery: string;
  credentialInput: string;
  reconciledBags: number;
  sealInput: string;
  collectionNotes: string;
  hasCollectionException: boolean;
  exceptionNotes: string;
  showDemoOps: boolean;
  isAuthenticated: boolean;
  bags?: BagCustodyItemInput[];
  zoneId?: string | null;
  bagCountExceptionReason?: string;
}

export type CounterCustodyHandoverResult =
  | { kind: "validation_error"; message: string }
  | { kind: "live_error"; message: string }
  | { kind: "live_success"; message: string }
  | { kind: "demo_simulation" };

export async function executeCounterCustodyHandover(
  params: CounterCustodyHandoverParams,
  api: Pick<
    typeof marketplaceApi,
    "verifyCustodyPass" | "completeCheckIn" | "completeCollection"
  > = marketplaceApi
): Promise<CounterCustodyHandoverResult> {
  const trimmedBookingId = params.lookupQuery.trim();
  const trimmedCredential = params.credentialInput.trim().replace(/\s+/g, "");

  if (!params.showDemoOps) {
    if (!params.isAuthenticated) {
      return {
        kind: "validation_error",
        message: "Sign in with an authorized Host account to execute counter custody handovers."
      };
    }
    if (!UUID_REGEX.test(trimmedBookingId)) {
      return {
        kind: "validation_error",
        message: "Enter a valid booking UUID to verify live custody credentials."
      };
    }
  }

  if (
    params.operationMode === "CHECK_OUT" &&
    params.hasCollectionException &&
    params.exceptionNotes.trim().length < 3
  ) {
    return {
      kind: "validation_error",
      message: "Enter exception details (at least 3 characters) when reporting a custody discrepancy."
    };
  }

  if (params.operationMode === "CHECK_IN" && !params.showDemoOps && params.bags && params.bags.length > 0) {
    const seenTags = new Set<string>();
    for (const bag of params.bags) {
      const normalizedTag = bag.bagTagCode.trim().toUpperCase();
      if (normalizedTag.length < 2 || seenTags.has(normalizedTag)) {
        return {
          kind: "validation_error",
          message: "Each bag requires a unique bag tag code (at least 2 characters)."
        };
      }
      seenTags.add(normalizedTag);
    }
  }

  if (params.isAuthenticated && UUID_REGEX.test(trimmedBookingId)) {
    try {
      const operation = params.operationMode === "CHECK_IN" ? "CHECK_IN" : "COLLECTION";
      const verification = await api.verifyCustodyPass(
        params.verificationMethod === "QR_SCAN"
          ? {
              bookingId: trimmedBookingId,
              operation,
              qrToken: trimmedCredential
            }
          : {
              bookingId: trimmedBookingId,
              operation,
              verificationPin: trimmedCredential
            }
      );

      const targetBookingId = verification.bookingId;
      if (params.operationMode === "CHECK_IN") {
        if (params.bags && params.bags.length > 0) {
          const trimmedReason = params.bagCountExceptionReason?.trim() || undefined;
          if (
            params.bags.length !== verification.expectedBagCount &&
            (!trimmedReason || trimmedReason.length < 5)
          ) {
            return {
              kind: "validation_error",
              message: `Bag count (${params.bags.length}) differs from booking (${verification.expectedBagCount}). Enter a bag count discrepancy reason (at least 5 characters).`
            };
          }

          const bagsToSubmit: BagCustodyItemInput[] = params.bags.map((bag) => ({
            bagTagCode: bag.bagTagCode.trim(),
            bagCategory: bag.bagCategory,
            securitySealNumber: bag.securitySealNumber?.trim() || null,
            zoneId: bag.zoneId ?? params.zoneId ?? null,
            photoFileKey: bag.photoFileKey?.trim() || null,
            conditionNotes: bag.conditionNotes?.trim() || null
          }));

          const checkInRes = await api.completeCheckIn(targetBookingId, {
            qrToken: params.verificationMethod === "QR_SCAN" ? trimmedCredential : undefined,
            verificationPin:
              params.verificationMethod === "PIN_FALLBACK" ? trimmedCredential : undefined,
            ...(params.zoneId ? { zoneId: params.zoneId } : {}),
            bags: bagsToSubmit,
            bagCountExceptionReason:
              bagsToSubmit.length !== verification.expectedBagCount ? trimmedReason : undefined
          });
          return {
            kind: "live_success",
            message: `Live Custody Check-In Completed: Booking ${verification.referenceCode} transitioned to ${checkInRes.status}. Reconciled ${bagsToSubmit.length} bags with tamper seals recorded.`
          };
        }

        const bagList = Array.from({ length: params.reconciledBags }, (_, idx) => ({
          bagTagCode: `TAG-${idx + 1}`,
          bagCategory: "BAG_MEDIUM" as const,
          securitySealNumber: `${params.sealInput}-${idx + 1}`
        }));
        const checkInRes = await api.completeCheckIn(targetBookingId, {
          qrToken: params.verificationMethod === "QR_SCAN" ? trimmedCredential : undefined,
          verificationPin:
            params.verificationMethod === "PIN_FALLBACK" ? trimmedCredential : undefined,
          ...(params.zoneId ? { zoneId: params.zoneId } : {}),
          bags: bagList,
          bagCountExceptionReason:
            params.reconciledBags !== verification.expectedBagCount
              ? "Bag count reconciled at Host Counter Web Desk"
              : undefined
        });
        return {
          kind: "live_success",
          message: `Live Custody Check-In Completed: Booking ${verification.referenceCode} transitioned to ${checkInRes.status}. Reconciled ${params.reconciledBags} bags with tamper seals recorded.`
        };
      }

      const collectionRes = await api.completeCollection(targetBookingId, {
        qrToken: params.verificationMethod === "QR_SCAN" ? trimmedCredential : undefined,
        verificationPin:
          params.verificationMethod === "PIN_FALLBACK" ? trimmedCredential : undefined,
        releasedBagCount: params.reconciledBags,
        collectionNotes: params.collectionNotes.trim() || undefined,
        exceptionNotes: params.hasCollectionException ? params.exceptionNotes.trim() : undefined
      });
      const overdueNote =
        collectionRes.overdueMinutes > 0
          ? ` Overdue notice logged (${collectionRes.overdueMinutes} min late) — baggage released immediately without possessory lien.`
          : "";
      return {
        kind: "live_success",
        message: `Live Baggage Release Completed: Booking ${verification.referenceCode} transitioned to ${collectionRes.status}.${overdueNote}`
      };
    } catch (err: unknown) {
      return {
        kind: "live_error",
        message: err instanceof Error ? err.message : "Counter verification failed."
      };
    }
  }

  return { kind: "demo_simulation" };
}

