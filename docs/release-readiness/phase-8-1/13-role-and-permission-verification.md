# Role and Permission Verification

**Document ID:** `docs/release-readiness/phase-8-1/13-role-and-permission-verification.md`  
**Phase:** 8.1 Demo Readiness  
**Target:** Role-Based Access Control (RBAC) & Tenant Boundaries  
**Status:** Verified & Documented

---

## 1. Executive Summary

This document verifies the strict enforcement of role-based access control (RBAC) across the API, Web App A, and Web App B (Mobile Web). It confirms that all role boundaries are enforced server-side via cryptographic JWT claims and verified database relations, preventing horizontal and vertical privilege escalation.

---

## 2. Seeded Demo Accounts

The demo database seed provides four pre-configured personas for demonstration and testing:

| Role | Demo Email | Access Scope |
| :--- | :--- | :--- |
| **Anonymous / Guest** | *(Unauthenticated)* | Public discovery, location search, approximate coordinates. |
| **Traveller** | `traveller@demo.example.com` | Booking creation, payment checkout, personal pass access, booking history. |
| **Host** | `host@demo.example.com` | Listing management, availability toggles, QR intake/release scanner, host payouts. |
| **Superadmin** | `superadmin@demo.example.com` | System monitoring, global audit logs, dispute arbitration, financial ledger review. |

---

## 3. RBAC Matrix & Permission Boundary Verification

| Resource / Endpoint | Anonymous | Traveller | Host | Superadmin | Verification Test |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `GET /api/v1/locations` | Allowed | Allowed | Allowed | Allowed | Public directory listing with fuzzy coordinates |
| `POST /api/v1/bookings` | 401 | Allowed | 403 / Denied | Allowed | Travellers create bookings; hosts cannot book own hubs |
| `GET /api/v1/bookings/:id/pass` | 401 | Owner Only | Assigned Host | Allowed | Strictly gated to booking owner and servicing host |
| `POST /api/v1/custody/intake` | 401 | 403 | Assigned Host | 403* | Intake scanning requires assigned host credential |
| `POST /api/v1/custody/release` | 401 | 403 | Assigned Host | 403* | Release scanning requires assigned host credential |
| `GET /api/v1/admin/dashboard` | 401 | 403 | 403 | Allowed | Admin dashboard strictly restricted to Superadmin |
| `GET /api/v1/admin/ledger` | 401 | 403 | 403 | Allowed | Financial double-entry ledger accessible only to Superadmin |

*\* Note: Superadmins have platform visibility but cannot perform physical intake/release custody scans without legitimate custody tokens and assigned host context.*

---

## 4. Privilege Escalation Prevention Checks

### 4.1 Horizontal Privilege Escalation
- **Test:** Traveller A (`user-1`) attempts to fetch custody pass for Traveller B (`booking-2`).
- **Result:** API responds with HTTP 403 Forbidden (`FORBIDDEN_RESOURCE_ACCESS`). Verified in `apps/api/tests/traveller-authorization.test.ts`.

### 4.2 Vertical Privilege Escalation
- **Test:** Host attempts to access `/api/v1/admin/audit-logs` by spoofing user headers.
- **Result:** API validates JWT signature cryptographically against `JWT_SECRET`; rejects unauthorized access with HTTP 403 Forbidden (`INSUFFICIENT_PERMISSIONS`).

### 4.3 Multi-Role Separation
- Users cannot manipulate their role in client storage (e.g. LocalStorage or SecureStore) because permissions are re-evaluated from the signed JWT payload and session token on every API call.
