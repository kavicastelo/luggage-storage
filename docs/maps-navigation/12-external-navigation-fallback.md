# External Navigation Fallback Strategy

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `12-external-navigation-fallback`

---

## 1. Principle of Secondary Fallback

The primary navigation and route preview experience occurs exclusively inside the application. However, travellers may require external navigation under specific circumstances:
- Complex vehicular driving routes requiring real-time traffic jam avoidance.
- System accessibility preferences requiring native OS screen reader integration.
- Temporary routing API outage.

---

## 2. Platform Deep Link Standards

When the user taps the secondary "External App" or "External Maps" action button:

### 2.1 Android Native
```text
google.navigation:q={lat},{lng}&mode=w
```
Falls back to generic geo URI:
```text
geo:0,0?q={lat},{lng}({label})
```

### 2.2 iOS Native
```text
maps://?daddr={lat},{lng}&dirflg=w
```

### 2.3 Web & Cross-Platform Fallback
```text
https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=walking
```

---

## 3. Preservation of Booking Context

External navigation opens via `Linking.openURL` in an external application or browser tab without terminating the user's booking session. Returning to the mobile or web app maintains the active Digital Custody Pass state.

