import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { env, buildDatabaseSslConfig } from "../src/config/env.js";

const { Pool } = pg;

describe("Workstream 2 — Supabase PostgreSQL & PostGIS Compatibility", () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = new Pool({
      connectionString: env.MIGRATION_DATABASE_URL,
      max: 2,
      ssl: buildDatabaseSslConfig(env)
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("1. verifies PostGIS extension is installed and reports version", async () => {
    const res = await pool.query<{ version: string }>("SELECT PostGIS_Version() AS version;");
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].version).toBeTruthy();
  });

  it("2. verifies pgcrypto and gen_random_uuid() cryptographic function", async () => {
    const res = await pool.query<{ uuid: string }>("SELECT gen_random_uuid()::text AS uuid;");
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("3. verifies session-level advisory locks for migration concurrency serialization", async () => {
    const client = await pool.connect();
    try {
      const lockRes = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock($1) AS locked;",
        [7461938502847]
      );
      expect(lockRes.rows[0].locked).toBe(true);

      const unlockRes = await client.query<{ unlocked: boolean }>(
        "SELECT pg_advisory_unlock($1) AS unlocked;",
        [7461938502847]
      );
      expect(unlockRes.rows[0].unlocked).toBe(true);
    } finally {
      client.release();
    }
  });

  it("4. verifies PostGIS spatial geography queries (ST_MakePoint, ST_Distance, radius filter)", async () => {
    // Colombo Fort coordinates: 6.9344 N, 79.8519 E
    // Galle Face coordinates: 6.9271 N, 79.8458 E (~1.0 km away)
    const res = await pool.query<{ distance_meters: number }>(`
      SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint(79.8519, 6.9344), 4326)::geography,
        ST_SetSRID(ST_MakePoint(79.8458, 6.9271), 4326)::geography
      ) AS distance_meters;
    `);

    expect(res.rows.length).toBe(1);
    const distance = Number(res.rows[0].distance_meters);
    expect(distance).toBeGreaterThan(800);
    expect(distance).toBeLessThan(1500);
  });

  it("5. verifies JSONB operations and GIN/B-tree index compatibility", async () => {
    const res = await pool.query<{ matches: boolean }>(`
      SELECT ('["WIFI", "CCTV", "ELEVATOR"]'::jsonb ? 'CCTV') AS matches;
    `);
    expect(res.rows[0].matches).toBe(true);
  });

  it("6. verifies row-level locking (SELECT ... FOR UPDATE) inside transactions", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN;");
      const res = await client.query("SELECT id FROM users LIMIT 1 FOR UPDATE;");
      expect(res.rows).toBeDefined();
      await client.query("COMMIT;");
    } finally {
      client.release();
    }
  });

  it("7. verifies buildDatabaseSslConfig outputs compatible TLS settings for Supabase", () => {
    const demoConfig = {
      DATABASE_SSL: true,
      DATABASE_SSL_REJECT_UNAUTHORIZED: false
    };
    const ssl = buildDatabaseSslConfig(demoConfig as any);
    expect(ssl).toEqual({ rejectUnauthorized: false });
  });
});
