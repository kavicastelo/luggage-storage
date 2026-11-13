import { FastifyInstance, FastifyRequest } from "fastify";
import {
  CreatePaymentIntentRequestSchema,
  SandboxSimulatePaymentRequestSchema,
  createSuccessResponse
} from "@luggage-storage/contracts";
import { AppError } from "../../common/errors/app-error.js";
import { paymentsService } from "./payments.service.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUuid(value: string, label = "ID"): string {
  if (!UUID_REGEX.test(value)) {
    throw AppError.badRequest(`Invalid ${label} format: must be a valid UUID`);
  }
  return value;
}

function getClientInfo(request: FastifyRequest) {
  return {
    ip: request.ip,
    userAgent: request.headers["user-agent"] as string | undefined,
    correlationId: (request.headers["x-correlation-id"] as string) || request.id
  };
}

/**
 * Payment intent & verified gateway webhook routes mounted at /payments (and /api/v1/payments).
 */
export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  // 1. Create or retrieve idempotent payment intent for a PENDING_PAYMENT booking
  app.post(
    "/intents",
    {
      preHandler: [app.authenticate, app.requirePermission("bookings.create")],
      schema: {
        tags: ["Payments"],
        summary: "Create or retrieve an idempotent payment intent for a booking hold",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const body = CreatePaymentIntentRequestSchema.parse(request.body);
      const intent = await paymentsService.createPaymentIntent(
        request.user.sub,
        body,
        getClientInfo(request)
      );
      return reply.status(201).send(createSuccessResponse(intent, request.id));
    }
  );

  // 2. Explicitly labeled development/sandbox payment simulator (disabled in production)
  app.post<{ Params: { intentId: string } }>(
    "/intents/:intentId/sandbox-simulate",
    {
      preHandler: [app.authenticate, app.requirePermission("bookings.create")],
      schema: {
        tags: ["Payments"],
        summary: "Simulate sandbox payment completion or failure via HMAC-signed webhook pipeline (non-production only)",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const intentId = validateUuid(request.params.intentId, "payment intent ID");
      const body = SandboxSimulatePaymentRequestSchema.parse(request.body || {});
      const result = await paymentsService.simulateSandboxPayment(
        intentId,
        request.user.sub,
        body,
        getClientInfo(request)
      );
      return reply.status(200).send(createSuccessResponse(result, request.id));
    }
  );

  // 3. Encapsulated webhook endpoint preserving exact raw JSON string for HMAC-SHA256 verification
  app.register(async (webhookScope) => {
    webhookScope.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (_req, body, done) => {
        done(null, typeof body === "string" ? body : String(body ?? ""));
      }
    );

    webhookScope.post(
      "/webhooks/sandbox",
      {
        schema: {
          tags: ["Payments"],
          summary: "Receive and verify HMAC-SHA256 signed sandbox payment gateway webhook"
        }
      },
      async (request, reply) => {
        const rawBody = typeof request.body === "string" ? request.body : "";
        const signatureHeader = request.headers["x-sandbox-signature"] as string | undefined;
        const result = await paymentsService.processSandboxWebhook(
          rawBody,
          signatureHeader,
          getClientInfo(request)
        );
        return reply.status(200).send(createSuccessResponse(result, request.id));
      }
    );
  });
}

