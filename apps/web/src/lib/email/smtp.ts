import nodemailer from 'nodemailer';
import { validateSmtpConfig, SmtpConfig } from '@project-hub/shared';

export interface SendInvitationEmailOptions {
  recipientEmail: string;
  recipientName?: string;
  inviterName: string;
  inviterRole: string;
  orgName: string;
  inviteLink: string;
  expiresAt: string | Date;
  isExistingUser?: boolean;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Creates and verifies a Nodemailer SMTP transporter.
 */
export function getSmtpTransporter(config?: SmtpConfig) {
  const validated = config || validateSmtpConfig(process.env);

  const transporter = nodemailer.createTransport({
    host: validated.SMTP_HOST,
    port: validated.SMTP_PORT,
    secure: validated.SMTP_PORT === 465, // true for 465, false for 587 / STARTTLS
    auth: {
      user: validated.SMTP_USER,
      pass: validated.SMTP_PASS,
    },
    connectionTimeout: 10000, // 10s connection timeout
    greetingTimeout: 5000,
    socketTimeout: 15000,
  });

  return { transporter, config: validated };
}

/**
 * Generates plain text and clean HTML email for invitations (Inter font, design tokens, zero emojis).
 */
export function buildInvitationEmailTemplate(options: SendInvitationEmailOptions) {
  const expirationStr = new Date(options.expiresAt).toUTCString();
  const recipientDisplay = options.recipientName ? options.recipientName : options.recipientEmail;

  const plainText = `
You are invited to join ${options.orgName} on Project Hub.

Hello ${recipientDisplay},

${options.inviterName} (${options.inviterRole}) has invited you to join the team on Project Hub.

Accept your invitation here:
${options.inviteLink}

This invitation link expires on: ${expirationStr}.

${
  options.isExistingUser
    ? 'Since you already have an account, log in with your credentials to join this organization.'
    : 'New members must create a secure password (minimum 10 characters, with uppercase, lowercase, numbers, and symbols) and configure Two-Factor Authentication (2FA) upon initial sign in.'
}

If you did not expect this invitation, you can safely ignore this email.
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to join ${options.orgName}</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #F8FAFC;
      color: #0F172A;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #F8FAFC;
      padding: 40px 16px;
    }
    .container {
      max-width: 540px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      color: #2563EB;
      background-color: #EFF6FF;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #0F172A;
      margin: 0 0 12px 0;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 13px;
      line-height: 1.6;
      color: #475569;
      margin: 0 0 16px 0;
    }
    .card-highlight {
      background-color: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 16px;
      margin: 20px 0;
    }
    .card-highlight p {
      margin: 0;
      font-size: 12px;
      color: #334155;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0;
    }
    .btn {
      display: inline-block;
      background-color: #2563EB;
      color: #FFFFFF !important;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 10px;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }
    .link-alt {
      font-size: 11px;
      word-break: break-all;
      color: #64748B;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #F1F5F9;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #94A3B8;
      margin-top: 28px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header-badge">Team Invitation</div>
      <h1>Join ${options.orgName}</h1>
      <p>Hello ${recipientDisplay},</p>
      <p><strong>${options.inviterName}</strong> (${options.inviterRole}) has invited you to collaborate on <strong>${options.orgName}</strong> through Project Hub.</p>
      
      <div class="card-highlight">
        <p><strong>Security Requirements:</strong> ${
          options.isExistingUser
            ? 'Sign in with your existing account credentials to access this workspace.'
            : 'You will configure your password (10+ characters with uppercase, lowercase, numbers, and symbols) and complete Two-Factor Authentication (2FA) setup upon accepting.'
        }</p>
        <p style="margin-top: 8px; color: #64748B; font-size: 11px;">Expires on: ${expirationStr}</p>
      </div>

      <div class="btn-container">
        <a href="${options.inviteLink}" class="btn" target="_blank" rel="noopener noreferrer">Accept Invitation</a>
      </div>

      <div class="link-alt">
        If the button above does not work, copy and paste this URL into your browser:<br>
        <a href="${options.inviteLink}" style="color: #2563EB; text-decoration: underline;">${options.inviteLink}</a>
      </div>
    </div>
    <div class="footer">
      Project Hub &bull; Unified Enterprise Workspace &bull; Light Theme Only
    </div>
  </div>
</body>
</html>
`.trim();

  return { plainText, html };
}

/**
 * Sends an invitation email with error handling, non-blocking execution, and exponential retry.
 */
export async function sendInvitationEmail(
  options: SendInvitationEmailOptions
): Promise<EmailResult> {
  let config: SmtpConfig;
  try {
    config = validateSmtpConfig(process.env);
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
    };
  }

  const { transporter } = getSmtpTransporter(config);
  const { plainText, html } = buildInvitationEmailTemplate(options);
  const fromAddress = `"${config.SMTP_FROM_NAME}" <${config.SMTP_FROM_EMAIL || config.SMTP_USER}>`;

  const mailOptions = {
    from: fromAddress,
    to: options.recipientEmail,
    subject: `Invitation: Join ${options.orgName} on Project Hub`,
    text: plainText,
    html: html,
  };

  // Exponential backoff retry loop (max 3 attempts)
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err: any) {
      lastError = err.message || 'Unknown SMTP error';

      // Dissect common SMTP failure codes
      if (err.code === 'EAUTH') {
        lastError = 'SMTP Authentication failed. Verify that your Google App Password is correct and 2-Step Verification is enabled.';
        break; // Do not retry on auth error
      } else if (err.code === 'EDNS' || err.code === 'ENOTFOUND') {
        lastError = `SMTP host '${config.SMTP_HOST}' could not be resolved.`;
        break;
      } else if (err.code === 'EENVELOPE') {
        lastError = `Recipient email address '${options.recipientEmail}' was rejected by the mail server.`;
        break;
      }

      // Wait with exponential backoff before next attempt: 1s, 2s
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  return {
    success: false,
    error: `Failed to deliver invitation email after retries: ${lastError}`,
  };
}

/**
 * Healthcheck test sending a single email to verify SMTP credentials.
 */
export async function testSmtpHealth(testRecipient: string): Promise<EmailResult> {
  try {
    const config = validateSmtpConfig(process.env);
    const { transporter } = getSmtpTransporter(config);

    // 1. Verify connection
    await transporter.verify();

    // 2. Send test email
    const info = await transporter.sendMail({
      from: `"${config.SMTP_FROM_NAME}" <${config.SMTP_FROM_EMAIL || config.SMTP_USER}>`,
      to: testRecipient,
      subject: `Project Hub - SMTP Health Check`,
      text: `This is a test email sent from Project Hub to verify SMTP configuration.\n\nHost: ${config.SMTP_HOST}\nPort: ${config.SMTP_PORT}\nTimestamp: ${new Date().toISOString()}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-top: 0;">Project Hub SMTP Health Check</h2>
          <p>Your SMTP email configuration is active and communicating successfully with the mail server.</p>
          <ul style="font-size: 13px; color: #475569;">
            <li><strong>SMTP Host:</strong> ${config.SMTP_HOST}</li>
            <li><strong>SMTP Port:</strong> ${config.SMTP_PORT}</li>
            <li><strong>Sent To:</strong> ${testRecipient}</li>
            <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
          </ul>
        </div>
      `,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'SMTP Health check failed',
    };
  }
}

