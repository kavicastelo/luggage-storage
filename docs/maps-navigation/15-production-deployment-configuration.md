# Production Deployment Configuration

**Initiative:** Cross-Platform Mapping & Navigation Transformation  
**Branch:** `feature/in-app-maps-navigation`  
**Date:** 2026-11-19  
**Status:** Approved  
**Document ID:** `15-production-deployment-configuration`

---

## 1. Production Environment Variables Checklist

### 1.1 Backend Service (`apps/api`)
```env
# Maps Provider: set to 'maptiler' in production
MAPS_PROVIDER=maptiler

# MapTiler Cloud API Key: must have access to Maps, Routing v2, and Geocoding APIs
MAPTILER_API_KEY=prod_maptiler_api_key_xxxxxxxxxxxxx
```

### 1.2 Web Frontend (`apps/web`)
```env
# Public MapTiler Client Key: configured with domain restrictions (*.luggagestorage.lk)
VITE_MAPTILER_KEY=prod_maptiler_public_client_key_xxxxxxxxxxxxx
```

### 1.3 Mobile Frontend (`apps/mobile`)
```env
# Public MapTiler Mobile Key: configured with Android application ID and iOS bundle ID restrictions
EXPO_PUBLIC_MAPTILER_KEY=prod_maptiler_mobile_client_key_xxxxxxxxxxxxx
```

---

## 2. API Key Origin and Application Restrictions

1. **Web Domain Restriction:** Bind `VITE_MAPTILER_KEY` in the MapTiler Cloud console to allowed HTTP Referrers:
   - `https://luggagestorage.lk/*`
   - `https://*.luggagestorage.lk/*`
2. **Mobile Bundle Restriction:**
   - Android Package Name: `com.luggagestorage.mobile`
   - iOS Bundle Identifier: `com.luggagestorage.mobile`
3. **Backend API Key (`MAPTILER_API_KEY`):**
   - Kept strictly server-side in Fastify environment. Never bundled into web or native mobile binaries.

