import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./common/middleware/error-handler.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";

export function buildApp(): FastifyInstance {
  const app = fastify({
    genReqId: (req) => (req.headers["x-correlation-id"] as string) || randomUUID(),
    logger: {
      level: env.LOG_LEVEL
    }
  });

  // Security plugins
  app.register(helmet, { contentSecurityPolicy: env.NODE_ENV === "production" });
  app.register(cors, {
    origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(",")
  });
  app.register(sensible);

  // Error Handler
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  // OpenAPI Swagger Documentation
  app.register(swagger, {
    openapi: {
      info: {
        title: "Global Luggage Storage Marketplace API",
        description: "Modular Monolith Backend API for Traveller, Host, and Administration surfaces",
        version: "0.1.0"
      },
      servers: [
        {
          url: `http://${env.HOST}:${env.PORT}`,
          description: "Local Development Server"
        }
      ]
    }
  });

  app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false
    }
  });

  // Routes
  app.register(healthRoutes, { prefix: env.API_PREFIX });
  // Also register /health at root for container orchestration liveness
  app.register(healthRoutes);

  // Authentication routes (versioned and unversioned aliases)
  app.register(authRoutes, { prefix: `${env.API_PREFIX}/auth` });
  app.register(authRoutes, { prefix: "/auth" });

  return app;
}
