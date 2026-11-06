# Requirements Traceability Matrix

**Document Title:** Requirements Traceability Matrix  
**Project:** Global Luggage Storage Marketplace  
**Phase:** Phase 0B — Requirements Normalization & Traceability  
**Document Status:** Complete Authoritative Baseline  
**Source Document:** `docs/product/source/luggage-storage-frs.pdf`  
**Related Documents:**
- [Normalized Functional Requirements Specification](functional-requirements.md)
- [Workflow and Use-Case Inventory](workflow-inventory.md)
- [Business Rules and Validation Catalogue](business-rules-catalogue.md)
- [Assumptions and Open Questions Register](assumptions-and-open-questions.md)
- [Phase 0B Summary and Decision Register](phase-0b-summary.md)

---

## 1. Traceability Overview & Summary Statistics

This matrix provides 100% end-to-end traceability from the original Functional Requirement Specification (`luggage-storage-frs.pdf`) through normalized requirements, acceptance criteria, actors, application surfaces, and validation statuses.

### 1.1 Source Row Accountability
- **Total Source Rows in FRS:** **57**
  - **Traveller Feature Rows:** **27** (Index `FR -1` through `FR -14`, with duplicate numbering on `FR-2` through `FR-14`)
  - **Host Feature Rows:** **30** (Index `FR-15` through `FR-44`)
- **Total Source Rows Accounted For:** **57 (100%)**
- **Unmapped Source Rows:** **0**

### 1.2 Count by Original FRS Classification

| Original FRS Classification | Source Row Count | Normalized IDs | Description |
| :--- | :---: | :--- | :--- |
| **Core MVP (unmarked)** | **49** | `REQ-TRV-001`..`018`, `020`..`023`, `025`; `REQ-HST-001`..`011`, `013`..`014`, `016`..`027`, `030` | Core functional launch requirements |
| **Later/MVP** | **1** | `REQ-TRV-019` (`FR -10 Refund Status`) | Dual classification; tracked functionally in MVP |
| **Depends** | **1** | `REQ-HST-012` (`FR-26 Booking Acceptance`) | Configurable per location; 15m host SLA & 10m traveller pay default approved (`OQ-004`) |
| **Recommended** | **1** | `REQ-HST-015` (`FR-29 Check-in Evidence`) | Photo evidence supported in MVP; optional by default, configurable mandatory per location (`OQ-014`) |
| **Later** | **5** | `REQ-TRV-024`, `REQ-TRV-026`, `REQ-TRV-027`, `REQ-HST-028`, `REQ-HST-029` | UI-complete in MVP; backend deferred to Phase 11 |
| **Total Source Rows** | **57** | — | — |

### 1.3 Count by Requirement Origin

| Requirement Origin | Requirement Count | Percentage | Scope Description |
| :--- | :---: | :---: | :--- |
| **EXPLICIT** | **57** | 79.2% | Directly derived from the 57 FRS source rows |
| **IMPLIED** | **15** | 20.8% | Necessary operational/system requirements (`REQ-IMPL-001`..`015`) |
| **PROPOSED** | **0** | 0.0% | Zero speculative requirements added without foundation |
| **Total Requirements** | **72** | **100%** | Full normalized specification scope |

### 1.4 Count by Application Surface Allocation

*Note: Requirements frequently span multiple application surfaces (e.g., Mobile client + Backend API).*

| Application Surface | Identifier | Surface Role | Normalized Requirements Covering Surface |
| :--- | :---: | :--- | :---: |
| **Traveller Mobile Application** | `TM` | Dedicated iOS & Android consumer app | 27 (`REQ-TRV-001`..`027`) |
| **Host Mobile Application** | `HM` | Dedicated iOS & Android host store-floor app | 30 (`REQ-HST-001`..`030`) |
| **Public Traveller Website** | `PW` | Browser discovery & web checkout | 27 (`REQ-TRV-001`..`027`) |
| **Host Web Dashboard** | `HD` | Desktop/tablet host management & multi-location setup | 29 (`REQ-HST-001`..`030`, except mobile-only steps) |
| **Superadmin Dashboard** | `AD` | Platform governance, manual payouts, KYC, refunds | 22 (Oversight, approvals, disputes, payouts) |
| **Backend API / Modular Monolith** | `API` | Central Fastify service & Postgres database | 72 (All explicit and implied requirements) |

