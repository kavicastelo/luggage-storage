import pg from "pg";
import { env, buildDatabaseSslConfig } from "../../config/env.js";
import { logger } from "../logging/logger.js";

const { Pool } = pg;

export const dbPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_MAX_CONNECTIONS,
  ssl: buildDatabaseSslConfig(env)
});

dbPool.on("error", (err) => {
  logger.error({ err }, "Unexpected error on idle PostgreSQL client");
});

export async function checkDatabaseConnection(): Promise<{ ok: boolean; postgisVersion?: string; error?: string }> {
  try {
    const client = await dbPool.connect();
    try {
      const pingResult = await client.query("SELECT 1 AS connected");
      let postgisVersion: string | undefined;
      try {
        const gisResult = await client.query("SELECT PostGIS_Version() AS version");
        postgisVersion = gisResult.rows[0]?.version;
      } catch {
        postgisVersion = "Extension not installed (run CREATE EXTENSION IF NOT EXISTS postgis;)";
      }
      return { ok: pingResult.rows[0]?.connected === 1, postgisVersion };
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
