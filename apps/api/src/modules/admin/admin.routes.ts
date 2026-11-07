import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  AdminUserQuerySchema,
  AdminSuspendUserRequestSchema,
  AdminReinstateUserRequestSchema,
  AdminDeactivateUserRequestSchema,
  AdminReactivateUserRequestSchema,
  AdminVerifyEmailRequestSchema,
  createPaginatedResponse,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { adminService } from "./admin.service.js";
import { AppError } from "../../common/errors/app-error.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUserId(userId: string): string {
  if (!UUID_REGEX.test(userId)) {
    throw AppError.badRequest("Invalid user ID format: must be a valid UUID");
  }
  return userId;
}

export const adminRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ============================================================================
  // 1. List Users (Paginated & Filterable)
  // ============================================================================
  app.get(
    "/users",
    {
      onRequest: [app.authenticate, app.requireAdmin],
      schema: {
        tags: ["Admin"],
        summary: "List users with pagination, status filtering, and search",
        description: "Requires administrative privileges (SUPERADMIN or SUPPORT).",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            status: {
              type: "string",
              enum: ["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DEACTIVATED"]
            },
            search: { type: "string" },
            role: { type: "string" }
          }
        }
      }
    },
    async (request) => {
      const parseResult = AdminUserQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
          code: "VALIDATION_ERROR"
        }));
        throw AppError.validation("Invalid query parameters", details);
      }

      const { users, total } = await adminService.listUsers(parseResult.data);
      const page = parseResult.data.page ?? 1;
      const limit = parseResult.data.limit ?? 20;

      return createPaginatedResponse(users, page, limit, total, request.id);
    }
  );

  // ============================================================================
  // 2. Get User Detail
  // ============================================================================
  app.get<{ Params: { userId: string } }>(
    "/users/:userId",
    {
      onRequest: [app.authenticate, app.requireAdmin],
      schema: {
        tags: ["Admin"],
        summary: "Inspect comprehensive user details and profile context",
        description: "Requires administrative privileges. Never exposes password hashes.",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request) => {
      const userId = validateUserId(request.params.userId);
      const user = await adminService.getUserById(userId);
      return createSuccessResponse(user, request.id);
    }
  );

  // ============================================================================
  // 3. Suspend User Account
  // ============================================================================
  app.post<{ Params: { userId: string } }>(
    "/users/:userId/suspend",
    {
      onRequest: [app.authenticate, app.requireAdmin],
      schema: {
        tags: ["Admin"],
        summary: "Suspend a user account and immediately revoke all active sessions",
        description:
          "Requires administrative privileges. Revokes all active refresh sessions and prevents authentication.",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string", format: "uuid" }
          }
        },
        body: {
          type: "object",
          required: ["reason"],
          properties: {
            reason: { type: "string", minLength: 3, maxLength: 255 }
          }
        }
      }
    },
    async (request) => {
      const userId = validateUserId(request.params.userId);
      const parseResult = AdminSuspendUserRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
          code: "VALIDATION_ERROR"
        }));
        throw AppError.validation("Validation failed", details);
      }

      const result = await adminService.suspendUser(
        {
          adminId: request.user.sub,
          adminRoles: request.user.roles,
          targetUserId: userId,
          clientInfo: {
            ip: request.ip,
            userAgent: request.headers["user-agent"]
          }
        },
        parseResult.data
      );

      return createSuccessResponse(result, request.id);
    }
  );

  // ============================================================================
  // 4. Reinstate Suspended User Account
  // ============================================================================
  app.post<{ Params: { userId: string } }>(
    "/users/:userId/reinstate",
    {
      onRequest: [app.authenticate, app.requireAdmin],
      schema: {
        tags: ["Admin"],
        summary: "Reinstate a suspended user account back to ACTIVE",
        description:
          "Requires administrative privileges. Does not restore previously revoked sessions.",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request) => {
      const userId = validateUserId(request.params.userId);
      const parseResult = AdminReinstateUserRequestSchema.safeParse(request.body || {});
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
          code: "VALIDATION_ERROR"
        }));
        throw AppError.validation("Validation failed", details);
      }

      const result = await adminService.reinstateUser(
        {
          adminId: request.user.sub,
          adminRoles: request.user.roles,
          targetUserId: userId,
          clientInfo: {
            ip: request.ip,
            userAgent: request.headers["user-agent"]
          }
        },
        parseResult.data
      );

      return createSuccessResponse(result, request.id);
    }
  );

  // ============================================================================
  // 5. Deactivate User Account
  // ============================================================================
  app.post<{ Params: { userId: string } }>(
    "/users/:userId/deactivate",
    {
      onRequest: [app.authenticate, app.requireAdmin],
      schema: {
        tags: ["Admin"],
        summary: "Deactivate a user account and revoke active sessions",
        description: "Requires administrative privileges. Transitions account to DEACTIVATED.",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string", format: "uuid" }
          }
        },
        body: {
          type: "object",
          required: ["reason"],
          properties: {
            reason: { type: "string", minLength: 3, maxLength: 255 }
          }
        }
      }
    },
    async (request) => {
      const userId = validateUserId(request.params.userId);
      const parseResult = AdminDeactivateUserRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
          code: "VALIDATION_ERROR"
        }));
        throw AppError.validation("Validation failed", details);
      }

      const result = await adminService.deactivateUser(
        {
          adminId: request.user.sub,
          adminRoles: request.user.roles,
          targetUserId: userId,
          clientInfo: {
            ip: request.ip,
            userAgent: request.headers["user-agent"]
          }
        },
        parseResult.data
      );

      return createSuccessResponse(result, request.id);
    }
  );

  // ============================================================================
  // 6. Reactivate Deactivated User Account
  // ============================================================================
  app.post<{ Params: { userId: string } }>(
    "/users/:userId/reactivate",
    {
      onRequest: [app.authenticate, app.requireAdmin],
      schema: {
        tags: ["Admin"],
        summary: "Reactivate a deactivated user account back to ACTIVE",
        description: "Requires administrative privileges. Transitions account to ACTIVE.",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request) => {
      const userId = validateUserId(request.params.userId);
      const parseResult = AdminReactivateUserRequestSchema.safeParse(request.body || {});
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
          code: "VALIDATION_ERROR"
        }));
        throw AppError.validation("Validation failed", details);
      }

      const result = await adminService.reactivateUser(
        {
          adminId: request.user.sub,
          adminRoles: request.user.roles,
          targetUserId: userId,
          clientInfo: {
            ip: request.ip,
            userAgent: request.headers["user-agent"]
          }
        },
        parseResult.data
      );

      return createSuccessResponse(result, request.id);
    }
  );

  // ============================================================================
  // 7. Verify User Email (Administrative Override)
  // ============================================================================
  app.post<{ Params: { userId: string } }>(
    "/users/:userId/verify-email",
    {
      onRequest: [app.authenticate, app.requireAdmin],
      schema: {
        tags: ["Admin"],
        summary: "Override and verify a user's email address by administrative action",
        description:
          "Requires administrative privileges. Transitions PENDING_VERIFICATION to ACTIVE.",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request) => {
      const userId = validateUserId(request.params.userId);
      const parseResult = AdminVerifyEmailRequestSchema.safeParse(request.body || {});
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
          code: "VALIDATION_ERROR"
        }));
        throw AppError.validation("Validation failed", details);
      }

      const result = await adminService.verifyUserEmail(
        {
          adminId: request.user.sub,
          adminRoles: request.user.roles,
          targetUserId: userId,
          clientInfo: {
            ip: request.ip,
            userAgent: request.headers["user-agent"]
          }
        },
        parseResult.data
      );

      return createSuccessResponse(result, request.id);
    }
  );
};
