# Phase 8 — Demo Seed & Reset Guide

**Document:** `docs/release-readiness/06-demo-seed-and-reset-guide.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8 — Workstream 2: Demo Infrastructure & Staging Deployment  
**Status:** COMPLETED & VERIFIED  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Auditor  

---

## 1. Executive Summary

A critical requirement for stakeholder demonstrations and internal quality assurance is an **idempotent, reproducible seeding and reset capability**. Demonstrations frequently create state changes (new holds, check-ins, scans, status updates) that leave the environment in an altered state.

The demo seed script (`apps/api/src/infrastructure/database/seeds/demo-seed.ts`) provides two operational modes:
1. **`pnpm --filter @luggage-storage/api db:seed`**: An idempotent upsert mode that ensures all standard demo accounts, host profiles, verified locations, and sample bookings exist without altering already active user sessions.
2. **`pnpm --filter @luggage-storage/api db:reset`**: A full reset mode that cascades truncation across operational tables and reseeds the clean, predictable baseline state in seconds.

---

## 2. Standard Demo Accounts & Credentials

All demo user accounts are created with verified email status and initialized with the standard demonstration password:

| Role | Email Address | Password | Permissions Scope | Primary Purpose |
|---|---|---|---|---|
| **Superadmin** | `superadmin@luggagevault.lk` | `DemoPassword123!` | Full platform governance, ledger, users, locations | Demonstrating administrative dashboards, dispute resolution, host approval |
| **Customer Support** | `support@luggagevault.lk` | `DemoPassword123!` | Read users, bookings, custody, manage support tickets | Demonstrating customer support assistance and booking inquiry handling |
| **Host Partner (Colombo)** | `host.colombo@luggagevault.lk` | `DemoPassword123!` | Location management, pricing tiers, capacity | Managing Colombo Central storage inventory and payout settings |
| **Host Partner (Kandy)** | `host.kandy@luggagevault.lk` | `DemoPassword123!` | Location management, pricing tiers, capacity | Managing Kandy Hill Country storage facilities |
| **Host Partner (Galle)** | `host.galle@luggagevault.lk` | `DemoPassword123!` | Location management, pricing tiers, capacity | Managing Galle Fort heritage storage |
| **Host Staff (Colombo)** | `staff.colombo@luggagevault.lk` | `DemoPassword123!` | `custody.verify`, QR code scanning, check-in/out | Demonstrating mobile app scanner for baggage intake and release |
| **Traveller (Elena)** | `traveller.elena@luggagevault.lk` | `DemoPassword123!` | Bookings, payments, active custody pass view | Primary demo traveller with an active reservation at Colombo Fort |
| **Traveller (John)** | `traveller.john@luggagevault.lk` | `DemoPassword123!` | Bookings, search, payments | Clean traveller account for live walkthrough of booking and checkout |

---

## 3. Seeded Locations & Geographic Hubs

Four verified locations are pre-seeded with active capacity pools (50 units each), calendar day pricing policies, and recurring operating hours (06:00 to 22:00 daily):

| Location Name | City | PostGIS Coordinates | Daily Base Rate | Key Highlights |
|---|---|---|---|---|
| **Colombo Fort Station Central Vault** | Colombo | `6.9344, 79.8519` | 1,500 LKR | 2 min walk from Fort station, primary demo route hub |
| **Kandy Railway Station Transit Lockers** | Kandy | `7.2906, 80.6337` | 1,200 LKR | Central station lockers for hill country transit |
| **Galle Fort Heritage Locker Vault** | Galle | `6.0328, 80.2170` | 1,400 LKR | UNESCO World Heritage site locker facility |
| **Negombo Transit Hub Locker Facility** | Negombo | `7.2083, 79.8358` | 1,300 LKR | CMB airport transit connection hub |

---

## 4. Pre-Configured Demo Booking (`DEMO-COLOMBO-001`)

To enable immediate demonstration of the Traveller Custody Pass and Host Staff scanning without running a checkout flow first:
- **Reference Code:** `DEMO-COLOMBO-001`
- **Traveller:** Elena Rostova (`traveller.elena@luggagevault.lk`)
- **Location:** Colombo Fort Station Central Vault
- **Items:** 2 bags (1 Large Suitcase, 1 Medium Backpack)
- **Status:** `CONFIRMED`
- **Payment:** `SUCCEEDED` (Stripe Provider order `pi_demo_colombo_001_succeeded`)
- **Custody Pass:** Valid CSPRNG QR code with domain-separated HMAC-SHA256 signature (`hmac-sha256-v2`) and 6-digit numeric backup PIN (`123456`).

---

## 5. Execution Commands

### To seed data (idempotent upsert):
```bash
pnpm --filter @luggage-storage/api db:seed
```

### To execute a clean reset:
```bash
pnpm --filter @luggage-storage/api db:reset
```

### Reset Verification:
```bash
# Output:
# ⚠️ [Demo Seeder] Resetting database tables...
# 🧹 [Demo Seeder] Operational tables truncated.
# 🌱 [Demo Seeder] Starting idempotent marketplace demo seeding...
# ✅ [Demo Seeder] Seeding finished successfully!
#      - Users: 8 (Default Password: DemoPassword123!)
#      - Host Businesses: 3
#      - Storage Locations: 4
#      - Demo Booking: DEMO-COLOMBO-001 (Elena Rostova at Colombo Fort Central Vault)
```

