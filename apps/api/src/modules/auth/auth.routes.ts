import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { AppError } from "../../common/errors/app-error.js";
import { authService } from "./auth.service.js";

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * POST /register
   * Registers a new user account with default TRAVELLER role assignment.
   */
  app.post(
    "/register",
    {
      schema: {
        summary: "User Registration",
        description:
          "Registers a new unified user account, securely hashes the password with Argon2id, and assigns the default TRAVELLER role via a restricted database function.",
        tags: ["Authentication"],
        body: {
          type: "object",
          required: ["email", "password", "displayName"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8, maxLength: 128 },
            displayName: { type: "string", minLength: 1, maxLength: 128 },
            phoneNumber: { type: "string", maxLength: 32 },
            role: { type: "string", description: "Ignored by the backend to prevent privilege escalation" }
          }
        },
        response: {
          201: {
            description: "Account created successfully",
            type: "object",
            properties: {
              success: { type: "boolean", enum: [true] },
              data: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  email: { type: "string" },
                  displayName: { type: "string" },
                  status: { type: "string" },
                  isEmailVerified: { type: "boolean" },
                  isPhoneVerified: { type: "boolean" },
                  roles: { type: "array", items: { type: "string" } },
                  createdAt: { type: "string" }
                }
              },
              meta: {
                type: "object",
                properties: {
                  timestamp: { type: "string" },
                  correlationId: { type: "string" }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const parseResult = RegisterRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: "VALIDATION_ERROR"
        }));
        throw AppError.validation("Validation failed", details);
      }

      const clientInfo = {
        ip: request.ip,
        userAgent: request.headers["user-agent"]
      };

      const result = await authService.register(parseResult.data, clientInfo);

      return reply
        .status(201)
        .send(createSuccessResponse(result, request.id));
    }
  );

  /**
   * POST /login
   * Authenticates a user with email and password.
   */
  app.post(
    "/login",
    {
      schema: {
        summary: "User Login",
        description:
          "Authenticates user credentials using Argon2id password verification, enforces account state restrictions, and updates the last login timestamp.",
        tags: ["Authentication"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 }
          }
        },
        response: {
          200: {
            description: "Authentication successful",
            type: "object",
            properties: {
              success: { type: "boolean", enum: [true] },
              data: {
                type: "object",
                properties: {
                  user: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      email: { type: "string" },
                      displayName: { type: "string" },
                      status: { type: "string" },
                      isEmailVerified: { type: "boolean" },
                      isPhoneVerified: { type: "boolean" },
                      roles: { type: "array", items: { type: "string" } },
                      lastLoginAt: { type: "string", nullable: true }
                    }
                  }
                }
              },
              meta: {
                type: "object",
                properties: {
                  timestamp: { type: "string" },
                  correlationId: { type: "string" }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const parseResult = LoginRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        const details = parseResult.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: "VALIDATION_ERROR"
        }));
        throw AppError.validation("Validation failed", details);
      }

      const clientInfo = {
        ip: request.ip,
        userAgent: request.headers["user-agent"]
      };

      const result = await authService.login(parseResult.data, clientInfo);

      return reply
        .status(200)
        .send(createSuccessResponse(result, request.id));
    }
  );
};
