/**
 * Email Service
 *
 * Sends emails via Azure Communication Services.
 * Falls back to console logging when not configured.
 */

const CONN_STR = process.env.AZURE_COMM_CONNECTION_STRING;
const SENDER = process.env.EMAIL_SENDER_ADDRESS || 'DoNotReply@azurecomm.net';

let emailClient = null;

function getClient() {
    if (!CONN_STR) return null;
    if (!emailClient) {
        const { EmailClient } = require('@azure/communication-email');
        emailClient = new EmailClient(CONN_STR);
    }
    return emailClient;
}

/**
 * Send an email. Returns { sent: true/false, message: string }.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} [options.cc] - CC email (optional)
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} [options.html] - HTML body (optional)
 */
async function sendEmail({ to, cc, subject, text, html }) {
    const client = getClient();

    if (!client) {
        // No email service configured — log to console
        console.log('─────────────────────────────────────────');
        console.log('[EMAIL - DEV MODE] No email service configured.');
        console.log(`To: ${to}${cc ? `\nCC: ${cc}` : ''}`);
        console.log(`Subject: ${subject}`);
        console.log('');
        console.log(text);
        console.log('─────────────────────────────────────────');
        return { sent: false, message: 'Email service not configured. Content logged to console.' };
    }

    try {
        const message = {
            senderAddress: SENDER,
            recipients: {
                to: [{ address: to }],
            },
            content: {
                subject,
                plainText: text,
                html: html || undefined,
            },
        };

        if (cc) {
            message.recipients.cc = [{ address: cc }];
        }

        const poller = await client.beginSend(message);
        const result = await poller.pollUntilDone();

        if (result.status === 'Succeeded') {
            console.log(`[EMAIL] Sent to ${to}: "${subject}"`);
            return { sent: true, message: 'Email sent successfully.' };
        } else {
            console.error(`[EMAIL] Failed to send to ${to}: ${result.status}`, result.error);
            return { sent: false, message: `Email delivery failed: ${result.status}` };
        }
    } catch (err) {
        console.error(`[EMAIL] Error sending to ${to}:`, err.message);
        return { sent: false, message: `Email error: ${err.message}` };
    }
}

/**
 * Build a styled HTML email using the CAT Bootcamp template.
 * @param {Object} options
 * @param {string} options.title - Header title
 * @param {string} options.greeting - e.g., "Hello Jane,"
 * @param {string} options.body - HTML content for the main body
 * @param {string} [options.note] - Optional grey note at the bottom
 */
function buildEmailHtml({ title, greeting, body, note }) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 36px;">
    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">CAT Bootcamp Feedback</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${title}</p>
  </td></tr>
  <tr><td style="padding:32px 36px;">
    <p style="font-size:16px;color:#1e293b;margin:0 0 16px;">${greeting}</p>
    ${body}
    ${note ? `<p style="font-size:13px;color:#94a3b8;margin:24px 0 0;">${note}</p>` : ''}
  </td></tr>
  <tr><td style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">CAT Bootcamp Feedback System &bull; This is an automated message</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

module.exports = { sendEmail, buildEmailHtml };
