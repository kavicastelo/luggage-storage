# Web and Mobile Payment Experience

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/10-web-and-mobile-payment-experience.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Technical UX Specification  

---

## 1. Web Checkout Experience (`apps/web`)

### 1.1 Multi-Provider Selection Component
On `apps/web/src/features/traveller/CheckoutSchedulePage.tsx`, the traveller is presented with a clear, accessible payment method selection UI:

```text
┌────────────────────────────────────────────────────────┐
│  Select Payment Method                                 │
│                                                        │
│  ○ [ Credit / Debit Card (Stripe) ]                    │
│    Visa, Mastercard, Amex, Apple Pay, Google Pay       │
│                                                        │
│  ○ [ PayPal ]                                          │
│    Pay with PayPal wallet, debit, or Pay in 4          │
│                                                        │
├────────────────────────────────────────────────────────┤
│  Booking Summary                                       │
│  Drop-off: 2026-11-20 10:00 • Collection: 18:00 (8h)  │
│  Bags: 2 Medium                                        │
│  Total Amount: $16.00 USD                              │
├────────────────────────────────────────────────────────┤
│  [ Pay $16.00 USD with Stripe / PayPal ]               │
└────────────────────────────────────────────────────────┘
```

### 1.2 Web Interaction States:
1. **Selection:** Customer toggles between Card (Stripe) and PayPal.
2. **Submission:**
   - Single in-flight guard prevents duplicate clicks (`isProcessing` disabled button state).
   - Calls `marketplaceApi.createPaymentIntent({ bookingId, channel: "WEB", provider: selectedProvider })`.
3. **Execution:**
   - **Stripe:** Mounts Stripe Payment Element or redirects to verified Stripe Checkout session.
   - **PayPal:** Opens PayPal approval flow or redirects to PayPal approve URL.
4. **Return & Polling:**
   - Customer returns to `/booking/confirm?bookingId=...`.
   - Polling loop checks `GET /api/v1/payments/checkout-status`.
   - When confirmed, unlocks custody pass view with interactive QR code and instructions.

---

## 2. Mobile Checkout Experience (`apps/mobile`)

### 2.1 Unified Mobile Screen (`app/(traveller)/checkout.tsx`)
- Renders native payment selection cards styled with `mobileColors.container`, `mobileRadius.md`, and CWCP mascot tokens.
- Supports both `Platform.OS === 'web'` (responsive web view) and native iOS / Android.
- Provides fallback to secure in-app browser (`WebBrowser.openBrowserAsync`) for seamless PayPal and Stripe authorization.
- Deep links back to `luggagestorage://booking/confirm` upon completion or cancellation.

### 2.2 Payment Recovery & Offline Handling:
- If network connection drops during checkout, the app re-checks booking status upon resume via `AppState` listener.
- Context is persisted in SecureStore / SessionStorage so traveller can resume payment without re-entering booking details.

