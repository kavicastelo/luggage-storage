# Webhook Security and Idempotency

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/08-webhook-security-and-idempotency.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Security Architecture  

---

## 1. Webhook Endpoints & Content Handling

All webhook endpoints are isolated inside an encapsulated Fastify route scope with custom raw body parsing:

```typescript
app.register(async (webhookScope) => {
  webhookScope.removeContentTypeParser("application/json");
  webhookScope.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      done(null, typeof body === "string" ? body : String(body ?? ""));
    }
  );

  webhookScope.post("/webhooks/stripe", { bodyLimit: 65_536 }, handleStripeWebhook);
  webhookScope.post("/webhooks/paypal", { bodyLimit: 65_536 }, handlePayPalWebhook);
  webhookScope.post("/webhooks/sandbox", { bodyLimit: 65_536 }, handleSandboxWebhook);
});
```

### Protection Against Byte Mutation:
JSON deserialization in standard web frameworks often normalizes whitespace, reorders object keys, or alters float formatting, which invalidates cryptographic HMAC signatures. Preserving the exact incoming request string guarantees 100% signature accuracy.

---

## 2. Signature Verification Mechanisms

### 2.1 Stripe Webhook Signatures
- **Header:** `stripe-signature`
- **Verification:**
  $$\text{computed\_sig} = \text{HMAC-SHA256}(t + "." + \text{rawBody}, \text{STRIPE\_WEBHOOK\_SECRET})$$
- Timestamp tolerance: 300 seconds (5 minutes) to protect against replay attacks.

### 2.2 PayPal Webhook Signatures
- **Headers:** `paypal-transmission-id`, `paypal-transmission-time`, `paypal-transmission-sig`, `paypal-cert-url`, `paypal-auth-algo`.
- **Verification:** Validated via PayPal's Webhook Verification API against `PAYPAL_WEBHOOK_ID`.

### 2.3 Sandbox Simulator Signatures
- **Header:** `x-sandbox-signature`
- **Verification:** HMAC-SHA256 computed over raw body using `PAYMENT_WEBHOOK_SECRET` with constant-time equality check (`crypto.timingSafeEqual`).

---

## 3. Idempotent Deduplication & Replay Protection

```text
Incoming Webhook
      │
      ▼ Compute SHA-256 payload hash
Check payment_webhook_events(provider, event_id)
      │
      ├─► Found & Outcome != null ──► RETURN 200 OK (duplicate: true, ALREADY_SETTLED_NOOP)
      │
      ▼ Not Found: Open Transaction (SELECT ... FOR UPDATE)
Settle Payment & Confirm Booking
      │
      ▼
Insert payment_webhook_events(provider, event_id, payloadHash, outcome: "BOOKING_CONFIRMED")
      │
      ▼
Commit Transaction & Return 200 OK
```

### Out-of-Order Event Protection:
If an out-of-order `payment_failed` or `charge.refunded` event arrives after an intent has already been marked `SUCCEEDED`, the settlement engine checks state precedence:
- A `SUCCEEDED` intent cannot be reverted to `PENDING` or `FAILED`.
- Late webhooks on expired bookings trigger capacity re-verification or automated refund.

