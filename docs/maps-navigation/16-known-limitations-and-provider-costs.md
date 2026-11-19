# Known Limitations and Provider Costs

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `16-known-limitations-and-provider-costs`

---

## 1. Provider Cost Analysis

### 1.1 MapTiler Cloud Pricing
- **Free / Startup Tier:**
  - Up to 100,000 map tile requests / month.
  - Generous geocoding and routing quota.
- **Production Usage Scaling:**
  - Map vector & raster tiles: ~$0.05 per 1,000 tile requests.
  - Routing API calls: ~$0.50 per 1,000 routing calculations.
  - Geocoding requests: ~$0.50 per 1,000 searches.

### 1.2 Cost Control Strategies Implemented
1. **Debounced Client Searches (350ms):** Prevents keystroke-by-keystroke geocoding requests.
2. **Deterministic Sandbox Routing in Development & CI:** Prevents burning production API quota during testing and integration runs.
3. **Route Polyline Caching:** Prevents repeating route calculations when users simply re-render their mobile navigation or route preview drawer.

---

## 2. Known Technical Limitations

1. **GPS Signal in Heavy Concrete Structures:** In underground railway corridors or deep commercial buildings, device GPS may drift. The UI handles this via tolerance radius and smooth error notices.
2. **Audio Synthesis Compatibility:** Web voice guidance uses the HTML5 Web Speech API (`SpeechSynthesis`). If an older browser or device has speech synthesis disabled at the OS level, instructions remain visually presented without throwing errors.

