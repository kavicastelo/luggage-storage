import pg from "pg";
import { normalizeEmail } from "@luggage-storage/contracts";
import { env } from "../src/config/env.js";
import { argon2Service } from "../src/modules/auth/argon2.service.js";

const { Pool } = pg;

async function main() {
  const [command, arg1, arg2, arg3, arg4] = process.argv.slice(2);
  if (!command || !arg1) {
    console.error("Usage: e2e-db-helper.ts <command> <arg1> [arg2] [arg3] [arg4]");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: env.MIGRATION_DATABASE_URL,
    max: 2
  });

  try {
    if (command === "create-user") {
      const email = arg1;
      const password = arg2 || "StrongPassword123!";
      const displayName = arg3
        ? Buffer.from(arg3, "base64").toString("utf8")
        : "E2E Test User";
      const roleCode = arg4 || "TRAVELLER";
      const passwordHash = await argon2Service.hashPassword(password);
      const normEmail = normalizeEmail(email);

      const userRes = await pool.query(
        `INSERT INTO users (email, normalized_email, password_hash, display_name, status, is_email_verified, email_verified_at)
         VALUES ($1, $2, $3, $4, 'ACTIVE', true, NOW())
         RETURNING id;`,
        [email, normEmail, passwordHash, displayName]
      );
      const userId = userRes.rows[0].id as string;

      const travellerRole = await pool.query(
        "SELECT id FROM roles WHERE code = 'TRAVELLER' LIMIT 1;"
      );
      if (travellerRole.rows.length > 0) {
        await pool.query(
          "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
          [userId, travellerRole.rows[0].id]
        );
      }

      if (roleCode !== "TRAVELLER") {
        const roleRes = await pool.query("SELECT id FROM roles WHERE code = $1 LIMIT 1;", [
          roleCode
        ]);
        if (roleRes.rows.length > 0) {
          await pool.query(
            "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
            [userId, roleRes.rows[0].id]
          );
        }
      }

      await pool.query("DELETE FROM auth_rate_limits;");
      console.log(JSON.stringify({ userId }));
    } else if (command === "activate-user") {
      const userId = arg1;
      const roleCode = arg2;
      await pool.query(
        "UPDATE users SET status = 'ACTIVE', is_email_verified = true WHERE id = $1;",
        [userId]
      );
      if (roleCode && roleCode !== "TRAVELLER") {
        const roleRes = await pool.query("SELECT id FROM roles WHERE code = $1 LIMIT 1;", [
          roleCode
        ]);
        if (roleRes.rows.length > 0) {
          await pool.query(
            "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
            [userId, roleRes.rows[0].id]
          );
        }
      }
    } else if (command === "approve-business") {
      await pool.query("UPDATE host_businesses SET status = 'ACTIVE' WHERE id = $1;", [arg1]);
    } else if (command === "approve-location") {
      await pool.query("UPDATE storage_locations SET status = 'ACTIVE' WHERE id = $1;", [arg1]);
    } else if (command === "disable-location") {
      await pool.query("UPDATE storage_locations SET status = 'DISABLED' WHERE id = $1;", [arg1]);
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
