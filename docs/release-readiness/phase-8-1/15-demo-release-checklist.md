# Demo Release Checklist

**Document ID:** `docs/release-readiness/phase-8-1/15-demo-release-checklist.md`  
**Phase:** 8.1 Demo Readiness  
**Target:** Staging & Demo Environment Deployment  
**Status:** Ready for Execution

---

## 1. Pre-Deployment Checklist

| Item | Requirement / Verification | Status | Owner |
| :--- | :--- | :---: | :--- |
| **Branch Verification** | Current branch is `release/phase-8-1-demo-readiness` with all commits staged. | [x] | Eng Lead |
| **API Test Suite** | 28/28 test files and 408/408 tests pass cleanly (`pnpm --filter @luggage-storage/api test`). | [x] | QA Lead |
| **Compiled Dist Migrations** | `apps/api/dist` contains compiled migration `.sql` files (`pnpm --filter @luggage-storage/api build`). | [x] | DevOps |
| **Web App A Build** | `pnpm --filter @luggage-storage/web build` succeeds into `apps/web/dist`. | [x] | Frontend |
| **Web App B Export** | `pnpm --filter @luggage-storage/mobile export` succeeds into `apps/mobile/dist`. | [x] | Mobile |
| **Supabase Account** | Supabase project created in `ap-southeast-1` or closest region; direct connection string obtained. | [ ] | DevOps |
| **AWS EC2 Instance** | Ubuntu 22.04 LTS instance provisioned (t4g.small / t3.small), SSH key accessible. | [ ] | DevOps |
| **Netlify Account** | Netlify account ready to create two static SPA sites with custom build commands. | [ ] | DevOps |
| **Expo / EAS Account** | Expo CLI authenticated with `eas login` for mobile APK generation. | [ ] | Mobile |

---

## 2. Deployment Execution Checklist

| Step | Action | Script / Command | Status |
| :--- | :--- | :--- | :---: |
| **Step 1: Database Setup** | Enable PostGIS extension on Supabase project. | `CREATE EXTENSION IF NOT EXISTS postgis;` | [ ] |
| **Step 2: Database Migration** | Run Drizzle migrations over direct port 5432. | `DATABASE_URL="postgresql://..." node apps/api/dist/infrastructure/database/migrate.js` | [ ] |
| **Step 3: Database Seeding** | Seed demo hubs, users, and baseline catalog. | `DATABASE_URL="postgresql://..." pnpm --filter @luggage-storage/api seed` | [ ] |
| **Step 4: EC2 API Deployment** | Deploy native Node.js API with PM2/systemd and Nginx. | `./scripts/deploy-demo-api.sh` | [ ] |
| **Step 5: Netlify Site A** | Link `apps/web` repository, build directory `apps/web/dist`. | Deploy via Netlify UI or Netlify CLI | [ ] |
| **Step 6: Netlify Site B** | Link `apps/mobile` repository, build directory `apps/mobile/dist`. | Deploy via Netlify UI or Netlify CLI | [ ] |
| **Step 7: Mobile Build** | Generate preview Android APK via EAS. | `cd apps/mobile && eas build --profile preview --platform android` | [ ] |

---

## 3. Post-Deployment Verification Checklist

| Verification Check | Target URL / Test | Expected Result | Verified |
| :--- | :--- | :--- | :---: |
| **API Health** | `GET https://demo-api.../health` | HTTP 200 `{"status": "ok"}` | [ ] |
| **API Readiness** | `GET https://demo-api.../ready` | HTTP 200 `{"status": "ready", "checks": {"database": {"connected": true}}}` | [ ] |
| **Web App A Smoke** | Open Web App A in desktop browser | Loads homepage, renders hubs, allows login as demo users. | [ ] |
| **Web App B Smoke** | Open Web App B in mobile browser | Loads mobile UI, renders responsive layout, scans QR pass. | [ ] |
| **Payment Flow** | Submit booking with Stripe test card `4242...` | Transitions to `CONFIRMED`, generates valid QR pass. | [ ] |
| **Navigation Flow** | Request route to nearest hub | Polyline renders, turn-by-turn guidance displays. | [ ] |
| **Backup Verification** | Run backup script against Supabase | Produces encrypted `.tar.gz` archive with catalog dump. | [ ] |

---

## 4. Stakeholder Sign-Off Template

```text
========================================================================
DEMO RELEASE APPROVAL SIGN-OFF
========================================================================
Release Phase: Phase 8.1 Demo Readiness
Environment: AWS EC2 API + Supabase PostgreSQL + Netlify Web (A & B)

Sign-off Authorities:
1. Engineering Lead: ______________________ Date: ______________
2. QA & Security Lead: ____________________ Date: ______________
3. Product Owner: _________________________ Date: ______________

Status: [ ] APPROVED FOR DEMONSTRATION
        [ ] REJECTED (BLOCKING ISSUES IDENTIFIED)
========================================================================
```
