import type {
  PayHereNativeCheckoutHandoff,
  PayHereWebCheckoutHandoff,
  PaymentCheckoutHandoff
} from "@luggage-storage/contracts";

export const ALLOWED_PAYHERE_CHECKOUT_URLS = new Set<string>([
  "https://sandbox.payhere.lk/pay/checkout",
  "https://www.payhere.lk/pay/checkout"
]);

const RESTRICTED_REFERRER_POLICIES = new Set(["no-referrer", "never", "same-origin"]);
const MOBILE_WEB_PENDING_CHECKOUT_KEY = "luggage_mobile_pending_checkout_v1";

export interface MobilePendingCheckoutContext {
  bookingId: string;
  intentId: string;
  orderId: string;
  provider: "STRIPE" | "PAYPAL" | "SANDBOX_GATEWAY" | "PAYHERE";
  channel: "WEB" | "MOBILE_APP";
  createdAt: string;
}

export function isStripeElementsHandoff(
  handoff: PaymentCheckoutHandoff | null | undefined
): boolean {
  return Boolean(handoff && handoff.mode === "STRIPE_ELEMENTS" && handoff.provider === "STRIPE");
}

export function isPayPalCheckoutHandoff(
  handoff: PaymentCheckoutHandoff | null | undefined
): boolean {
  return Boolean(handoff && handoff.mode === "PAYPAL_CHECKOUT" && handoff.provider === "PAYPAL");
}

export interface SanitizedMobileReturnQuery {
  bookingId: string | null;
  orderId: string | null;
  cancelledHint: boolean;
  ignoredQueryPaymentClaim: boolean;
}

export function isPayHereWebPostHandoff(
  handoff: PaymentCheckoutHandoff | null | undefined
): handoff is PayHereWebCheckoutHandoff {
  return Boolean(handoff && handoff.provider === "PAYHERE" && handoff.method === "POST_FORM");
}

export function isPayHereNativeSdkHandoff(
  handoff: PaymentCheckoutHandoff | null | undefined
): handoff is PayHereNativeCheckoutHandoff {
  return Boolean(handoff && handoff.provider === "PAYHERE" && handoff.method === "NATIVE_SDK");
}

export function assertSafeWebReferrerPolicy(doc: Document = document): void {
  const metaTags = doc.querySelectorAll?.('meta[name="referrer"]');
  if (!metaTags) return;
  for (const tag of Array.from(metaTags)) {
    const content = tag.getAttribute("content")?.trim().toLowerCase();
    if (content && RESTRICTED_REFERRER_POLICIES.has(content)) {
      throw new Error(
        `Unsafe document referrer policy "${content}" prevents PayHere domain verification`
      );
    }
  }
}

/**
 * Builds an auto-submitting hidden POST form from the registered Expo Web origin directly
 * to PayHere Checkout API, preserving server-generated fields verbatim without exposing secrets.
 */
export function buildPayHereWebCheckoutForm(
  handoff: PayHereWebCheckoutHandoff,
  doc: Document = document
): HTMLFormElement {
  if (!ALLOWED_PAYHERE_CHECKOUT_URLS.has(handoff.actionUrl)) {
    throw new Error(`Untrusted PayHere actionUrl: ${handoff.actionUrl}`);
  }
  assertSafeWebReferrerPolicy(doc);

  const form = doc.createElement("form");
  form.method = "POST";
  form.action = handoff.actionUrl;
  form.style.display = "none";
  form.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  if ("referrerPolicy" in form) {
    (form as HTMLFormElement & { referrerPolicy?: string }).referrerPolicy =
      "strict-origin-when-cross-origin";
  }
  form.setAttribute("data-testid", "mobile-web-payhere-post-form");

  for (const [name, value] of Object.entries(handoff.fields)) {
    if (typeof value !== "string") continue;
    const input = doc.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  return form;
}

export function submitPayHereWebCheckoutForm(
  handoff: PayHereWebCheckoutHandoff,
  doc: Document = document
): HTMLFormElement {
  const form = buildPayHereWebCheckoutForm(handoff, doc);
  doc.body.appendChild(form);
  form.submit();
  return form;
}

/**
 * Parses URL query parameters after PayHere return_url/cancel_url strictly as lookup hints.
 * Never trusts query-string payment status claims (?status=paid, ?status_code=2, ?md5sig=...).
 */
export function parseMobileCheckoutReturnQuery(search: string): SanitizedMobileReturnQuery {
  const params = new URLSearchParams(search);
  const bookingId = params.get("bookingId");
  const orderId = params.get("order_id") || params.get("orderId");
  const cancelledRaw = params.get("cancelled");
  const hasForgedClaim =
    params.has("status") ||
    params.has("status_code") ||
    params.has("payment_id") ||
    params.has("md5sig") ||
    params.has("paid");

  return {
    bookingId: bookingId ? bookingId.trim() : null,
    orderId: orderId ? orderId.trim() : null,
    cancelledHint: cancelledRaw === "1" || cancelledRaw === "true",
    ignoredQueryPaymentClaim: hasForgedClaim
  };
}

export function saveMobilePendingCheckoutContext(
  ctx: MobilePendingCheckoutContext,
  storage?: Pick<Storage, "setItem">
): void {
  const target = storage ?? (typeof window !== "undefined" ? window.sessionStorage : undefined);
  if (!target) return;
  try {
    target.setItem(MOBILE_WEB_PENDING_CHECKOUT_KEY, JSON.stringify(ctx));
  } catch {
    // Ignore storage quota or restricted browsing errors
  }
}

export function loadMobilePendingCheckoutContext(
  storage?: Pick<Storage, "getItem">
): MobilePendingCheckoutContext | null {
  const target = storage ?? (typeof window !== "undefined" ? window.sessionStorage : undefined);
  if (!target) return null;
  try {
    const raw = target.getItem(MOBILE_WEB_PENDING_CHECKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MobilePendingCheckoutContext>;
    if (typeof parsed.bookingId === "string" && typeof parsed.orderId === "string") {
      return {
        bookingId: parsed.bookingId,
        intentId: typeof parsed.intentId === "string" ? parsed.intentId : "",
        orderId: parsed.orderId,
        provider:
          parsed.provider === "STRIPE"
            ? "STRIPE"
            : parsed.provider === "PAYPAL"
            ? "PAYPAL"
            : parsed.provider === "PAYHERE"
            ? "PAYHERE"
            : "SANDBOX_GATEWAY",
        channel: parsed.channel === "MOBILE_APP" ? "MOBILE_APP" : "WEB",
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : ""
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function clearMobilePendingCheckoutContext(storage?: Pick<Storage, "removeItem">): void {
  const target = storage ?? (typeof window !== "undefined" ? window.sessionStorage : undefined);
  if (!target) return;
  try {
    target.removeItem(MOBILE_WEB_PENDING_CHECKOUT_KEY);
  } catch {
    // Ignore
  }
}
