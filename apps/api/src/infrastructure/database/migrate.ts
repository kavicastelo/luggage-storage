import pg from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env, buildDatabaseSslConfig } from "../../config/env.js";
import { logger } from "../logging/logger.js";
import { encryptPayoutAccountNumber } from "../../common/crypto/payout-encryption.js";

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
  "upload_intents",
  "trusted_auth_secrets",
  "consumed_auth_assertions"
] as const;

export async function syncTrustedAuthSecret(client: pg.PoolClient): Promise<void> {
  const tableCheck = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = 'trusted_auth_secrets'
     );`
  );
  if (!tableCheck.rows[0]?.exists) {
    return;
  }

  await client.query(
    `INSERT INTO public.trusted_auth_secrets (key_id, secret)
     VALUES ('active', $1)
     ON CONFLICT (key_id) DO UPDATE SET secret = EXCLUDED.secret;`,
    [env.DB_IDENTITY_SECRET]
  );
}

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

export async function backfillPlaintextPayoutRecords(client: pg.PoolClient): Promise<number> {
  const tableCheck = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = 'host_businesses'
     );`
  );
  if (!tableCheck.rows[0]?.exists) {
    return 0;
  }

  // Ensure column is widened to text before writing encrypted envelopes
  await client.query(
    `ALTER TABLE public.host_businesses ALTER COLUMN payout_account_number TYPE text;`
  );

  const result = await client.query<{ id: string; payout_account_number: string }>(
    `SELECT id, payout_account_number
     FROM public.host_businesses
     WHERE payout_account_number IS NOT NULL
       AND payout_account_number NOT LIKE 'enc:v1:%';`
  );

  if (result.rows.length === 0) {
    return 0;
  }

  for (const row of result.rows) {
    const encrypted = encryptPayoutAccountNumber(row.payout_account_number);
    await client.query(
      `UPDATE public.host_businesses
       SET payout_account_number = $1, updated_at = NOW()
       WHERE id = $2;`,
      [encrypted, row.id]
    );
  }

  logger.info(
    { count: result.rows.length },
    "[Migration Engine] Successfully backfilled and encrypted plaintext payout records"
  );
  return result.rows.length;
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

    // Backfill any plaintext payout account numbers before applying pending migrations/constraints
    await backfillPlaintextPayoutRecords(client);

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

    // Synchronize configured identity assertion secret into private database storage
    await syncTrustedAuthSecret(client);

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
