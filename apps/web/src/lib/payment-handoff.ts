import type { PayHereCheckoutHandoff, PaymentCheckoutHandoff } from "@luggage-storage/contracts";

export const ALLOWED_PAYHERE_CHECKOUT_URLS = new Set<string>([
  "https://sandbox.payhere.lk/pay/checkout",
  "https://www.payhere.lk/pay/checkout"
]);

const PENDING_CHECKOUT_STORAGE_KEY = "luggage_pending_checkout_v1";

export interface PendingCheckoutContext {
  bookingId: string;
  intentId: string;
  orderId: string;
  provider: "PAYHERE" | "SANDBOX_GATEWAY";
  createdAt: string;
}

export interface SanitizedReturnQueryFlags {
  bookingId: string | null;
  orderId: string | null;
  cancelledHint: boolean;
  ignoredQueryPaymentClaim: boolean;
}

/**
 * Parses URL return query parameters strictly as navigation hints.
 * Never trusts query-string payment status claims (e.g., ?status=paid, ?status_code=2, ?payment_id=...).
 */
export function parseCheckoutReturnQuery(search: string): SanitizedReturnQueryFlags {
  const params = new URLSearchParams(search);
  const bookingId = params.get("bookingId");
  const orderId = params.get("order_id") || params.get("orderId");
  const cancelledRaw = params.get("cancelled");
  const hasForgedPaymentClaim =
    params.has("status") ||
    params.has("status_code") ||
    params.has("payment_id") ||
    params.has("md5sig") ||
    params.has("paid");

  return {
    bookingId: bookingId ? bookingId.trim() : null,
    orderId: orderId ? orderId.trim() : null,
    cancelledHint: cancelledRaw === "1" || cancelledRaw === "true",
    ignoredQueryPaymentClaim: hasForgedPaymentClaim
  };
}

export function savePendingCheckoutContext(
  ctx: PendingCheckoutContext,
  storage?: Pick<Storage, "setItem">
): void {
  const target = storage ?? (typeof window !== "undefined" ? window.sessionStorage : undefined);
  if (!target) return;
  try {
    target.setItem(PENDING_CHECKOUT_STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // Ignore storage quota or restricted browsing errors
  }
}

export function loadPendingCheckoutContext(
  storage?: Pick<Storage, "getItem">
): PendingCheckoutContext | null {
  const target = storage ?? (typeof window !== "undefined" ? window.sessionStorage : undefined);
  if (!target) return null;
  try {
    const raw = target.getItem(PENDING_CHECKOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingCheckoutContext>;
    if (typeof parsed.bookingId === "string" && typeof parsed.orderId === "string") {
      return {
        bookingId: parsed.bookingId,
        intentId: typeof parsed.intentId === "string" ? parsed.intentId : "",
        orderId: parsed.orderId,
        provider: parsed.provider === "PAYHERE" ? "PAYHERE" : "SANDBOX_GATEWAY",
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : ""
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function clearPendingCheckoutContext(storage?: Pick<Storage, "removeItem">): void {
  const target = storage ?? (typeof window !== "undefined" ? window.sessionStorage : undefined);
  if (!target) return;
  try {
    target.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function isPayHerePostHandoff(
  handoff: PaymentCheckoutHandoff | null | undefined
): handoff is PayHereCheckoutHandoff {
  return Boolean(handoff && handoff.method === "POST_FORM" && handoff.provider === "PAYHERE");
}

/**
 * Creates a hidden HTML form with POST method targeting the verified PayHere action URL
 * and strictly copies server-generated PayHere checkout fields verbatim without mutation.
 */
export function buildPayHereCheckoutForm(
  handoff: PayHereCheckoutHandoff,
  doc: Document = document
): HTMLFormElement {
  if (!ALLOWED_PAYHERE_CHECKOUT_URLS.has(handoff.actionUrl)) {
    throw new Error(`Untrusted PayHere actionUrl: ${handoff.actionUrl}`);
  }

  const form = doc.createElement("form");
  form.method = "POST";
  form.action = handoff.actionUrl;
  form.style.display = "none";
  form.setAttribute("data-testid", "payhere-post-form");

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

export function submitPayHereCheckoutForm(
  handoff: PayHereCheckoutHandoff,
  doc: Document = document
): HTMLFormElement {
  const form = buildPayHereCheckoutForm(handoff, doc);
  doc.body.appendChild(form);
  form.submit();
  return form;
}

