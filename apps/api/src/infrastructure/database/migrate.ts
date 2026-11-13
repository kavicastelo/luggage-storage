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

export const REVOKED_IDENTITY_SECRETS = new Set([
  "dev_db_identity_secret_key_minimum_32_characters_12345"
]);

const KEY_ID_FORMAT_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export interface IdentitySecretSyncOptions {
  activeKeyId?: string;
  activeSecret?: string;
  retiringKeyId?: string;
  retiringSecret?: string;
  retiringWindowSeconds?: number;
}

export async function syncTrustedAuthSecret(
  client: pg.PoolClient,
  options?: IdentitySecretSyncOptions
): Promise<void> {
  const tableCheck = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = 'trusted_auth_secrets'
     );`
  );
  if (!tableCheck.rows[0]?.exists) {
    return;
  }

  const activeKeyId = (options?.activeKeyId ?? env.DB_IDENTITY_KEY_ID ?? "active").trim();
  const secretToProvision = (options?.activeSecret ?? env.DB_IDENTITY_SECRET)?.trim();
  const retiringKeyId = (options?.retiringKeyId ?? env.DB_IDENTITY_RETIRING_KEY_ID)?.trim() || undefined;
  const retiringSecret = (options?.retiringSecret ?? env.DB_IDENTITY_RETIRING_SECRET)?.trim() || undefined;
  const retiringWindowSeconds =
    options?.retiringWindowSeconds ?? env.DB_IDENTITY_RETIRING_WINDOW_SECONDS ?? 300;

  if (!KEY_ID_FORMAT_REGEX.test(activeKeyId)) {
    throw new Error(
      "[Migration Engine] Security failure: DB_IDENTITY_KEY_ID is malformed. Must match ^[a-zA-Z0-9_-]{1,64}$."
    );
  }

  if (!secretToProvision || secretToProvision.length < 32) {
    throw new Error(
      "[Migration Engine] Security failure: DB_IDENTITY_SECRET is missing or less than 32 characters. Privileged identity provisioning cannot proceed."
    );
  }

  if (REVOKED_IDENTITY_SECRETS.has(secretToProvision)) {
    throw new Error(
      "[Migration Engine] Security failure: DB_IDENTITY_SECRET matches a known compromised development secret. Migration aborted."
    );
  }

  if (Boolean(retiringKeyId) !== Boolean(retiringSecret)) {
    throw new Error(
      "[Migration Engine] Security failure: DB_IDENTITY_RETIRING_KEY_ID and DB_IDENTITY_RETIRING_SECRET must both be provided when rotating keys."
    );
  }

  if (retiringKeyId && retiringSecret) {
    if (!KEY_ID_FORMAT_REGEX.test(retiringKeyId)) {
      throw new Error(
        "[Migration Engine] Security failure: DB_IDENTITY_RETIRING_KEY_ID is malformed. Must match ^[a-zA-Z0-9_-]{1,64}$."
      );
    }
    if (retiringKeyId === activeKeyId) {
      throw new Error(
        "[Migration Engine] Security failure: DB_IDENTITY_RETIRING_KEY_ID must differ from active DB_IDENTITY_KEY_ID."
      );
    }
    if (retiringSecret.length < 32) {
      throw new Error(
        "[Migration Engine] Security failure: DB_IDENTITY_RETIRING_SECRET must be at least 32 characters."
      );
    }
    if (REVOKED_IDENTITY_SECRETS.has(retiringSecret)) {
      throw new Error(
        "[Migration Engine] Security failure: DB_IDENTITY_RETIRING_SECRET matches a known compromised development secret."
      );
    }
    if (
      !Number.isInteger(retiringWindowSeconds) ||
      retiringWindowSeconds < 30 ||
      retiringWindowSeconds > 3600
    ) {
      throw new Error(
        "[Migration Engine] Security failure: DB_IDENTITY_RETIRING_WINDOW_SECONDS must be between 30 and 3600 seconds."
      );
    }
  }

  // Check whether the lifecycle columns from migration 0011 are present
  const statusColCheck = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'trusted_auth_secrets'
         AND column_name = 'status'
     );`
  );

  // Purge any compromised development secrets from database storage
  await client.query(
    `DELETE FROM public.trusted_auth_secrets 
     WHERE secret = 'dev_db_identity_secret_key_minimum_32_characters_12345';`
  );

  if (!statusColCheck.rows[0]?.exists) {
    await client.query(
      `INSERT INTO public.trusted_auth_secrets (key_id, secret)
       VALUES ($1, $2)
       ON CONFLICT (key_id) DO UPDATE SET secret = EXCLUDED.secret;`,
      [activeKeyId, secretToProvision]
    );
    return;
  }

  await client.query("BEGIN");
  try {
    // 1. Transition any elapsed RETIRING keys to REVOKED
    await client.query(
      `UPDATE public.trusted_auth_secrets
       SET status = 'REVOKED',
           retires_at = NULL,
           updated_at = NOW()
       WHERE status = 'RETIRING'
         AND retires_at <= NOW();`
    );

    // 2. Demote any previously ACTIVE key that differs from the configured activeKeyId
    if (retiringKeyId) {
      await client.query(
        `UPDATE public.trusted_auth_secrets
         SET status = CASE WHEN key_id = $2 THEN 'RETIRING' ELSE 'REVOKED' END,
             retires_at = CASE WHEN key_id = $2 THEN NOW() + make_interval(secs => $3::int) ELSE NULL END,
             updated_at = NOW()
         WHERE status = 'ACTIVE'
           AND key_id <> $1;`,
        [activeKeyId, retiringKeyId, retiringWindowSeconds]
      );
    } else {
      await client.query(
        `UPDATE public.trusted_auth_secrets
         SET status = 'REVOKED',
             retires_at = NULL,
             updated_at = NOW()
         WHERE status = 'ACTIVE'
           AND key_id <> $1;`,
        [activeKeyId]
      );

      // If no retiring key is configured, revoke any remaining RETIRING keys immediately on explicit cutover
      await client.query(
        `UPDATE public.trusted_auth_secrets
         SET status = 'REVOKED',
             retires_at = NULL,
             updated_at = NOW()
         WHERE status = 'RETIRING'
           AND key_id <> $1;`,
        [activeKeyId]
      );
    }

    // 3. Provision or update the configured ACTIVE key
    await client.query(
      `INSERT INTO public.trusted_auth_secrets (key_id, secret, status, retires_at, updated_at)
       VALUES ($1, $2, 'ACTIVE', NULL, NOW())
       ON CONFLICT (key_id) DO UPDATE
       SET secret = EXCLUDED.secret,
           status = 'ACTIVE',
           retires_at = NULL,
           updated_at = NOW();`,
      [activeKeyId, secretToProvision]
    );

    // 4. Optionally provision or refresh the bounded RETIRING key for overlap rotation
    if (retiringKeyId && retiringSecret) {
      await client.query(
        `INSERT INTO public.trusted_auth_secrets (key_id, secret, status, retires_at, updated_at)
         VALUES ($1, $2, 'RETIRING', NOW() + make_interval(secs => $3::int), NOW())
         ON CONFLICT (key_id) DO UPDATE
         SET secret = EXCLUDED.secret,
             status = 'RETIRING',
             retires_at = NOW() + make_interval(secs => $3::int),
             updated_at = NOW();`,
        [retiringKeyId, retiringSecret, retiringWindowSeconds]
      );
    }

    // 5. Verify in PostgreSQL that exactly one valid ACTIVE key exists and matches activeKeyId
    const verifyRes = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM public.trusted_auth_secrets
       WHERE status = 'ACTIVE'
         AND key_id = $1
         AND secret <> 'dev_db_identity_secret_key_minimum_32_characters_12345'
         AND length(secret) >= 32;`,
      [activeKeyId]
    );

    if (verifyRes.rows[0]?.count !== "1") {
      throw new Error(
        "[Migration Engine] Security failure: active identity secret verification failed in PostgreSQL"
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
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
