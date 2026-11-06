# Global Data Standards

**Project:** Global Luggage Storage Marketplace  
**Document Type:** Data Architecture Specification  
**Status:** Approved Phase 0C Baseline  
**Governing Documents:** ADR-010 (Global-Ready Data Architecture), Business Rules Catalogue (`BR-086`–`BR-100`), Assumptions & Open Questions (`OQ-002`, `OQ-007`, `OQ-010`).

---

## 1. Executive Summary & Purpose

The Global Luggage Storage Marketplace is designed from day one to support international scale while executing its initial commercial launch in Sri Lanka (`ADR-010`).

To avoid costly schema migrations, localization refactoring, or currency miscalculations during international expansion, this document establishes strict global data standards across all data stores, API contracts, domain entities, and user interfaces.

### Core Architectural Mandates:
1. **Dynamic Currency Exponent Architecture:** All money amounts are stored and calculated as integers in the currency's minor units. The system **never hard-codes a 2-decimal assumption**, supporting zero-decimal (e.g., JPY, KRW) and three-decimal (e.g., BHD, KWD, OMR) currencies alongside standard two-decimal currencies (e.g., LKR, USD, EUR) (`BR-089`).
2. **Universal UTC Storage:** All timestamps across database columns, domain events, API responses, and server logs are stored and exchanged in UTC ISO 8601 format (`TIMESTAMPTZ`). Display formatting in local time is strictly decoupled and computed at the client edge (`BR-090`).
3. **Decoupled Tax & Legal Framework:** The system provides full technical capability for varied jurisdictional taxation without assuming specific legal or tax classifications for any market (`BR-029`, `BR-096`).
4. **Geospatial Privacy Protection:** Exact street addresses and GPS coordinates are masked/jittered in public discovery searches and revealed only after booking confirmation (`BR-088`).

---

## 2. Standards Specification

### 2.1 ISO 3166 Country Codes
- **Standard:** ISO 3166-1 alpha-2 (two-letter capitalized country codes).
- **Initial Launch Market:** `"LK"` (Sri Lanka).
- **Usage:** Database columns (`country_code CHAR(2)`), address validation, tax jurisdiction mapping, mobile phone number validation.
- **Invariants:** Must match official ISO 3166-1 alpha-2 registry. Case-insensitive input, normalized to uppercase.

### 2.2 ISO 4217 Currency Standards & Dynamic Minor-Unit Model

#### Dynamic Currency Exponent Table
The platform resolves currency rules dynamically via a reference catalog:

| Currency Code | ISO 4217 Numeric | Currency Name | Minor Unit Name | Minor Unit Exponent | Example: 100.00 Nominal in DB Integer |
| :--- | :---: | :--- | :--- | :---: | :--- |
| **`LKR`** (Launch) | `144` | Sri Lankan Rupee | Cent | **2** | `10000` (LKR 100.00) |
| **`USD`** | `840` | US Dollar | Cent | **2** | `10000` ($100.00) |
| **`EUR`** | `978` | Euro | Cent | **2** | `10000` (€100.00) |
| **`GBP`** | `826` | Pound Sterling | Penny | **2** | `10000` (£100.00) |
| **`JPY`** | `392` | Japanese Yen | None | **0** | `100` (¥100) |
| **`KRW`** | `410` | South Korean Won | Jeon | **0** | `100` (₩100) |
| **`BHD`** | `048` | Bahraini Dinar | Fils | **3** | `100000` (BD 100.000) |
| **`KWD`** | `414` | Kuwaiti Dinar | Fils | **3** | `100000` (KD 100.000) |

#### Exact Integer Money Invariants (`BR-089`)
- All database columns storing money amounts use `BIGINT` (64-bit integer) representing minor units.
- Floating-point representations (`FLOAT`, `REAL`, `DOUBLE PRECISION`) are strictly prohibited in database schemas, backend TypeScript models, and API exchange formats.
- Monetary calculations (commission, taxes, discounts) use integer arithmetic with explicit rounding rules (e.g., floor or half-up rounding explicitly defined in `pricing-and-financial-domain-model.md`).

