import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  RefreshRequestSchema,
  ChangePasswordRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  LoginResponseData,
  RefreshResponseData,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import { authService } from "./auth.service.js";
import { sessionService } from "./session.service.js";
import { passwordService } from "./password.service.js";

const UuidParamSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID format")
});

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * Helper to determine secure cookie settings based on environment
   */
  const getCookieConfig = (requestUrl: string) => {
    const isSecure = env.COOKIE_SECURE ?? (env.NODE_ENV === "production");
    const cookiePath =
      requestUrl.startsWith("/auth") && !requestUrl.startsWith("/api/v1")
        ? "/"
        : "/api/v1/auth";
    const maxAge = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
    return { isSecure, cookiePath, maxAge };
  };

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
   * Authenticates user, creates session, issues JWT access token, and provides refresh token via cookie/body.
   */
  app.post(
    "/login",
    {
      schema: {
        summary: "User Login",
        description:
          "Authenticates user credentials using Argon2id, creates an auth session, issues a 15-minute access token, and sets an HTTP-only refresh cookie for Web clients or returns it in body for Mobile.",
        tags: ["Authentication"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
            clientType: { type: "string", enum: ["WEB", "MOBILE"] }
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
                  },
                  accessToken: { type: "string" },
                  refreshToken: { type: "string" },
                  expiresIn: { type: "number" },
                  tokenType: { type: "string" }
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

      // Sign JWT access token
      const accessToken = app.jwt.sign({
        sub: result.user.id,
        sessionId: result.session.id,
        email: result.user.email,
        roles: result.user.roles,
        jti: randomUUID()
      });

      const clientType = parseResult.data.clientType || "WEB";
      const isMobile = clientType === "MOBILE";
      const { isSecure, cookiePath, maxAge } = getCookieConfig(request.url);

      if (!isMobile) {
        reply.setCookie("refresh_token", result.rawRefreshToken, {
          httpOnly: true,
          secure: isSecure,
          sameSite: "strict",
          path: cookiePath,
          maxAge
        });
      }

      const responseData: LoginResponseData = {
        user: result.user,
        accessToken,
        expiresIn: 900,
        tokenType: "Bearer",
        ...(isMobile ? { refreshToken: result.rawRefreshToken } : {})
      };

      return reply
        .status(200)
        .send(createSuccessResponse(responseData, request.id));
    }
  );

  /**
   * POST /refresh
   * Rotates the refresh token atomically, verifies against reuse, and issues new credentials.
   */
  app.post(
    "/refresh",
    {
      schema: {
        summary: "Refresh Access Token",
        description:
          "Rotates the refresh token atomically under database row-level locking. Detects reuse of previously rotated tokens, immediately revoking compromised session families.",
        tags: ["Authentication"],
        response: {
          200: {
            description: "Token refreshed successfully",
            type: "object",
            properties: {
              success: { type: "boolean", enum: [true] },
              data: {
                type: "object",
                properties: {
                  accessToken: { type: "string" },
                  refreshToken: { type: "string" },
                  expiresIn: { type: "number" },
                  tokenType: { type: "string" }
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
      const bodyData =
        request.body && typeof request.body === "object" ? request.body : {};
      const parseResult = RefreshRequestSchema.safeParse(bodyData);
      const cookieToken = request.cookies.refresh_token;
      const bodyToken = parseResult.success ? parseResult.data.refreshToken : undefined;
      const rawRefreshToken = cookieToken || bodyToken;

      if (!rawRefreshToken) {
        throw AppError.unauthorized("Refresh token is required");
      }

      const clientInfo = {
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"]
      };

      const rotateResult = await sessionService.rotateRefreshToken({
        rawRefreshToken,
        clientInfo
      });

      // Sign new JWT access token
      const accessToken = app.jwt.sign({
        sub: rotateResult.user.id,
        sessionId: rotateResult.session.id,
        email: rotateResult.user.email,
        roles: rotateResult.user.roles,
        jti: randomUUID()
      });

      const isMobile =
        rotateResult.session.clientType === "MOBILE" ||
        (!cookieToken && Boolean(bodyToken));

      const { isSecure, cookiePath, maxAge } = getCookieConfig(request.url);

      if (!isMobile) {
        reply.setCookie("refresh_token", rotateResult.newRawRefreshToken, {
          httpOnly: true,
          secure: isSecure,
          sameSite: "strict",
          path: cookiePath,
          maxAge
        });
      }

      const responseData: RefreshResponseData = {
        accessToken,
        expiresIn: 900,
        tokenType: "Bearer",
        ...(isMobile ? { refreshToken: rotateResult.newRawRefreshToken } : {})
      };

      return reply
        .status(200)
        .send(createSuccessResponse(responseData, request.id));
    }
  );

  /**
   * POST /logout
   * Logs out current session, revokes refresh token, and clears cookies.
   */
  app.post(
    "/logout",
    {
      schema: {
        summary: "User Logout",
        description:
          "Revokes the current authentication session in the database and clears the refresh token cookie.",
        tags: ["Authentication"],
        response: {
          200: {
            description: "Logged out successfully",
            type: "object",
            properties: {
              success: { type: "boolean", enum: [true] },
              data: {
                type: "object",
                properties: {
                  message: { type: "string" }
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
      const bodyData =
        request.body && typeof request.body === "object"
          ? (request.body as { refreshToken?: string })
          : undefined;
      const rawRefreshToken =
        request.cookies.refresh_token || bodyData?.refreshToken;

      let sessionId: string | undefined = undefined;

      // Extract sessionId from bearer token if present
      if (request.headers.authorization?.startsWith("Bearer ")) {
        try {
          const token = request.headers.authorization.slice(7);
          const decoded = app.jwt.decode<{ sessionId?: string }>(token);
          if (decoded?.sessionId) {
            sessionId = decoded.sessionId;
          }
        } catch {
          // Ignore decode errors on logout
        }
      }

      await sessionService.logout({
        rawRefreshToken,
        sessionId,
        clientInfo: {
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"]
        }
      });

      // Clear cookie for all possible paths
      reply.clearCookie("refresh_token", { path: "/api/v1/auth" });
      reply.clearCookie("refresh_token", { path: "/" });

      return reply
        .status(200)
        .send(createSuccessResponse({ message: "Logged out successfully" }, request.id));
    }
  );

  /**
   * POST /logout-all
   * Revokes all active sessions for the authenticated user across all devices.
   */
  app.post(
    "/logout-all",
    {
      onRequest: [app.authenticate],
      schema: {
        summary: "Logout All Sessions",
        description:
          "Revokes all active sessions belonging to the authenticated user across all devices.",
        tags: ["Authentication"],
        response: {
          200: {
            description: "All sessions revoked",
            type: "object",
            properties: {
              success: { type: "boolean", enum: [true] },
              data: {
                type: "object",
                properties: {
                  message: { type: "string" }
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
      const userId = request.user.sub;
      const count = await sessionService.logoutAll(userId, {
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"]
      });

      reply.clearCookie("refresh_token", { path: "/api/v1/auth" });
      reply.clearCookie("refresh_token", { path: "/" });

      return reply.status(200).send(
        createSuccessResponse(
          { message: `Successfully logged out from all sessions (${count} session(s) revoked)` },
          request.id
        )
      );
    }
  );

  /**
   * GET /me
   * Returns current authenticated user and session ID.
   */
  app.get(
    "/me",
    {
      onRequest: [app.authenticate],
      schema: {
        summary: "Current User Profile",
        description:
          "Returns the profile and role assignments for the currently authenticated user.",
        tags: ["Authentication"],
        response: {
          200: {
            description: "User profile",
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
                  },
                  sessionId: { type: "string", format: "uuid" }
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
      const user = await authService.getCurrentUser(request.user.sub);

      return reply.status(200).send(
        createSuccessResponse(
          {
            user,
            sessionId: request.user.sessionId
          },
          request.id
        )
      );
    }
  );

  /**
   * GET /sessions
   * Returns all active sessions for the current authenticated user.
   */
  app.get(
    "/sessions",
    {
      onRequest: [app.authenticate],
      schema: {
        summary: "List Active Sessions",
        description:
          "Lists all active, unrevoked sessions for the authenticated user, identifying the current session.",
        tags: ["Authentication"],
        response: {
          200: {
            description: "List of active sessions",
            type: "object",
            properties: {
              success: { type: "boolean", enum: [true] },
              data: {
                type: "object",
                properties: {
                  sessions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        clientType: { type: "string" },
                        ipAddress: { type: "string", nullable: true },
                        userAgent: { type: "string", nullable: true },
                        lastActiveAt: { type: "string" },
                        createdAt: { type: "string" },
                        isCurrentSession: { type: "boolean" }
                      }
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
      const sessions = await sessionService.getUserSessions(
        request.user.sub,
        request.user.sessionId
      );

      return reply
        .status(200)
        .send(createSuccessResponse({ sessions }, request.id));
    }
  );

  /**
   * DELETE /sessions/:sessionId
   * Revokes a specific session belonging to the authenticated user.
   */
  app.delete(
    "/sessions/:sessionId",
    {
      onRequest: [app.authenticate],
      schema: {
        summary: "Revoke Specific Session",
        description:
          "Revokes an active session belonging to the authenticated user by its ID.",
        tags: ["Authentication"],
        params: {
          type: "object",
          required: ["sessionId"],
          properties: {
            sessionId: { type: "string", format: "uuid" }
          }
        },
        response: {
          200: {
            description: "Session revoked successfully",
            type: "object",
            properties: {
              success: { type: "boolean", enum: [true] },
              data: {
                type: "object",
                properties: {
                  message: { type: "string" }
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
      const paramResult = UuidParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        throw AppError.validation("Invalid session ID parameter", [
          {
            field: "sessionId",
            message: "Must be a valid UUID",
            code: "VALIDATION_ERROR"
          }
        ]);
      }

      const { sessionId } = paramResult.data;

      await sessionService.revokeUserSession(request.user.sub, sessionId, {
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"]
      });

      // If user revoked their own current session, clear cookie
      if (sessionId === request.user.sessionId) {
        reply.clearCookie("refresh_token", { path: "/api/v1/auth" });
        reply.clearCookie("refresh_token", { path: "/" });
      }

      return reply
        .status(200)
        .send(createSuccessResponse({ message: "Session revoked successfully" }, request.id));
    }
  );

  /**
   * POST /change-password
   * Authenticated password change. Updates password and revokes all other active sessions.
   */
  app.post(
    "/change-password",
    {
      onRequest: [app.authenticate],
      schema: {
        summary: "Change Password",
        description:
          "Changes the password for the currently authenticated user, verifies current password with Argon2id, and revokes all other active sessions.",
        tags: ["Authentication"],
        body: {
          type: "object",
          required: ["currentPassword", "newPassword", "confirmPassword"],
          properties: {
            currentPassword: { type: "string" },
            newPassword: { type: "string", minLength: 8, maxLength: 128 },
            confirmPassword: { type: "string", minLength: 8, maxLength: 128 }
          }
        },
        response: {
          200: {
            description: "Password changed successfully",
            type: "object",
            properties: {
              success: { type: "boolean", enum: [true] },
              data: {
                type: "object",
                properties: {
                  message: { type: "string" }
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
      const parseResult = ChangePasswordRequestSchema.safeParse(request.body);
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

      const result = await passwordService.changePassword({
        userId: request.user.sub,
        currentSessionId: request.user.sessionId,
        input: parseResult.data,
        clientInfo
      });

      return reply
        .status(200)
        .send(createSuccessResponse(result, request.id));
    }
  );

  /**
   * POST /forgot-password
   * Requests a password recovery token. Strictly enumeration-resistant.
   */
  app.post(
    "/forgot-password",
    {
      schema: {
        summary: "Forgot Password",
        description:
          "Initiates password recovery for an account. Strictly enumeration-resistant, returning identical messages whether an account exists or not.",
        tags: ["Authentication"],
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email" }
          }
        },
        response: {
          200: {
            description: "Password reset request accepted",
            type: "object",
            properties: {
              success: { type: "boolean", enum: [true] },
              data: {
                type: "object",
                properties: {
                  message: { type: "string" }
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
      const parseResult = ForgotPasswordRequestSchema.safeParse(request.body);
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

      const result = await passwordService.requestPasswordReset({
        input: parseResult.data,
        clientInfo
      });

      return reply
        .status(200)
        .send(createSuccessResponse(result, request.id));
    }
  );

  /**
   * POST /reset-password
   * Completes password reset using single-use recovery token. Revokes all active sessions.
   */
  app.post(
    "/reset-password",
    {
      schema: {
        summary: "Reset Password",
        description:
          "Consumes a single-use recovery token atomically, updates password hash with Argon2id, and revokes all active sessions for the user.",
        tags: ["Authentication"],
        body: {
          type: "object",
          required: ["token", "newPassword", "confirmPassword"],
          properties: {
            token: { type: "string" },
            newPassword: { type: "string", minLength: 8, maxLength: 128 },
            confirmPassword: { type: "string", minLength: 8, maxLength: 128 }
          }
        },
        response: {
          200: {
            description: "Password reset completed successfully",
            type: "object",
            properties: {
              success: { type: "boolean", enum: [true] },
              data: {
                type: "object",
                properties: {
                  message: { type: "string" }
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
      const parseResult = ResetPasswordRequestSchema.safeParse(request.body);
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

      const result = await passwordService.resetPassword({
        input: parseResult.data,
        clientInfo
      });

      return reply
        .status(200)
        .send(createSuccessResponse(result, request.id));
    }
  );
};
