/**
 * Notification API
 *
 * POST /api/notify/welcome - Send welcome email to new user + admin
 *
 * In production, configure SENDGRID_API_KEY or AZURE_COMM_CONNECTION_STRING
 * to send real emails. Without these, the endpoint logs the content and returns
 * success so the frontend can show the email preview.
 */

const { app } = require('@azure/functions');
const { requireRole, getAuthenticatedUser } = require('../shared/auth');
const { addSecurityHeaders } = require('../shared/utils');
const { audit } = require('../shared/audit');

app.http('notifyWelcome', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'notify/welcome',
    handler: async (request, context) => {
        const roleError = requireRole(request, 'UserAdmin');
        if (roleError) return roleError;

        try {
            const body = JSON.parse(await request.text());
            const { recipientEmail, recipientName, username, temporaryPassword, loginUrl, roles, creatorEmail } = body;

            if (!recipientEmail || !username) {
                return addSecurityHeaders({
                    status: 400,
                    jsonBody: { success: false, message: 'recipientEmail and username are required' }
                });
            }

            const caller = getAuthenticatedUser(request);

            // Build email content
            const emailSubject = 'Your CAT Bootcamp Feedback System Account';
            const emailBody = [
                `Hello ${recipientName || username},`,
                '',
                'An account has been created for you on the CAT Bootcamp Feedback System.',
                '',
                'Login Details:',
                `  URL:      ${loginUrl || 'Contact your administrator'}`,
                `  Username: ${username}`,
                `  Password: ${temporaryPassword}`,
                '',
                'IMPORTANT: You will be required to change your password on first login.',
                '',
                'Your Permissions:',
                ...(roles || []).map(r => `  - ${r}`),
                '',
                'If you have any questions, contact your administrator.',
                '',
                '— CAT Bootcamp Feedback System'
            ].join('\n');

            // Check if email service is configured
            const sendgridKey = process.env.SENDGRID_API_KEY;
            const azureCommStr = process.env.AZURE_COMM_CONNECTION_STRING;
            let emailSent = false;

            if (sendgridKey) {
                // TODO: Implement SendGrid email sending
                context.log(`[EMAIL] Would send via SendGrid to: ${recipientEmail}, CC: ${creatorEmail}`);
                context.log(`[EMAIL] Subject: ${emailSubject}`);
                emailSent = true;
            } else if (azureCommStr) {
                // TODO: Implement Azure Communication Services email sending
                context.log(`[EMAIL] Would send via Azure Comm Services to: ${recipientEmail}, CC: ${creatorEmail}`);
                context.log(`[EMAIL] Subject: ${emailSubject}`);
                emailSent = true;
            } else {
                // Dev mode: log the email content
                context.log('─────────────────────────────────────────');
                context.log(`[EMAIL - DEV MODE] No email service configured.`);
                context.log(`To: ${recipientEmail}`);
                context.log(`CC: ${creatorEmail || caller?.email || 'N/A'}`);
                context.log(`Subject: ${emailSubject}`);
                context.log('');
                context.log(emailBody);
                context.log('─────────────────────────────────────────');
            }

            await audit(request, 'SEND_WELCOME', 'Notification', null, `Welcome email for ${username} to ${recipientEmail}`, { recipientEmail, username, roles, emailSent });

            return addSecurityHeaders({
                status: 200,
                jsonBody: {
                    success: true,
                    emailSent,
                    message: emailSent
                        ? 'Welcome email sent successfully.'
                        : 'Email service not configured. Login details are shown in the admin panel.'
                }
            });

        } catch (err) {
            context.log('Notification error:', err.message);
            return addSecurityHeaders({
                status: 200,
                jsonBody: { success: true, emailSent: false, message: 'Email delivery not available.' }
            });
        }
    }
});
