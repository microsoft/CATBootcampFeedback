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
const { sendEmail } = require('../shared/email');

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
            const emailSubject = 'Welcome to CAT Bootcamp Feedback';
            const name = recipientName || username;
            const rolesHtml = (roles || []).map(r => {
                const [label, desc] = r.split(' — ');
                return `<tr><td style="padding:6px 12px;font-weight:600;color:#4f46e5;">${label || r}</td><td style="padding:6px 12px;color:#64748b;">${desc || ''}</td></tr>`;
            }).join('');

            const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 36px;">
    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">CAT Bootcamp Feedback</h1>
    <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Training Feedback Management System</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px 36px;">
    <p style="font-size:16px;color:#1e293b;margin:0 0 16px;">Hello ${name},</p>
    <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 24px;">An account has been created for you. Here are your login details:</p>

    <!-- Credentials Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 24px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:4px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Username</td>
            <td style="padding:4px 0;font-size:15px;color:#0f172a;font-weight:600;text-align:right;">${username}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Temporary Password</td>
            <td style="padding:4px 0;font-size:15px;color:#0f172a;font-weight:600;font-family:'Courier New',monospace;text-align:right;">${temporaryPassword}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <!-- Login Button -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td align="center">
        <a href="${loginUrl || '#'}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:0.3px;">Sign In Now</a>
      </td></tr>
    </table>

    <!-- Password Warning -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 6px 6px 0;margin:0 0 24px;">
      <tr><td style="padding:12px 16px;">
        <p style="margin:0;font-size:13px;color:#9a3412;font-weight:600;">You will be required to change your password on first login.</p>
      </td></tr>
    </table>

    <!-- Permissions -->
    ${rolesHtml ? `
    <p style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin:0 0 8px;">Your Permissions</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 24px;">
      ${rolesHtml}
    </table>
    ` : ''}

    <p style="font-size:13px;color:#94a3b8;margin:0;">If you have any questions, please contact your administrator.</p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">CAT Bootcamp Feedback System &bull; This is an automated message</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

            const emailText = [
                `Hello ${name},`,
                '',
                'An account has been created for you on the CAT Bootcamp Feedback System.',
                '',
                'Login Details:',
                `  URL:      ${loginUrl || 'Contact your administrator'}`,
                `  Username: ${username}`,
                `  Password: ${temporaryPassword}`,
                '',
                'You will be required to change your password on first login.',
                '',
                'Your Permissions:',
                ...(roles || []).map(r => `  - ${r}`),
                '',
                'If you have any questions, contact your administrator.',
                '',
                '— CAT Bootcamp Feedback System'
            ].join('\n');

            // Send email via Azure Communication Services (or log if not configured)
            const emailResult = await sendEmail({
                to: recipientEmail,
                cc: creatorEmail || undefined,
                subject: emailSubject,
                text: emailText,
                html: emailHtml
            });
            const emailSent = emailResult.sent;

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
