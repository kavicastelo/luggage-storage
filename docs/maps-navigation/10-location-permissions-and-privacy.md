# Location Permissions and Privacy

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `10-location-permissions-and-privacy`

---

## 1. Permission Architecture

The application strictly requests **foreground-only** location permissions while navigation is active:
- Zero background location tracking or silent tracking services.
- GPS watch listeners automatically terminate as soon as the user exits the navigation screen or taps "End Navigation".
- If permission is denied by the user, the application operates gracefully using manual search and centroid routing (e.g. Colombo Fort transit centroid) without crashing or locking out the user.

---

## 2. Location Privacy Controls (`OQ-012`)

1. **Public Discovery Obfuscation:**
   - Unbooked / unconfirmed locations expose only `coarseLatitude` and `coarseLongitude` (~100-300m randomized displacement).
   - Exact building numbers and exact GPS coordinates are NEVER included in public search or quote responses.
2. **Confirmed Booking Custody Unlock:**
   - Only when a booking has transitioned to `CONFIRMED` or `IN_STORAGE` does the backend release the host's exact physical coordinates and street address to the authorized traveller.
3. **No Storage of Traveller GPS History:**
   - Traveller real-time GPS coordinates exist exclusively in device memory during foreground navigation.
   - Coordinates are never persisted in the database, logged in application telemetry, or shared with third-party tracking networks.

