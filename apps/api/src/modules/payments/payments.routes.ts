import { FastifyInstance, FastifyRequest } from "fastify";
import {
  CheckoutStatusQuerySchema,
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

  // 1b. Retired legacy server-rendered PayHere HTML handoff bridge
  app.get<{ Params: { handoffToken: string } }>(
    "/handoff/:handoffToken",
    {
      schema: {
        tags: ["Payments"],
        summary: "Retired legacy HTML payment handoff bridge (410 Gone)"
      }
    },
    async (request, reply) => {
      return reply
        .status(410)
        .header("Cache-Control", "no-store, no-cache, must-revalidate, private")
        .send({
          success: false,
          error: {
            code: "HANDOFF_ENDPOINT_RETIRED",
            message:
              "The API HTML payment handoff bridge has been retired. Use direct web POST checkout or the official PayHere native mobile SDK."
          },
          meta: {
            requestId: request.id,
            timestamp: new Date().toISOString()
          }
        });
    }
  );

  // 1c. Authoritative checkout & booking status check (never trusts URL query flags)
  app.get(
    "/checkout-status",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["Payments"],
        summary: "Retrieve authoritative booking and latest payment intent status for checkout return",
        security: [{ bearerAuth: [] }]
      }
    },
    async (request, reply) => {
      const query = CheckoutStatusQuerySchema.parse(request.query);
      const result = await paymentsService.getCheckoutStatus(
        request.user.sub,
        request.user.roles ?? [],
        query
      );
      return reply.status(200).send(createSuccessResponse(result, request.id));
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

  // 3. Encapsulated webhook endpoints preserving exact raw body strings for signature verification
  app.register(async (webhookScope) => {
    webhookScope.removeContentTypeParser("application/json");
    webhookScope.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (_req, body, done) => {
        done(null, typeof body === "string" ? body : String(body ?? ""));
      }
    );

    webhookScope.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string" },
      (_req, body, done) => {
        done(null, typeof body === "string" ? body : String(body ?? ""));
      }
    );

    webhookScope.post(
      "/webhooks/sandbox",
      {
        bodyLimit: 65_536,
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

    webhookScope.post(
      "/webhooks/stripe",
      {
        bodyLimit: 65_536,
        schema: {
          tags: ["Payments"],
          summary: "Receive and verify Stripe webhook notification via official SDK signature"
        }
      },
      async (request, reply) => {
        const rawBody = typeof request.body === "string" ? request.body : "";
        const result = await paymentsService.processStripeWebhook(
          rawBody,
          request.headers,
          getClientInfo(request)
        );
        return reply.status(200).send(createSuccessResponse(result, request.id));
      }
    );

    webhookScope.post(
      "/webhooks/paypal",
      {
        bodyLimit: 65_536,
        schema: {
          tags: ["Payments"],
          summary: "Receive and verify PayPal webhook notification via REST verification API"
        }
      },
      async (request, reply) => {
        const rawBody = typeof request.body === "string" ? request.body : "";
        const result = await paymentsService.processPayPalWebhook(
          rawBody,
          request.headers,
          getClientInfo(request)
        );
        return reply.status(200).send(createSuccessResponse(result, request.id));
      }
    );

    webhookScope.post(
      "/webhooks/payhere",
      {
        bodyLimit: 65_536,
        schema: {
          tags: ["Payments"],
          summary: "Receive and verify PayHere notify_url webhook via isolated md5sig verification"
        }
      },
      async (request, reply) => {
        const rawBody = typeof request.body === "string" ? request.body : "";
        const result = await paymentsService.processPayHereWebhook(
          rawBody,
          request.headers,
          request.headers["content-type"],
          getClientInfo(request)
        );
        return reply.status(200).send(createSuccessResponse(result, request.id));
      }
    );
  });
}

