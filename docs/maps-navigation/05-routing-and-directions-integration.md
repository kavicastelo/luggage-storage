# Routing and Directions Integration

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `05-routing-and-directions-integration`

---

## 1. Routing Endpoint

```http
POST /api/v1/maps/routes
Content-Type: application/json
```

### 1.1 Request Payload
```json
{
  "origin": {
    "latitude": 6.9271,
    "longitude": 79.8458
  },
  "destination": {
    "latitude": 6.9344,
    "longitude": 79.8519
  },
  "travelMode": "walking",
  "alternatives": true
}
```

### 1.2 Response Payload
```json
{
  "success": true,
  "data": {
    "routeId": "route-723a9b1c",
    "travelMode": "walking",
    "distanceMeters": 1150,
    "durationSeconds": 880,
    "geometry": [
      { "latitude": 6.9271, "longitude": 79.8458 },
      { "latitude": 6.9302, "longitude": 79.8491 },
      { "latitude": 6.9344, "longitude": 79.8519 }
    ],
    "legs": [
      {
        "distanceMeters": 1150,
        "durationSeconds": 880,
        "startLocation": { "latitude": 6.9271, "longitude": 79.8458 },
        "endLocation": { "latitude": 6.9344, "longitude": 79.8519 },
        "steps": [
          {
            "index": 0,
            "instruction": "Head northeast along transit corridor",
            "distanceMeters": 520,
            "durationSeconds": 400,
            "maneuver": {
              "type": "DEPART",
              "instruction": "Head northeast along transit corridor",
              "distanceMeters": 520,
              "durationSeconds": 400,
              "location": { "latitude": 6.9271, "longitude": 79.8458 }
            }
          },
          {
            "index": 1,
            "instruction": "Turn right toward storage facility",
            "distanceMeters": 630,
            "durationSeconds": 480,
            "maneuver": {
              "type": "TURN_RIGHT",
              "instruction": "Turn right toward storage facility",
              "distanceMeters": 630,
              "durationSeconds": 480,
              "location": { "latitude": 6.9302, "longitude": 79.8491 }
            }
          }
        ]
      }
    ],
    "alternatives": [],
    "provider": "sandbox",
    "summary": "Standard walking route (1.2 km)"
  }
}
```

---

## 2. Pluggable Adapter Pattern

The routing engine follows Hexagonal Architecture:
```text
           POST /api/v1/maps/routes
                     |
                MapsService
                     |
              +------+------+
              |             |
     MapTiler Adapter    Sandbox Adapter
   (MapTiler Routing v2)  (Deterministic geometry)
```

- When `MAPS_PROVIDER=maptiler` and `MAPTILER_API_KEY` is present, queries MapTiler Routing API v2.
- When `MAPS_PROVIDER=sandbox` (or if network error occurs), the `SandboxRoutingAdapter` deterministically interpolates intermediate street coordinates and turn maneuvers using Haversine calculation, guaranteeing 100% reliable local development and automated CI testing.

