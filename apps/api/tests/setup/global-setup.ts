import { runMigrations } from "../../src/infrastructure/database/migrate.js";

/**
 * Vitest globalSetup hook for @luggage-storage/api.
 * Guarantees that all Drizzle SQL migrations and schema verification checks
 * complete deterministically under luggage_migrator before any test suite executes.
 */
export async function setup(): Promise<void> {
  await runMigrations();
}
