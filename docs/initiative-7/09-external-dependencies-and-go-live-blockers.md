# Initiative 7 — External Dependencies & Go-Live Blockers Register

All items below sit **outside application source control** and require infrastructure, vendor, or qualified professional action before commercial production launch:

| ID | Category | Blocker / Requirement | Owner | Current Status |
|---|---|---|---|---|
| **EXT-01** | **Cloudflare R2** | Provision production R2 bucket, credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`), and configure bucket CORS policy allowing `PUT`/`GET` from production Web origin. | DevOps / Infra Owner | Awaiting staging/prod bucket verification |
| **EXT-02** | **PayHere Live Merchant (`OQ-003`, `OQ-013`)** | Obtain PayHere live merchant approval, distinct `PAYHERE_WEB_MERCHANT_SECRET` & `PAYHERE_MOBILE_MERCHANT_SECRET`, configure production `https://` `PAYHERE_NOTIFY_URL`/`RETURN_URL`/`CANCEL_URL`, and confirm refund settlement mode (`PROVIDER_CONFIRMED` vs `MANUAL_OFFLINE`). | Business Owner / Finance | Awaiting live merchant credentials |
| **EXT-03** | **MapTiler (`OQ-018`)** | Provision production `VITE_MAPTILER_KEY` with allowed origin restrictions for the Web domain. | DevOps / Frontend Owner | Awaiting production API key |
| **EXT-04** | **Zoho SMTP & DNS (`OQ-019`)** | Configure Zoho Mail sender identity and verify DNS `SPF`, `DKIM`, and `DMARC` records; execute controlled delivery test for verification and password-reset emails. | Infra / Domain Owner | Awaiting DNS & controlled send test |
| **EXT-05** | **Sri Lankan Legal, Tax & Compliance (`OQ-002`, `OQ-010`)** | Obtain qualified Sri Lankan legal, tax, and financial review covering host KYC/BRN/TIN verification standards, VAT/SSCL/withholding-tax applicability and invoicing format, merchant settlement terms, cancellation/refund disclosures, luggage liability/insurance terms, and personal-data privacy policy. | Legal & Tax Counsel | Requires qualified professional sign-off |
| **EXT-06** | **GitHub Repository Governance** | Enable GitHub branch protection on `main` (require PR, review, `validate`, `security-audit`, `browser-e2e` checks) and fast-forward/reconcile `dev` with `main`. | Repo Administrator | Actionable checklist provided in `06-*` |
| **EXT-07** | **Mobile Device Verification** | Execute on-device iOS/Android Expo build & PayHere native SDK smoke test (local validation covered TypeScript, ESLint, Expo bundle export, and Vitest). | Mobile QA | Pending physical device/emulator run |

