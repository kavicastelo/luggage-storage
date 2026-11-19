# Phase 8 — Role & Permission Matrix (RBAC Audit)

**Document:** `docs/release-readiness/10-role-and-permission-matrix.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8 — Workstream 5: Security & Authorization Architecture  
**Status:** COMPLETED & VERIFIED  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Auditor  

---

## 1. RBAC Architectural Principles

The Luggage Storage authorization architecture implements fine-grained, database-backed Role-Based Access Control (RBAC) enforced at the Fastify route handler layer via `app.requirePermission(code)` preHandlers.

Core architectural safeguards include:
1. **Multi-Role Support:** Users have accounts in `users` and multiple role assignments in `user_roles`. A user can act as both a `TRAVELLER` and a `HOST_OWNER` without account splitting.
2. **Deny-by-Default:** Endpoints require explicit authentication and granular permissions. Missing permissions result in an immediate `403 Forbidden` response.
3. **Defense-in-Depth Against IDOR:** In addition to role permissions, object-level ownership checks are strictly enforced in the service layer (e.g. `assertHostLocationAccess(userId, locationId)` ensures host staff can only view and scan bags for locations belonging to their authorized employer).

---

## 2. System Role Taxonomy

| Role Code | Role Name | System Role | Primary Domain & Purpose |
|---|---|---|---|
| `SUPERADMIN` | Super Administrator | Yes | Full executive platform governance, financial ledger audits, host approvals |
| `SUPPORT` | Customer Support | Yes | Read-only inquiry handling, ticket management, authorized refund mediation |
| `HOST_OWNER` | Host Business Owner | Yes | Manage host businesses, locations, staff invitations, pricing, and payouts |
| `HOST_STAFF` | Host Staff Attendant | Yes | Baggage scanning, custody intake/release execution at assigned locations |
| `TRAVELLER` | Registered Traveller | Yes | Search locations, preview routes, create bookings, checkout, view custody passes |

---

## 3. Granular Permission Catalog & Role Assignment Matrix

| Permission Code | Module | Description | SUPERADMIN | SUPPORT | HOST_OWNER | HOST_STAFF | TRAVELLER |
|---|---|---|:---:|:---:|:---:|:---:|:---:|
| `identity.profile.read` | Identity | Read own profile and settings | ✓ | ✓ | ✓ | ✓ | ✓ |
| `identity.profile.update` | Identity | Update own profile and settings | ✓ | ✓ | ✓ | ✓ | ✓ |
| `identity.session.revoke_own`| Identity | Terminate own active session | ✓ | ✓ | ✓ | ✓ | ✓ |
| `admin.user.read` | Admin | Search and inspect user accounts | ✓ | ✓ | - | - | - |
| `admin.user.suspend` | Admin | Suspend user accounts | ✓ | - | - | - | - |
| `admin.role.assign` | Admin | Assign system roles to users | ✓ | - | - | - | - |
| `admin.hosts.verify` | Admin | Verify host legal entities | ✓ | - | - | - | - |
| `admin.locations.approve` | Admin | Approve pending storage locations | ✓ | - | - | - | - |
| `admin.audit.read` | Admin | Inspect immutable security audit trail| ✓ | - | - | - | - |
| `hosts.business.manage` | Hosts | Create and update business profiles | ✓ | - | ✓ | - | - |
| `hosts.locations.manage` | Hosts | Create, update locations and pricing | ✓ | - | ✓ | - | - |
| `hosts.staff.manage` | Hosts | Invite and manage location staff | ✓ | - | ✓ | - | - |
| `hosts.payouts.manage` | Hosts | Configure bank accounts and payouts | ✓ | - | ✓ | - | - |
| `custody.verify` | Custody | Scan and verify traveller QR passes | ✓ | - | ✓ | ✓ | - |
| `custody.intake` | Custody | Record bag intake, seals, and photos | ✓ | - | ✓ | ✓ | - |
| `custody.release` | Custody | Release luggage to traveller | ✓ | - | ✓ | ✓ | - |
| `bookings.create` | Bookings | Create reservation holds & intents | ✓ | - | - | - | ✓ |
| `bookings.read_own` | Bookings | View own reservation history | ✓ | - | - | - | ✓ |
| `bookings.cancel_own` | Bookings | Cancel own unfulfilled booking | ✓ | - | - | - | ✓ |
| `finance.ledger.read` | Finance | Inspect platform ledger balances | ✓ | - | - | - | - |
| `refunds.manage` | Finance | Authorize and execute booking refunds| ✓ | ✓ | - | - | - |
| `support.tickets.manage` | Support | Handle support customer inquiries | ✓ | ✓ | - | - | - |

---

## 4. Insecure Direct Object Reference (IDOR) Protections

The platform guards against IDOR through tenant-level verification:

1. **Traveller Booking Isolation:**
   ```typescript
   // apps/api/src/modules/bookings/bookings.service.ts
   if (booking.travellerUserId !== callerUserId && !callerRoles.includes("SUPERADMIN") && !callerRoles.includes("SUPPORT")) {
     throw AppError.forbidden("Access denied: You do not own this booking");
   }
   ```

2. **Host Staff Location Binding:**
   ```typescript
   // apps/api/src/modules/bookings/host-access.helper.ts
   await assertHostLocationAccess(callerUserId, locationId);
   // Verifies caller is either the owner of host_businesses or has an active row in host_staff_memberships
   ```

3. **Custody Token Secrecy:**
   Raw QR tokens and PINs are never stored in plaintext in the database. Only domain-separated HMAC-SHA256 digests (`hmac-sha256-v2`) are stored, preventing database administrators or compromised tokens from being forged.

---

## 5. Verification Verdict

The RBAC implementation enforces strict segregation of duties between travellers, hosts, staff, customer support, and superadministrators. Cross-role boundary violation tests in `tests/auth-contract-compatibility.test.ts` and `tests/initiative-3-host-staff-rbac.test.ts` pass with 100% compliance.

