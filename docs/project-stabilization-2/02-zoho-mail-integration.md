# 02 — Zoho Mail Production Transactional Email Integration (`AUD-002`)

**Project:** Global Luggage Storage Marketplace  
**Branch:** `feat/phase-1b-identity`  
**Audit Finding Addressed:** `AUD-002` (High — Production Email Delivery & Zoho Mail Integration)  
**Status:** `COMPLETE & VERIFIED`

---

## 1. Architecture & Provider Model

Transactional email delivery in `apps/api/src/modules/email/` is abstracted behind the `EmailDeliveryAdapter` interface (`email.types.ts`) with four concrete runtime implementations in `email.service.ts`:

| `EMAIL_PROVIDER` | Adapter Class | Permitted Environments | Behavior |
|:---|:---|:---|:---|
| `zoho` | `ZohoSmtpEmailAdapter` | `production` (Mandatory), `development`, `test` | Sends multipart HTML + plain-text emails via Zoho Mail SMTP (`nodemailer`) over implicit TLS (`465`) or STARTTLS (`587`). |
| `console` | `ConsoleDevEmailAdapter` | `development`, `test` (**Forbidden in `production`**) | Logs structured email metadata (`to`, `provider`, `emailCategory`) without exposing raw tokens. |
| `test` | `DeterministicTestEmailAdapter` | `test` (**Forbidden in `production`**) | Captures dispatched verification and password reset payloads in memory for deterministic test assertions and supports failure simulation (`setSimulatedFailure`). |
| `noop` | `NoopEmailDeliveryAdapter` | `development`, `test` (**Forbidden in `production`**) | Returns `{ delivered: false, error: "NO_APPROVED_EMAIL_PROVIDER_CONFIGURED_OQ_019" }`. |

---

## 2. Environment Configuration & Startup Validation (`apps/api/src/config/env.ts`)

The following Zoho Mail environment variables are validated by `EnvSchema`:

| Variable | Default / Requirement | Validation Rule |
|:---|:---|:---|
| `EMAIL_PROVIDER` | `zoho` required when `NODE_ENV=production` | Rejects `noop`, `console`, `test`, or unset provider in `production`. |
| `ZOHO_SMTP_HOST` | `smtp.zoho.com` (or regional `smtp.zoho.eu` / `smtp.zoho.in` / `smtp.zoho.com.au`) | Required non-empty hostname without URL scheme or whitespace when `EMAIL_PROVIDER=zoho`. |
| `ZOHO_SMTP_PORT` | `587` (STARTTLS) or `465` (Implicit TLS) | Positive integer `1..65535`. |
| `ZOHO_SMTP_SECURE` | `false` (for `587`) or `true` (for `465`) | Must be `true` on port `465` and `false` on port `587`. |
| `ZOHO_SMTP_REQUIRE_TLS` | `true` | Requires `ZOHO_SMTP_SECURE=true` or `ZOHO_SMTP_REQUIRE_TLS=true`; enforces minimum `TLSv1.2` and `rejectUnauthorized: true`. |
| `ZOHO_SMTP_USER` | Zoho mailbox address | Required non-empty string when `EMAIL_PROVIDER=zoho`. |
| `ZOHO_SMTP_PASSWORD` | Zoho app-specific password | Required non-empty secret when `EMAIL_PROVIDER=zoho`; never logged or exposed in error messages. |
| `ZOHO_SMTP_TIMEOUT_MS` | `10000` (10s) | Applied to `connectionTimeout`, `greetingTimeout`, and `socketTimeout`. |
| `EMAIL_FROM_ADDRESS` | `no-reply@luggagestorage.lk` | Validated email address format. |
| `EMAIL_FROM_NAME` | `Luggage Storage Marketplace` | Non-empty display name formatted in `From` header. |

---

## 3. Transactional Email Templates (`apps/api/src/modules/email/email.templates.ts`)

