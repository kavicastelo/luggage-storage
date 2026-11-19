# Map Provider and Tiles Configuration

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `04-map-provider-and-tiles-configuration`

---

## 1. Map Tiles Architecture

The platform uses a layered vector and raster tile architecture:
1. **Primary Tile Service:** **MapTiler Cloud** (Streets-v2 vector style & raster static snapshots).
2. **Fallback Service:** **OpenStreetMap Carto** standard raster tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
3. **Environment Security:**
   - Client frontends read public tile tokens (`VITE_MAPTILER_KEY` in `apps/web` and `EXPO_PUBLIC_MAPTILER_KEY` in `apps/mobile`).
   - In development/sandbox environments when keys are empty, clients fall back gracefully to open raster tile providers or stylized coordinate grids with high-contrast transit corridors.

---

## 2. Environment Variables

### 2.1 Backend (`apps/api`)
```env
MAPS_PROVIDER=sandbox # or 'maptiler'
MAPTILER_API_KEY=     # Required in production if MAPS_PROVIDER=maptiler
```

### 2.2 Web (`apps/web`)
```env
VITE_MAPTILER_KEY=    # Optional in local dev, MapTiler Cloud token in staging/prod
```

### 2.3 Mobile (`apps/mobile`)
```env
EXPO_PUBLIC_MAPTILER_KEY= # Optional in local dev, MapTiler Cloud token in staging/prod
```

---

## 3. Map Styling & Contrast Tokens

To maintain brand consistency across the platform, map markers, user indicators, and route lines map directly to design system tokens:

| UI Map Element | Design Token | Hex Value | Purpose |
| :--- | :--- | :--- | :--- |
| **Route Active Line** | `terracotta-500` / Primary Accent | `#E05D38` / `#FF5A36` | Active navigation path polyline |
| **Route Alternative** | `sand-400` / Slate Muted | `#94A3B8` / `#CBD5E1` | Secondary alternative routes |
| **Storage Marker** | `navy-900` + `terracotta-500` | `#0A192F` + `#E05D38` | Storage facility location pin |
| **User Position Dot** | `teal-500` / `blue-500` with pulse ring | `#0EA5E9` | Live GPS location indicator |
| **Arrival Zone** | `emerald-500` translucent ring | `rgba(16, 185, 129, 0.2)` | 25-meter arrival detection circle |

