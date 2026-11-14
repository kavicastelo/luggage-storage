# Stage C4 — Live Host Onboarding, Location Management & Custody Workspace

## 1. Screen Inventory Implemented (`apps/mobile/app/(host)/`)

| Route | Component | Live Data / Mutations | Access Control |
| --- | --- | --- | --- |
| `/(host)/_layout` | `HostLayout` | `useAuthStore` | Sign-in gate + `HOST_OWNER` / `HOST_STAFF` / `SUPERADMIN` RBAC guard (permits `/onboarding` for prospective owners); hides `Earnings` & `Settings` from `HOST_STAFF` |
| `/(host)` (`index.tsx`) | `HostLiveDeskScreen` | `useOwnedBusinessesQuery`, `useOwnedLocationsQuery`, `useHostBookingsQuery`, `useCapacityPoolsQuery` | Guides 0-business owners to onboarding and 0-hub owners to hub creation; live vault occupancy bar & movement queue |
| `/(host)/onboarding` | `HostOnboardingScreen` | `useCreateBusinessMutation`, `useUpdateBusinessMutation`, `useAuthStore.refreshSessionAndUser()`, `marketplaceApi.initiateUpload` -> `uploadFileToPresignedUrl` -> `confirmUpload`, `useSubmitVerificationMutation`, `getVerificationDocumentDownloadUrl` | 3-step signed upload + KYC submission + presigned download preview |
| `/(host)/locations` | `HostLocationsScreen` | `useOwnedLocationsQuery`, `useMobileStore.setSelectedHostLocationId` | Partner hub switcher + readiness overview |
| `/(host)/location-editor` | `HostLocationEditorScreen` | `createLocation`, `updateLocation`, `LOCATION_IMAGE` 3-step upload, `setOpeningHours`, `addOpeningHoursException`, `createStorageZone`, `createCapacityPool`, `updateCapacityPool`, `configurePricingPolicy`, `submitLocationForReview`, `disableLocation`, `getCurrentDeviceLocation` | Full lifecycle editor for Sri Lanka hubs, minor-cent LKR pricing, weekly hours & zones |
| `/(host)/requests` | `HostRequestsScreen` | `useHostBookingsQuery`, `useAcceptHostBookingMutation`, `useRejectHostBookingMutation`, `useHostCancelBookingMutation`, `useReportBookingExceptionMutation` | Segmented queue (`Pending`, `Upcoming`, `Active`, `Past`) |
| `/(host)/scanner` | `HostScannerScreen` | `CameraView`, `useCameraPermissions`, `useHostBookingsQuery`, `useVerifyCustodyPassMutation` | QR + 6-digit PIN verification + `429` cooldown display |
| `/(host)/intake` | `HostIntakeScreen` | `useHostBookingDetailQuery`, `useHostLocationDetailQuery`, `useCompleteCheckInMutation`, `expo-image-picker` | Dynamic bag rows, seals, storage zones, optional local counter reference photo with honest policy notice |
| `/(host)/vault` | `HostVaultScreen` | `useHostBookingsQuery`, `useCustodyDetailQuery`, `useCompleteCollectionMutation` | Unconditional no-lien overdue release banner + PIN/QR release sheet |
| `/(host)/earnings` | `HostEarningsScreen` | `useHostFinanceSummaryQuery`, `useBusinessPayoutDetailsQuery` | Direct `HOST_OWNER` / `SUPERADMIN` 403 guard + LKR minor-unit payables breakdown |
| `/(host)/settings` | `HostSettingsScreen` | `useOwnedBusinessesQuery`, `useOwnedLocationsQuery`, `useAuthStore.logout`, `useMobileStore.setRole` | Direct `HOST_OWNER` / `SUPERADMIN` 403 guard + honest staff invite limitation disclosure |

## 2. Safeguards & Backend Constraints Preserved

- **No Production Mocks:** Removed `useHostStore` and `mock-host-data` imports from all `app/(host)/*` screens while keeping unit stores intact on disk for regression tests.
- **Unconditional Custody Release (No-Lien):** Overdue bookings remain prominently tagged for attention while staff release luggage unconditionally with overdue minutes accrued in the double-entry ledger.
- **On-Device Intake Photos:** Optional check-in counter photos use `expo-image-picker` locally with explicit copy clarifying that local reference photos do not assert pristine condition.
- **Staff Invite Disclosure:** Self-service staff invitation links are not yet exposed by the API routes and are disclosed transparently rather than fabricated.
