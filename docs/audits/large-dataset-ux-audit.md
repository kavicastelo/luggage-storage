# Cross-Platform Large Dataset UX Audit & Optimization Report

**Project:** Luggage Storage Marketplace  
**Platforms:** React Native Mobile (`apps/mobile`) & React Web (`apps/web`)  
**Backend:** Fastify TypeScript API (`apps/api`) & Shared Contracts (`packages/contracts`)  
**Date:** November 2026  
**Auditor:** Senior Full-Stack & UX Architect

---

## 1. Architecture Findings

### 1.1 Repository Structure & Technology Stack
- **Monorepo:** Managed with PNPM workspaces and Turborepo.
  - `apps/mobile`: React Native 0.88, Expo SDK 58, Expo Router, `@tanstack/react-query` v5, `zustand`.
  - `apps/web`: React 18, Vite 6, Tailwind CSS, `@tanstack/react-query` v5, React Router v6, `zustand`.
  - `apps/api`: Fastify 4, Drizzle ORM, PostgreSQL 16 + PostGIS 3.5, Zod validation.
  - `packages/contracts`: Shared Zod schemas, TypeScript domain types, standard pagination utilities.

### 1.2 Existing Pagination & Data-Fetching Foundations
- **Shared Contracts (`packages/contracts/src/api/pagination.ts`):**
  - Standard schemas: `PaginationQuerySchema` (`page`, `limit`), `PaginationMetaSchema` (`page`, `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`), `createPaginatedResponse`.
- **Backend Endpoints:**
  - `GET /api/v1/discovery/locations`: Supports `page`, `limit`, `city`, `searchTerm`, `amenities`, `acceptsOversized`, `sortBy`, `latitude`, `longitude`, `radiusMeters`. Returns `{ locations, pagination: { page, limit, total, totalPages } }`.
  - `GET /api/v1/bookings`: Supports `status`, `search`, `page`, `limit`. Returns `PaginatedApiResponse<BookingDetail>`.
  - `GET /api/v1/hosts/bookings`: Supports `status`, `locationId`, `businessId`, `search`, `page`, `limit`. Returns `PaginatedApiResponse<BookingDetail>`.
  - `GET /api/v1/admin/*` (bookings, audit, ledger, users, hosts, payouts, tickets): All support server-side `page`, `limit`, and search/filter parameters with `createPaginatedResponse`.
- **Client Data-Fetching:** Both web and mobile use `@tanstack/react-query` v5 with dedicated query key factories (`mobileQueryKeys`, `travellerQueryKeys`, `hostQueryKeys`, `adminQueryKeys`).

---

## 2. Complete Audit Report: Large-Data Scenarios

| # | Screen / Feature | Platform | Current Implementation | Critical Problem / Bottleneck | Recommended Solution | Priority |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Luggage Discovery & Search** | Mobile (`DiscoveryView.tsx`) | `useSearchLocationsQuery` fetches single batch (`page: 1`). Renders using `.map()` inside `ScreenContainer` (vertical `ScrollView`). | **Critical Memory & Performance Blocker:** As locations grow (100–10,000), unvirtualized `.map()` in `ScrollView` renders all DOM/native nodes at once, causing severe frame drops and crashes. No infinite scrolling or pagination exists; items past page 1 are unreachable. | Convert to virtualized `FlatList` with `ScreenContainer(scrollable=false)`. Implement `useInfiniteQuery` with smooth incremental fetching, skeleton loading, pull-to-refresh, debounced search, and map sync. | **P0 (Critical)** |
| **2** | **Traveller Discovery & Search** | Web (`SearchDiscoveryPage.tsx`) | `useDiscoveryLocations` with hardcoded `limit: 24`. No `page` state. Renders via `.map()` in standard DOM. | **Dataset Truncation:** Zero pagination controls exist (no Next/Prev, no Page N of M, no Load More). Locations beyond the 24th item are completely inaccessible to users. Search debounce does not reset page. | Implement hybrid Server-Side Pagination with "Load More" / Page Navigation bar, URL query sync (`?page=1`), search input debounce, and total record count badge. | **P0 (Critical)** |
| **3** | **Traveller Bookings** | Mobile (`bookings.tsx`) | Hardcoded `{ limit: 50 }`. Client-side tab filtering (`useMemo`) over 3 statuses. Renders `.map()` in `ScrollView`. | **Data Inaccuracy & Truncation:** If a traveller has >50 bookings, newer or older records vanish. Filtering on the frontend means 50 completed bookings hide active bookings from view. Unvirtualized rendering. | Convert to `FlatList` virtualization. Push tab status (`status`) directly to backend query. Add "Load More" / infinite pagination and pull-to-refresh. | **P0 (Critical)** |
| **4** | **Traveller Bookings Portal** | Web (`BookingsPortalPage.tsx`) | Hardcoded `{ limit: 50 }`. Client-side `useMemo` filtering for search and status. Zero pagination controls. | **Incomplete Records:** Users with large booking histories cannot view records beyond 50. Client-side search fails on un-fetched pages. | Implement server-side pagination with `page`, `limit`, `status`, and `search` query params. Add pagination bar with total counts and page navigation. | **P0 (Critical)** |
| **5** | **Host Bookings Management** | Web (`HostBookingsPage.tsx`) | Hardcoded `{ limit: 50 }`. No pagination bar. | **Scale Limit:** Busy storage hosts handling hundreds of bookings cannot access bookings beyond 50. | Add server-side pagination controls (`AdminPaginationBar` style), page-size selection, and URL sync. | **P1 (High)** |
| **6** | **Host Bookings & Requests** | Mobile (`requests.tsx`, `vault.tsx`) | Hardcoded `{ limit: 50 }`. Renders `.map()` inside `ScrollView`. | **Performance & Limit:** High-volume hosts experience sluggish scrolling and truncated request history. | Transition to `FlatList` virtualization with pull-to-refresh and server-side status tab queries. | **P1 (High)** |
| **7** | **Saved Locations** | Mobile (`saved.tsx`) | Fires N parallel HTTP requests via `useQueries` for every saved location ID. | **Network Congestion:** Saving 30 locations triggers 30 concurrent API calls. | Batch location retrieval or paginate saved items with virtualized list rendering. | **P2 (Medium)** |
| **8** | **Host Locations List** | Mobile (`locations.tsx`) & Web (`HostLocationsPage.tsx`) | Unpaginated list rendering. | **Future Scale:** Large enterprise hosts with 50+ locations experience unoptimized DOM/view rendering. | Add virtualized layout / pagination for multi-hub hosts. | **P2 (Medium)** |
| **9** | **Admin Portals (Bookings, Audit, Ledger, Users, Payouts)** | Web (`Admin*.tsx`) | Already implemented server-side pagination (`AdminPaginationBar`, `page`, `limit = 20-25`). | **Minor Optimization Needed:** Ensure search inputs have proper debouncing to avoid API hammer on every keystroke, and URL sync is maintained. | Verify debounced search inputs, page reset on filter change, and stable table layout. | **P2 (Medium)** |

