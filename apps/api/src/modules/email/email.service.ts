import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../infrastructure/logging/logger.js";
import {
  EmailDeliveryAdapter,
  EmailSendResult,
  SendEmailVerificationParams,
  SendPasswordResetEmailParams
} from "./email.types.js";
import {
  buildPasswordResetEmailTemplate,
  buildVerificationEmailTemplate
} from "./email.templates.js";

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SmtpSendMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SmtpSendMailResult {
  messageId?: string;
  accepted?: Array<string | unknown>;
  rejected?: Array<string | unknown>;
}

export interface SmtpTransportLike {
  sendMail(mailOptions: SmtpSendMailOptions): Promise<SmtpSendMailResult>;
}

export interface ZohoSmtpAdapterOptions {
  host?: string;
  port?: number;
  secure?: boolean;
  requireTls?: boolean;
  user?: string;
  password?: string;
  fromAddress?: string;
  fromName?: string;
  timeoutMs?: number;
  publicBaseUrl?: string;
  transporter?: SmtpTransportLike;
}

/**
 * ZohoSmtpEmailAdapter:
 * Production Zoho Mail SMTP delivery adapter with strict TLS/STARTTLS validation,
 * timeout protection, and structured token-safe logging (AUD-002 / OQ-019).
 */
export class ZohoSmtpEmailAdapter implements EmailDeliveryAdapter {
  readonly name = "zoho";
  private readonly host: string;
  private readonly port: number;
  private readonly secure: boolean;
  private readonly requireTls: boolean;
  private readonly user: string;
  private readonly password: string;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly timeoutMs: number;
  private readonly publicBaseUrl: string;
  private transporter: SmtpTransportLike | null;

  constructor(options?: ZohoSmtpAdapterOptions) {
    this.host = (options?.host ?? env.ZOHO_SMTP_HOST ?? "").trim();
    this.port = options?.port ?? env.ZOHO_SMTP_PORT ?? 587;
    this.secure = options?.secure ?? env.ZOHO_SMTP_SECURE ?? false;
    this.requireTls = options?.requireTls ?? env.ZOHO_SMTP_REQUIRE_TLS ?? true;
    this.user = (options?.user ?? env.ZOHO_SMTP_USER ?? "").trim();
    this.password = options?.password ?? env.ZOHO_SMTP_PASSWORD ?? "";
    this.fromAddress = (options?.fromAddress ?? env.EMAIL_FROM_ADDRESS ?? "").trim();
    this.fromName = (options?.fromName ?? env.EMAIL_FROM_NAME ?? "Luggage Storage Marketplace").trim();
    this.timeoutMs = options?.timeoutMs ?? env.ZOHO_SMTP_TIMEOUT_MS ?? 10000;
    this.publicBaseUrl = (options?.publicBaseUrl ?? env.APP_PUBLIC_URL).trim();
    this.transporter = options?.transporter ?? null;
  }

  public getConfigurationSummary(): {
    host: string;
    port: number;
    secure: boolean;
    requireTls: boolean;
    fromAddress: string;
    fromName: string;
    timeoutMs: number;
    hasCredentials: boolean;
  } {
    return {
      host: this.host,
      port: this.port,
      secure: this.secure,
      requireTls: this.requireTls,
      fromAddress: this.fromAddress,
      fromName: this.fromName,
      timeoutMs: this.timeoutMs,
      hasCredentials: Boolean(this.user && this.password)
    };
  }

  private validateConfiguration(): string | null {
    if (!this.host || /^https?:\/\//i.test(this.host) || /\s/.test(this.host)) {
      return "MISSING_OR_INVALID_ZOHO_SMTP_HOST";
    }
    if (!Number.isInteger(this.port) || this.port <= 0 || this.port > 65535) {
      return "INVALID_ZOHO_SMTP_PORT";
    }
    if (!this.user || !this.password) {
      return "MISSING_ZOHO_SMTP_CREDENTIALS";
    }
    if (!this.fromAddress || !SIMPLE_EMAIL_REGEX.test(this.fromAddress)) {
      return "INVALID_EMAIL_FROM_ADDRESS";
    }
    if (this.port === 465 && !this.secure) {
      return "INSECURE_ZOHO_SMTP_TLS_CONFIG";
    }
    if (this.port === 587 && this.secure) {
      return "INSECURE_ZOHO_SMTP_TLS_CONFIG";
    }
    if (!this.secure && !this.requireTls) {
      return "INSECURE_ZOHO_SMTP_TLS_CONFIG";
    }
    return null;
  }

