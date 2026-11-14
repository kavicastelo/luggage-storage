# Stage C0.2 — Backend API Coverage Matrix

Verified directly against `apps/api/src/app.ts` (`API_PREFIX = "/api/v1"`), route registrations in `apps/api/src/modules/*/*.routes.ts`, and Zod schemas in `packages/contracts/src/*`.

---

## 1. Available Endpoints & Contracts

### 1.1 Authentication, Sessions & Verification (`/api/v1/auth/*`)
| Endpoint | Auth / RBAC | Rate Limit / Guard | Request / Response Contract | Mobile Workflow |
| :--- | :--- | :--- | :--- | :--- |
| `POST /auth/register` | Public | Password `>= 8`, assigns `TRAVELLER` | `RegisterRequest` -> `RegisterResponseData` (`PENDING_VERIFICATION`) | Sign up (`TM-006`) |
| `POST /auth/login` | Public | Rate-limited; requires `clientType: "MOBILE"` to return body `refreshToken` | `LoginRequest` -> `LoginResponseData` | Sign in (`TM-005`) |
| `POST /auth/refresh` | Public + Refresh Token | Token family rotation; `clientType: "MOBILE"` | `RefreshRequest` -> `RefreshResponseData` | Boot restore + RBAC refresh |
| `POST /auth/logout` | Optional Bearer | Revokes session family | `refreshToken` -> `LogoutResponseData` | Sign out |
| `POST /auth/logout-all` | `app.authenticate` | Revokes all active sessions | `void` -> `{ message }` | Security (`TM-043`) |
| `GET /auth/me` | `app.authenticate` | Reads live DB user, roles, permissions | `UserMeResponseData` | Session hydration |
| `GET /auth/sessions` | `app.authenticate` | Own sessions only | `SessionListResponseData` | Devices (`TM-043`) |
| `DELETE /auth/sessions/:sessionId` | `app.authenticate` | Own session UUID | `{ message }` | Revoke device |
| `POST /auth/change-password` | `app.authenticate` | Verified email (`403` if pending) | `ChangePasswordRequest` -> `ChangePasswordResponseData` | Password change |
| `POST /auth/forgot-password` | Public | Enumeration-resistant | `ForgotPasswordRequest` -> `ForgotPasswordResponseData` | Recovery (`TM-007`) |
| `POST /auth/reset-password` | Public | Single-use recovery token | `ResetPasswordRequest` -> `ResetPasswordResponseData` | Reset password |
| `POST /auth/verify-email` | Public | Single-use email token; activates user (`ACTIVE`) | `VerifyEmailRequest` -> `VerifyEmailResponseData` | Verify email (`TM-008`) |
| `POST /auth/resend-verification` | Public | Rate-limited (`429`) | `ResendVerificationRequest` -> `ResendVerificationResponseData` | Resend email (`TM-008`) |

### 1.2 Public Discovery & Availability (`/api/v1/discovery/*`, `/api/v1/availability/*`)
| Endpoint | Auth / RBAC | Privacy / Constraint Rules | Request / Response Contract |
| :--- | :--- | :--- | :--- |
| `GET /discovery/locations` | Public | `OQ-012` privacy grid (`~500m`), `100m` rounded `approximateDistanceMeters`, exact street address suppressed | `SearchLocationsQueryInput` -> `SearchLocationsResponse` (`locations`, `pagination`) |
| `GET /discovery/locations/:locationId` | Public | Exact coordinates & street address stripped; `ACTIVE` locations only | `PublicStorageLocation` |
| `GET /availability/search` | Public | Validates `dropOffAt`/`collectionAt` + bag counts against active capacity pools | `AvailabilitySearchQuery` -> `AvailabilitySearchResponse` |

