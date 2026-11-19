# Mobile Navigation Implementation

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `09-mobile-navigation-implementation`

---

## 1. Overview

The mobile application (`apps/mobile`) replaces external Google Maps browser redirects with an in-app, cross-platform turn-by-turn navigation HUD and interactive vector map:
- **Interactive Map:** [InteractiveMobileMap.tsx](file:///d:/luggage-storage/luggage-storage/apps/mobile/src/components/maps/InteractiveMobileMap.tsx).
- **Navigation Screen:** [navigation.tsx](file:///d:/luggage-storage/luggage-storage/apps/mobile/app/(traveller)/navigation.tsx).
- **Custody Pass Handoff:** [pass.tsx](file:///d:/luggage-storage/luggage-storage/apps/mobile/app/(traveller)/pass.tsx).
- **Discovery Map Toggle:** [DiscoveryView.tsx](file:///d:/luggage-storage/luggage-storage/apps/mobile/src/components/DiscoveryView.tsx).

---

## 2. In-App Navigation State Machine

```text
               [ Start Navigation ]
                        |
                        v
               CALCULATING_ROUTE
                        |
                        v
              +---> NAVIGATING <---+
              |         |          |
 (Deviation   |         |          | (New route
    > 45m)    |         v          |  calculated)
              +---  REROUTING -----+
                        |
            (Distance <= 25m)
                        |
                        v
                     ARRIVED
                        |
                        v
         [ View Digital Custody Pass ]
```

---

## 3. Core Capabilities

### 3.1 Live Turn-by-Turn Maneuver HUD
- **Top Maneuver Card:** Displays high-contrast turn arrow icons (`TURN_LEFT`, `TURN_RIGHT`, `CONTINUE`, `U_TURN`, `ARRIVE`), exact instruction text, and distance to maneuver.
- **Preview Next Step:** Subtitle shows upcoming maneuver ("Then turn left onto Olcott Mawatha") to prepare travellers in advance.

### 3.2 Dynamic Route Recalculation (Rerouting)
- Calculates distance from user GPS coordinates to route geometry.
- If traveller deviates more than **45 meters** for two consecutive GPS updates, triggers automatic reroute calculation without disrupting the user.

### 3.3 Destination Arrival Detection
- Checks distance from user GPS position to destination.
- When distance is **$\le 25\text{ meters}$**, triggers `ARRIVED` state and displays the arrival modal with a direct action button to view the Digital Custody Pass (`/pass`).

### 3.4 Secondary External Navigation Fallback
- Accessible via the "External App" button on the navigation bottom sheet:
  - **Android:** Launches `google.navigation:q=lat,lng&mode=w`.
  - **iOS:** Launches `maps://?daddr=lat,lng&dirflg=w`.
  - **Web / Fallback:** Opens Google Maps web directions.

