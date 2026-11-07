import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { EnvSchema } from "../src/config/env.js";

describe("Health, Readiness & Foundation API Endpoints", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health should return 200 with status ok and echo correlationId", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        "x-correlation-id": "test-correlation-123"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(body.meta.correlationId).toBe("test-correlation-123");
    expect(body.meta.timestamp).toBeDefined();
  });

  it("GET /api/v1/health should generate UUID correlation ID when omitted", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health"
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(body.meta.correlationId).toBeDefined();
    expect(body.meta.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("GET /ready should return structured readiness response (200 or 503 if DB offline)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/ready"
    });

    // If Docker DB is running -> 200, if offline -> 503
    expect([200, 503]).toContain(response.statusCode);
    const body = JSON.parse(response.body);
    if (response.statusCode === 200) {
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("ready");
    } else {
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
      // Must not leak passwords or internal connection strings
      expect(JSON.stringify(body)).not.toContain("password");
      expect(JSON.stringify(body)).not.toContain("postgres://");
    }
  });

  it("Non-existent route should return 404 with structured ApiErrorResponse", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/non-existent-route-xyz"
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.meta.correlationId).toBeDefined();
  });

  it("Zod EnvSchema should fail-fast on invalid port or missing required keys", () => {
    const invalidConfig = {
      PORT: "not-a-number",
      NODE_ENV: "invalid-env"
    };
    const result = EnvSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });
});