  private getOrCreateTransporter(): SmtpTransportLike {
    if (this.transporter) {
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      requireTLS: !this.secure && this.requireTls,
      auth: {
        user: this.user,
        pass: this.password
      },
      connectionTimeout: this.timeoutMs,
      greetingTimeout: this.timeoutMs,
      socketTimeout: this.timeoutMs,
      tls: {
        rejectUnauthorized: true,
        minVersion: "TLSv1.2"
      }
    });

    return this.transporter;
  }

  private async dispatchEmail(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
    emailCategory: "email_verification" | "password_reset";
  }): Promise<EmailSendResult> {
    const configError = this.validateConfiguration();
    if (configError) {
      logger.error(
        {
          provider: this.name,
          emailCategory: params.emailCategory,
          errorCode: configError
        },
        "[ZohoSmtpEmailAdapter] Configuration validation failed"
      );
      return {
        delivered: false,
        error: configError,
        provider: this.name
      };
    }

    const formattedFrom = this.fromName
      ? `"${this.fromName.replace(/"/g, "")}" <${this.fromAddress}>`
      : this.fromAddress;

    try {
      const transport = this.getOrCreateTransporter();
      const info = await transport.sendMail({
        from: formattedFrom,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text
      });

      const rejectedCount = Array.isArray(info.rejected) ? info.rejected.length : 0;
      const acceptedCount = Array.isArray(info.accepted) ? info.accepted.length : 1;

      if (rejectedCount > 0 && acceptedCount === 0) {
        logger.warn(
          {
            provider: this.name,
            emailCategory: params.emailCategory,
            errorCode: "ZOHO_SMTP_RECIPIENT_REJECTED"
          },
          "[ZohoSmtpEmailAdapter] Recipient rejected by SMTP server"
        );
        return {
          delivered: false,
          error: "ZOHO_SMTP_RECIPIENT_REJECTED",
          provider: this.name
        };
      }

      const messageId = info.messageId || `zoho-${Date.now()}`;
      logger.info(
        {
          provider: this.name,
          emailCategory: params.emailCategory,
          messageId
        },
        "[ZohoSmtpEmailAdapter] Transactional email accepted for delivery"
      );

      return {
        delivered: true,
        messageId,
        provider: this.name
      };
    } catch (err: unknown) {
      const errCode = (err as { code?: string })?.code;
      const errMsg = err instanceof Error ? err.message : "ZOHO_SMTP_DELIVERY_FAILED";
      const normalizedError =
        errCode === "EAUTH" || /auth/i.test(errMsg)
          ? "ZOHO_SMTP_AUTH_FAILED"
          : errCode === "ETIMEDOUT" || /timeout/i.test(errMsg)
            ? "ZOHO_SMTP_TIMEOUT"
            : errCode || errMsg;

      logger.error(
        {
          provider: this.name,
          emailCategory: params.emailCategory,
          errorCode: normalizedError
        },
        "[ZohoSmtpEmailAdapter] Failed to dispatch transactional email"
      );

      return {
        delivered: false,
        error: normalizedError,
        provider: this.name
      };
    }
  }

  async sendEmailVerificationEmail(
    params: SendEmailVerificationParams
  ): Promise<EmailSendResult> {
    const rendered = buildVerificationEmailTemplate({
      displayName: params.displayName,
      verificationUrl: params.verificationUrl,
      publicBaseUrl: this.publicBaseUrl,
      brandName: this.fromName
    });

    return await this.dispatchEmail({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      emailCategory: "email_verification"
    });
  }

  async sendPasswordResetEmail(
    params: SendPasswordResetEmailParams
  ): Promise<EmailSendResult> {
    const rendered = buildPasswordResetEmailTemplate({
      displayName: params.displayName,
      resetUrl: params.resetUrl,
      publicBaseUrl: this.publicBaseUrl,
      brandName: this.fromName
    });

    return await this.dispatchEmail({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      emailCategory: "password_reset"
    });
  }
}

/**
 * NoopEmailDeliveryAdapter:
 * Non-production fallback when no external email provider is configured.
 * Explicitly returns delivered: false and is forbidden in production.
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
 * Local development adapter that logs transactional email metadata without exposing raw tokens.
 */
