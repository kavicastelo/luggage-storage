export interface RenderedEmailTemplate {
  subject: string;
  html: string;
  text: string;
  actionUrl: string;
  resendUrl: string;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function resolvePublicEmailUrl(targetUrlOrPath: string, publicBaseUrl: string): string {
  const trimmedTarget = targetUrlOrPath.trim();
  const normalizedBase = publicBaseUrl.trim().replace(/\/+$/, "");

  if (/^https?:\/\//i.test(trimmedTarget)) {
    return trimmedTarget;
  }

  const normalizedPath = trimmedTarget.startsWith("/") ? trimmedTarget : `/${trimmedTarget}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function buildVerificationEmailTemplate(params: {
  displayName: string;
  verificationUrl: string;
  publicBaseUrl: string;
  brandName?: string;
}): RenderedEmailTemplate {
  const brand = params.brandName?.trim() || "Luggage Storage Marketplace";
  const safeName = escapeHtml(params.displayName.trim() || "Traveller");
  const actionUrl = resolvePublicEmailUrl(params.verificationUrl, params.publicBaseUrl);
  const safeActionUrl = escapeHtml(actionUrl);
  const resendUrl = resolvePublicEmailUrl("/verify-email", params.publicBaseUrl);
  const safeResendUrl = escapeHtml(resendUrl);

  const subject = `Verify your ${brand} account`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px 24px;">
          <tr>
            <td>
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb;">${escapeHtml(brand)}</p>
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;color:#0f172a;">Verify your email address</h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Hello ${safeName},</p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#334155;">
                Welcome to ${escapeHtml(brand)}. Please confirm your email address to activate your account.
              </p>
              <p style="margin:0 0 24px 0;">
                <a href="${safeActionUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">Verify Email Address</a>
              </p>
              <p style="margin:0 0 12px 0;font-size:13px;line-height:1.5;color:#475569;">
                Or copy and paste this link into your browser:<br />
                <a href="${safeActionUrl}" style="color:#2563eb;word-break:break-all;">${safeActionUrl}</a>
              </p>
              <p style="margin:0 0 16px 0;font-size:13px;line-height:1.5;color:#64748b;">
                <strong>Expiration:</strong> This verification link is valid for <strong>24 hours</strong> and can only be used once.
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
              <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">
                Need a new verification link? Request a fresh email anytime at
                <a href="${safeResendUrl}" style="color:#2563eb;">${safeResendUrl}</a>.
                If you did not create an account with ${escapeHtml(brand)}, you can safely ignore this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${brand} — Verify your email address`,
    "",
    `Hello ${params.displayName.trim() || "Traveller"},`,
    "",
    `Welcome to ${brand}. Please confirm your email address to activate your account by opening the link below:`,
    actionUrl,
    "",
    "Expiration: This verification link is valid for 24 hours and can only be used once.",
    "",
    `Need a new verification link? Request a resend at: ${resendUrl}`,
    `If you did not create an account with ${brand}, you can safely ignore this message.`
  ].join("\n");

  return {
    subject,
    html,
    text,
    actionUrl,
    resendUrl
  };
}

export function buildPasswordResetEmailTemplate(params: {
  displayName: string;
  resetUrl: string;
  publicBaseUrl: string;
  brandName?: string;
}): RenderedEmailTemplate {
  const brand = params.brandName?.trim() || "Luggage Storage Marketplace";
  const safeName = escapeHtml(params.displayName.trim() || "Traveller");
  const normalizedPath = params.resetUrl.trim().replace(/^\/auth\/reset-password/, "/reset-password");
  const actionUrl = resolvePublicEmailUrl(normalizedPath, params.publicBaseUrl);
  const safeActionUrl = escapeHtml(actionUrl);
  const resendUrl = resolvePublicEmailUrl("/forgot-password", params.publicBaseUrl);
  const safeResendUrl = escapeHtml(resendUrl);

  const subject = `Reset your ${brand} password`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px 24px;">
          <tr>
            <td>
              <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb;">${escapeHtml(brand)}</p>
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;color:#0f172a;">Password recovery request</h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;">Hello ${safeName},</p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#334155;">
                We received a request to reset your ${escapeHtml(brand)} password. Use the button below to choose a new password:
              </p>
              <p style="margin:0 0 24px 0;">
                <a href="${safeActionUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">Reset Password</a>
              </p>
              <p style="margin:0 0 12px 0;font-size:13px;line-height:1.5;color:#475569;">
                Or copy and paste this link into your browser:<br />
                <a href="${safeActionUrl}" style="color:#2563eb;word-break:break-all;">${safeActionUrl}</a>
              </p>
              <p style="margin:0 0 16px 0;font-size:13px;line-height:1.5;color:#64748b;">
                <strong>Expiration:</strong> This password reset link expires in <strong>60 minutes</strong> and is valid for a single use.
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
              <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">
                If this link expires, you can request a new one at
                <a href="${safeResendUrl}" style="color:#2563eb;">${safeResendUrl}</a>.
                If you did not request a password reset, no changes have been made to your account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${brand} — Password recovery request`,
    "",
    `Hello ${params.displayName.trim() || "Traveller"},`,
    "",
    `We received a request to reset your ${brand} password. Open the link below to set a new password:`,
    actionUrl,
    "",
    "Expiration: This password reset link expires in 60 minutes and is valid for a single use.",
    "",
    `Need a new link? Visit: ${resendUrl}`,
    "If you did not request a password reset, no changes have been made to your account."
  ].join("\n");

  return {
    subject,
    html,
    text,
    actionUrl,
    resendUrl
  };
}
