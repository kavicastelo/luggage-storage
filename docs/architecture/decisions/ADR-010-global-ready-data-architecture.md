# ADR-010: Global-Ready Data and Domain Architecture from Initial Release

- **Status:** Accepted
- **Date:** 2026-11-07
- **Phase:** Phase 0A — Product Architecture & System Foundation
- **Related Documents:** [Product Overview](../../product/product-overview.md), [System Architecture Overview](../system-architecture.md), [Backend Domain Architecture Overview](../backend-domain-overview.md)

---

## 1. Context

Although the platform's initial commercial launch market is **Sri Lanka** (`LK`, `LKR`, `Asia/Colombo`, English `en`, PayHere), its core product vision is an **international luggage-storage marketplace** supporting multiple countries, languages (`FR-14 Multiple Languages`), currencies (`FR -14 Multiple Currencies`), timezones, host business models, and regional payment providers.

In the FRS, `FR-14 Multiple Languages` and `FR -14 Multiple Currencies` are marked as `Later`. However, if the initial database schema and domain services hardcode single-country assumptions (such as currency-less numeric fields, server-local timestamps, Sri Lanka-only address fields, or `+94`-only phone validation), expanding to a second country or activating `FR-14` later will require destructive database migrations and rewrites of the booking, pricing, and finance engines.

---

## 2. Decision

We will establish a **Global-Ready Data and Domain Architecture** from the very first schema and module design, while scoping initial operational defaults to Sri Lanka (`LK` / `LKR` / `en` / `Asia/Colombo`):

1. **Country Identification:** All country references use `ISO 3166-1 alpha-2` codes (e.g., `LK`), backed by a `supported_countries` configuration table.
2. **Currency & Monetary Precision:** Every monetary value in `pricing`, `bookings`, `payments`, and `finance` is stored as an exact integer in minor units (or fixed-precision `NUMERIC`) paired with an explicit `ISO 4217` currency code column (e.g., `LKR`). Floating-point numbers are strictly forbidden for money.
3. **Timezones & Dates:**
   - Every `StorageLocation` stores its explicit `IANA` timezone identifier (e.g., `Asia/Colombo`).
   - Host operating hours (`FR-20`) are configured in the location's local `IANA` timezone.
   - All absolute booking, payment, and custody timestamps are persisted in PostgreSQL as `UTC` (`TIMESTAMPTZ`).
4. **Addresses & Phone Numbers:**
   - Addresses use flexible, country-aware fields (`address_line_1`, `address_line_2`, `city`, `administrative_area`, `postal_code`, `country_code`, plus PostGIS coordinates) rather than Sri Lanka-only district/province enums.
   - Phone numbers are normalized and stored in international `E.164` format.
5. **Localization (`BCP 47`):** UI strings in `apps/mobile` and `apps/web` use `@luggage/i18n` translation keys (`BCP 47` locale codes, initially `en`) rather than hardcoded inline strings, and the `FR-14` language/currency preference screens are included in the UI-complete initial release.
6. **Configurable Business Rules:** Host verification requirements (`FR-16`), tax/commission rates (`FR-36`, `FR-38`), cancellation policies (`FR-10`, `FR-34`), and payment gateways (`FR-6`) are resolved dynamically by country/location policy rather than global constants.

---

## 3. Alternatives Considered

1. **Hardcode Sri Lanka (`LKR`, `+94`, `UTC+05:30`) in MVP and Refactor Later:**
   - *Rejected:* Explicitly prohibited by Phase 0A architectural constraints (*"Do not architect the application exclusively around the Sri Lankan market"*). Retrofitting multi-currency and timezone awareness onto historical financial ledgers and bookings is high-risk and expensive.
2. **Build Full Live Multi-Currency FX Settlement and Multi-Language Content Management in Phase 1:**
   - *Rejected:* Violates FRS source fidelity, which classifies `FR-14 Multiple Languages` and `FR -14 Multiple Currencies` as `Later`. Making the *schema and architecture* global-ready in Phase 0/1 while activating multi-locale/multi-currency runtime workflows in Phase 11 achieves architectural readiness without scope creep.

---

## 4. Consequences

### Positive
- **Zero-Rewrite International Expansion:** Onboarding a second country (e.g., Thailand, UAE, Maldives, India, or European markets) or activating `FR-14` in Phase 11 requires only configuration and translation files—no core database or booking engine rewrites.
- **Timezone Safety for International Travellers:** A traveller booking storage in Colombo while still in London or Singapore sees unambiguous location-local drop-off/collection times (`Asia/Colombo`) backed by exact `UTC` instants.

### Negative / Trade-offs
- Every monetary DTO and database table requires an explicit `currency` field (`ISO 4217`) alongside the amount from day one.

---

## 5. Risks & Mitigations

- **Risk:** Developers accidentally using `new Date()` browser/server local time instead of the `StorageLocation`'s `IANA` timezone when validating `FR-20 Opening Hours`.
  - **Mitigation:** Centralize all schedule and timezone conversions in shared timezone utilities inside `@luggage/i18n` and the backend `availability` module, tested with cross-timezone unit tests.

