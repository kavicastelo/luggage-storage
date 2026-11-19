# Host Location Management and Coordinate Precision

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `11-host-location-management`

---

## 1. Overview

Host facilities require precise geographic coordinates and clear visual pin verification so travellers are routed accurately to counter entrances rather than random street centroids.

---

## 2. Host Location Experience

### 2.1 Web Host Location Editor (`apps/web`)
- Located in [HostLocationEditorPage.tsx](file:///d:/luggage-storage/luggage-storage/apps/web/src/features/host/HostLocationEditorPage.tsx).
- Provides input fields for Address Line 1, Address Line 2, City, Postal Code, Latitude, and Longitude.
- Interactive **Pin Location Preview** embedded directly below the coordinate inputs displays the exact physical pin drop on the transit corridor map before submission.

### 2.2 Mobile Host Location Editor (`apps/mobile`)
- Located in [location-editor.tsx](file:///d:/luggage-storage/luggage-storage/apps/mobile/app/(host)/location-editor.tsx).
- "Use Device GPS Coordinates" button enables hosts standing inside their facility to capture high-accuracy coordinates with a single tap.
- Embedded vector map preview verifies pin position instantly.

---

## 3. Coordinate Precision and Validation Standards

1. Decimal precision: 7 decimal places (`numeric(10, 7)`) in PostgreSQL/PostGIS provides sub-meter resolution (~11 cm).
2. Sane geographic bounding:
   - Latitude: $-90 \le \text{lat} \le 90$
   - Longitude: $-180 \le \text{lng} \le 180$
   - Sri Lanka operational corridors: Latitude $5.90^\circ$ to $9.85^\circ$, Longitude $79.65^\circ$ to $81.90^\circ$.
3. Automatic PostGIS Point generation: on location creation or update, the backend sets both `exact_coordinates` and privacy-preserving `coarse_coordinates`.

