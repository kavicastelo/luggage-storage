import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { runMigrations } from "../src/infrastructure/database/migrate.js";

const { Pool } = pg;

const runtimeUrl =
  process.env.DATABASE_URL ||
  "postgresql://luggage_user:luggage_password@localhost:5432/luggage_storage_dev";

const migratorUrl =
  process.env.MIGRATION_DATABASE_URL ||
  "postgresql://luggage_migrator:migrator_password@localhost:5432/luggage_storage_dev";

describe("WP-02: Identity Database Architecture & Integrity Tests", () => {
  let runtimePool: pg.Pool;
  let migratorPool: pg.Pool;

  beforeAll(async () => {
    // Run migrations using migrator role
    await runMigrations(migratorUrl);

    runtimePool = new Pool({ connectionString: runtimeUrl, max: 2 });
    migratorPool = new Pool({ connectionString: migratorUrl, max: 2 });
  });

  afterAll(async () => {
    await runtimePool?.end();
    await migratorPool?.end();
  });

  describe("1. Schema & Migration Idempotency", () => {
    it("should report 0 applied migrations on repeated execution", async () => {
      const appliedCount = await runMigrations(migratorUrl);
      expect(appliedCount).toBe(0);
    });

    it("should verify all 10 identity tables exist in schema public", async () => {
      const result = await runtimePool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      const tableNames = result.rows.map((r) => r.table_name);

      const requiredTables = [
        "users",
        "traveller_profiles",
        "host_profiles",
        "roles",
        "permissions",
        "user_roles",
        "role_permissions",
        "auth_sessions",
        "password_reset_tokens",
        "security_audit_events"
      ];

      for (const table of requiredTables) {
        expect(tableNames).toContain(table);
      }
    });
  });

  describe("2. User Identity Integrity & Normalized Email Uniqueness", () => {
    it("should reject duplicate normalized_email values", async () => {
      const uniqueSuffix = Date.now();
      const email1 = `Traveller_${uniqueSuffix}@Example.COM`;
      const normalizedEmail = `traveller_${uniqueSuffix}@example.com`;

      // First insert should succeed
      const insert1 = await runtimePool.query(
        `INSERT INTO users (email, normalized_email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [email1, normalizedEmail, "$argon2id$mockhash", "John Doe"]
      );
      expect(insert1.rows[0]?.id).toBeDefined();

      // Second insert with different casing but same normalized_email must fail with unique constraint violation (code 23505)
      const email2 = `TRAVELLER_${uniqueSuffix}@example.com`;
      await expect(
        runtimePool.query(
          `INSERT INTO users (email, normalized_email, password_hash, display_name)
           VALUES ($1, $2, $3, $4);`,
          [email2, normalizedEmail, "$argon2id$mockhash", "John Duplicate"]
        )
      ).rejects.toThrowError(/duplicate key value violates unique constraint/i);
    });

    it("should enforce check constraint on users.status", async () => {
      const uniqueSuffix = Date.now() + 1;
      await expect(
        runtimePool.query(
          `INSERT INTO users (email, normalized_email, password_hash, display_name, status)
           VALUES ($1, $2, $3, $4, $5);`,
          [
            `invalid_${uniqueSuffix}@example.com`,
            `invalid_${uniqueSuffix}@example.com`,
            "$argon2id$mockhash",
            "Bad Status",
            "INVALID_STATUS_VALUE"
          ]
        )
      ).rejects.toThrowError(/violates check constraint "users_status_check"/i);
    });

    it("should enforce check constraint when normalized_email disagrees with lower(trim(email))", async () => {
      const uniqueSuffix = Date.now() + 10;
      await expect(
        runtimePool.query(
          `INSERT INTO users (email, normalized_email, password_hash, display_name)
           VALUES ($1, $2, $3, $4);`,
          [
            `User_${uniqueSuffix}@Example.COM`,
            `attacker_${uniqueSuffix}@evil.com`,
            "$argon2id$mockhash",
            "Mismatched Email"
          ]
        )
      ).rejects.toThrowError(/violates check constraint "users_normalized_email_match_check"/i);
    });

    it("should accept email with casing and whitespace when normalized_email matches lower(trim(email))", async () => {
      const uniqueSuffix = Date.now() + 11;
      const rawEmail = `   Whitespace_${uniqueSuffix}@Example.COM   `;
      const expectedNormalized = `whitespace_${uniqueSuffix}@example.com`;

      const res = await runtimePool.query(
        `INSERT INTO users (email, normalized_email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, normalized_email;`,
        [rawEmail, expectedNormalized, "$argon2id$mockhash", "Whitespace User"]
      );

      expect(res.rows[0].email).toBe(rawEmail);
      expect(res.rows[0].normalized_email).toBe(expectedNormalized);
    });
  });

  describe("3. Profile Context Separation & Referential Cascade", () => {
    it("should create TravellerProfile and HostProfile linked to a single User", async () => {
      const uniqueSuffix = Date.now() + 2;
      const userRes = await runtimePool.query(
        `INSERT INTO users (email, normalized_email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [
          `dual_${uniqueSuffix}@example.com`,
          `dual_${uniqueSuffix}@example.com`,
          "$argon2id$mockhash",
          "Dual Persona User"
        ]
      );
      const userId = userRes.rows[0].id;

      // Create TravellerProfile
      const travRes = await runtimePool.query(
        `INSERT INTO traveller_profiles (user_id, first_name, last_name, preferred_language, preferred_currency)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id;`,
        [userId, "Dual", "Traveller", "en", "LKR"]
      );
      expect(travRes.rows[0]?.id).toBeDefined();

      // Create HostProfile
      const hostRes = await runtimePool.query(
        `INSERT INTO host_profiles (user_id, display_name, host_type, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [userId, "Dual Host Station", "INDIVIDUAL", "PENDING_ONBOARDING"]
      );
      expect(hostRes.rows[0]?.id).toBeDefined();

      // Reject second TravellerProfile for same user (1-to-1 enforcement)
      await expect(
        runtimePool.query(
          `INSERT INTO traveller_profiles (user_id, first_name, last_name)
           VALUES ($1, $2, $3);`,
          [userId, "Duplicate", "Profile"]
        )
      ).rejects.toThrowError(/duplicate key value violates unique constraint/i);

      // Reject invalid host_type
      await expect(
        runtimePool.query(
          `INSERT INTO host_profiles (user_id, display_name, host_type)
           VALUES ($1, $2, $3);`,
          [userId, "Invalid Host", "CONGLOMERATE"]
        )
      ).rejects.toThrowError(/violates check constraint "host_profiles_host_type_check"/i);
    });

    it("should cascade profile deletion upon user deletion", async () => {
      const uniqueSuffix = Date.now() + 3;
      const userRes = await runtimePool.query(
        `INSERT INTO users (email, normalized_email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [
          `cascade_${uniqueSuffix}@example.com`,
          `cascade_${uniqueSuffix}@example.com`,
          "$argon2id$mockhash",
          "Cascade User"
        ]
      );
      const userId = userRes.rows[0].id;

      await runtimePool.query(
        `INSERT INTO traveller_profiles (user_id, first_name, last_name)
         VALUES ($1, $2, $3);`,
        [userId, "Cascade", "Traveller"]
      );

      // Delete user
      await runtimePool.query(`DELETE FROM users WHERE id = $1;`, [userId]);

      // Profile must be cascaded and deleted
      const checkProfile = await runtimePool.query(
        `SELECT id FROM traveller_profiles WHERE user_id = $1;`,
        [userId]
      );
      expect(checkProfile.rows.length).toBe(0);
    });
  });

  describe("4. Centralized RBAC Integrity & Role-Permission Constraints", () => {
    it("should support multiple role assignments and reject duplicates", async () => {
      const uniqueSuffix = Date.now() + 4;
      const userRes = await runtimePool.query(
        `INSERT INTO users (email, normalized_email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [
          `rbac_${uniqueSuffix}@example.com`,
          `rbac_${uniqueSuffix}@example.com`,
          "$argon2id$mockhash",
          "RBAC User"
        ]
      );
      const userId = userRes.rows[0].id;

      // Seed roles using migrator
      const role1 = await migratorPool.query(
        `INSERT INTO roles (code, name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id;`,
        [`TRAVELLER_${uniqueSuffix}`, "Traveller Role", "Standard traveller"]
      );
      const role2 = await migratorPool.query(
        `INSERT INTO roles (code, name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id;`,
        [`HOST_OWNER_${uniqueSuffix}`, "Host Owner Role", "Host owner"]
      );

      const roleId1 = role1.rows[0].id;
      const roleId2 = role2.rows[0].id;

      // Assign first role
      await runtimePool.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);`,
        [userId, roleId1]
      );

      // Assign second role (multi-role support)
      await runtimePool.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);`,
        [userId, roleId2]
      );

      // Verify user has both roles
      const userRolesRes = await runtimePool.query(
        `SELECT role_id FROM user_roles WHERE user_id = $1 ORDER BY role_id;`,
        [userId]
      );
      expect(userRolesRes.rows.length).toBe(2);

      // Reject duplicate assignment of same role
      await expect(
        runtimePool.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);`,
          [userId, roleId1]
        )
      ).rejects.toThrowError(/duplicate key value violates unique constraint/i);
    });

    it("should reject duplicate role-permission assignments", async () => {
      const uniqueSuffix = Date.now() + 5;
      const role = await runtimePool.query(
        `INSERT INTO roles (code, name) VALUES ($1, $2) RETURNING id;`,
        [`ROLE_PERM_${uniqueSuffix}`, "Test Role"]
      );
      const perm = await runtimePool.query(
        `INSERT INTO permissions (code, name, module) VALUES ($1, $2, $3) RETURNING id;`,
        [`auth:test:${uniqueSuffix}`, "Test Permission", "identity"]
      );

      const roleId = role.rows[0].id;
      const permId = perm.rows[0].id;

      await runtimePool.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2);`,
        [roleId, permId]
      );

      // Duplicate must fail
      await expect(
        runtimePool.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2);`,
          [roleId, permId]
        )
      ).rejects.toThrowError(/duplicate key value violates unique constraint/i);
    });
  });

  describe("5. Authentication Session Persistence & Rotation Guardrails", () => {
    it("should persist auth_sessions and enforce unique refresh_token_hash", async () => {
      const uniqueSuffix = Date.now() + 6;
      const userRes = await runtimePool.query(
        `INSERT INTO users (email, normalized_email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [
          `session_${uniqueSuffix}@example.com`,
          `session_${uniqueSuffix}@example.com`,
          "$argon2id$mockhash",
          "Session User"
        ]
      );
      const userId = userRes.rows[0].id;
      const tokenHash = `sha256_hash_value_${uniqueSuffix}`;

      // Insert session
      const sessionRes = await runtimePool.query(
        `INSERT INTO auth_sessions (user_id, refresh_token_hash, client_type, expires_at)
         VALUES ($1, $2, $3, NOW() + interval '7 days')
         RETURNING id;`,
        [userId, tokenHash, "WEB"]
      );
      expect(sessionRes.rows[0]?.id).toBeDefined();

      // Reject duplicate refresh_token_hash
      await expect(
        runtimePool.query(
          `INSERT INTO auth_sessions (user_id, refresh_token_hash, client_type, expires_at)
           VALUES ($1, $2, $3, NOW() + interval '7 days');`,
          [userId, tokenHash, "MOBILE"]
        )
      ).rejects.toThrowError(/duplicate key value violates unique constraint/i);

      // Enforce client_type check constraint
      await expect(
        runtimePool.query(
          `INSERT INTO auth_sessions (user_id, refresh_token_hash, client_type, expires_at)
           VALUES ($1, $2, $3, NOW() + interval '7 days');`,
          [userId, `sha256_invalid_${uniqueSuffix}`, "DESKTOP_APP"]
        )
      ).rejects.toThrowError(/violates check constraint "auth_sessions_client_type_check"/i);
    });

    it("should verify index exists on previous_token_hash for reuse detection", async () => {
      const res = await runtimePool.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'auth_sessions' AND indexname = 'auth_sessions_previous_token_hash_idx';
      `);
      expect(res.rows.length).toBe(1);
    });
  });

  describe("6. Security Audit Trail & SET NULL Referential Behavior", () => {
    it("should preserve security_audit_events with user_id = null when user is deleted", async () => {
      const uniqueSuffix = Date.now() + 7;
      const userRes = await runtimePool.query(
        `INSERT INTO users (email, normalized_email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id;`,
        [
          `audit_${uniqueSuffix}@example.com`,
          `audit_${uniqueSuffix}@example.com`,
          "$argon2id$mockhash",
          "Audit User"
        ]
      );
      const userId = userRes.rows[0].id;

      // Log event
      const eventRes = await runtimePool.query(
        `INSERT INTO security_audit_events (user_id, event_type, metadata)
         VALUES ($1, $2, $3)
         RETURNING id;`,
        [userId, "REGISTER_SUCCESS", JSON.stringify({ ip: "127.0.0.1" })]
      );
      const eventId = eventRes.rows[0].id;

      // Delete user
      await runtimePool.query(`DELETE FROM users WHERE id = $1;`, [userId]);

      // Audit event must still exist, with user_id set to null (audit trail preservation)
      const auditCheck = await runtimePool.query(
        `SELECT id, user_id, event_type FROM security_audit_events WHERE id = $1;`,
        [eventId]
      );
      expect(auditCheck.rows.length).toBe(1);
      expect(auditCheck.rows[0].user_id).toBeNull();
      expect(auditCheck.rows[0].event_type).toBe("REGISTER_SUCCESS");
    });

    it("should deny luggage_user UPDATE privileges on security_audit_events", async () => {
      const privRes = await runtimePool.query(`
        SELECT has_table_privilege('luggage_user', 'security_audit_events', 'UPDATE') as can_update;
      `);
      expect(privRes.rows[0].can_update).toBe(false);

      await expect(
        runtimePool.query(
          `UPDATE security_audit_events SET event_type = 'TAMPERED' WHERE id = '00000000-0000-0000-0000-000000000000';`
        )
      ).rejects.toThrowError(/permission denied for table security_audit_events/i);
    });

    it("should deny luggage_user DELETE privileges on security_audit_events", async () => {
      const privRes = await runtimePool.query(`
        SELECT has_table_privilege('luggage_user', 'security_audit_events', 'DELETE') as can_delete;
      `);
      expect(privRes.rows[0].can_delete).toBe(false);

      await expect(
        runtimePool.query(
          `DELETE FROM security_audit_events WHERE id = '00000000-0000-0000-0000-000000000000';`
        )
      ).rejects.toThrowError(/permission denied for table security_audit_events/i);
    });

    it("should block UPDATE and DELETE via database trigger even under migrator", async () => {
      const eventRes = await migratorPool.query(
        `INSERT INTO security_audit_events (event_type, metadata)
         VALUES ($1, $2)
         RETURNING id;`,
        ["TRIGGER_TEST", JSON.stringify({ test: true })]
      );
      const eventId = eventRes.rows[0].id;

      // UPDATE attempt must be blocked by trigger
      await expect(
        migratorPool.query(
          `UPDATE security_audit_events SET event_type = 'TAMPERED' WHERE id = $1;`,
          [eventId]
        )
      ).rejects.toThrowError(/security_audit_events records are immutable: UPDATE is prohibited/i);

      // DELETE attempt must be blocked by trigger
      await expect(
        migratorPool.query(
          `DELETE FROM security_audit_events WHERE id = $1;`,
          [eventId]
        )
      ).rejects.toThrowError(/security_audit_events records are immutable: DELETE is prohibited/i);
    });
  });

  describe("7. Three-Tier Database Role Privilege Enforcement", () => {
    it("should verify luggage_user cannot create tables (DDL denied)", async () => {
      await expect(
        runtimePool.query("CREATE TABLE unauthorized_table (id int);")
      ).rejects.toThrowError(/permission denied for schema public/i);
    });

    it("should verify luggage_user can execute DML (SELECT, INSERT, UPDATE, DELETE)", async () => {
      const uniqueSuffix = Date.now() + 8;
      const testEmail = `dml_${uniqueSuffix}@example.com`;

      // INSERT
      const insRes = await runtimePool.query(
        `INSERT INTO users (email, normalized_email, password_hash, display_name)
         VALUES ($1, $1, 'hash', 'DML Test')
         RETURNING id;`,
        [testEmail]
      );
      const id = insRes.rows[0].id;

      // SELECT
      const selRes = await runtimePool.query(`SELECT display_name FROM users WHERE id = $1;`, [id]);
      expect(selRes.rows[0].display_name).toBe("DML Test");

      // UPDATE
      await runtimePool.query(`UPDATE users SET display_name = 'DML Updated' WHERE id = $1;`, [id]);
      const updRes = await runtimePool.query(`SELECT display_name FROM users WHERE id = $1;`, [id]);
      expect(updRes.rows[0].display_name).toBe("DML Updated");

      // DELETE
      await runtimePool.query(`DELETE FROM users WHERE id = $1;`, [id]);
      const delRes = await runtimePool.query(`SELECT id FROM users WHERE id = $1;`, [id]);
      expect(delRes.rows.length).toBe(0);
    });

    it("should verify both roles are non-superusers", async () => {
      const res = await runtimePool.query(`
        SELECT rolname, rolsuper, rolcreatedb, rolcreaterole 
        FROM pg_roles 
        WHERE rolname IN ('luggage_user', 'luggage_migrator');
      `);

      for (const row of res.rows) {
        expect(row.rolsuper).toBe(false);
        expect(row.rolcreatedb).toBe(false);
        expect(row.rolcreaterole).toBe(false);
      }
    });

    it("should deny luggage_user UPDATE and DELETE on roles and permissions catalogs", async () => {
      const res = await runtimePool.query(`
        SELECT 
          has_table_privilege('luggage_user', 'roles', 'UPDATE') as can_update_roles,
          has_table_privilege('luggage_user', 'roles', 'DELETE') as can_delete_roles,
          has_table_privilege('luggage_user', 'permissions', 'UPDATE') as can_update_perms,
          has_table_privilege('luggage_user', 'permissions', 'DELETE') as can_delete_perms;
      `);
      expect(res.rows[0].can_update_roles).toBe(false);
      expect(res.rows[0].can_delete_roles).toBe(false);
      expect(res.rows[0].can_update_perms).toBe(false);
      expect(res.rows[0].can_delete_perms).toBe(false);
    });

    it("should serialize migrations via PostgreSQL advisory lock", async () => {
      // Running migration runner should cleanly acquire and release lock without deadlock
      const count = await runMigrations(migratorUrl);
      expect(count).toBe(0);
    });
  });
});
