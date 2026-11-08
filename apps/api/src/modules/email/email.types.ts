export interface SendPasswordResetEmailParams {
  to: string;
  displayName: string;
  resetToken: string;
  resetUrl: string;
}

export interface SendEmailVerificationParams {
  to: string;
  displayName: string;
  verificationToken: string;
  verificationUrl: string;
}

export interface EmailSendResult {
  delivered: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

export interface EmailDeliveryAdapter {
  readonly name: string;
  sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<EmailSendResult>;
  sendEmailVerificationEmail?(params: SendEmailVerificationParams): Promise<EmailSendResult>;
}
