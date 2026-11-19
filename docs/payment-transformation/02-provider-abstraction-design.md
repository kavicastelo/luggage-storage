# Provider Abstraction Design

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/02-provider-abstraction-design.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Technical Design  

---

## 1. Provider-Agnostic Interface Specification

To prevent provider-specific constructs (`Stripe.PaymentIntent`, `PayPal.Order`, `PayHere.hash`) from leaking into core domain logic, we establish a standardized provider contract:

```typescript
export type PaymentProviderName = "STRIPE" | "PAYPAL" | "SANDBOX_GATEWAY" | "PAYHERE";

export interface PaymentProviderCapabilities {
  supportsAutomaticCapture: boolean;
  supportsPartialRefunds: boolean;
  supportsDisputes: boolean;
  supportsWebhooks: boolean;
  supportedCurrencies: readonly string[];
  supportedPaymentMethods: readonly string[];
}

export interface CreateProviderPaymentParams {
  intentId: string;
  bookingId: string;
  referenceCode: string;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  channel: "WEB" | "MOBILE_APP";
  customerEmail: string;
  customerName: string;
  customerDetails?: {
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
  returnUrl?: string;
  cancelUrl?: string;
}

export type ProviderCheckoutHandoff =
  | {
      provider: "STRIPE";
      method: "STRIPE_ELEMENTS";
      clientSecret: string;
      publishableKey: string;
      paymentIntentId: string;
    }
  | {
      provider: "STRIPE";
      method: "REDIRECT_SESSION";
      checkoutSessionUrl: string;
      checkoutSessionId: string;
    }
  | {
      provider: "PAYPAL";
      method: "PAYPAL_CHECKOUT";
      orderId: string;
      approveUrl: string;
    }
  | {
      provider: "SANDBOX_GATEWAY";
      method: "SIMULATED_API";
      intentId: string;
      orderId: string;
      amountMinor: number;
      currency: string;
    }
  | {
      provider: "PAYHERE";
      method: "EXPIRED";
      reason: string;
    };

export interface RawWebhookInput {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
  url?: string;
}

export type NormalizedPaymentStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "PENDING"
  | "CANCELLED"
  | "DISPUTED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export interface NormalizedWebhookEvent {
  provider: PaymentProviderName;
  providerEventId: string;
  eventType: string;
  providerOrderId: string;
  providerTransactionId?: string;
  paymentIntentId?: string;
  status: NormalizedPaymentStatus;
  rawStatusCode: string;
  amountMinor: number;
  currency: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateProviderRefundParams {
  refundId: string;
  bookingId: string;
  paymentIntentId: string;
  providerTransactionId: string;
  amountMinor: number;
  currency: string;
  reason?: string;
}

export interface ProviderRefundResult {
  providerRefundId: string;
  status: "SUCCEEDED" | "PENDING" | "FAILED";
  amountMinor: number;
  currency: string;
  rawResponse?: Record<string, unknown>;
}

export interface PaymentGatewayPort {
  readonly providerName: PaymentProviderName;
  getCapabilities(): PaymentProviderCapabilities;
  buildCheckoutHandoff(params: CreateProviderPaymentParams): Promise<ProviderCheckoutHandoff>;
  verifyWebhookSignature(input: RawWebhookInput): Promise<boolean>;
  normalizeWebhookEvent(input: RawWebhookInput): Promise<NormalizedWebhookEvent>;
  createRefund(params: CreateProviderRefundParams): Promise<ProviderRefundResult>;
}
```

---

## 2. Provider Registry Architecture

The `PaymentProviderRegistry` acts as the single source of truth for all configured adapters:

```typescript
export class PaymentProviderRegistry {
  private readonly providers = new Map<PaymentProviderName, PaymentGatewayPort>();

  register(adapter: PaymentGatewayPort): void {
    this.providers.set(adapter.providerName, adapter);
  }

  get(name: PaymentProviderName): PaymentGatewayPort {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Payment provider "${name}" is not registered or not enabled.`);
    }
    return provider;
  }

  getActiveProviders(): PaymentProviderName[] {
    return Array.from(this.providers.keys()).filter((name) => name !== "PAYHERE");
  }

  has(name: PaymentProviderName): boolean {
    return this.providers.has(name);
  }
}
```

### Provider Resolution Workflow:
1. **Creation:** When a customer calls `POST /api/v1/payments/intents`, the request specifies `provider?: "STRIPE" | "PAYPAL"`.
2. **Defaulting:** If omitted, the platform default is determined by `env.PAYMENT_DEFAULT_PROVIDER` (defaults to `"STRIPE"`).
3. **Validation:** The registry verifies that the requested provider is active and that its credentials are valid.
4. **Handoff Generation:** The corresponding adapter generates the normalized `checkoutHandoff` payload.

---

## 3. Webhook Routing & Normalization Strategy

Each provider delivers webhooks to its own dedicated endpoint:
- `POST /api/v1/payments/webhooks/stripe`
- `POST /api/v1/payments/webhooks/paypal`
- `POST /api/v1/payments/webhooks/sandbox`

Each endpoint forwards the raw request body to the respective provider adapter:
1. `adapter.verifyWebhookSignature(rawInput)` confirms cryptographic authenticity.
2. `adapter.normalizeWebhookEvent(rawInput)` extracts normalized values (`providerEventId`, `providerOrderId`, `providerTransactionId`, `status`, `amountMinor`, `currency`).
3. The normalized event is fed directly into the shared, idempotent `processGatewayWebhookInternal()` pipeline in `payments.service.ts`.

---

## 4. Historical PayHere Record Preservation

To satisfy strict data preservation requirements:
- The `PAYHERE` enum value remains registered in `@luggage-storage/contracts` and database constraints.
- A dummy `LegacyPayHereAdapter` is registered in the provider registry for read-only query normalization.
- Any attempt to create a new `PAYHERE` payment intent throws an error: `PAYHERE_PROVIDER_RETIRED`.
- All existing rows with `provider = 'PAYHERE'` in `payment_intents`, `payment_transactions`, and `financial_ledger_entries` remain fully accessible to admin and host finance queries.