---

## 2. Complete Traceability Matrix: Traveller Features (27 Source Rows)

| Source Row # | Original FRS Index | Normalized ID | Original Feature Name | Original Description | Original FRS Class. | Delivery Target | Implementation Status | Origin | Acceptance Criteria IDs | Primary Actor | Surfaces | Dependencies |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :--- |
| **1** | `FR -1` | `REQ-TRV-001` | Account Registration & Login | Sign up using email, Google/Apple etc. | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-001-01`..`03` | Traveller | `TM`, `PW`, `API` | `identity`, `users` |
| **2** | `FR-2` *(1st)* | `REQ-TRV-002` | Traveller Profile | Name, contact details, booking history and preferences | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-002-01`..`02` | Traveller | `TM`, `PW`, `API` | `REQ-TRV-001`, `users` |
| **3** | `FR -2` *(2nd)* | `REQ-TRV-003` | Location Search | Search storage locations based on destination/current location | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-003-01`..`03` | Traveller | `TM`, `PW`, `API` | `marketplace`, `geospatial` |
| **4** | `FR-3` *(1st)* | `REQ-TRV-004` | Map View | See nearby Hosts on a map | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-004-01`..`03` | Traveller | `TM`, `PW`, `API` | `REQ-TRV-003`, `MapLibre` |
| **5** | `FR -3` *(2nd)* | `REQ-TRV-005` | Host Listings | View available luggage-storage locations | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-005-01`..`02` | Traveller | `TM`, `PW`, `API` | `REQ-TRV-003`, `locations` |
| **6** | `FR-4` *(1st)* | `REQ-TRV-006` | Filters | Filter by distance, price, opening hours, rating, availability etc. | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-006-01`..`03` | Traveller | `TM`, `PW`, `API` | `REQ-TRV-003`, `REQ-TRV-005` |
| **7** | `FR -4` *(2nd)* | `REQ-TRV-007` | Host Details | Address/approximate location, photos, opening hours, facilities, restrictions, reviews | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-007-01`..`03` | Traveller | `TM`, `PW`, `API` | `locations`, `reviews` |
| **8** | `FR-5` *(1st)* | `REQ-TRV-008` | Availability Check | Select date, drop-off time, collection time and number/type of bags | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-008-01`..`03` | Traveller | `TM`, `PW`, `API` | `capacity`, `availability` |
| **9** | `FR -5` *(2nd)* | `REQ-TRV-009` | Price Calculation | Automatically calculate storage price | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-009-01`..`02` | Traveller | `TM`, `PW`, `API` | `REQ-TRV-008`, `pricing` |
| **10** | `FR-6` *(1st)* | `REQ-TRV-010` | Booking | Reserve luggage space for selected period | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-010-01`..`02` | Traveller | `TM`, `PW`, `API` | `REQ-TRV-008`, `bookings` |
| **11** | `FR -6` *(2nd)* | `REQ-TRV-011` | Online Payment | Pay securely through the app | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-011-01`..`03` | Traveller | `TM`, `PW`, `API` | `REQ-TRV-010`, `PayHere` |
| **12** | `FR-7` *(1st)* | `REQ-TRV-012` | Booking Confirmation | Receive booking reference/QR code/PIN | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-012-01`..`02` | Traveller | `TM`, `PW`, `API` | `REQ-TRV-011`, `custody` |
| **13** | `FR -7` *(2nd)* | `REQ-TRV-013` | Directions | Navigate to the Host location | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-013-01`..`02` | Traveller | `TM`, `PW`, `API` | `REQ-TRV-012`, `locations` |
| **14** | `FR-8` *(1st)* | `REQ-TRV-014` | Check-in / Bag Drop | Verify booking when handing luggage to Host | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-014-01`..`02` | Traveller | `TM`, `PW`, `API` | `REQ-TRV-012`, `REQ-HST-013` |
| **15** | `FR -8` *(2nd)* | `REQ-TRV-015` | Check-out / Collection | Secure verification when retrieving luggage | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-015-01`..`02` | Traveller | `TM`, `PW`, `API` | `REQ-HST-016`, `custody` |
| **16** | `FR-9` *(1st)* | `REQ-TRV-016` | Active Booking | See current storage details and collection deadline | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-016-01`..`02` | Traveller | `TM`, `PW`, `API` | `bookings`, `custody` |
| **17** | `FR -9` *(2nd)* | `REQ-TRV-017` | Booking History | Previous/completed/cancelled bookings | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-017-01`..`02` | Traveller | `TM`, `PW`, `API` | `bookings` |
| **18** | `FR-10` *(1st)* | `REQ-TRV-018` | Cancellation | Cancel according to cancellation policy | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-018-01`..`02` | Traveller | `TM`, `PW`, `API` | `bookings`, `finance` |
| **19** | `FR -10` *(2nd)* | `REQ-TRV-019` | Refund Status | See whether refund is pending/completed | Later/MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-019-01`..`02` | Traveller | `TM`, `PW`, `AD`, `API` | `REQ-TRV-018`, `payments` |
| **20** | `FR-11` *(1st)* | `REQ-TRV-020` | Notifications | Booking confirmation, drop-off reminder, collection reminder etc. | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-020-01`..`02` | Traveller | `TM`, `PW`, `API` | `notifications`, `bookings` |
| **21** | `FR -11` *(2nd)* | `REQ-TRV-021` | Host Reviews & Ratings | View reviews before booking | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-021-01`..`02` | Traveller | `TM`, `PW`, `API` | `reviews`, `locations` |
| **22** | `FR-12` *(1st)* | `REQ-TRV-022` | Leave Review | Rate Host after collection and for app | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-022-01`..`02` | Traveller | `TM`, `PW`, `API` | `REQ-TRV-015`, `reviews` |
| **23** | `FR -12` *(2nd)* | `REQ-TRV-023` | Customer Support | Report issues or contact platform support. Should be seperated | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-023-01`..`02` | Traveller | `TM`, `PW`, `AD`, `API` | `support`, `users` |
| **24** | `FR-13` *(1st)* | `REQ-TRV-024` | Favourite Hosts | Save preferred storage locations | Later | UI-Complete / Backend-Deferred | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-024-01`..`02` | Traveller | `TM`, `PW`, `API` | `travellers`, `locations` |
| **25** | `FR -13` *(2nd)* | `REQ-TRV-025` | Promo Codes | Apply discounts/offers | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-025-01`..`02` | Traveller | `TM`, `PW`, `API` | `pricing`, `REQ-TRV-009` |
| **26** | `FR-14` *(1st)* | `REQ-TRV-026` | Multiple Languages | Traveller-friendly localization | Later | UI-Complete / Backend-Deferred | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-026-01`..`02` | Traveller | `TM`, `PW`, `HD`, `API` | `localization`, `i18n` |
| **27** | `FR -14` *(2nd)* | `REQ-TRV-027` | Multiple Currencies | Display/pay in preferred currency | Later | UI-Complete / Backend-Deferred | `Documentation defined` | `EXPLICIT` | `AC-REQ-TRV-027-01`..`02` | Traveller | `TM`, `PW`, `API` | `localization`, `pricing` |