### 2.3 BCP 47 Language Tags & Multilingual Readiness
- **Standard:** BCP 47 language subtags.
- **Initial Supported Languages:**
  - `en` / `en-US` / `en-LK` (English - Primary system default).
  - `si` / `si-LK` (Sinhala - Localized traveller/host experience).
  - `ta` / `ta-LK` (Tamil - Localized traveller/host experience).
- **Architecture:** User interface strings are isolated into standard i18n dictionary catalogs (JSON/i18next). Database content requiring localization (e.g., terms and conditions, FAQ answers, notifications) utilizes localized JSONB structures (`{"en": "...", "si": "...", "ta": "..."}`).

### 2.4 IANA Timezones & Datetime Architecture
- **Standard:** IANA Time Zone Database (e.g., `Asia/Colombo`, `Europe/London`, `Asia/Tokyo`).
- **Storage Standard:** All datetime fields in PostgreSQL use `TIMESTAMPTZ` (UTC).
- **Location Timezone Context:** Every `StorageLocation` record includes a mandatory `timezone VARCHAR(64) DEFAULT 'Asia/Colombo'` column.
- **Operating Hours & Schedule Evaluation:** Opening hours, collection buffers, and overdue evaluations are computed against the **location's physical IANA timezone**, NOT the traveller's device timezone (`BR-095`).
- **Wire Exchange Format:** All API payloads exchange datetimes as ISO 8601 strings with explicit UTC indicator: `YYYY-MM-DDTHH:mm:ss.sssZ`.

### 2.5 E.164 International Telephone Numbers
- **Standard:** ITU-T E.164 international public telecommunication numbering plan.
- **Format:** `+[CountryCode][NationalNumber]` without spaces, dashes, or punctuation (e.g., Sri Lanka: `+94771234567`, UK: `+447911123456`).
- **Validation:** Normalized on intake via standard libphonenumber algorithms.
- **Database Column:** `VARCHAR(20)`.

### 2.6 Geospatial Privacy & Coordinate Standards (`BR-088`)
- **Spatial Reference System:** WGS 84 (`EPSG:4326`).
- **PostGIS Column Type:** `GEOGRAPHY(Point, 4326)`.
- **Public Search Privacy (Spatial Jittering):**
  - Unauthenticated visitors and travellers searching for locations receive a randomized jittered coordinate offset of between $150	ext{m}$ and $300	ext{m}$ from the true location.
  - The exact address, floor/suite number, and exact GPS coordinates are revealed **only upon successful booking confirmation and payment**.
  - This protects host security, residential privacy, and prevents disintermediation.

---

## 3. The 4-Layer Jurisdictional Tax & Legal Model

To enable worldwide operational rollouts without forcing compliance assumptions onto the code:

```
+--------------------------------------------------------------------------+
| LAYER D: LAUNCH COMPLIANCE GATE (Verified legal sign-off per market)     |
+--------------------------------------------------------------------------+
| LAYER C: LEGAL CLASSIFICATION (Marketplace Intermediary vs Principal)   |
+--------------------------------------------------------------------------+
| LAYER B: CONFIGURED JURISDICTION RULES (VAT %, SSCL %, Exemptions)       |
+--------------------------------------------------------------------------+
| LAYER A: PLATFORM ENGINE CAPABILITY (Inclusive/Exclusive tax math engine)|
+--------------------------------------------------------------------------+
```

1. **Layer A (Technical Capability):** The pricing engine supports calculating percentage-based and fixed taxes per bag, per booking, or per day, in inclusive or exclusive formats.
2. **Layer B (Jurisdiction Rules):** Tax rules are stored in a configurable database table (`tax_jurisdiction_rules`) keyed by `country_code`, `region_code`, and `service_category`.
3. **Layer C (Legal Classification):** Whether the marketplace acts as an agent/intermediary or a principal vendor (`OQ-010`).
4. **Layer D (Launch Compliance Gate):** Legal and accounting counsel must formally approve the active tax configuration before a new country is set to `ACTIVE`.
