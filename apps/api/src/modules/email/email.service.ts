import { env } from "../../config/env.js";
import { logger } from "../../infrastructure/logging/logger.js";
import {
  EmailDeliveryAdapter,
  EmailSendResult,
  SendEmailVerificationParams,
  SendPasswordResetEmailParams
} from "./email.types.js";

/**
 * NoopEmailDeliveryAdapter:
 * Safe fallback when no external email provider is configured.
 * Explicitly returns delivered: false so the application never falsely claims
 * an email was delivered in production when unconfigured.
 */
export class NoopEmailDeliveryAdapter implements EmailDeliveryAdapter {
  readonly name = "noop";

  async sendPasswordResetEmail(
    _params: SendPasswordResetEmailParams
  ): Promise<EmailSendResult> {
    return {
      delivered: false,
      error: "NO_APPROVED_EMAIL_PROVIDER_CONFIGURED_OQ_019",
      provider: this.name
    };
  }

  async sendEmailVerificationEmail(
    _params: SendEmailVerificationParams
  ): Promise<EmailSendResult> {
    return {
      delivered: false,
      error: "NO_APPROVED_EMAIL_PROVIDER_CONFIGURED_OQ_019",
      provider: this.name
    };
  }
}

/**
 * ConsoleDevEmailAdapter:
 * Local development adapter that logs transactional email metadata to stdout.
 */
export class ConsoleDevEmailAdapter implements EmailDeliveryAdapter {
  readonly name = "console-dev";

  async sendPasswordResetEmail(
    params: SendPasswordResetEmailParams
  ): Promise<EmailSendResult> {
    logger.info(
      { to: params.to, resetUrl: params.resetUrl, provider: this.name },
      "[ConsoleDevEmailAdapter] Dispatched password reset email"
    );
    return {
      delivered: true,
      messageId: `console-reset-${Date.now()}`,
      provider: this.name
    };
  }

  async sendEmailVerificationEmail(
    params: SendEmailVerificationParams
  ): Promise<EmailSendResult> {
    logger.info(
      { to: params.to, verificationUrl: params.verificationUrl, provider: this.name },
      "[ConsoleDevEmailAdapter] Dispatched account email verification"
    );
    return {
      delivered: true,
      messageId: `console-verify-${Date.now()}`,
      provider: this.name
    };
  }
}

/**
 * ResendHttpEmailAdapter:
 * Production-capable HTTPS transactional email adapter (OQ-019 / OTD-003).
 */
export class ResendHttpEmailAdapter implements EmailDeliveryAdapter {
  readonly name = "resend";
  private readonly apiKey: string;
  private readonly fromAddress: string;

  constructor(options?: { apiKey?: string; fromAddress?: string }) {
    this.apiKey = options?.apiKey ?? env.RESEND_API_KEY ?? "";
    this.fromAddress = options?.fromAddress ?? env.EMAIL_FROM_ADDRESS;
  }

  private async dispatchHtmlEmail(
    to: string,
    subject: string,
    html: string
  ): Promise<EmailSendResult> {
    if (!this.apiKey) {
      return {
        delivered: false,
        error: "MISSING_RESEND_API_KEY",
        provider: this.name
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [to],
          subject,
          html
        })
      });

      if (!response.ok) {
        return {
          delivered: false,
          error: `RESEND_HTTP_${response.status}`,
          provider: this.name
        };
      }

      const body = (await response.json()) as { id?: string };
      return {
        delivered: true,
        messageId: body.id ?? `resend-${Date.now()}`,
        provider: this.name
      };
    } catch (err: unknown) {
      return {
        delivered: false,
        error: err instanceof Error ? err.message : "RESEND_NETWORK_ERROR",
        provider: this.name
      };
    }
  }

  async sendPasswordResetEmail(
    params: SendPasswordResetEmailParams
  ): Promise<EmailSendResult> {
    return await this.dispatchHtmlEmail(
      params.to,
      "Reset your Luggage Storage Marketplace password",
      `<p>Hello ${params.displayName},</p><p>Use the link below to reset your password (valid for 60 minutes):</p><p><a href="${params.resetUrl}">${params.resetUrl}</a></p>`
    );
  }

  async sendEmailVerificationEmail(
    params: SendEmailVerificationParams
  ): Promise<EmailSendResult> {
    return await this.dispatchHtmlEmail(
      params.to,
      "Verify your Luggage Storage Marketplace account",
      `<p>Hello ${params.displayName},</p><p>Please verify your email address to activate your account:</p><p><a href="${params.verificationUrl}">${params.verificationUrl}</a></p>`
    );
  }
}

