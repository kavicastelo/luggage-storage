# Performance and Reliability

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `13-performance-and-reliability`

---

## 1. Network Degradation and Offline Resilience

1. **Deterministic Sandbox Routing:** If network connectivity drops or the external MapTiler API times out, the backend routing service fails gracefully to the `SandboxRoutingAdapter`, ensuring travellers still receive route geometry and distance estimates.
2. **Client-Side Polyline Caching:** Once a route is calculated for a booking, the mobile navigation screen caches the geometry and maneuver steps in local component state. Temporary cellular disconnects in subways, train corridors, or dense masonry buildings do not crash the navigation HUD.
3. **Controlled Rerouting Frequency:** To prevent flooding the API with routing requests during GPS jitter, off-route recalculation requires 2 consecutive readings $>45\text{m}$ debounced by at least 4 seconds.

---

## 2. Rendering and Memory Optimization

1. **Lightweight Vector Rendering:** Web and mobile use clean SVG path rendering for route polylines rather than heavy unmanaged WebGL contexts, avoiding memory leaks on low-end Android devices.
2. **Bounds Optimization:** Map bounds calculation scales with active location pins or the active route, preventing unnecessary rendering of hundreds of distant off-screen coordinates.
3. **Foreground GPS Lifecycles:** Geolocation intervals run strictly while `MobileNavigationScreen` is mounted. As soon as the user navigates away or checks into custody, interval timers are destroyed (`clearInterval`).

