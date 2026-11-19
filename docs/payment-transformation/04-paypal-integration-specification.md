# PayPal Alternative Integration Specification

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/04-paypal-integration-specification.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Technical Specification  

---

## 1. Overview & API Architecture

PayPal provides an international wallet and alternative payment method for travellers who prefer not to enter card details directly.

- **API Architecture:** Current PayPal Orders v2 REST API and Webhooks API.
- **Base URLs:**
  - Sandbox: `https://api-m.sandbox.paypal.com`
  - Live: `https://api-m.paypal.com`
- **Frontend Integration:**
  - Web: PayPal JS SDK (`@paypal/react-paypal-js` or direct PayPal Button rendering).
  - Mobile: PayPal web approval flow inside in-app browser or native deep link.

---

## 2. Configuration & Authentication

### 2.1 Environment Variables
Validated in `apps/api/src/config/env.ts`:
- `PAYPAL_CLIENT_ID`: PayPal REST Client ID (public or server).
- `PAYPAL_CLIENT_SECRET`: PayPal REST Client Secret (server only).
- `PAYPAL_WEBHOOK_ID`: Webhook ID generated in PayPal Developer Portal for the webhook endpoint.
- `PAYPAL_SANDBOX_MODE`: Boolean flag toggling between sandbox and live endpoints.

### 2.2 OAuth 2.0 Access Token Management
The server manages an in-memory OAuth 2.0 token cache:
- Endpoint: `POST /v1/oauth2/token`
- Headers: `Authorization: Basic base64(client_id:client_secret)`
- Body: `grant_type=client_credentials`
- Token is cached until `expires_in - 60s` to eliminate redundant auth handshakes.

---

## 3. Order Creation & Customer Approval

1. **Order Creation:** `PayPalGatewayAdapter.buildCheckoutHandoff` calls `POST /v2/checkout/orders`:
   ```json
   {
     "intent": "CAPTURE",
     "purchase_units": [
       {
         "reference_id": "INTENT_UUID",
         "custom_id": "BOOKING_UUID",
         "description": "Luggage Storage - REF123",
         "amount": {
           "currency_code": "USD",
           "value": "15.00"
         }
       }
     ],
     "application_context": {
       "brand_name": "Luggage Storage Marketplace",
       "landing_page": "LOGIN",
       "user_action": "PAY_NOW",
       "return_url": "https://web.domain/booking/confirm",
       "cancel_url": "https://web.domain/booking/confirm?cancelled=1"
     }
   }
   ```
2. **Approval URL:** PayPal returns an `id` (`ORDER_ID`) and an HATEOAS link with `rel: "approve"`.
3. **Checkout Handoff:**
   ```typescript
   {
     provider: "PAYPAL",
     method: "PAYPAL_CHECKOUT",
     orderId: order.id,
     approveUrl: approveLink.href
   }
   ```
4. **Approval & Capture:**
   - When the customer approves in PayPal, PayPal redirects to `return_url` or triggers client `onApprove`.
   - The server captures the authorized order: `POST /v2/checkout/orders/{orderId}/capture`.
   - The resulting capture ID is saved as `provider_transaction_id` in `payment_transactions`.

---

## 4. Webhook Verification & Normalization

PayPal delivers events to:
`POST /api/v1/payments/webhooks/paypal`

### 4.1 Signature Verification
The server verifies authenticity via PayPal's Webhook Verification API (`POST /v1/notifications/verify-webhook-signature`):
```json
{
  "auth_algo": headers["paypal-auth-algo"],
  "cert_url": headers["paypal-cert-url"],
  "transmission_id": headers["paypal-transmission-id"],
  "transmission_sig": headers["paypal-transmission-sig"],
  "transmission_time": headers["paypal-transmission-time"],
  "webhook_id": env.PAYPAL_WEBHOOK_ID,
  "webhook_event": JSON.parse(rawBody)
}
```
Verification passes if `verification_status === "SUCCESS"`.

### 4.2 Handled PayPal Events
| PayPal Event | Normalized Status | System Action |
|---|---|---|
| `PAYMENT.CAPTURE.COMPLETED` | `SUCCEEDED` | Transitions intent to `SUCCEEDED`, booking to `CONFIRMED`, unlocks custody pass, records ledger entry (DR 1010, CR 2010). |
| `CHECKOUT.ORDER.APPROVED` | `PENDING` | Trigger for server-side capture if not yet captured by API. |
| `PAYMENT.CAPTURE.DENIED` | `FAILED` | Transitions intent to `FAILED`. |
| `CUSTOMER.DISPUTE.CREATED` | `DISPUTED` | Flags booking as `DISPUTED`, places host payable `ON_HOLD`. |
| `PAYMENT.CAPTURE.REFUNDED` | `REFUNDED` | Synchronizes refund status in `refund_records`. |

---

## 5. Automated Refunds & Marketplace Payout Notes

### 5.1 Refund Processing
Refunds are executed directly against the captured transaction:
- Endpoint: `POST /v2/payments/captures/{capture_id}/refund`
- Amount: minor-unit converted exact decimal string.
- Returns PayPal refund ID (e.g. `9...`).

### 5.2 Marketplace & Payout Limitations
- Standard PayPal Checkout processes customer payments to the platform's PayPal Business account.
- **Important Marketplace Note:** Disbursing payouts automatically to hosts via PayPal requires the separate **PayPal Payouts API** or **PayPal Complete Payments for Marketplaces**, which requires separate underwriting, country verification, and commercial approval from PayPal.
- For Phase 1 & 2, customer payments are collected via PayPal Checkout, while host settlements follow the established non-escrow payout batch model.

