import { env } from "../../config/env.js";
import {
  EmailDeliveryAdapter,
  EmailSendResult,
  SendPasswordResetEmailParams
} from "./email.types.js";

/**
 * NoopEmailDeliveryAdapter:
 * Used in production until an external email provider is formally approved under OQ-019.
 * Fails safely and observably without leaking sensitive recovery tokens.
 */
export class NoopEmailDeliveryAdapter implements EmailDeliveryAdapter {
  readonly name = "noop";

  async sendPasswordResetEmail(
    _params: SendPasswordResetEmailParams
  ): Promise<EmailSendResult> {
    // Under OQ-019, external provider decision is pending.
    // We intentionally do not deliver emails in production until approved.
    return {
      delivered: false,
      error: "NO_APPROVED_EMAIL_PROVIDER_CONFIGURED_OQ_019",
      provider: this.name
    };
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

  getSentEmails(): SendPasswordResetEmailParams[] {
    return [...this.sentEmails];
  }

  getLastEmail(): SendPasswordResetEmailParams | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  clear(): void {
    this.sentEmails = [];
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
    } else if (env.NODE_ENV === "test") {
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
}

export const emailService = new EmailService();

