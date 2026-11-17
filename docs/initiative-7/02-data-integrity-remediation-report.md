# Initiative 7 — WS-7.1 Data Integrity Remediation Report

---

## 1. Operating-Hours Explicit State Model

### Defect Confirmed
- `PublicStorageLocationSchema` (`packages/contracts/src/locations/index.ts`) defaulted `operatingHoursSummary` to `"08:00 - 20:00"`.
- `DiscoveryService.searchLocations` and `DiscoveryService.getPublicLocationDetails` (`apps/api/src/modules/discovery/discovery.service.ts`) emitted `"08:00 - 20:00"` when zero `opening_hours` rows existed, contradicting `QuotationAndAvailabilityService.validateOperatingWindow` (`apps/api/src/modules/bookings/quotation-availability.service.ts`), which treated `weeklyHours.length === 0` as 24/7 open.
- Web (`LandingPage.tsx`, `SearchDiscoveryPage.tsx`, `LocationDetailPage.tsx`) and Mobile (`LocationCard.tsx`, `location.tsx`, `checkout.tsx`) assumed a non-null string or added a second `"08:00 - 20:00"` fallback.

### Remediation Implemented
1. **Shared Contract Helper (`packages/contracts/src/locations/index.ts`):**
   - Added `OPERATING_HOURS_STATUSES`: `"CONFIGURED" | "UNCONFIGURED" | "PARTIAL" | "CLOSED" | "OPEN_24_HOURS"`.
   - Updated `PublicStorageLocationSchema` so `operatingHoursStatus` defaults to `"UNCONFIGURED"` and `operatingHoursSummary` is `z.string().nullable().default(null)`.
   - Exported `summarizeOpeningHours(hours)` returning explicit `is24Hours`, `operatingHoursStatus`, and `operatingHoursSummary`.
2. **Backend Discovery & Availability:**
   - Replaced duplicated summary logic in `DiscoveryService.searchLocations` and `getPublicLocationDetails` with `summarizeOpeningHours(hours)`.
   - Updated `QuotationAndAvailabilityService.validateOperatingWindow` so `weeklyHours.length === 0` returns `"Operating hours are not configured for this storage location"` instead of silently treating unconfigured schedules as 24/7.
3. **Web & Mobile Consumers:**
   - Updated Web (`LandingPage.tsx`, `SearchDiscoveryPage.tsx`, `LocationDetailPage.tsx`) and Mobile (`LocationCard.tsx`, `location.tsx`, `checkout.tsx`) to display `"Operating hours not configured"` (or `"Hours not configured"`) when `operatingHoursSummary` is `null`.

---

## 2. Support Ticket Assignment Validation

### Defect Confirmed
`SupportService.updateAdminTicket` (`apps/api/src/modules/support/support.service.ts`) verified only that `assignedToUserId` existed in `users`, allowing assignment to suspended accounts, travellers, or hosts.

### Remediation Implemented
- Added strict assignee verification in `SupportService.updateAdminTicket`:
  - `404 Not Found` if `users.id` does not exist.
  - `400 Bad Request` if `users.status !== "ACTIVE"`.
  - `400 Bad Request` if the user holds neither `"SUPPORT"` nor `"SUPERADMIN"` in `user_roles` joined with `roles`.
- Preserved `assignedToUserId: null` to clear ticket assignment.

---

## 3. Additional Data-Integrity Audit Findings

- **Host Location Cards (`apps/web/src/features/host/host-helpers.tsx`, `HostLocationsPage.tsx`):** Removed fabricated `hasInsurance: true`, `insuranceLimitLkr: 250000`, `"LKR 250k Protection"` badge, and `"08:00 - 20:00 IST"` fallback in `mapApiLocationToItem`.
- **Clean Areas Verified:** Bookings (`OQ-012` masking, commission scoping), Quotations (`pricing_policies` required), Custody, Payments, and Finance (`ADMIN_FINANCIAL_MANAGE` `null` gating) already avoid synthesized defaults.

---

## 4. Verification
- `apps/api/tests/initiative-7-closure.test.ts` (Tests #1, #2, #3): Verified `summarizeOpeningHours` across all 5 states, verified `UNCONFIGURED` discovery (`operatingHoursSummary: null`) & quotation rejection, and verified all 8 support-assignment scenarios (`404` missing, `400` traveller/host/suspended, `403` unauthorized caller, `200` active `SUPPORT`/`SUPERADMIN`/unassign).
- `apps/web/tests/initiative-7-profile-and-integrity.test.tsx` (Test #3): Verified Web `LocationProfileDetailPage` and `HostLocationManagementPage` do not render `"08:00 - 20:00"` or `"LKR 250k Protection"`.

