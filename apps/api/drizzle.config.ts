import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infrastructure/database/schema/index.ts",
  out: "./src/infrastructure/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.MIGRATION_DATABASE_URL ||
      process.env.DATABASE_URL ||
      "postgresql://luggage_migrator:migrator_password@localhost:5432/luggage_storage_dev"
  }
});