export class ConsoleDevEmailAdapter implements EmailDeliveryAdapter {
  readonly name = "console-dev";

  async sendPasswordResetEmail(
    params: SendPasswordResetEmailParams
  ): Promise<EmailSendResult> {
    logger.info(
      { to: params.to, provider: this.name, emailCategory: "password_reset" },
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
      { to: params.to, provider: this.name, emailCategory: "email_verification" },
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
 * Optional HTTPS transactional email adapter retained for compatibility.
 */
export class ResendHttpEmailAdapter implements EmailDeliveryAdapter {
  readonly name = "resend";
  private readonly apiKey: string;
  private readonly fromAddress: string;
  private readonly publicBaseUrl: string;

  constructor(options?: { apiKey?: string; fromAddress?: string; publicBaseUrl?: string }) {
    this.apiKey = options?.apiKey ?? env.RESEND_API_KEY ?? "";
    this.fromAddress = options?.fromAddress ?? env.EMAIL_FROM_ADDRESS;
    this.publicBaseUrl = options?.publicBaseUrl ?? env.APP_PUBLIC_URL;
  }

  private async dispatchHtmlEmail(
    to: string,
    subject: string,
    html: string,
    text: string
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
          html,
          text
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
    const rendered = buildPasswordResetEmailTemplate({
      displayName: params.displayName,
      resetUrl: params.resetUrl,
      publicBaseUrl: this.publicBaseUrl
    });
    return await this.dispatchHtmlEmail(params.to, rendered.subject, rendered.html, rendered.text);
  }

  async sendEmailVerificationEmail(
    params: SendEmailVerificationParams
  ): Promise<EmailSendResult> {
    const rendered = buildVerificationEmailTemplate({
      displayName: params.displayName,
      verificationUrl: params.verificationUrl,
      publicBaseUrl: this.publicBaseUrl
    });
    return await this.dispatchHtmlEmail(params.to, rendered.subject, rendered.html, rendered.text);
  }
}

/**
 * DeterministicTestEmailAdapter:
 * In-memory adapter for automated test suites.
 */
export class DeterministicTestEmailAdapter implements EmailDeliveryAdapter {
  readonly name = "deterministic-test";
  private sentEmails: SendPasswordResetEmailParams[] = [];
  private sentVerificationEmails: SendEmailVerificationParams[] = [];
  private simulateFailureError: string | null = null;

  setSimulatedFailure(errorCode: string | null): void {
    this.simulateFailureError = errorCode;
  }

  async sendPasswordResetEmail(
    params: SendPasswordResetEmailParams
  ): Promise<EmailSendResult> {
    if (this.simulateFailureError) {
      return {
        delivered: false,
        error: this.simulateFailureError,
        provider: this.name
      };
    }
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
    if (this.simulateFailureError) {
      return {
        delivered: false,
        error: this.simulateFailureError,
        provider: this.name
      };
    }
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
    this.simulateFailureError = null;
  }
}

export function createAdapterForEnvironment(
  provider: typeof env.EMAIL_PROVIDER,
  nodeEnv: typeof env.NODE_ENV
): EmailDeliveryAdapter {
  if (nodeEnv === "production") {
    if (provider !== "zoho") {
      throw new Error(
        `Invalid production email provider '${String(provider)}'. Production requires EMAIL_PROVIDER=zoho.`
      );
    }
    return new ZohoSmtpEmailAdapter();
  }

  if (provider === "zoho") {
    return new ZohoSmtpEmailAdapter();
  }
  if (provider === "resend") {
    return new ResendHttpEmailAdapter();
  }
  if (provider === "console") {
    return new ConsoleDevEmailAdapter();
  }
  if (provider === "noop") {
    return new NoopEmailDeliveryAdapter();
  }
  if (nodeEnv === "test" || provider === "test") {
    return new DeterministicTestEmailAdapter();
  }
  return new ConsoleDevEmailAdapter();
}

/**
 * EmailService:
 * Provider-agnostic boundary for transactional email delivery.
 */
export class EmailService {
  private adapter: EmailDeliveryAdapter;

  constructor(initialAdapter?: EmailDeliveryAdapter) {
    if (initialAdapter) {
      this.adapter = initialAdapter;
    } else {
      this.adapter = createAdapterForEnvironment(env.EMAIL_PROVIDER, env.NODE_ENV);
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
