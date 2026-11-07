import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import { AppError } from "./common/errors/app-error.js";
import { errorHandler, notFoundHandler } from "./common/middleware/error-handler.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { sessionService } from "./modules/auth/session.service.js";

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
    origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(","),
    credentials: true
  });
  app.register(sensible);

  // Cookie and JWT plugins
  app.register(fastifyCookie, {
    secret: env.COOKIE_SECRET
  });

  app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_ACCESS_EXPIRATION,
      iss: "luggage-storage-api",
      aud: "luggage-storage-app"
    },
    verify: {
      allowedIss: "luggage-storage-api",
      allowedAud: "luggage-storage-app"
    }
  });

  // Authentication Decorator for protected routes
  app.decorate("authenticate", async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      throw AppError.unauthorized("Authentication required: invalid or expired access token");
    }

    if (!request.user || !request.user.sessionId) {
      throw AppError.unauthorized("Invalid access token claims");
    }

    // Verify session validity in database
    const isActive = await sessionService.isSessionActive(request.user.sessionId);
    if (!isActive) {
      throw AppError.unauthorized("Session has been revoked or expired");
    }
  });

  // Role-based authorization decorator factory
  app.decorate("requireRoles", (allowedRoles: string[]) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.user || !Array.isArray(request.user.roles)) {
        throw AppError.unauthorized("Authentication required");
      }

      const hasRole = request.user.roles.some((role) => allowedRoles.includes(role));
      if (!hasRole) {
        throw AppError.forbidden("Access denied: insufficient permissions");
      }
    };
  });

  // Admin authorization decorator (SUPERADMIN or SUPPORT)
  app.decorate("requireAdmin", async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user || !Array.isArray(request.user.roles)) {
      throw AppError.unauthorized("Authentication required");
    }

    const isAdmin = request.user.roles.some((role) =>
      ["SUPERADMIN", "SUPPORT"].includes(role)
    );
    if (!isAdmin) {
      throw AppError.forbidden("Administrative privileges required");
    }
  });

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

  // Administration routes (versioned and unversioned aliases)
  app.register(adminRoutes, { prefix: `${env.API_PREFIX}/admin` });
  app.register(adminRoutes, { prefix: "/admin" });

  return app;
}
