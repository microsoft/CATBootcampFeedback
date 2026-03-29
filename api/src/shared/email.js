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

module.exports = { sendEmail };
