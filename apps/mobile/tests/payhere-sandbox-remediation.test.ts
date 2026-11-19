import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import type { PayHereNativeSdkPayload } from "@luggage-storage/contracts";
import { launchPayHereNativeCheckout } from "../src/lib/payhere-native";
import {
  clearMobilePendingCheckoutContext,
  loadMobilePendingCheckoutContext,
  parseMobileCheckoutReturnQuery,
  saveMobilePendingCheckoutContext
} from "../src/lib/payment-handoff";


const VALID_SDK_PAYLOAD: PayHereNativeSdkPayload = {
  sandbox: true,
  merchant_id: "1219999",
  notify_url: "https://api.luggagevault.lk/api/v1/payments/webhooks/payhere",
  order_id: "ORD-LGS-MOB-001",
  items: "Luggage Storage Booking LGS-MOB001",
  amount: "1500.00",
  currency: "LKR",
  first_name: "Nadeesha",
  last_name: "Silva",
  email: "nadeesha@example.com",
  phone: "+94771234567",
  address: "100 Galle Road",
  city: "Colombo",
  country: "Sri Lanka",
  custom_1: "11111111-2222-4333-8444-555555555555",
  custom_2: "LGS-MOB001"
};

describe("PayHere Sandbox Remediation — Mobile Web Checkout & Android Native SDK Integration", () => {
  const mobileRoot = path.resolve(__dirname, "..");
  const repoRoot = path.resolve(mobileRoot, "../..");

  it("1. enforces removal of PayHere native SDK, plugin, and patches from mobile configuration", () => {
    const appJson = JSON.parse(fs.readFileSync(path.join(mobileRoot, "app.json"), "utf8")) as {
      expo: {
        android?: { package?: string };
        plugins?: unknown[];
      };
    };
    expect(appJson.expo.android?.package).toBe("com.luggagestorage.app");
    expect(appJson.expo.plugins).toContain("expo-dev-client");
    expect(appJson.expo.plugins).not.toContain("./plugins/withPayHereSdk");

    const mobilePkg = JSON.parse(fs.readFileSync(path.join(mobileRoot, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(mobilePkg.dependencies["@payhere/payhere-mobilesdk-reactnative"]).toBeUndefined();
    expect(mobilePkg.dependencies["expo-dev-client"]).toBeDefined();

    const patchPath = path.join(
      repoRoot,
      "patches/@payhere__payhere-mobilesdk-reactnative@4.1.0.patch"
    );
    expect(fs.existsSync(patchPath)).toBe(false);

    const workspaceYaml = fs.readFileSync(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8");
    expect(workspaceYaml).not.toContain("@payhere/payhere-mobilesdk-reactnative@4.1.0");
  });

  it("2. confirms decommission of withPayHereSdk config plugin file", () => {
    const pluginPath = path.join(mobileRoot, "plugins/withPayHereSdk.js");
    expect(fs.existsSync(pluginPath)).toBe(false);
  });

  it("3. launchPayHereNativeCheckout refuses web, handles Expo Go cleanly, validates strict payload, and returns untrusted SDK callbacks", async () => {
    const webBlocked = await launchPayHereNativeCheckout(VALID_SDK_PAYLOAD, {
      platformOs: "web",
      hasNativeBridge: true,
      sdkModule: { startPayment: vi.fn() }
    });
    expect(webBlocked.status).toBe("ERROR");

    const expoGoErr = await launchPayHereNativeCheckout(VALID_SDK_PAYLOAD, {
      platformOs: "android",
      hasNativeBridge: false,
      sdkModule: null
    });
    expect(expoGoErr.status).toBe("ERROR");
    if (expoGoErr.status === "ERROR") {
      expect(expoGoErr.message).toMatch(/expo-dev-client/i);
    }

    const startPaymentSpy = vi.fn(
      (
        _payload: PayHereNativeSdkPayload,
        onCompleted: (id: string) => void,
        _onError: (e: string) => void,
        onDismissed: () => void
      ) => {
        onCompleted("PH-NATIVE-777");
        onDismissed(); // Duplicate late callback ignored
      }
    );

    const completed = await launchPayHereNativeCheckout(VALID_SDK_PAYLOAD, {
      platformOs: "android",
      hasNativeBridge: true,
      sdkModule: { startPayment: startPaymentSpy }
    });
    expect(startPaymentSpy).toHaveBeenCalledTimes(1);
    expect(startPaymentSpy).toHaveBeenCalledWith(
      VALID_SDK_PAYLOAD,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function)
    );
    expect(completed).toEqual({ status: "COMPLETED", paymentId: "PH-NATIVE-777" });

    const dismissed = await launchPayHereNativeCheckout(VALID_SDK_PAYLOAD, {
      platformOs: "android",
      hasNativeBridge: true,
      sdkModule: {
        startPayment: (_payload, _onC, _onE, onDismissed) => onDismissed()
      }
    });
    expect(dismissed).toEqual({ status: "DISMISSED" });

    const errored = await launchPayHereNativeCheckout(VALID_SDK_PAYLOAD, {
      platformOs: "android",
      hasNativeBridge: true,
      sdkModule: {
        startPayment: (_payload, _onC, onError) => onError("Card declined")
      }
    });
    expect(errored).toEqual({ status: "ERROR", message: "Card declined" });

    const badAmount = await launchPayHereNativeCheckout(
      { ...VALID_SDK_PAYLOAD, amount: "1500" },
      {
        platformOs: "android",
        hasNativeBridge: true,
        sdkModule: { startPayment: vi.fn() }
      }
    );
    expect(badAmount.status).toBe("ERROR");
  });

  it("4. registers Expo Web /booking/confirm route, ignores forged return URLs, and round-trips mobile pending checkout context", () => {
    const layoutSrc = fs.readFileSync(path.join(mobileRoot, "app/_layout.tsx"), "utf8");
    expect(layoutSrc).toContain('name="booking/confirm"');

    const confirmSrc = fs.readFileSync(path.join(mobileRoot, "app/booking/confirm.tsx"), "utf8");
    expect(confirmSrc).toContain("getCheckoutStatus");
    expect(confirmSrc).not.toContain("simulateSandboxPayment");

    const forged = parseMobileCheckoutReturnQuery(
      "?bookingId=22222222-3333-4444-8555-666666666666&order_id=ORD-99&status=paid&status_code=2&md5sig=FORGED&cancelled=1"
    );
    expect(forged.bookingId).toBe("22222222-3333-4444-8555-666666666666");
    expect(forged.orderId).toBe("ORD-99");
    expect(forged.cancelledHint).toBe(true);
    expect(forged.ignoredQueryPaymentClaim).toBe(true);

    const store = new Map<string, string>();
    const storageStub: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v);
      },
      removeItem: (k) => {
        store.delete(k);
      }
    };

    saveMobilePendingCheckoutContext(
      {
        bookingId: "22222222-3333-4444-8555-666666666666",
        intentId: "11111111-2222-4333-8444-555555555555",
        orderId: "ORD-99",
        provider: "PAYHERE",
        channel: "WEB",
        createdAt: "2026-11-15T00:00:00.000Z"
      },
      storageStub
    );
    const loaded = loadMobilePendingCheckoutContext(storageStub);
    expect(loaded?.channel).toBe("WEB");
    expect(loaded?.provider).toBe("PAYHERE");

    clearMobilePendingCheckoutContext(storageStub);
    expect(loadMobilePendingCheckoutContext(storageStub)).toBeNull();
  });
});

