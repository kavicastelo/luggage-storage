# Phase 8.1 — Workstream 4: Netlify Web Applications Deployment Guide

**Document:** `docs/release-readiness/phase-8-1/07-netlify-web-deployment.md`  
**Repository:** `https://github.com/kavicastelo/luggage-storage`  
**Phase:** 8.1 — Checkpoint 1  
**Date:** November 19, 2026  
**Auditor:** Independent Release Readiness Lead  

---

## 1. Application Identification & Port Mapping

| Attribute | Web Application A | Web Application B |
|---|---|---|
| **Workspace Directory** | `apps/web` | `apps/mobile` |
| **Package Name** | `@luggage-storage/web` | `@luggage-storage/mobile` |
| **Technology Stack** | React 18, Vite 6, Tailwind CSS | Expo SDK 58, React Native Web, Expo Router |
| **Development Port** | **Port 5173** (`pnpm dev` -> `vite`) | **Port 8081** (`pnpm web` -> `expo start --web`) |
| **Build Command** | `pnpm --filter @luggage-storage/web build` | `pnpm --filter @luggage-storage/mobile export` |
| **Publish Directory** | `apps/web/dist` | `apps/mobile/dist` |
| **Configuration File** | `apps/web/netlify.toml` | `apps/mobile/netlify.toml` |

---

## 2. Netlify Site Provisioning

Two distinct Netlify sites are created in the Netlify Dashboard:

### 2.1 Netlify Site A (Public Marketplace Web App)
- **Site Name:** `luggage-storage-web-demo`
- **Base directory:** `apps/web`
- **Build command:** `pnpm --filter @luggage-storage/web build`
- **Publish directory:** `apps/web/dist`
- **Environment Variables:**
  - `VITE_API_URL`: `https://api-demo.yourdomain.com/api/v1` (Targeting EC2 API)
  - `VITE_STRIPE_PUBLISHABLE_KEY`: `pk_test_...`
  - `VITE_MAPTILER_KEY`: `your_maptiler_api_key` (Optional)

### 2.2 Netlify Site B (Mobile Experience Web Preview)
- **Site Name:** `luggage-storage-mobile-demo`
- **Base directory:** `apps/mobile`
- **Build command:** `pnpm --filter @luggage-storage/mobile export`
- **Publish directory:** `apps/mobile/dist`
- **Environment Variables:**
  - `EXPO_PUBLIC_API_URL`: `https://api-demo.yourdomain.com/api/v1` (Targeting EC2 API)

---

## 3. SPA Deep Linking & Redirects

Both `netlify.toml` files include strict SPA rewrite rules:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```
This guarantees that deep links (e.g. `/locations/:id`, `/booking/confirm`, `/pass/:token`) and browser refreshes resolve correctly without generating HTTP 404 errors.

---

## 4. Verification & Testing

Both application build pipelines have been verified locally:
1. `apps/web`: `pnpm --filter @luggage-storage/web build` produces clean HTML/JS/CSS bundles in `apps/web/dist`.
2. `apps/mobile`: `pnpm --filter @luggage-storage/mobile export` generates complete React Native Web bundles in `apps/mobile/dist`.
