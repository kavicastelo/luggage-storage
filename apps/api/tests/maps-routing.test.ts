import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { MapsService } from "../src/modules/maps/maps.service.js";
import { MapTilerRoutingAdapter } from "../src/modules/maps/maptiler-routing.adapter.js";
import { AppError } from "../src/common/errors/app-error.js";

describe("Maps & Routing API Integration", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/v1/maps/routes", () => {
    it("calculates a valid walking route between Colombo coordinates", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/maps/routes",
        payload: {
          origin: { latitude: 6.9271, longitude: 79.8458 },
          destination: { latitude: 6.9344, longitude: 79.8519 },
          travelMode: "walking",
          alternatives: false
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.travelMode).toBe("walking");
      expect(body.data.distanceMeters).toBeGreaterThan(500);
      expect(body.data.durationSeconds).toBeGreaterThan(100);
      expect(body.data.geometry).toBeInstanceOf(Array);
      expect(body.data.geometry.length).toBeGreaterThanOrEqual(2);
      expect(body.data.legs).toBeInstanceOf(Array);
      expect(body.data.legs[0].steps.length).toBeGreaterThanOrEqual(2);

      const firstStep = body.data.legs[0].steps[0];
      expect(firstStep.maneuver.type).toBe("DEPART");
      expect(firstStep.maneuver.instruction).toBeTruthy();
    });

    it("calculates driving route with alternative routes", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/maps/routes",
        payload: {
          origin: { latitude: 6.9271, longitude: 79.8458 },
          destination: { latitude: 6.0328, longitude: 80.217 }, // Colombo to Galle
          travelMode: "driving",
          alternatives: true
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.travelMode).toBe("driving");
      expect(body.data.distanceMeters).toBeGreaterThan(50000); // > 50km
      expect(body.data.alternatives.length).toBeGreaterThanOrEqual(1);
    });

    it("rejects invalid coordinate parameters", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/maps/routes",
        payload: {
          origin: { latitude: 95.0, longitude: 79.8458 }, // Invalid latitude > 90
          destination: { latitude: 6.9344, longitude: 79.8519 }
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
    });

    it("rejects unsupported travel modes", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/maps/routes",
        payload: {
          origin: { latitude: 6.9271, longitude: 79.8458 },
          destination: { latitude: 6.9344, longitude: 79.8519 },
          travelMode: "helicopter"
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
    });
  });

  describe("GET /api/v1/maps/geocoding", () => {
    it("searches places by text query with Sri Lanka biasing", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/maps/geocoding?query=Colombo+Fort&limit=3"
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.results.length).toBeGreaterThan(0);
      expect(body.data.results[0].placeName).toContain("Colombo Fort");
      expect(body.data.results[0].coordinate.latitude).toBeCloseTo(6.9344, 2);
    });

    it("rejects empty geocoding query", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/maps/geocoding"
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/v1/maps/reverse-geocoding", () => {
    it("converts coordinate to nearest place and address", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/maps/reverse-geocoding?latitude=6.9344&longitude=79.8519"
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.placeName).toBeTruthy();
      expect(body.data.city).toBe("Colombo");
    });

    it("rejects missing coordinates", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/maps/reverse-geocoding?latitude=6.9344"
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("Production Maps Environment & Fallback Prohibitions", () => {
    const validProdEnv: Record<string, string | undefined> = {
      NODE_ENV: "production",
      PORT: "3000",
      HOST: "0.0.0.0",
      LOG_LEVEL: "info",
      DATABASE_URL: "postgresql://luggage_user:luggage_password@db.luggagevault.lk:5432/luggage_prod",
      MIGRATION_DATABASE_URL:
        "postgresql://luggage_migrator:migrator_password@db.luggagevault.lk:5432/luggage_prod",
      DATABASE_SSL: "true",
      DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
      CORS_ORIGIN: "https://app.luggagevault.lk",
      APP_PUBLIC_URL: "https://app.luggagevault.lk",
      JWT_SECRET: "prod_jwt_secret_distinct_at_least_32_chars_a1",
      COOKIE_SECRET: "prod_cookie_secret_distinct_at_least_32_chars_b2",
      RATE_LIMIT_HASH_SECRET: "prod_ratelimit_secret_distinct_at_least_32_chars_c3",
      EMAIL_PROVIDER: "zoho",
      ZOHO_SMTP_HOST: "smtp.zoho.com",
      ZOHO_SMTP_PORT: "465",
      ZOHO_SMTP_SECURE: "true",
      ZOHO_SMTP_REQUIRE_TLS: "true",
      ZOHO_SMTP_USER: "noreply@luggagevault.lk",
      ZOHO_SMTP_PASSWORD: "zoho_smtp_app_password_prod_99",
      STORAGE_PROVIDER: "r2",
      R2_ACCOUNT_ID: "r2_account_prod_001",
      R2_ACCESS_KEY_ID: "r2_access_key_prod_001",
      R2_SECRET_ACCESS_KEY: "r2_secret_access_key_prod_001",
      R2_BUCKET_NAME: "luggage-storage-prod",
      PAYOUT_ENCRYPTION_KEY: "prod_payout_encryption_key_distinct_32_chars_d4",
      DB_IDENTITY_KEY_ID: "prod-key-2026-v1",
      DB_IDENTITY_SECRET: "prod_db_identity_secret_distinct_32_chars_e5",
      PAYMENT_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "sk_live_valid_stripe_key_12345",
      STRIPE_PUBLISHABLE_KEY: "pk_live_valid_stripe_key_12345",
      STRIPE_WEBHOOK_SECRET: "whsec_valid_webhook_secret_12345",
      PAYMENT_WEBHOOK_SECRET: "prod_payment_webhook_secret_distinct_32_chars_f6",
      CUSTODY_TOKEN_HMAC_SECRET: "prod_custody_token_distinct_secret_32_chars_g7",
      MAPS_PROVIDER: "maptiler",
      MAPTILER_API_KEY: "maptiler_live_api_key_valid_67890"
    };

    it("strictly rejects MAPS_PROVIDER=sandbox in production", () => {
      expect(() => {
        new MapsService({
          NODE_ENV: "production",
          MAPS_PROVIDER: "sandbox",
          MAPTILER_API_KEY: ""
        });
      }).toThrow(/MAPS_PROVIDER_INVALID: In production, MAPS_PROVIDER must be 'maptiler'/);
    });

    it("requires MAPTILER_API_KEY when MAPS_PROVIDER=maptiler in production", () => {
      expect(() => {
        loadConfig({
          ...validProdEnv,
          MAPS_PROVIDER: "maptiler",
          MAPTILER_API_KEY: ""
        });
      }).toThrow(/MAPTILER_API_KEY is required in production/);
    });

    it("rejects dev or placeholder MAPTILER_API_KEY in production", () => {
      expect(() => {
        loadConfig({
          ...validProdEnv,
          MAPTILER_API_KEY: "dev_maptiler_placeholder_key"
        });
      }).toThrow(/MAPTILER_API_KEY is required in production/);
    });

    it("fails closed without returning synthetic route if MapTiler key is missing in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        const adapter = new MapTilerRoutingAdapter("");
        await expect(
          adapter.calculateRoute({
            origin: { latitude: 6.9271, longitude: 79.8458 },
            destination: { latitude: 6.9344, longitude: 79.8519 },
            travelMode: "walking"
          })
        ).rejects.toThrow(/EXTERNAL_ROUTING_UNAVAILABLE/);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});

