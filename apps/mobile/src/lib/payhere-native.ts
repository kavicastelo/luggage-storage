import { NativeModules, Platform } from "react-native";
import {
  PayHereNativeSdkPayload,
  PayHereNativeSdkPayloadSchema
} from "@luggage-storage/contracts";

export type PayHereNativeOutcome =
  | { status: "COMPLETED"; paymentId: string }
  | { status: "DISMISSED" }
  | { status: "ERROR"; message: string };

export interface PayHereNativeModuleLike {
  startPayment(
    paymentObject: PayHereNativeSdkPayload,
    onCompleted: (paymentId: string) => void,
    onError: (errorData: string) => void,
    onDismissed: () => void
  ): void;
}

export interface LaunchPayHereNativeDependencies {
  platformOs?: string;
  sdkModule?: PayHereNativeModuleLike | null;
  hasNativeBridge?: boolean;
}

function resolveDefaultSdkModule(): {
  sdkModule: PayHereNativeModuleLike | null;
  hasNativeBridge: boolean;
} {
  const nativeBridge = Boolean(
    NativeModules && typeof NativeModules === "object" && "PayhereOfficial" in NativeModules && NativeModules.PayhereOfficial
  );
  if (!nativeBridge) {
    return { sdkModule: null, hasNativeBridge: false };
  }

  try {
    // Load dynamically so web bundles and non-native test runners never fail on native bridge evaluation.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const required = require("@payhere/payhere-mobilesdk-reactnative") as
      | { default?: PayHereNativeModuleLike }
      | PayHereNativeModuleLike;
    const mod =
      required && "default" in required && required.default
        ? required.default
        : (required as PayHereNativeModuleLike);
    return {
      sdkModule: mod && typeof mod.startPayment === "function" ? mod : null,
      hasNativeBridge: true
    };
  } catch {
    return { sdkModule: null, hasNativeBridge: nativeBridge };
  }
}

/**
 * @deprecated Legacy adapter retained exclusively for historical test invariant verification.
 * Active runtime checkout uses Stripe and PayPal via provider-agnostic handoff.
 */
export async function launchPayHereNativeCheckout(
  rawSdkPayload: PayHereNativeSdkPayload,
  deps?: LaunchPayHereNativeDependencies
): Promise<PayHereNativeOutcome> {
  const platformOs = deps?.platformOs ?? Platform.OS;
  if (platformOs === "web") {
    return {
      status: "ERROR",
      message: "PayHere native mobile SDK cannot run on web; use direct web POST checkout."
    };
  }

  const parsed = PayHereNativeSdkPayloadSchema.safeParse(rawSdkPayload);
  if (!parsed.success) {
    return {
      status: "ERROR",
      message: "PayHere native checkout payload failed contract validation."
    };
  }

  let sdkModule = deps?.sdkModule ?? null;
  let hasNativeBridge = deps?.hasNativeBridge ?? Boolean(deps?.sdkModule);

  if (!deps?.sdkModule) {
    const resolved = resolveDefaultSdkModule();
    sdkModule = resolved.sdkModule;
    hasNativeBridge = deps?.hasNativeBridge ?? resolved.hasNativeBridge;
  }

  if (!hasNativeBridge || !sdkModule || typeof sdkModule.startPayment !== "function") {
    return {
      status: "ERROR",
      message:
        "PayHere native checkout requires an expo-dev-client or native Android build (PayhereOfficial module is unavailable in Expo Go)."
    };
  }

  return new Promise<PayHereNativeOutcome>((resolve) => {
    let settled = false;
    const settleOnce = (outcome: PayHereNativeOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    try {
      sdkModule.startPayment(
        parsed.data,
        (paymentId: string) => {
          settleOnce({
            status: "COMPLETED",
            paymentId: typeof paymentId === "string" ? paymentId : String(paymentId ?? "")
          });
        },
        (errorData: string) => {
          const message =
            typeof errorData === "string" && errorData.trim().length > 0
              ? errorData.trim()
              : "PayHere native checkout could not complete.";
          settleOnce({ status: "ERROR", message });
        },
        () => {
          settleOnce({ status: "DISMISSED" });
        }
      );
    } catch (err: unknown) {
      settleOnce({
        status: "ERROR",
        message: err instanceof Error ? err.message : "Failed to start PayHere native checkout."
      });
    }
  });
}