### 1.3 Traveller Bookings & Refunds (`/api/v1/bookings/*`)
| Endpoint | Auth / RBAC | State Transitions & Business Rules | Request / Response Contract |
| :--- | :--- | :--- | :--- |
| `POST /bookings/quote` | Public | Authoritative integer `totalAmountMinor` (`LKR`) & capacity check | `BookingQuoteRequest` -> `BookingQuoteResponse` |
| `POST /bookings` | `bookings.create` *(verified user)* | Locks capacity, creates `PENDING_PAYMENT` or `PENDING_HOST_APPROVAL` | `CreateBookingRequest` -> `BookingDetail` |
| `GET /bookings` | `bookings.read_own` | Owner-scoped paginated list (`res.data`, `res.pagination`) | `BookingListQuery` -> `PaginatedApiResponse<BookingDetail>` |
| `GET /bookings/:bookingId` | Authenticated owner / host / admin | `OQ-012`: `exactAddress` disclosed only on `CONFIRMED \| IN_STORAGE \| COMPLETED \| DISPUTED` | `BookingDetail` |
| `POST /bookings/:bookingId/cancel` | `bookings.cancel_own` | Allowed on `PENDING_HOST_APPROVAL`, `PENDING_PAYMENT`, `CONFIRMED`; `OQ-009` `>2h` 100%, `<=2h` 50%, `<=0` 0% | `CancelBookingRequest` -> `BookingDetail` |
| `POST /bookings/:bookingId/exceptions` | Owner / authorized host / admin | Transitions/flags operational incident (`DISPUTED`) and places payout hold | `RecordBookingExceptionRequest` -> `BookingDetail` |
| `POST /bookings/:bookingId/custody-pass` | `bookings.read_own` (owner only) | `CHECK_IN` (`CONFIRMED` & `EXPECTED`) or `COLLECTION` (`IN_STORAGE`/`DISPUTED`), 15m TTL, HMAC-SHA256 | `IssueCustodyPassRequest` -> `CustodyPassResponse` |

### 1.4 Payments (`/api/v1/payments/*`)
| Endpoint | Auth / RBAC | Security Controls | Request / Response Contract |
| :--- | :--- | :--- | :--- |
| `POST /payments/intents` | `bookings.create` | Idempotent per booking; returns `nextAction`: `REDIRECT_TO_PROVIDER` (`POST_FORM`) or `SANDBOX_SIMULATION` (`SIMULATED_API`) | `CreatePaymentIntentRequest` -> `PaymentIntent` |
| `GET /payments/handoff/:handoffToken` | Signed token | Server-rendered auto-POST HTML bridge (`Content-Security-Policy` locked to PayHere actionUrl) | HTML redirect |
| `GET /payments/checkout-status` | Owner / Host / Admin | Authoritative DB check of `bookingStatus` + `paymentIntent`; never trusts URL query flags | `CheckoutStatusQuery` -> `CheckoutStatusResponse` |
| `POST /payments/intents/:intentId/sandbox-simulate` | `bookings.create` | Non-production sandbox only; executes signed internal sandbox webhook | `SandboxSimulatePaymentRequest` |

