import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { createErrorResponse } from "@luggage-storage/contracts";
import { AppError } from "../errors/app-error.js";

export function errorHandler(error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) {
  const correlationId = request.id;

  if (error instanceof AppError) {
    request.log.warn({ err: error, correlationId }, `AppError [${error.code}]: ${error.message}`);
    return reply.status(error.statusCode).send(
      createErrorResponse(error.code, error.message, error.details, correlationId)
    );
  }

  // Fastify validation errors
  if ("validation" in error && error.validation) {
    const details = error.validation.map((v) => {
      const rawField = v.instancePath || v.params?.missingProperty?.toString() || "";
      const field = rawField.replace(/^\//, "");
      return {
        field: field || undefined,
        message: v.message || "Invalid input",
        code: "VALIDATION_ERROR"
      };
    });
    return reply.status(400).send(
      createErrorResponse("VALIDATION_ERROR", "Request validation failed", details, correlationId)
    );
  }

  // Generic 500
  request.log.error({ err: error, correlationId }, "Unhandled internal server error");
  return reply.status(500).send(
    createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", undefined, correlationId)
  );
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  const correlationId = request.id;
  return reply.status(404).send(
    createErrorResponse(
      "NOT_FOUND",
      `Route ${request.method}:${request.url} not found`,
      undefined,
      correlationId
    )
  );
}

