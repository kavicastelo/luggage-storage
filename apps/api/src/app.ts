import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { randomUUID } from "node:crypto";
import { env, parseAllowedCorsOrigins } from "./config/env.js";
import { AppError } from "./common/errors/app-error.js";
import { errorHandler, notFoundHandler } from "./common/middleware/error-handler.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { sessionService } from "./modules/auth/session.service.js";
import { rbacService } from "./modules/auth/rbac.service.js";
import { auditService, SecurityEventType } from "./modules/audit/audit.service.js";

export function isCorsOriginAllowed(
  requestOrigin: string | undefined,
  allowedOrigins: string[],
  nodeEnv: "development" | "test" | "production"
): boolean {
  // Non-browser requests (server-to-server, native mobile apps, CLI) have no Origin header
  if (!requestOrigin) {
    return true;
  }

  // Wildcard is never allowed when credentials: true in production
  if (nodeEnv === "production") {
    return allowedOrigins.some((allowed) => allowed !== "*" && allowed === requestOrigin);
  }

  if (allowedOrigins.includes("*")) {
    return true;
  }

  if (allowedOrigins.includes(requestOrigin)) {
    return true;
  }

  // Allow localhost / 127.0.0.1 in development and test
  if (
    requestOrigin.startsWith("http://localhost:") ||
    requestOrigin.startsWith("http://127.0.0.1:")
  ) {
    return true;
  }

  return false;
}

export function buildApp(): FastifyInstance {
  const app = fastify({
    genReqId: (req) => (req.headers["x-correlation-id"] as string) || randomUUID(),
    logger: {
      level: env.LOG_LEVEL
    }
  });

  const allowedOrigins = parseAllowedCorsOrigins(env.CORS_ORIGIN);

  // Security plugins
  app.register(helmet, { contentSecurityPolicy: env.NODE_ENV === "production" });
  app.register(cors, {
    origin: (origin, cb) => {
      if (isCorsOriginAllowed(origin, allowedOrigins, env.NODE_ENV)) {
        cb(null, origin || true);
      } else {
        cb(null, false);
      }
    },
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
        await auditService.recordEvent({
          eventType: SecurityEventType.AUTH_ACCESS_DENIED,
          userId: request.user.sub || null,
          clientInfo: {
            ip: request.ip,
            userAgent: request.headers["user-agent"] as string,
            correlationId: (request.headers["x-correlation-id"] as string) || request.id
          },
          metadata: {
            path: request.url,
            method: request.method,
            reason: "INSUFFICIENT_ROLE",
            allowedRoles,
            roles: request.user.roles
          }
        });
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
      await auditService.recordEvent({
        eventType: SecurityEventType.AUTH_ACCESS_DENIED,
        userId: request.user.sub || null,
        clientInfo: {
          ip: request.ip,
          userAgent: request.headers["user-agent"] as string,
          correlationId: (request.headers["x-correlation-id"] as string) || request.id
        },
        metadata: {
          path: request.url,
          method: request.method,
          reason: "ADMIN_REQUIRED",
          roles: request.user.roles
        }
      });
      throw AppError.forbidden("Administrative privileges required");
    }
  });

  // Permission-based authorization decorator factory (single required permission)
  app.decorate("requirePermission", (permission: string) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.user || !request.user.sub) {
        throw AppError.unauthorized("Authentication required");
      }

      const hasPerm = await rbacService.hasPermission(request.user.sub, permission);
      if (!hasPerm) {
        await auditService.recordEvent({
          eventType: SecurityEventType.AUTH_ACCESS_DENIED,
          userId: request.user.sub,
          clientInfo: {
            ip: request.ip,
            userAgent: request.headers["user-agent"] as string,
            correlationId: (request.headers["x-correlation-id"] as string) || request.id
          },
          metadata: {
            path: request.url,
            method: request.method,
            reason: "MISSING_PERMISSION",
            requiredPermission: permission,
            roles: request.user.roles || []
          }
        });
        throw AppError.forbidden(`Access denied: missing required permission: ${permission}`);
      }
    };
  });

  // Permission-based authorization decorator factory (any of the required permissions)
  app.decorate("requireAnyPermission", (permissions: string[]) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.user || !request.user.sub) {
        throw AppError.unauthorized("Authentication required");
      }

      const hasPerm = await rbacService.hasAnyPermission(request.user.sub, permissions);
      if (!hasPerm) {
        await auditService.recordEvent({
          eventType: SecurityEventType.AUTH_ACCESS_DENIED,
          userId: request.user.sub,
          clientInfo: {
            ip: request.ip,
            userAgent: request.headers["user-agent"] as string,
            correlationId: (request.headers["x-correlation-id"] as string) || request.id
          },
          metadata: {
            path: request.url,
            method: request.method,
            reason: "MISSING_ANY_PERMISSION",
            requiredPermissions: permissions,
            roles: request.user.roles || []
          }
        });
        throw AppError.forbidden("Access denied: insufficient permissions");
      }
    };
  });

  // Permission-based authorization decorator factory (all of the required permissions)
  app.decorate("requireAllPermissions", (permissions: string[]) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.user || !request.user.sub) {
        throw AppError.unauthorized("Authentication required");
      }

      const hasPerm = await rbacService.hasAllPermissions(request.user.sub, permissions);
      if (!hasPerm) {
        await auditService.recordEvent({
          eventType: SecurityEventType.AUTH_ACCESS_DENIED,
          userId: request.user.sub,
          clientInfo: {
            ip: request.ip,
            userAgent: request.headers["user-agent"] as string,
            correlationId: (request.headers["x-correlation-id"] as string) || request.id
          },
          metadata: {
            path: request.url,
            method: request.method,
            reason: "MISSING_ALL_PERMISSIONS",
            requiredPermissions: permissions,
            roles: request.user.roles || []
          }
        });
        throw AppError.forbidden("Access denied: insufficient permissions");
      }
    };
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
