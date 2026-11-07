import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./infrastructure/logging/logger.js";
import { dbPool } from "./infrastructure/database/connection.js";

async function main() {
  const app = buildApp();

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    try {
      await app.close();
      await dbPool.end();
      logger.info("Server and database connections successfully closed.");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during graceful shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`Server listening at http://${env.HOST}:${env.PORT}`);
    logger.info(`OpenAPI documentation available at http://${env.HOST}:${env.PORT}/docs`);
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

main();