---

## 3. UX Decision Matrix

| Scenario | Platform | Selected Strategy | Rationale |
| :--- | :--- | :--- | :--- |
| **Location Discovery** | Mobile | **Infinite Scrolling + FlatList** | Natural touch gesture for mobile browsing. Virtualization via `FlatList` recycles native views offscreen, maintaining 60fps even with 1,000+ hubs. |
| **Location Discovery** | Web | **Load More + Pagination Bar** | Web users expect explicit feedback of total hubs available, easy page navigation, and bookmarkable URL state (`?page=1&city=Colombo`). Avoids infinite scroll footer traps. |
| **Traveller Bookings** | Mobile | **FlatList + Pull-to-Refresh + Load More** | High-priority active bookings are shown upfront. Status tabs query backend directly. Smooth "Load More" at list end. |
| **Traveller Bookings** | Web | **Traditional Pagination Table/Cards** | Structured account management requires knowing exact page number and total count. Preserves scroll position. |
| **Host Operations & Vault** | Mobile | **FlatList + Status Filters** | Fast counter operations require snappy, zero-lag lists of active bags in storage with instant search. |
| **Host Bookings** | Web | **Traditional Pagination + Filters** | Hosts need to filter by date/status with predictable pagination controls. |
| **Admin Ledgers & Audits** | Web | **Traditional Server-Side Pagination** | Financial auditability demands deterministic page numbers, total row counts, CSV export, and exact page jumps. |

---

## 4. Implementation Plan

1. **Shared Contracts & API Optimization:**
   - Add cursor/infinite pagination helper types if beneficial.
   - Fix `getMyBookings` in `apps/mobile/src/services/marketplace-api.ts` to include `search` query parameter.
   - Ensure `SearchLocationsResponse` and `PaginatedApiResponse` metadata are fully leveraged.
2. **Mobile Optimization (`apps/mobile`):**
   - Implement `useInfiniteSearchLocationsQuery` and `useInfiniteBookingsQuery` in TanStack Query hooks.
   - Refactor `DiscoveryView.tsx`: Use `FlatList` with `ListHeaderComponent`, `ListEmptyComponent`, `ListFooterComponent`, `onEndReached`, `onEndReachedThreshold={0.5}`, item memoization, and search debouncing. Set `ScreenContainer` to `scrollable={false}`.
   - Refactor `bookings.tsx`: Convert to `FlatList`, push active tab status to backend query, implement Load More / Infinite Query.
   - Refactor `requests.tsx` and `vault.tsx`: Convert from `ScrollView` + `.map()` to virtualized `FlatList`.
3. **Web Optimization (`apps/web`):**
   - Refactor `SearchDiscoveryPage.tsx`: Add pagination state (`page`, `limit`), pagination bar with total counts, Next/Prev navigation, page size options, URL param sync, and search debouncing.
   - Refactor `BookingsPortalPage.tsx`: Add server-side status and search queries, pagination controls, and total records display.
   - Refactor `HostBookingsPage.tsx`: Add pagination controls and server-side filter sync.
4. **Testing & Verification:**
   - Unit and integration tests for pagination, infinite queries, debouncing, and empty/error states.
   - Typechecking (`tsc --noEmit`) across all packages.
   - Web build and mobile export verification.
