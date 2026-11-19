# Web Interactive Maps and Route Preview

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `08-web-interactive-maps`

---

## 1. Overview

The Web application (`apps/web`) replaces static/simulated coordinate scatters with a production-grade, interactive in-app mapping and route preview experience located at [LocationDiscoveryMap.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/features/traveller/LocationDiscoveryMap.tsx) and embedded inside [SearchDiscoveryPage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/features/traveller/SearchDiscoveryPage.tsx).

---

## 2. Key Capabilities Delivered

### 2.1 Interactive Map Controls
- **Dynamic Pan & Drag:** Mouse/touch drag allows panning across transit corridors with smooth velocity damping.
- **Multi-Level Zoom:** Dedicated Zoom In (`+`), Zoom Out (`-`), and Extent Reset buttons adjust zoom scale between 0.8x and 2.5x.
- **Locate Me Button:** Direct HTML5 Geolocation lookup with high-contrast user position indicator and pulse ring.
- **Map/List Synchronization:** Selecting a card in the search results highlights the corresponding marker on the map and vice versa.

### 2.2 In-App Route Preview Drawer
- **Trigger:** Tapping "Preview Route" on any active location pin or card initiates in-app route calculation.
- **API Integration:** Calls `POST /api/v1/maps/routes` through `marketplaceApi.calculateRoute(...)`.
- **Mode Switching:** Instant toggling between **Walking** (🚶), **Driving** (🚗), and **Cycling** (🚲).
- **Active Polyline:** Vector SVG polyline rendered directly over the map with glowing accent styling (`#E05D38` / `#FF5A36`).
- **Maneuver Steps:** Scrollable breakdown of each turn step with distance in meters and turn direction.
- **External Fallback:** Secondary link ("External Maps") opens Google Maps with pre-populated destination coordinates.

