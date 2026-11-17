# Initiative 7 — WS-7.6 Production Readiness Assessment

---

## 1. Environment & Code Controls Verified

| Control / Integration | Code Verification Status | Notes |
|---|---|---|
| **API Production Env Guards (`apps/api/src/config/env.ts`)** | **Verified in code** | `NODE_ENV=production` enforces `STORAGE_PROVIDER=r2` + R2 credentials, `DATABASE_SSL=true` + `DATABASE_SSL_REJECT_UNAUTHORIZED=true`, `EMAIL_PROVIDER=zoho` + TLS >=1.2, non-wildcard valid `CORS_ORIGIN`, `PAYMENT_PROVIDER !== "sandbox"`, `PAYHERE_SANDBOX_MODE=false`, `https://` public PayHere URLs, distinct Web/Mobile PayHere secrets, and non-`dev_` secrets. |
| **Web Env Configuration (`apps/web/.env.example`, `vite-env.d.ts`)** | **Verified in code** | Documents `VITE_API_URL`, `VITE_ENABLE_DEMO_PREVIEW=false`, `VITE_FEATURE_REVIEWS=false`, `VITE_FEATURE_PROMOTIONS=false`, and `VITE_MAPTILER_KEY` (graceful fallback when unset). |
| **Database Migrations (`apps/api/src/infrastructure/database/migrate.ts`)** | **Verified in tests** | Forward-only migrations `0000`–`0018` verify `47` required tables + PostGIS (`3.5`). |
| **Demo Data Isolation** | **Verified in tests & E2E** | Live routes render zero `DEMO_*` records when `VITE_ENABLE_DEMO_PREVIEW=false`. |

---

## 2. Staging Smoke-Test Checklist (Pre-Cutover)

Mark each step in the staging environment prior to DNS cutover:
1. `[ ]` **Authentication & Profile:** Register, email verification link delivery via Zoho SMTP, login, `/profile` edit & reload persistence, logout revocation.
2. `[ ]` **Discovery & Maps:** `/search` with PostGIS filter, MapTiler static map tile rendering with production `VITE_MAPTILER_KEY`, unconfigured-hours handling.
3. `[ ]` **Booking & PayHere:** Quote -> `PENDING_PAYMENT` -> PayHere hosted checkout -> signed `notify_url` webhook -> `CONFIRMED` + exact address reveal (`OQ-012`).
4. `[ ]` **Custody QR/PIN:** Issue `CHECK_IN` pass, verify single-use replay protection (`401`), host check-in & clean release (`OQ-015`).
5. `[ ]` **Host Onboarding & R2 CORS:** Direct browser `PUT` upload of KYC BRN/TIN PDF & location image to Cloudflare R2 bucket from staging Web origin -> `POST /uploads/confirm` -> `DOCUMENT_ACCESSED` signed download.
6. `[ ]` **Support Tickets:** Traveller `/contact` submission -> Support agent triage & public reply -> internal note confidentiality.
7. `[ ]` **Superadmin Governance & Payouts:** KYC approval, location approval, dispute adjudication, payout batch generation & disbursement attestation.
8. `[ ]` **Health & Backup:** `/api/v1/health` & `/api/v1/ready` `200`, automated PostgreSQL daily snapshot/restore drill verified.

