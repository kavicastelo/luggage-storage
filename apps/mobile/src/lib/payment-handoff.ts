import type { PayHereCheckoutHandoff, PaymentCheckoutHandoff } from "@luggage-storage/contracts";

export const ALLOWED_PAYHERE_HANDOFF_PATH_REGEX =
  /^\/payments\/handoff\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function isPayHerePostHandoff(
  handoff: PaymentCheckoutHandoff | null | undefined
): handoff is PayHereCheckoutHandoff {
  return Boolean(handoff && handoff.method === "POST_FORM" && handoff.provider === "PAYHERE");
}

/**
 * Resolves a validated absolute backend URL for launching the server-signed PayHere
 * auto-POST HTML bridge in an external browser without exposing secrets or hash logic.
 */
export function resolveMobileHandoffUrl(apiBaseUrl: string, mobileHandoffPath: string): string {
  const trimmedPath = mobileHandoffPath.trim();
  if (!ALLOWED_PAYHERE_HANDOFF_PATH_REGEX.test(trimmedPath)) {
    throw new Error("Invalid mobile PayHere handoff path");
  }
  const normalizedBase = apiBaseUrl.trim().replace(/\/+$/, "");
  const fullUrl = `${normalizedBase}${trimmedPath}`;
  let parsed: URL;
  try {
    parsed = new URL(fullUrl);
  } catch {
    throw new Error("Invalid API base URL for mobile payment handoff");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Unsupported protocol for mobile payment handoff");
  }
  return parsed.toString();
}

export async function openExternalPayHereHandoff(
  handoffUrl: string,
  openUrl: (url: string) => Promise<void>
): Promise<void> {
  await openUrl(handoffUrl);
}

