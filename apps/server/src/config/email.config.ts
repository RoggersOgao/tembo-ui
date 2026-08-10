// config/email.config.ts
import { ENV } from './config';
import { logger } from '@repo/logger';

export const emailConfig = {
    // Service identifier (optional, for logging)
    service: ENV.EMAIL_SERVICE,

    // Authentication method (only relevant for Gmail)
    authMethod: ENV.EMAIL_AUTH_METHOD || 'password',

    // SMTP Configuration (works with ANY provider)
    host: ENV.EMAIL_HOST,
    port: ENV.EMAIL_PORT,
    secure: ENV.EMAIL_SECURE, // true for 465, false for 587

    // Authentication
    auth: {
        user: ENV.EMAIL_USER,
        pass: ENV.EMAIL_PASSWORD,
    },

    // OAuth2 configuration (ONLY for Gmail when EMAIL_AUTH_METHOD=oauth2)
    oauth2:
        ENV.EMAIL_SERVICE === 'gmail' &&
            ENV.EMAIL_AUTH_METHOD === 'oauth2' &&
            ENV.GMAIL_CLIENT_ID &&
            ENV.GMAIL_CLIENT_SECRET
            ? {
                clientId: ENV.GMAIL_CLIENT_ID,
                clientSecret: ENV.GMAIL_CLIENT_SECRET,
                refreshToken: ENV.GMAIL_REFRESH_TOKEN, // Optional - can be loaded from file
            }
            : undefined,

    // Rate limiting (adjust based on your provider's limits)
    rateLimits: {
        perSecond: ENV.RATE_LIMIT_PER_SECOND,
        perHour: ENV.RATE_LIMIT_PER_HOUR,
        perDay: ENV.RATE_LIMIT_PER_DAY,
    },

    // Retry configuration
    retry: {
        maxAttempts: ENV.EMAIL_RETRY_ATTEMPTS,
        backoffMs: ENV.EMAIL_RETRY_BACKOFF,
    },

    // Default "from" address
    defaultFrom: ENV.EMAIL_FROM,
};

// Validate required email configuration on startup
export function validateEmailConfig() {
    const authMethod = ENV.EMAIL_AUTH_METHOD || 'password';

    if (authMethod === 'oauth2') {
        // OAuth2 mode (Gmail only): host/port/password are irrelevant —
        // nodemailer resolves Gmail's SMTP endpoint internally via
        // `service: 'gmail'`. Only require what OAuth2 actually needs.
        const missing: string[] = [];
        if (!ENV.EMAIL_USER) missing.push('EMAIL_USER');
        if (!ENV.GMAIL_CLIENT_ID) missing.push('GMAIL_CLIENT_ID');
        if (!ENV.GMAIL_CLIENT_SECRET) missing.push('GMAIL_CLIENT_SECRET');

        if (missing.length > 0) {
            throw new Error(
                `Missing required email configuration: ${missing.join(', ')}\n` +
                'OAuth2 selected but credentials missing.\n' +
                'Provide GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and EMAIL_USER, ' +
                'or run: npm run setup-gmail-oauth'
            );
        }

        // GMAIL_REFRESH_TOKEN is not required here — if it's absent, the
        // transporter falls back to reading a local token file (dev only).
        // In production it should always be set, but that's an operational
        // concern, not a hard startup requirement.
        logger.info('Email configuration validated (OAuth2 mode)');
        return;
    }

    // Standard SMTP mode: host + user + password are required, since
    // nodemailer needs explicit connection details for non-service transports.
    const requiredVars = ['EMAIL_USER', 'EMAIL_HOST'];
    const missing = requiredVars.filter(key => !ENV[key as keyof typeof ENV]);

    if (missing.length > 0) {
        throw new Error(
            `Missing required email configuration: ${missing.join(', ')}\n` +
            'Please check your .env file.'
        );
    }

    if (!ENV.EMAIL_PASSWORD) {
        throw new Error(
            'EMAIL_PASSWORD is required for standard SMTP authentication.\n' +
            'For Gmail, generate an App Password at: https://myaccount.google.com/apppasswords'
        );
    }
    logger.info('Email configuration validated (SMTP mode)');
}

// Provider-specific configuration helpers.
// NOTE: these are reference defaults, not auto-applied. Nothing in this file
// currently reads providerConfigs[EMAIL_SERVICE] and merges it into
// emailConfig.host/port/secure/auth.user — you still need to set EMAIL_HOST,
// EMAIL_PORT, EMAIL_SECURE (and EMAIL_USER for providers like Resend/SendGrid
// that use a fixed username) yourself in .env, using the values below as a
// reference. If you want these applied automatically, see the helper below.
export const providerConfigs = {
    gmail: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
    },
    resend: {
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        user: 'resend',
    },
    sendgrid: {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        user: 'apikey',
    },
    ses: {
        host: 'email-smtp.us-east-1.amazonaws.com',
        port: 587,
        secure: false,
    },
    mailgun: {
        host: 'smtp.mailgun.org',
        port: 587,
        secure: false,
    },
    postmark: {
        host: 'smtp.postmarkapp.com',
        port: 587,
        secure: false,
    },
    brevo: {
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
    },
};