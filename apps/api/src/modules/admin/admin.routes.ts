import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  AdminUserQuerySchema,
  AdminAuditEventQuerySchema,
  AdminSuspendUserRequestSchema,
  AdminReinstateUserRequestSchema,
  AdminDeactivateUserRequestSchema,
  AdminReactivateUserRequestSchema,
  AdminVerifyEmailRequestSchema,
  AssignUserRoleRequestSchema,
  createPaginatedResponse,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { adminService } from "./admin.service.js";
import { rbacService } from "../auth/rbac.service.js";
import { auditService } from "../audit/audit.service.js";
import { AppError } from "../../common/errors/app-error.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUserId(userId: string): string {
  if (!UUID_REGEX.test(userId)) {
    throw AppError.badRequest("Invalid user ID format: must be a valid UUID");
  }
  return userId;
}

function getClientInfo(request: FastifyRequest) {
  return {
    ip: request.ip,
    userAgent: request.headers["user-agent"] as string | undefined,
    correlationId: (request.headers["x-correlation-id"] as string) || request.id
  };
}

export const adminRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // ============================================================================
  // 1. List Users (Paginated & Filterable)
  // ============================================================================
  app.get(
    "/users",
    {
      onRequest: [app.authenticate, app.requirePermission("admin.user.read")],
      schema: {
        tags: ["Admin"],
        summary: "List users with pagination, status filtering, and search",
        description: "Requires admin.user.read permission.",
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
      onRequest: [app.authenticate, app.requirePermission("admin.user.read")],
      schema: {
        tags: ["Admin"],
        summary: "Inspect comprehensive user details and profile context",
        description: "Requires admin.user.read permission. Never exposes password hashes.",
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
      onRequest: [app.authenticate, app.requirePermission("admin.user.suspend")],
      schema: {
        tags: ["Admin"],
        summary: "Suspend a user account and immediately revoke all active sessions",
        description:
          "Requires admin.user.suspend permission. Revokes all active sessions immediately.",
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
          clientInfo: getClientInfo(request)
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
      onRequest: [app.authenticate, app.requirePermission("admin.user.reinstate")],
      schema: {
        tags: ["Admin"],
        summary: "Reinstate a suspended user account back to ACTIVE",
        description:
          "Requires admin.user.reinstate permission. Does not restore previously revoked sessions.",
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
          clientInfo: getClientInfo(request)
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
      onRequest: [app.authenticate, app.requirePermission("admin.user.deactivate")],
      schema: {
        tags: ["Admin"],
        summary: "Deactivate a user account and revoke active sessions",
        description: "Requires admin.user.deactivate permission.",
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
          clientInfo: getClientInfo(request)
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
      onRequest: [app.authenticate, app.requirePermission("admin.user.reactivate")],
      schema: {
        tags: ["Admin"],
        summary: "Reactivate a deactivated user account back to ACTIVE",
        description: "Requires admin.user.reactivate permission.",
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
          clientInfo: getClientInfo(request)
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
      onRequest: [app.authenticate, app.requirePermission("admin.user.verify_email")],
      schema: {
        tags: ["Admin"],
        summary: "Override and verify a user's email address by administrative action",
        description: "Requires admin.user.verify_email permission.",
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
          clientInfo: getClientInfo(request)
        },
        parseResult.data
      );

      return createSuccessResponse(result, request.id);
    }
  );

  // ============================================================================
  // 8. List Roles and Mappings (GET /roles)
  // ============================================================================
  app.get(
    "/roles",
    {
      onRequest: [app.authenticate, app.requirePermission("admin.role.read")],
      schema: {
        tags: ["Admin"],
        summary: "List all system roles and their assigned permission catalogue codes",
        description: "Requires admin.role.read permission.",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request) => {
      const roles = await rbacService.listRoles();
      return createSuccessResponse(roles, request.id);
    }
  );

  // ============================================================================
  // 9. List Permission Catalogue (GET /permissions)
  // ============================================================================
  app.get(
    "/permissions",
    {
      onRequest: [app.authenticate, app.requirePermission("admin.permission.read")],
      schema: {
        tags: ["Admin"],
        summary: "List the system permission catalogue",
        description: "Requires admin.permission.read permission.",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request) => {
      const permissions = await rbacService.listPermissions();
      return createSuccessResponse(permissions, request.id);
    }
  );

  // ============================================================================
  // 10. Inspect User Effective Permissions (GET /users/:userId/permissions)
  // ============================================================================
  app.get<{ Params: { userId: string } }>(
    "/users/:userId/permissions",
    {
      onRequest: [app.authenticate, app.requirePermission("admin.role.read")],
      schema: {
        tags: ["Admin"],
        summary: "Inspect effective permissions and assigned roles for a user",
        description: "Requires admin.role.read permission.",
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
      const roles = await rbacService.getUserRoles(userId);
      const permissions = await rbacService.getEffectivePermissions(userId);

      return createSuccessResponse(
        {
          userId,
          roles,
          permissions
        },
        request.id
      );
    }
  );

  // ============================================================================
  // 11. Assign Role to User (POST /users/:userId/roles)
  // ============================================================================
  app.post<{ Params: { userId: string } }>(
    "/users/:userId/roles",
    {
      onRequest: [app.authenticate, app.requirePermission("admin.role.assign")],
      schema: {
        tags: ["Admin"],
        summary: "Assign a system role to a user account",
        description:
          "Requires admin.role.assign permission. Only Superadmin can grant administrative roles.",
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
          required: ["roleCode"],
          properties: {
            roleCode: { type: "string", minLength: 1, maxLength: 32 }
          }
        }
      }
    },
    async (request) => {
      const userId = validateUserId(request.params.userId);
      const parseResult = AssignUserRoleRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
          code: "VALIDATION_ERROR"
        }));
        throw AppError.validation("Validation failed", details);
      }

      const updatedRoles = await rbacService.assignRole({
        adminId: request.user.sub,
        adminRoles: request.user.roles,
        targetUserId: userId,
        roleCode: parseResult.data.roleCode,
        clientInfo: getClientInfo(request)
      });

      return createSuccessResponse(
        {
          userId,
          roles: updatedRoles,
          message: `Role ${parseResult.data.roleCode.toUpperCase()} assigned successfully`
        },
        request.id
      );
    }
  );

  // ============================================================================
  // 12. Revoke Role from User (DELETE /users/:userId/roles/:roleCode)
  // ============================================================================
  app.delete<{ Params: { userId: string; roleCode: string } }>(
    "/users/:userId/roles/:roleCode",
    {
      onRequest: [app.authenticate, app.requirePermission("admin.role.revoke")],
      schema: {
        tags: ["Admin"],
        summary: "Revoke an assigned system role from a user account",
        description:
          "Requires admin.role.revoke permission. Only Superadmin can revoke Superadmin role.",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["userId", "roleCode"],
          properties: {
            userId: { type: "string", format: "uuid" },
            roleCode: { type: "string", minLength: 1, maxLength: 32 }
          }
        }
      }
    },
    async (request) => {
      const userId = validateUserId(request.params.userId);
      const roleCode = request.params.roleCode;

      const updatedRoles = await rbacService.revokeRole({
        adminId: request.user.sub,
        adminRoles: request.user.roles,
        targetUserId: userId,
        roleCode,
        clientInfo: getClientInfo(request)
      });

      return createSuccessResponse(
        {
          userId,
          roles: updatedRoles,
          message: `Role ${roleCode.toUpperCase()} revoked successfully`
        },
        request.id
      );
    }
  );

  // ============================================================================
  // 13. List Security Audit Events (GET /audit-events)
  // ============================================================================
  app.get(
    "/audit-events",
    {
      onRequest: [app.authenticate, app.requirePermission("admin.audit.read")],
      schema: {
        tags: ["Admin"],
        summary: "List immutable security audit events with pagination and filtering",
        description: "Requires admin.audit.read permission (SUPERADMIN only).",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            eventType: { type: "string" },
            userId: { type: "string", format: "uuid" },
            from: { type: "string", format: "date-time" },
            to: { type: "string", format: "date-time" }
          }
        }
      }
    },
    async (request) => {
      const parseResult = AdminAuditEventQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
          code: "VALIDATION_ERROR"
        }));
        throw AppError.validation("Invalid audit query parameters", details);
      }

      const { items, total } = await auditService.listAuditEvents(parseResult.data);
      const page = parseResult.data.page ?? 1;
      const limit = parseResult.data.limit ?? 20;

      return createPaginatedResponse(items, page, limit, total, request.id);
    }
  );

  // ============================================================================
  // 14. Get Single Security Audit Event Detail (GET /audit-events/:eventId)
  // ============================================================================
  app.get<{ Params: { eventId: string } }>(
    "/audit-events/:eventId",
    {
      onRequest: [app.authenticate, app.requirePermission("admin.audit.read")],
      schema: {
        tags: ["Admin"],
        summary: "Inspect a single security audit event by ID",
        description: "Requires admin.audit.read permission (SUPERADMIN only).",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["eventId"],
          properties: {
            eventId: { type: "string", format: "uuid" }
          }
        }
      }
    },
    async (request) => {
      const eventId = request.params.eventId;
      if (!UUID_REGEX.test(eventId)) {
        throw AppError.badRequest("Invalid audit event ID format: must be a valid UUID");
      }

      const event = await auditService.getEventById(eventId);
      if (!event) {
        throw AppError.notFound("Security audit event not found");
      }

      return createSuccessResponse(
        {
          event: {
            id: event.id,
            userId: event.userId,
            eventType: event.eventType,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            metadata: (event.metadata as Record<string, unknown>) ?? {},
            createdAt: event.createdAt.toISOString()
          }
        },
        request.id
      );
    }
  );
};