/**
 * DeterministicTestEmailAdapter:
 * In-memory adapter for automated test suites and local development.
 * Allows tests to inspect dispatched tokens deterministically without exposing them
 * via public API responses or log streams.
 */
export class DeterministicTestEmailAdapter implements EmailDeliveryAdapter {
  readonly name = "deterministic-test";
  private sentEmails: SendPasswordResetEmailParams[] = [];
  private sentVerificationEmails: SendEmailVerificationParams[] = [];

  async sendPasswordResetEmail(
    params: SendPasswordResetEmailParams
  ): Promise<EmailSendResult> {
    this.sentEmails.push({ ...params });
    return {
      delivered: true,
      messageId: `test-msg-${this.sentEmails.length}-${Date.now()}`,
      provider: this.name
    };
  }

  async sendEmailVerificationEmail(
    params: SendEmailVerificationParams
  ): Promise<EmailSendResult> {
    this.sentVerificationEmails.push({ ...params });
    return {
      delivered: true,
      messageId: `test-verify-msg-${this.sentVerificationEmails.length}-${Date.now()}`,
      provider: this.name
    };
  }

  getSentEmails(): SendPasswordResetEmailParams[] {
    return [...this.sentEmails];
  }

  getLastEmail(): SendPasswordResetEmailParams | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  getSentVerificationEmails(): SendEmailVerificationParams[] {
    return [...this.sentVerificationEmails];
  }

  getLastVerificationEmail(): SendEmailVerificationParams | undefined {
    return this.sentVerificationEmails[this.sentVerificationEmails.length - 1];
  }

  getLastVerificationEmailFor(email: string): SendEmailVerificationParams | undefined {
    const normalized = email.trim().toLowerCase();
    for (let i = this.sentVerificationEmails.length - 1; i >= 0; i--) {
      if (this.sentVerificationEmails[i].to.trim().toLowerCase() === normalized) {
        return this.sentVerificationEmails[i];
      }
    }
    return undefined;
  }

  clear(): void {
    this.sentEmails = [];
    this.sentVerificationEmails = [];
  }
}

/**
 * EmailService:
 * Provider-agnostic boundary for email delivery.
 */
export class EmailService {
  private adapter: EmailDeliveryAdapter;

  constructor(initialAdapter?: EmailDeliveryAdapter) {
    if (initialAdapter) {
      this.adapter = initialAdapter;
    } else if (env.EMAIL_PROVIDER === "resend") {
      this.adapter = new ResendHttpEmailAdapter();
    } else if (env.EMAIL_PROVIDER === "console") {
      this.adapter = new ConsoleDevEmailAdapter();
    } else if (env.EMAIL_PROVIDER === "noop") {
      this.adapter = new NoopEmailDeliveryAdapter();
    } else if (env.NODE_ENV === "test" || env.EMAIL_PROVIDER === "test") {
      this.adapter = new DeterministicTestEmailAdapter();
    } else {
      this.adapter = new NoopEmailDeliveryAdapter();
    }
  }

  setAdapter(adapter: EmailDeliveryAdapter): void {
    this.adapter = adapter;
  }

  getAdapter(): EmailDeliveryAdapter {
    return this.adapter;
  }

  async sendPasswordResetEmail(
    params: SendPasswordResetEmailParams
  ): Promise<EmailSendResult> {
    return await this.adapter.sendPasswordResetEmail(params);
  }

  async sendEmailVerificationEmail(
    params: SendEmailVerificationParams
  ): Promise<EmailSendResult> {
    if (this.adapter.sendEmailVerificationEmail) {
      return await this.adapter.sendEmailVerificationEmail(params);
    }
    return {
      delivered: false,
      error: "ADAPTER_DOES_NOT_IMPLEMENT_EMAIL_VERIFICATION",
      provider: this.adapter.name
    };
  }
}

export const emailService = new EmailService();
