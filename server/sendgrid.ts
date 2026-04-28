// SendGrid integration for email notifications
import sgMail from '@sendgrid/mail';
import { logger } from "./lib/logger";
import { maskEmail } from "./lib/safeLogger";

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key,
    email: connectionSettings.settings.from_email
  };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getUncachableSendGridClient() {
  const { apiKey, email } = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  // Optional SendGrid `custom_args`. Echoed back on every event in the SendGrid
  // event webhook payload, so callers (e.g. first-booking emails — Task #81)
  // can round-trip an outboundMessageId for open/click attribution.
  customArgs?: Record<string, string>;
}

// Result of a send. `messageId` is the SendGrid `X-Message-Id` header from the
// API response — the same value SendGrid reports as `sg_message_id` on every
// event in the event webhook payload, so callers can persist it for fallback
// attribution when customArgs are missing.
export interface SendEmailResult {
  ok: boolean;
  messageId: string | null;
}

export async function sendEmail(options: EmailOptions): Promise<boolean>;
export async function sendEmail(options: EmailOptions, opts: { withResult: true }): Promise<SendEmailResult>;
export async function sendEmail(
  options: EmailOptions,
  opts?: { withResult?: boolean },
): Promise<boolean | SendEmailResult> {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const payload: Record<string, unknown> = {
      to: options.to,
      from: {
        email: fromEmail,
        name: "GigAid Notification"
      },
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
    };
    if (options.customArgs && Object.keys(options.customArgs).length > 0) {
      payload.customArgs = options.customArgs;
    }

    const response = await client.send(payload as any);
    // sgMail.send returns [response, body]; pick the first response's headers.
    let messageId: string | null = null;
    if (Array.isArray(response) && response[0]?.headers) {
      const raw = response[0].headers["x-message-id"] ?? response[0].headers["X-Message-Id"];
      if (typeof raw === "string") messageId = raw;
    }

    logger.info(`Email sent successfully to ${maskEmail(options.to)}`);
    return opts?.withResult ? { ok: true, messageId } : true;
  } catch (error) {
    logger.error('Failed to send email:', error);
    return opts?.withResult ? { ok: false, messageId: null } : false;
  }
}