---

## 3. Complete Traceability Matrix: Host Features (30 Source Rows)

| Source Row # | Original FRS Index | Normalized ID | Original Feature Name | Original Description | Original FRS Class. | Delivery Target | Implementation Status | Origin | Acceptance Criteria IDs | Primary Actor | Surfaces | Dependencies |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :--- |
| **28** | `FR-15` | `REQ-HST-001` | Host Registration | Apply to become a storage Host | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-001-01`..`02` | Host Owner | `HM`, `PW`, `HD`, `API` | `hosts`, `users` |
| **29** | `FR-16` | `REQ-HST-002` | Identity/Business Verification | Submit required identity/business information | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-002-01`..`02` | Host Owner | `HM`, `HD`, `API` | `REQ-HST-001`, `R2` |
| **30** | `FR-17` | `REQ-HST-003` | Host Approval | Platform approves Host before listing goes live | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-003-01`..`03` | Superadmin | `AD`, `HM`, `HD`, `API` | `REQ-HST-002`, `admin` |
| **31** | `FR-18` | `REQ-HST-004` | Host Profile | Business/location information and contact details | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-004-01`..`02` | Host Owner | `HM`, `HD`, `API` | `hosts` |
| **32** | `FR-19` | `REQ-HST-005` | Storage Location Setup | Add address, photos and description | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-005-01`..`02` | Host Owner | `HM`, `HD`, `API` | `locations`, `R2` |
| **33** | `FR-20` | `REQ-HST-006` | Opening Hours | Define available storage hours | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-006-01`..`02` | Host Owner | `HM`, `HD`, `API` | `REQ-HST-005`, `availability` |
| **34** | `FR-21` | `REQ-HST-007` | Storage Capacity | Specify how many bags can be stored | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-007-01`..`02` | Host Owner | `HM`, `HD`, `API` | `REQ-HST-005`, `capacity` |
| **35** | `FR-22` | `REQ-HST-008` | Availability Management | Block dates/times or temporarily stop bookings | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-008-01`..`02` | Host Owner | `HM`, `HD`, `API` | `availability` |
| **36** | `FR-23` | `REQ-HST-009` | Pricing | View/configure storage pricing depending on your business model | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-009-01`..`02` | Host Owner | `HM`, `HD`, `API` | `pricing` |
| **37** | `FR-24` | `REQ-HST-010` | Booking Dashboard | See today's/upcoming bookings | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-010-01`..`02` | Host Owner | `HM`, `HD`, `API` | `bookings`, `custody` |
| **38** | `FR-25` | `REQ-HST-011` | Booking Details | Traveller, number of bags, drop-off/collection times etc. | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-011-01`..`02` | Host Owner | `HM`, `HD`, `API` | `bookings` |
| **39** | `FR-26` | `REQ-HST-012` | Booking Acceptance | Accept booking if you're not using instant booking | Depends | Configurable MVP | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-012-01`..`02` | Host Owner | `HM`, `HD`, `API` | `bookings`, `finance` |
| **40** | `FR-27` | `REQ-HST-013` | Check-in Traveller | Verify booking at luggage drop-off | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-013-01`..`02` | Host Owner | `HM`, `HD`, `API` | `REQ-TRV-012`, `custody` |
| **41** | `FR-28` | `REQ-HST-014` | Bag Verification | Confirm number/type of bags received | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-014-01`..`02` | Host Owner | `HM`, `HD`, `API` | `REQ-HST-013`, `custody` |
| **42** | `FR-29` | `REQ-HST-015` | Check-in Evidence | Photo/tag/QR/PIN confirmation | Recommended | Configurable MVP | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-015-01`..`02` | Host Owner | `HM`, `HD`, `API` | `REQ-HST-014`, `R2` |
| **43** | `FR-30` | `REQ-HST-016` | Check-out Verification | Verify traveller before releasing luggage | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-016-01`..`02` | Host Owner | `HM`, `HD`, `API` | `REQ-TRV-015`, `custody` |
| **44** | `FR-31` | `REQ-HST-017` | Mark Booking Complete | Confirm successful collection | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-017-01`..`02` | Host Owner | `HM`, `HD`, `API` | `REQ-HST-016`, `finance` |
| **45** | `FR-32` | `REQ-HST-018` | Late Collection Handling | Flag overdue luggage / calculate additional charges | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-018-01`..`02` | Host Owner | `HM`, `HD`, `API` | `custody`, `pricing` |
| **46** | `FR-33` | `REQ-HST-019` | Booking History | View previous bookings | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-019-01`..`02` | Host Owner | `HM`, `HD`, `API` | `bookings` |
| **47** | `FR-34` | `REQ-HST-020` | Cancellation Handling | Host cancellation according to platform rules | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-020-01`..`02` | Host Owner | `HM`, `HD`, `API` | `bookings`, `finance` |
| **48** | `FR-35` | `REQ-HST-021` | Notifications | New booking, upcoming arrival, collection etc. | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-021-01`..`02` | Host Owner | `HM`, `HD`, `API` | `notifications` |
| **49** | `FR-36` | `REQ-HST-022` | Earnings Dashboard | Booking revenue and Host earnings | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-022-01`..`02` | Host Owner | `HM`, `HD`, `API` | `finance` |
| **50** | `FR-37` | `REQ-HST-023` | Payout Management | Bank/payment account and payout status- Will do a manual payout through a superadmin dashboard | Core MVP | MVP Functional (Manual) | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-023-01`..`02` | Superadmin | `HM`, `HD`, `AD`, `API` | `finance`, `admin` |
| **51** | `FR-38` | `REQ-HST-024` | Transaction History | View payments, platform commission and payouts | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-024-01`..`02` | Host Owner | `HM`, `HD`, `API` | `finance` |
| **52** | `FR-39` | `REQ-HST-025` | Reviews & Ratings | See ratings/reviews received | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-025-01`..`02` | Host Owner | `HM`, `HD`, `API` | `reviews` |
| **53** | `FR-40` | `REQ-HST-026` | Support | Report traveller/booking/luggage issues | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-026-01`..`02` | Host Owner | `HM`, `HD`, `AD`, `API` | `support` |
| **54** | `FR-41` | `REQ-HST-027` | Incident Reporting | Report lost/damaged/unclaimed luggage | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-027-01`..`02` | Host Owner | `HM`, `HD`, `AD`, `API` | `custody`, `incidents` |
| **55** | `FR-42` | `REQ-HST-028` | Staff Accounts | Allow employees to handle check-in/out | Later | UI-Complete / Backend-Deferred | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-028-01`..`02` | Host Owner | `HM`, `HD`, `API` | `staff`, `hosts` |
| **56** | `FR-43` | `REQ-HST-029` | Analytics | Occupancy, bookings, revenue, busiest periods etc. | Later | UI-Complete / Backend-Deferred | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-029-01`..`02` | Host Owner | `HM`, `HD`, `API` | `analytics` |
| **57** | `FR-44` | `REQ-HST-030` | Multiple Locations | One Host manages several storage locations ( Ex. Barista ) | Core MVP | MVP Functional | `Documentation defined` | `EXPLICIT` | `AC-REQ-HST-030-01`..`02` | Host Owner | `HM`, `HD`, `AD`, `API` | `hosts`, `locations` |

---

## 4. Traceability Matrix: Implied Operational Requirements (`REQ-IMPL-001` to `REQ-IMPL-015`)

| Implied ID | Feature Name | Origin | Why Necessary (Source FRS Tracing) | Delivery Target | Implementation Status | Acceptance Criteria IDs | Primary Actor | Surfaces |
| :---: | :--- | :---: | :--- | :--- | :---: | :--- | :--- | :--- |
| `REQ-IMPL-001` | Host Re-Verification on Profile Edit | `IMPLIED` | Prevents post-approval alteration of legal entity name (`FR-16`, `FR-17`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-001-01` | Host / Admin | `HD`, `AD`, `API` |
| `REQ-IMPL-002` | Location Status & Moderation Lifecycle | `IMPLIED` | Enables deactivating rogue/unsafe locations (`FR-17`, `FR-19`, `FR-44`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-002-01` | Superadmin | `HD`, `AD`, `API` |
| `REQ-IMPL-003` | Price Breakdown Snapshot Persistence | `IMPLIED` | Prevents host price edits from mutating existing bookings (`FR-5`, `FR-23`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-003-01` | Backend Engine | `API` |
| `REQ-IMPL-004` | Capacity Reservation Expiration Worker | `IMPLIED` | Releases capacity held by abandoned checkouts (`FR-5`, `FR-6`, `FR-21`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-004-01` | Worker Routine | `API` |
| `REQ-IMPL-005` | Booking State Machine Guardrails | `IMPLIED` | Prohibits illegal state transitions (`FR-6`, `FR-8`, `FR-27`, `FR-31`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-005-01` | Backend Engine | `API` |
| `REQ-IMPL-006` | Payment Webhook Idempotency & Checksum | `IMPLIED` | Prevents duplicate confirmation on PayHere webhook retry (`FR-6`, `FR-38`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-006-01` | PayHere Gateway | `API` |
| `REQ-IMPL-007` | Payment Provider Abstraction Layer | `IMPLIED` | Supports global multi-provider expansion (`FR-6`, `ADR-008`, `ADR-010`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-007-01` | Backend Service | `API` |
| `REQ-IMPL-008` | Automated Refund Trigger on Host Rejection | `IMPLIED` | Approved in `OQ-004`: auto-refund upon rejection/expiration (`FR-26`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-008-01` | Backend Engine | `API` |
| `REQ-IMPL-009` | Review Moderation Queue | `IMPLIED` | Provides administrative review moderation (`FR-12`, `FR-39`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-009-01` | Superadmin | `AD`, `API` |
| `REQ-IMPL-010` | Custody Evidence Legal Hold on Incident | `IMPLIED` | Preserves photo evidence during incident investigation (`FR-29`, `FR-41`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-010-01` | Platform Staff | `AD`, `API` |
| `REQ-IMPL-011` | Immutable Financial Ledger Journal | `IMPLIED` | Ensures auditable host balance and commission ledger (`FR-36`..`FR-38`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-011-01` | Finance Service | `AD`, `API` |
| `REQ-IMPL-012` | Manual Payout Authorization & Reference Log | `IMPLIED` | Directly implements Superadmin manual payout workflow (`FR-37`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-012-01` | Superadmin | `AD`, `API` |
| `REQ-IMPL-013` | Platform Commission Policy Engine | `IMPLIED` | Configures commission rates across hosts/countries (`FR-36`, `FR-38`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-013-01` | Superadmin | `AD`, `API` |
| `REQ-IMPL-014` | Superadmin RBAC & Audit Log | `IMPLIED` | Restricts manual payouts to Superadmin (`FR-17`, `FR-37`, `OQ-011`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-014-01` | Superadmin | `AD`, `API` |
| `REQ-IMPL-015` | Global Configuration Engine | `IMPLIED` | Manages country, currency, locale, and timezone metadata (`FR-14`, `ADR-010`) | MVP Functional | `Documentation defined` | `AC-REQ-IMPL-015-01` | Superadmin | `AD`, `API` |

---

## 5. Requirements Awaiting Owner Decisions & External Verification Gates

Following the adoption of the Product Owner Decision Record (`OQ-001` through `OQ-015`) and the Phase 0B-D integrity audit, architectural baselines and core product policies are formally approved. The remaining items below are categorized into **Owner-Approved Baseline Policies**, **Proposed Details Pending Owner Confirmation**, and **Mandatory External Verification Gates**:

### 5.1 Owner-Approved Architectural & Policy Baselines
| Normalized ID | Feature Name | Approved Policy Baseline | Open Question Ref | Approval Status |
| :--- | :--- | :--- | :---: | :---: |
| `REQ-TRV-001` / `REQ-HST-001` | Account Registration & Login | Self-managed Fastify authentication with PostgreSQL sessions/JWT and Argon2id password hashing; social login deferred/optional. | `OQ-001` | **Approved** |
| `REQ-TRV-010` / `REQ-HST-012` | Booking & Acceptance | Both Instant and Host Approval modes supported, configurable per location; 15-min default host SLA; 10-min default traveller payment SLA; payment after host acceptance. | `OQ-004` | **Approved** |
| `REQ-HST-009` / `REQ-HST-022` | Pricing & Commission | 15% platform commission baseline on storage service subtotal excluding taxes; payment gateway fees absorbed by platform; strict promo funding rules. | `OQ-005` | **Approved** |
| `REQ-HST-007` | Storage Capacity | Four standard bag categories: Small, Medium, Large, Oversized; configurable dimensions/weights; location opt-in for oversized. | `OQ-006` | **Approved** |
| `REQ-TRV-027` | Currency Selection | LKR as sole launch currency; stored as integer minor units with ISO 4217 code; dynamic exponent; no global two-decimal assumption; multi-currency deferred. | `OQ-008` | **Approved** |
| `REQ-TRV-018` / `REQ-HST-020` | Cancellations | Customer cancellation policy tiers: 100% >2h, 50% <2h, 0% after start/no-show, 100% host/platform cancel. | `OQ-009` | **Approved** |
| `REQ-HST-024` / `REQ-IMPL-011` | Tax & Invoicing Foundation | Configurable four-layer tax foundation (Layer A capability approved); software capability does not constitute legal advice or guarantee compliance. | `OQ-010` | **Approved (Arch)** |
| `REQ-HST-003` / `REQ-HST-029` | Governance Permissions | Strict least privilege: Platform Support Staff cannot approve hosts or execute financial payouts/refunds; reserved for Superadmin. | `OQ-011` | **Approved** |
| `REQ-TRV-004` / `REQ-TRV-007` | Address Privacy Masking | Mask exact address during public discovery; reveal exact street address post-confirmation to confirmed booking traveller. | `OQ-012` | **Approved (Baseline)** |
| `REQ-HST-013` / `REQ-HST-015` | Custody Evidence | Mandatory QR/PIN and bag count check; photo evidence supported in MVP, optional by default, configurable as mandatory per location. | `OQ-014` | **Approved** |
| `REQ-HST-016` / `REQ-HST-018` | Late Collection & Custody | In-app payment exclusively for overdue charge settlement; cash excluded; physical luggage return is strictly decoupled from overdue fee payment (no possessory lien). | `OQ-015` | **Approved** |

### 5.2 Proposed Implementation Details Awaiting Explicit Owner Decision
| Normalized ID | Feature Name | Proposed Detail | Open Question Ref | Status |
| :--- | :--- | :--- | :---: | :---: |
| `REQ-TRV-004` | Map View | Specific coordinate jitter radius range (such as $\pm 150-300\text{m}$) for public map display. | `OQ-012` | **Proposed / Pending Approval** |
| `REQ-TRV-007` / `REQ-TRV-013` | Host Details & Directions | Post-confirmation automatic disclosure of storefront signage name, entrance photos, and host contact phone number. | `OQ-012` | **Proposed / Pending Approval** |

### 5.3 Mandatory External Verification Gates (Pre-Launch Compliance & Commercial Verification)
| Normalized ID | Feature Name | External Gate Description | Priority | Open Question Ref | Verification Entity |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `REQ-TRV-011` / `REQ-HST-023` | Online Payments & Payouts | **Launch Gate Blocker:** Obtain written confirmation from PayHere permitting marketplace collection on behalf of hosts and manual host payouts. | **Critical** | `OQ-003` | PayHere Legal & Compliance |
| `REQ-HST-024` / `REQ-IMPL-011` | Tax & Invoicing Compliance | **Launch Gate:** Obtain professional Sri Lankan legal and tax advisory on agency vs principal supply, VAT on commission vs full service, SSCL turnover liability, and invoice formatting. | **Critical** | `OQ-010` | Sri Lankan Tax & Legal Advisor |
| `REQ-HST-002` | Host Verification | Confirm mandatory document checklist for Sri Lankan individuals (NIC/Passport) vs registered entities (BRC + Director NIC). | **High** | `OQ-002` | Legal / Compliance |
| `REQ-TRV-019` | Refund Status & Reconciliation | Confirm PayHere automated Refund API capabilities, portal fallback, settlement timing, fee deductions, and 7-stage lifecycle reconciliation. | **High** | `OQ-013` | PayHere Integration Team |
| `REQ-TRV-003` / `REQ-TRV-013` | Search & Directions | Finalize commercial map vector tile, geocoding, and routing provider contract and quota tiers. | **High** | `OQ-018` | Map Provider Vendor |
