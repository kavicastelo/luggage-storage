# Stripe Primary Integration Specification

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/03-stripe-integration-specification.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Technical Specification  

---

## 1. Overview & SDK Selection

Stripe is the primary payment provider for the global luggage storage marketplace.

- **Official SDK:** `stripe` (version `^17.0.0` or current stable Node.js SDK).
- **Frontend SDKs:**
  - Web: `@stripe/stripe-js` (`^5.0.0`) and `@stripe/react-stripe-js` (`^3.0.0`).
  - Mobile: Stripe Checkout hosted flow or `@stripe/stripe-react-native` for Expo dev-client.
- **Key Capabilities:**
  - Automatic payment capture.
  - 3D Secure / Strong Customer Authentication (SCA) compliance.
  - Multi-currency support across 135+ currencies.
  - Automated API refunds (full and partial).
  - Dispute lifecycle management (`charge.dispute.created`).

---

## 2. Configuration & Credentials

The API service validates Stripe credentials server-side in `apps/api/src/config/env.ts`:

| Environment Variable | Scope | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | Server Only | Restricted / Secret API Key (`sk_test_...` or `sk_live_...`). Never sent to client. |
| `STRIPE_PUBLISHABLE_KEY` | Public / Client | Publishable API Key (`pk_test_...` or `pk_live_...`) passed to client for Elements initialization. |
| `STRIPE_WEBHOOK_SECRET` | Server Only | Webhook signing secret (`whsec_...`) used to verify `stripe-signature` header. |

---

## 3. Payment Creation Flow

### 3.1 Stripe PaymentIntent Implementation
When a traveller initiates checkout on Web or Mobile:
1. `StripeGatewayAdapter.buildCheckoutHandoff` calls `stripe.paymentIntents.create`:
   ```typescript
   const paymentIntent = await stripe.paymentIntents.create(
     {
       amount: params.amountMinor,
       currency: params.currency.toLowerCase(),
       payment_method_types: ["card", "link"],
       metadata: {
         bookingId: params.bookingId,
         referenceCode: params.referenceCode,
         intentId: params.intentId,
         travellerEmail: params.customerEmail
       },
       description: `Luggage Storage - ${params.referenceCode}`
     },
     {
       idempotencyKey: `pi_${params.intentId}`
     }
   );
   ```
2. The adapter returns:
   ```typescript
   {
     provider: "STRIPE",
     method: "STRIPE_ELEMENTS",
     clientSecret: paymentIntent.client_secret,
     publishableKey: env.STRIPE_PUBLISHABLE_KEY,
     paymentIntentId: paymentIntent.id
   }
   ```
3. The frontend renders Stripe's unified Payment Element or Card Element.

---

## 4. Webhook Processing & Signature Verification

Stripe sends asynchronous webhook notifications to:
`POST /api/v1/payments/webhooks/stripe`

### 4.1 Signature Verification
The raw HTTP body buffer/string and `stripe-signature` header are verified using official Stripe tooling:
```typescript
const event = stripe.webhooks.constructEvent(
  input.rawBody,
  input.headers["stripe-signature"] as string,
  this.webhookSecret
);
```
If the timestamp is expired or signature mismatch occurs, an error is thrown and the webhook rejected with HTTP 400.

### 4.2 Handled Stripe Events
| Stripe Event Type | Normalized Status | System Action |
|---|---|---|
| `payment_intent.succeeded` | `SUCCEEDED` | Transitions intent to `SUCCEEDED`, booking to `CONFIRMED`, unlocks custody pass, records ledger entry (DR 1010, CR 2010). |
| `payment_intent.payment_failed` | `FAILED` | Transitions intent to `FAILED`, records failure reason from `last_payment_error`. |
| `payment_intent.canceled` | `CANCELLED` | Transitions intent to `EXPIRED` / `CANCELLED`. |
| `charge.dispute.created` | `DISPUTED` | Flags booking as `DISPUTED`, places associated `host_payables` in `ON_HOLD` status. |
| `charge.refunded` | `REFUNDED` | Synchronizes refund status in `refund_records`, posts ledger adjustment. |

---

## 5. Automated Refund Execution

Stripe enables native programmatic refunds without manual portal intervention:
```typescript
const refund = await stripe.refunds.create(
  {
    payment_intent: params.providerTransactionId,
    amount: params.amountMinor,
    reason: mapRefundReasonToStripe(params.reason)
  },
  {
    idempotencyKey: `ref_${params.refundId}`
  }
);
```
- Returns `providerRefundId: refund.id` (e.g. `re_3N...`).
- When refund succeeds, `refund_records.status` is set to `SUCCEEDED`, `settlement_mode` is set to `PROVIDER_CONFIRMED`, and `ledgerService.recordRefundDisbursed` is called.

