import pg from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env, buildDatabaseSslConfig } from "../../config/env.js";
import { logger } from "../logging/logger.js";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_ADVISORY_LOCK_ID = 7461938502847;

export const REQUIRED_PUBLIC_TABLES = [
  "__drizzle_migrations",
  "users",
  "traveller_profiles",
  "host_profiles",
  "roles",
  "permissions",
  "user_roles",
  "role_permissions",
  "auth_sessions",
  "password_reset_tokens",
  "security_audit_events",
  "email_verification_tokens",
  "auth_rate_limits",
  "host_businesses",
  "host_verifications",
  "host_verification_documents",
  "host_staff_memberships",
  "storage_locations",
  "location_media",
  "storage_zones",
  "opening_hours",
  "opening_hours_exceptions",
  "storage_capacity_pools",
  "pricing_policies",
  "pricing_tier_rates",
  "upload_intents"
] as const;

export async function verifyMigratedSchema(client: pg.PoolClient): Promise<void> {
  const extRes = await client.query<{ extname: string }>(
    `SELECT extname FROM pg_extension WHERE extname = 'postgis';`
  );
  if (extRes.rows.length === 0) {
    throw new Error(
      "[Migration Engine] Required PostgreSQL extension 'postgis' is not installed"
    );
  }

  const tablesRes = await client.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[]);`,
    [REQUIRED_PUBLIC_TABLES]
  );

  const existingTables = new Set(tablesRes.rows.map((r) => r.table_name));
  const missingTables = REQUIRED_PUBLIC_TABLES.filter((t) => !existingTables.has(t));
  if (missingTables.length > 0) {
    throw new Error(
      `[Migration Engine] Schema verification failed; missing tables: ${missingTables.join(", ")}`
    );
  }
}

export async function runMigrations(customConnectionString?: string): Promise<number> {
  const connectionString =
    customConnectionString ||
    process.env.MIGRATION_DATABASE_URL ||
    env.MIGRATION_DATABASE_URL ||
    "postgresql://luggage_migrator:migrator_password@localhost:5432/luggage_storage_dev";

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: buildDatabaseSslConfig(env)
  });

  const client = await pool.connect();
  try {
    const userRes = await client.query("SELECT current_user, current_database()");
    logger.info(
      { role: userRes.rows[0].current_user, database: userRes.rows[0].current_database },
      "[Migration Engine] Connected to database"
    );

    // Acquire PostgreSQL advisory lock to serialize concurrent migrations
    await client.query("SELECT pg_advisory_lock($1);", [MIGRATION_ADVISORY_LOCK_ID]);
    logger.info("[Migration Engine] Acquired migration advisory lock");

    // Ensure migration tracking table exists in public schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
    `);

    const lastRes = await client.query(`
      SELECT id, hash, created_at FROM public.__drizzle_migrations ORDER BY created_at DESC LIMIT 1;
    `);
    const lastMigration = lastRes.rows[0];

    const migrationsFolder = path.resolve(__dirname, "migrations");
    logger.info({ folder: migrationsFolder }, "[Migration Engine] Loading migrations");
    const migrations = readMigrationFiles({ migrationsFolder });

    let appliedCount = 0;
    for (const migration of migrations) {
      if (!lastMigration || Number(lastMigration.created_at) < migration.folderMillis) {
        logger.info({ timestamp: migration.folderMillis }, "[Migration Engine] Applying migration");
        await client.query("BEGIN");
        try {
          for (const stmt of migration.sql) {
            await client.query(stmt);
          }
          await client.query(
            `INSERT INTO public.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2);`,
            [migration.hash, migration.folderMillis]
          );
          await client.query("COMMIT");
          appliedCount++;
          logger.info({ timestamp: migration.folderMillis }, "[Migration Engine] Migration applied successfully");
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        }
      }
    }

    if (appliedCount === 0) {
      logger.info("[Migration Engine] Database schema is up to date. No new migrations to apply.");
    } else {
      logger.info({ appliedCount }, "[Migration Engine] Successfully applied migration(s)");
    }

    await verifyMigratedSchema(client);
    logger.info(
      { verifiedTables: REQUIRED_PUBLIC_TABLES.length },
      "[Migration Engine] Verified required schema tables and PostGIS extension"
    );

    return appliedCount;
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1);", [MIGRATION_ADVISORY_LOCK_ID]);
      logger.info("[Migration Engine] Released migration advisory lock");
    } catch (unlockErr) {
      logger.error({ err: unlockErr }, "[Migration Engine] Failed to release advisory lock");
    }
    client.release();
    await pool.end();
  }
}

// Auto-run when executed directly via CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then((count) => {
      logger.info({ count }, "[Migration Engine] Process finished cleanly");
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, "[Migration Engine] Migration failed");
      process.exit(1);
    });
}
