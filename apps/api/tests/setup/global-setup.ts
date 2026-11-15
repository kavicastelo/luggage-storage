/**
 * Vitest globalSetup hook for @luggage-storage/api.
 * Clears any legacy PAYHERE_MERCHANT_SECRET inherited from a developer's local .env
 * before env validation executes, then guarantees that all Drizzle SQL migrations and
 * schema verification checks complete deterministically under luggage_migrator.
 */
export async function setup(): Promise<void> {
  process.env.PAYMENT_PROVIDER = "sandbox";
  process.env.PAYHERE_MERCHANT_SECRET = "";
  const { runMigrations } = await import("../../src/infrastructure/database/migrate.js");
  await runMigrations();
}
