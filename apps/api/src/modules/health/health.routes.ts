import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { checkDatabaseConnection } from "../../infrastructure/database/connection.js";
import { createSuccessResponse } from "@luggage-storage/contracts";

export async function healthRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // Liveness check: confirms server process is responding
  fastify.get(
    "/health",
    {
      schema: {
        description: "Liveness probe: verifies Fastify application is responding",
        tags: ["Health & System"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  timestamp: { type: "string" },
                  uptime: { type: "number" }
                }
              },
              meta: { type: "object", additionalProperties: true }
            }
          }
        }
      }
    },
    async (request, _reply) => {
      const data = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };
      return createSuccessResponse(data, request.id);
    }
  );

  // Readiness check: verifies database connectivity and PostGIS
  fastify.get(
    "/ready",
    {
      schema: {
        description: "Readiness probe: verifies external dependencies (PostgreSQL & PostGIS)",
        tags: ["Health & System"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  database: { type: "object", additionalProperties: true }
                }
              },
              meta: { type: "object", additionalProperties: true }
            }
          },
          503: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "object", additionalProperties: true },
              meta: { type: "object", additionalProperties: true }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const dbStatus = await checkDatabaseConnection();
      if (!dbStatus.ok) {
        return reply.status(503).send({
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Database connection failed",
            details: [{ field: "database", message: dbStatus.error || "Unable to reach database" }]
          },
          meta: {
            timestamp: new Date().toISOString(),
            correlationId: request.id
          }
        });
      }

      return createSuccessResponse(
        {
          status: "ready",
          database: {
            connected: true,
            postgis: dbStatus.postgisVersion
          }
        },
        request.id
      );
    }
  );
}
