# Environment and Deployment Configuration

**Project:** Luggage Storage Marketplace (`kavicastelo/luggage-storage`)  
**Document:** `docs/payment-transformation/13-environment-and-deployment-configuration.md`  
**Initiative:** Payment Infrastructure Transformation  
**Status:** Approved Technical Configuration Guide  

---

## 1. Environment Variable Matrix

All payment configurations are validated server-side in `apps/api/src/config/env.ts` using strict Zod schemas:

| Variable | Scope | Local / Test | Staging | Production | Description |
|---|---|---|---|---|---|
| `PAYMENT_PROVIDER` | API | `stripe` or `sandbox` | `stripe` | `stripe` | Active primary provider |
| `PAYMENT_DEFAULT_PROVIDER` | API | `stripe` | `stripe` | `stripe` | Default provider when unselected |
| `STRIPE_SECRET_KEY` | API (Secret) | `sk_test_...` | `sk_test_...` | `sk_live_...` | Stripe secret API key |
| `STRIPE_PUBLISHABLE_KEY` | Public / Web | `pk_test_...` | `pk_test_...` | `pk_live_...` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | API (Secret) | `whsec_...` | `whsec_...` | `whsec_...` | Stripe webhook signing secret |
| `PAYPAL_CLIENT_ID` | Public / API | `Ac_...` | `Ac_...` | `Ac_...` | PayPal REST client ID |
| `PAYPAL_CLIENT_SECRET` | API (Secret) | `EL_...` | `EL_...` | `EL_...` | PayPal REST client secret |
| `PAYPAL_WEBHOOK_ID` | API (Secret) | `WH-...` | `WH-...` | `WH-...` | PayPal webhook endpoint ID |
| `PAYPAL_SANDBOX_MODE` | API | `true` | `true` | `false` | Toggles sandbox vs live endpoints |
| `PAYMENT_WEBHOOK_SECRET`| API (Secret) | `test_secret_...` | `stage_secret_...`| `prod_secret_...` | HMAC secret for dev simulator |

---

## 2. Retired Configuration (PayHere Elimination)

The following variables are **completely removed** from all active deployment environments and `.env.example` templates:
- `PAYHERE_MERCHANT_ID`
- `PAYHERE_WEB_MERCHANT_SECRET`
- `PAYHERE_MOBILE_MERCHANT_SECRET`
- `PAYHERE_ANDROID_PACKAGE_NAME`
- `PAYHERE_SANDBOX_MODE`
- `PAYHERE_NOTIFY_URL`
- `PAYHERE_RETURN_URL`
- `PAYHERE_CANCEL_URL`
- `PAYHERE_MERCHANT_SECRET`

**Fail-Closed Protection:** The API startup configuration explicitly fails closed with a clear error if any `PAYHERE_*` secret is detected in production environment files.

---

## 3. Webhook Endpoint Registration Guide

### 3.1 Stripe Dashboard Setup:
1. Navigate to Stripe Dashboard -> **Developers > Webhooks > Add endpoint**.
2. Endpoint URL: `https://<api-domain>/api/v1/payments/webhooks/stripe`.
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.dispute.created`
   - `charge.refunded`
4. Copy Signing Secret -> `STRIPE_WEBHOOK_SECRET`.

### 3.2 PayPal Developer Dashboard Setup:
1. Navigate to PayPal Developer Portal -> **Apps & Credentials > Webhooks > Add Webhook**.
2. Webhook URL: `https://<api-domain>/api/v1/payments/webhooks/paypal`.
3. Select events:
   - `Payment capture completed`
   - `Payment capture denied`
   - `Payment capture refunded`
   - `Customer dispute created`
4. Copy Webhook ID -> `PAYPAL_WEBHOOK_ID`.

