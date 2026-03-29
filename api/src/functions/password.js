/**
 * Password Management API
 *
 * PUT  /api/users/me/password           - Change own password (requires current password)
 * POST /api/users/{userId}/reset-password - Admin-initiated password reset
 */

const { app } = require('@azure/functions');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, mutate } = require('../shared/database');
const { requireAuth, requireRole, getAuthenticatedUser } = require('../shared/auth');
const { addSecurityHeaders } = require('../shared/utils');
const { rateLimit } = require('../shared/rate-limiter');
const { audit } = require('../shared/audit');
const { sendEmail } = require('../shared/email');

const BCRYPT_SALT_ROUNDS = 10;

// Per-email rate limiting for password reset and username recovery
// 2 requests per 15 minutes per email address
const emailRateLimits = new Map();
const EMAIL_RATE_MAX = 2;
const EMAIL_RATE_WINDOW = 15 * 60 * 1000; // 15 minutes

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of emailRateLimits.entries()) {
        if (now - data.firstAttempt > EMAIL_RATE_WINDOW) emailRateLimits.delete(key);
    }
}, 5 * 60 * 1000);

function checkEmailRateLimit(email, action) {
    const key = `${action}:${email.toLowerCase().trim()}`;
    const now = Date.now();
    const entry = emailRateLimits.get(key);

    if (!entry || now - entry.firstAttempt > EMAIL_RATE_WINDOW) {
        emailRateLimits.set(key, { count: 1, firstAttempt: now });
        return null; // Allowed
    }

    if (entry.count >= EMAIL_RATE_MAX) {
        const retryAfter = Math.ceil((EMAIL_RATE_WINDOW - (now - entry.firstAttempt)) / 1000);
        return addSecurityHeaders({
            status: 429,
            jsonBody: {
                success: false,
                message: `Too many requests for this email address. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
                code: 'RATE_LIMIT_EMAIL',
                retryAfter
            }
        });
    }

    entry.count++;
    return null; // Allowed
}

// ──────────────────────────────────────────────
// PUT /api/users/me/password
// ──────────────────────────────────────────────
app.http('changeOwnPassword', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'users/me/password',
    handler: async (request, context) => {
        const authError = requireAuth(request);
        if (authError) return authError;

        const rateLimitError = rateLimit(request, 'admin');
        if (rateLimitError) return rateLimitError;

        try {
            const caller = getAuthenticatedUser(request);
            const body = JSON.parse(await request.text());
            const { currentPassword, newPassword } = body;

            if (!currentPassword || !newPassword) {
                return addSecurityHeaders({
                    status: 400,
                    jsonBody: { success: false, message: 'Current password and new password are required' }
                });
            }

            if (newPassword.length < 8) {
                return addSecurityHeaders({
                    status: 400,
                    jsonBody: { success: false, message: 'New password must be at least 8 characters' }
                });
            }

            if (currentPassword === newPassword) {
                return addSecurityHeaders({
                    status: 400,
                    jsonBody: { success: false, message: 'New password must be different from current password' }
                });
            }

            // Look up user in database
            const users = await query(
                'SELECT UserId, PasswordHash FROM Users WHERE LOWER(Username) = LOWER(@username)',
                { username: caller.username }
            );

            if (users.length === 0) {
                return addSecurityHeaders({
                    status: 404,
                    jsonBody: { success: false, message: 'User not found' }
                });
            }

            // Verify current password
            const isValid = await bcrypt.compare(currentPassword, users[0].PasswordHash);
            if (!isValid) {
                return addSecurityHeaders({
                    status: 401,
                    jsonBody: { success: false, message: 'Current password is incorrect' }
                });
            }

            // Hash and update
            const newHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
            await mutate(
                `UPDATE Users
                 SET PasswordHash = @newHash, MustChangePassword = 0,
                     UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @username
                 WHERE UserId = @userId`,
                { newHash, username: caller.username, userId: users[0].UserId }
            );

            context.log(`Password changed by user: ${caller.username}`);
            await audit(request, 'CHANGE_PASSWORD', 'Password', users[0].UserId, `Changed own password`);

            return addSecurityHeaders({
                status: 200,
                jsonBody: { success: true, message: 'Password changed successfully' }
            });

        } catch (err) {
            context.log('Change password error:', err.message);
            return addSecurityHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Failed to change password' }
            });
        }
    }
});

// ──────────────────────────────────────────────
// POST /api/users/{userId}/reset-password
// ──────────────────────────────────────────────
app.http('resetUserPassword', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'users/{userId}/reset-password',
    handler: async (request, context) => {
        const roleError = requireRole(request, 'UserAdmin');
        if (roleError) return roleError;

        const userId = parseInt(request.params.userId, 10);
        if (isNaN(userId)) {
            return addSecurityHeaders({
                status: 400,
                jsonBody: { success: false, message: 'Invalid user ID' }
            });
        }

        try {
            const users = await query(
                'SELECT UserId, Username FROM Users WHERE UserId = @userId',
                { userId }
            );

            if (users.length === 0) {
                return addSecurityHeaders({
                    status: 404,
                    jsonBody: { success: false, message: 'User not found' }
                });
            }

            // Generate a secure temporary password
            const tempPassword = generateTemporaryPassword();
            const tempHash = await bcrypt.hash(tempPassword, BCRYPT_SALT_ROUNDS);

            const caller = getAuthenticatedUser(request);

            await mutate(
                `UPDATE Users
                 SET PasswordHash = @tempHash, MustChangePassword = 1,
                     UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @updatedBy
                 WHERE UserId = @userId`,
                { tempHash, updatedBy: caller.username, userId }
            );

            context.log(`Password reset for ${users[0].Username} (UserId=${userId}) by ${caller.username}`);
            await audit(request, 'RESET_PASSWORD', 'Password', userId, `Reset password for ${users[0].Username}`);

            return addSecurityHeaders({
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Password has been reset. Communicate the temporary password to the user securely.',
                    data: {
                        temporaryPassword: tempPassword,
                        username: users[0].Username,
                        mustChangePassword: true
                    }
                }
            });

        } catch (err) {
            context.log('Reset password error:', err.message);
            return addSecurityHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Failed to reset password' }
            });
        }
    }
});

// ──────────────────────────────────────────────
// POST /api/password-reset/request  (PUBLIC — rate limited)
// User provides email, system sends reset instructions
// ──────────────────────────────────────────────
app.http('requestPasswordReset', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'password-reset/request',
    handler: async (request, context) => {
        const ipRateLimitError = rateLimit(request, 'login');
        if (ipRateLimitError) return ipRateLimitError;

        try {
            const body = JSON.parse(await request.text());
            const { email } = body;

            if (!email) {
                return addSecurityHeaders({
                    status: 400,
                    jsonBody: { success: false, message: 'Email is required' }
                });
            }

            // Per-email rate limit: 2 requests per 15 minutes
            const emailLimitError = checkEmailRateLimit(email, 'password-reset');
            if (emailLimitError) {
                context.log(`Password reset rate limited for email: ${email}`);
                return emailLimitError;
            }

            // Always return success to avoid revealing whether the email exists
            const successResponse = addSecurityHeaders({
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'If an account with that email exists, a password reset has been initiated. Please contact your administrator for assistance.'
                }
            });

            // Look up user by email
            const users = await query(
                'SELECT UserId, Username, Email FROM Users WHERE LOWER(Email) = LOWER(@email) AND IsActive = 1',
                { email: email.trim() }
            );

            if (users.length === 0) {
                context.log(`Password reset requested for unknown email: ${email}`);
                return successResponse;
            }

            // Generate reset token and store it
            const resetToken = crypto.randomBytes(32).toString('hex');
            const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            await mutate(
                `UPDATE Users SET PasswordResetToken = @token, PasswordResetExpiry = @expiry WHERE UserId = @userId`,
                { token: resetToken, expiry, userId: users[0].UserId }
            );

            await sendEmail({
                to: users[0].Email,
                subject: 'Password Reset — CAT Bootcamp Feedback',
                text: [
                    `Hello ${users[0].Username},`,
                    '',
                    'A password reset was requested for your account on the CAT Bootcamp Feedback System.',
                    '',
                    'Please contact your administrator to complete the reset.',
                    '',
                    'If you did not request this, you can safely ignore this message.',
                    '',
                    '— CAT Bootcamp Feedback System'
                ].join('\n')
            });

            return successResponse;

        } catch (err) {
            context.log('Password reset request error:', err.message);
            return addSecurityHeaders({
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'If an account with that email exists, a password reset has been initiated. Please contact your administrator for assistance.'
                }
            });
        }
    }
});

// ──────────────────────────────────────────────
// POST /api/username-recovery  (PUBLIC — rate limited)
// User provides email, system sends their username
// ──────────────────────────────────────────────
app.http('recoverUsername', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'username-recovery',
    handler: async (request, context) => {
        const ipRateLimitError = rateLimit(request, 'login');
        if (ipRateLimitError) return ipRateLimitError;

        try {
            const body = JSON.parse(await request.text());
            const { email } = body;

            if (!email) {
                return addSecurityHeaders({
                    status: 400,
                    jsonBody: { success: false, message: 'Email is required' }
                });
            }

            // Per-email rate limit: 2 requests per 15 minutes
            const emailLimitError = checkEmailRateLimit(email, 'username-recovery');
            if (emailLimitError) {
                context.log(`Username recovery rate limited for email: ${email}`);
                return emailLimitError;
            }

            // Always return success to avoid revealing whether the email exists
            const successResponse = addSecurityHeaders({
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'If an account with that email exists, your username information has been sent. Please contact your administrator for assistance.'
                }
            });

            const users = await query(
                'SELECT UserId, Username, Email FROM Users WHERE LOWER(Email) = LOWER(@email) AND IsActive = 1',
                { email: email.trim() }
            );

            if (users.length > 0) {
                await sendEmail({
                    to: users[0].Email,
                    subject: 'Your Username — CAT Bootcamp Feedback',
                    text: [
                        'Hello,',
                        '',
                        'A username recovery was requested for this email address.',
                        '',
                        `Your username is: ${users[0].Username}`,
                        '',
                        'You can log in at the admin panel using this username.',
                        'If you did not request this, you can safely ignore this message.',
                        '',
                        '— CAT Bootcamp Feedback System'
                    ].join('\n')
                });
            } else {
                context.log(`Username recovery requested for unknown email: ${email}`);
            }

            return successResponse;

        } catch (err) {
            context.log('Username recovery error:', err.message);
            return addSecurityHeaders({
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'If an account with that email exists, your username information has been sent. Please contact your administrator for assistance.'
                }
            });
        }
    }
});

/**
 * Generate a cryptographically random temporary password.
 */
function generateTemporaryPassword() {
    // Generate an unbiased random password using rejection sampling.
    // Avoids modulo bias by discarding values >= the largest multiple of charset length.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    const maxValid = 256 - (256 % chars.length); // largest usable value
    let password = '';
    while (password.length < 16) {
        const bytes = crypto.randomBytes(1);
        if (bytes[0] < maxValid) {
            password += chars[bytes[0] % chars.length];
        }
    }
    return password;
}
