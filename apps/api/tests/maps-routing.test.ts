import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

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
});