Both authentication email workflows render responsive HTML and plain-text alternatives with strict HTML escaping (`escapeHtml`) and absolute URL resolution (`resolvePublicEmailUrl` against `APP_PUBLIC_URL`):

1. **Account Email Verification (`buildVerificationEmailTemplate`):**
   - Subject: `Verify your <EMAIL_FROM_NAME> account`
   - Includes primary verification button + copy-paste link (`${APP_PUBLIC_URL}/verify-email?token=...`), 24-hour single-use expiration notice, resend link (`/verify-email`), and ignore notice if not requested.
2. **Password Recovery (`buildPasswordResetEmailTemplate`):**
   - Subject: `Reset your <EMAIL_FROM_NAME> password`
   - Includes primary reset button + copy-paste link (`${APP_PUBLIC_URL}/reset-password?token=...`), 60-minute single-use expiration notice, recovery link (`/forgot-password`), and security notice if not requested.

---

## 4. Safe Delivery Failure Handling & Token Preservation (`auth.service.ts`, `password.service.ts`)

1. **Registration (`POST /api/v1/auth/register`):**
   - Persists the user in `PENDING_VERIFICATION` (`is_email_verified = false`) and inserts a SHA-256 hashed verification token in `email_verification_tokens`.
   - Inspects `EmailSendResult.delivered`. If `delivered === false`, logs a structured warning and records `AUTH_EMAIL_DELIVERY_FAILURE` in `security_audit_events` without exposing raw tokens or SMTP credentials. The user can recover seamlessly via `POST /api/v1/auth/resend-verification`.
2. **Resend Verification (`POST /api/v1/auth/resend-verification`):**
   - Inserts the new verification token first and dispatches the email via `emailService.sendEmailVerificationEmail(...)`.
   - **Token Preservation:** If `EmailSendResult.delivered === false`, deletes the undelivered new token row, records `AUTH_EMAIL_DELIVERY_FAILURE`, and **preserves any previously issued unused verification token** (`used_at IS NULL`) so a transient SMTP failure never invalidates a valid link already in the user's inbox. Only when `delivered === true` are prior unused tokens superseded (`used_at = NOW()`).
3. **Password Recovery (`POST /api/v1/auth/forgot-password`):**
   - Inserts the new reset token first and dispatches the email via `emailService.sendPasswordResetEmail(...)`.
   - **Token Preservation:** If `EmailSendResult.delivered === false`, deletes the undelivered new token row, records `AUTH_EMAIL_DELIVERY_FAILURE`, and **preserves any previously issued unused reset token**, while still returning the identical enumeration-resistant `200 OK` response.

---

## 5. Production DNS & Operational Checklist (External Pre-Production Gate)

> [!IMPORTANT]
> **No Live Zoho Credentials Fabricated:** All `.env.example` files contain safe placeholder values only. No live Zoho credentials were committed or fabricated.

Before enabling live production traffic against Zoho Mail (`OQ-019` operational gate):
1. Provision the production Zoho Mail mailbox (e.g., `no-reply@luggagestorage.lk`) and generate a dedicated **Zoho App-Specific Password** (never use the root account password).
2. Configure and verify domain DNS records in Zoho Mail Admin Console:
   - **SPF (`TXT`):** `v=spf1 include:zoho.com ~all` (or regional Zoho SPF include).
   - **DKIM (`TXT`):** Add the `<selector>._domainkey` public key generated by Zoho Mail.
   - **DMARC (`TXT`):** `_dmarc` -> `v=DMARC1; p=quarantine; rua=mailto:dmarc@luggagestorage.lk; pct=100`.
3. Inject `EMAIL_PROVIDER=zoho`, `ZOHO_SMTP_HOST`, `ZOHO_SMTP_PORT`, `ZOHO_SMTP_SECURE`, `ZOHO_SMTP_USER`, `ZOHO_SMTP_PASSWORD`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, and `APP_PUBLIC_URL` via the production secret manager.
