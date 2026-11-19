# Geocoding and Location Search

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `06-geocoding-and-location-search`

---

## 1. Geocoding Services

The platform provides forward and reverse geocoding to power address autocomplete, search-as-you-type, and host coordinate verification.

### 1.1 Forward Geocoding Endpoint
```http
GET /api/v1/maps/geocoding?query=Colombo+Fort&limit=5
```
- Returns ranked candidate places biased towards Sri Lanka (`country=lk`).
- Each result includes `placeName`, full `address`, `city`, and `coordinate: { latitude, longitude }`.

### 1.2 Reverse Geocoding Endpoint
```http
GET /api/v1/maps/reverse-geocoding?latitude=6.9344&longitude=79.8519
```
- Converts GPS or map-dropped coordinates into human-readable street addresses, neighborhoods, and postal districts.

---

## 2. Debouncing and Rate Limiting Standards

1. **Client Debounce:** All search-as-you-type inputs across Web and Mobile debounce user keystrokes by **350ms** before initiating API requests.
2. **Minimum Query Length:** Geocoding queries require at least 2 characters.
3. **Provider Fallback:** In sandbox/development, built-in directory of major Sri Lankan transit hubs (Colombo Fort, Galle Fort, Kandy Central, Ella Station, Negombo Beach, Bandaranaike Airport) guarantees realistic testing without external API quota consumption.