### 1.5 Host Businesses, Locations, Uploads & Finance (`/api/v1/hosts/*`, `/api/v1/uploads/*`)
| Endpoint | Auth / RBAC | Key Rules / Caveats |
| :--- | :--- | :--- |
| `POST /hosts/businesses` | `app.authenticate` (verified user) | Creates business (`PENDING_VERIFICATION`), assigns `HOST_OWNER` role in DB (**mobile must call `POST /auth/refresh` afterwards**) |
| `GET/PATCH /hosts/businesses`, `/:id` | Owner | List/read/update owned business |
| `POST /hosts/businesses/:id/verification`, `GET .../verification` | Owner | Submit confirmed document IDs (`HOST_VERIFICATION`) for review |
| `GET /hosts/businesses/:id/payout-details` | Owner / Financial Admin (`403` for `HOST_STAFF`) | Returns unmasked/authorized payout destination details |
| `POST /uploads/presigned-url`, `POST /uploads/confirm`, `GET /uploads/documents/:id/download` | `uploads.initiate` (`HOST_OWNER`) | Allowed purposes: `HOST_VERIFICATION` (`<=15MB` JPEG/PNG/WEBP/PDF; blocked by backend if business is `REJECTED` at `uploads.service.ts:75`) and `LOCATION_IMAGE` (`<=10MB` JPEG/PNG/WEBP) |
| `POST/GET/PATCH /hosts/locations`, `/:id` | Owner | Create/edit storage location (`GET /hosts/locations` filters `ownerUserId`; `HOST_STAFF` sees locations via assigned bookings) |
| `POST /hosts/locations/:id/submit` | Owner | Requires parent business `ACTIVE`, opening hours, capacity pool, pricing policy |
| `POST /hosts/locations/:id/disable` | Owner | Disables location (`INACTIVE`) |
| `PUT /hosts/locations/:id/opening-hours` | Owner | Replaces 7-day weekly schedule |
| `POST /hosts/locations/:id/exceptions` | Owner | Upserts closure/override by `exceptionDate` (**no `DELETE` route exists in backend**) |
| `POST /hosts/locations/:id/zones` | Owner | Adds storage zone (`zoneCode`, `name`, `zoneType`) |
| `POST /hosts/locations/:id/media` | Owner | Attaches uploaded location media metadata |
| `GET/POST /hosts/locations/:id/capacity-pools`, `PATCH /hosts/capacity-pools/:poolId` | Owner | Configures capacity quotas by bag category |
| `GET/PUT /hosts/locations/:id/pricing` | Owner | Configures hourly rate, daily cap, currency (`LKR`), bag multipliers, grace minutes |
| `GET /hosts/bookings`, `/:id`, `POST /accept`, `/reject`, `/cancel` | `hosts.bookings.read_own` / `manage_own` | Owner or assigned staff; `reject` requires non-empty `reason`; `cancel` authorizes 100% traveller refund |
| `POST /hosts/custody/verify`, `GET /hosts/custody/:id`, `POST /check-in`, `POST /check-out` | `hosts.custody.operate` | Verify checks QR/PIN without consuming (rate-limited `429`); check-in/out consumes credential and transitions state (`BR-035` / `OQ-015` zero possessory lien) |
| `GET /hosts/finance/summary` | `hosts.finance.read_own` (`403` for `HOST_STAFF`) | Real `totalAccruedMinor`, `totalEligibleMinor`, `totalOnHoldMinor`, `totalPaidMinor`, `payables[]` |

---

## 2. Explicit Missing Backend Capabilities (Documented — Never Faked)

1. **Saved / Favourite Locations:** No `/saved-locations` endpoint exists in `apps/api`. Implemented as honest device-local UUID list (`AsyncStorage`) hydrated against live `GET /discovery/locations/:locationId`, clearly labeled `"Saved on this device"`.
2. **In-App Notifications & Preferences:** No `/notifications` endpoint or table exists. Fake notification inbox/toggles are omitted; operational reminders are derived strictly from live booking/host status.
3. **Traveller Ratings & Reviews:** No `/reviews` endpoint or DB table exists (`averageRating: null`, `reviewCount: 0` in public discovery). Fabricated `4.8` ratings and fake review forms are removed and replaced with honest `"No verified reviews yet"`.
4. **User Profile Self-Service Edit (`PATCH /identity/profile`):** Request schema exists in `@luggage-storage/contracts`, but no route is mounted in `apps/api/src/app.ts`. Profile screen renders live read-only `GET /auth/me` fields + working verification/security/session actions.
5. **Support Ticketing (`TM-040`/`TM-041`):** No standalone `/support/tickets` endpoint exists. Active/completed/disputed bookings use real `POST /bookings/:id/exceptions`; general FAQ/help omits fake ticket creation.
6. **Mid-Storage Time Extension (`TM-029`):** No `/bookings/:id/extend` endpoint exists. Fake `setTimeout` extension modal is removed.
7. **Host Staff Invitations (`HM-033`/`HM-034`):** No mobile `/hosts/staff` invitation route exists in `apps/api`. Hardcoded mock staff names (`Roshan Fernando`) are removed from Settings.
8. **Delete Schedule Exception:** `locations.routes.ts` provides `POST /hosts/locations/:id/exceptions` (date upsert) without `DELETE`.
9. **Custody Check-In Photo Server Upload:** `uploads.routes.ts` only permits `HOST_VERIFICATION` and `LOCATION_IMAGE`. Per `OQ-014` (`DEC-001`), counter intake photo capture remains optional local counter reference only and never claims server persistence.
