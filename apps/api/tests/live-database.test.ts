import { describe, it, expect } from "vitest";
import { checkDatabaseConnection } from "../src/infrastructure/database/connection.js";
import { buildApp } from "../src/app.js";

describe("Live PostgreSQL and PostGIS Verification", () => {
  it("checkDatabaseConnection() should connect to live PostgreSQL and return PostGIS version", async () => {
    const dbStatus = await checkDatabaseConnection();
    console.log("Live DB Status:", JSON.stringify(dbStatus, null, 2));
    expect(dbStatus.ok).toBe(true);
    expect(dbStatus.postgisVersion).toBeDefined();
    expect(dbStatus.postgisVersion).toContain("3.5");
  });

  it("GET /ready should return 200 when database is healthy", async () => {
    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/ready"
    });

    console.log("GET /ready response status:", response.statusCode);
    console.log("GET /ready response body:", response.body);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ready");
    expect(body.data.database.connected).toBe(true);
    expect(body.data.database.postgis).toContain("3.5");

    await app.close();
  });
});

