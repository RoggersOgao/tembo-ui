// services/email.service.ts
import { emailConfig } from "../config/email.config";
import { emailTemplates } from "../templates/email.templates";
import { emailQueue } from "../utils/email-queue";
import { rateLimiter } from "../utils/rate-limiter";

export interface SendEmailOptions {
    to: string | string[];
    subject?: string; // Optional when using template
    template?: keyof typeof emailTemplates;
    templateData?: any;
    html?: string;
    text?: string;
    from?: string;
    attachments?: any[];
    scheduled?: Date;
    priority?: 'high' | 'normal' | 'low';
}

class EmailService {
    async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
        try {
            // Rate limiting check
            const recipientKey = Array.isArray(options.to) ? options.to.join(',') : options.to;
            const canSend = await rateLimiter.checkLimit(
                recipientKey,
                emailConfig.rateLimits.perHour,
                60 * 60 * 1000
            );

            if (!canSend) {
                throw new Error('Rate limit exceeded');
            }

            let html = options.html;
            let text = options.text;
            let subject = options.subject;

            // Use template if specified
            if (options.template && emailTemplates[options.template]) {
                const template = emailTemplates[options.template];
                html = template.html(options.templateData || {});
                text = template.text ? template.text(options.templateData || {}) : undefined;
                subject = subject || template.subject;
            }

            if (!html) {
                throw new Error('Email HTML content is required');
            }

            if (!subject) {
                throw new Error('Email subject is required');
            }

            // Add to queue with default from if not provided
            emailQueue.add({
                to: options.to,
                subject,
                html,
                text,
                from: options.from || emailConfig.defaultFrom,
                attachments: options.attachments,
                maxAttempts: emailConfig.retry.maxAttempts,
                scheduledFor: options.scheduled,
            });

            return { success: true };
        } catch (error: any) {
            console.error('Email service error:', error);
            return { success: false, error: error.message };
        }
    }

    async sendDeviceVerification(
        email: string,
        verificationCode: string,
        userName: string,
        deviceMetadata: {
            deviceName: string;
            browser?: string;
            browserVersion?: string;
            os?: string;
            location?: string;
            ipAddress?: string;
        }
    ): Promise<void> {
        await this.sendEmail({
            to: email,
            template: 'deviceVerification',
            templateData: {
                userName,
                verificationCode,
                deviceName: deviceMetadata.deviceName,
                browser: deviceMetadata.browser,
                location: deviceMetadata.location,
                ipAddress: deviceMetadata.ipAddress,
                expiresIn: '15 minutes'
            },
        });
    }

    async sendDeviceVerifiedSuccessfully(
        email: string,
        userName: string,
        deviceMetadata: {
            deviceName: string;
            browser?: string;
            deviceType?: string;
        }
    ): Promise<void> {
        await this.sendEmail({
            to: email,
            template: 'deviceVerifiedSuccessfully',
            templateData: {
                userName,
                deviceName: deviceMetadata.deviceName,
                browser: deviceMetadata.browser,
                deviceType: deviceMetadata.deviceType,
                verificationTime: new Date().toLocaleString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short'
                })
            },
        });
    }

    async sendVerificationEmail(email: string, token: string, userName?: string): Promise<void> {
        const domain = process.env.DOMAIN || 'http://localhost:3000';
        const confirmLink = `${domain}/auth/new-verification?token=${encodeURIComponent(token)}`;

        await this.sendEmail({
            to: email,
            template: 'verification',
            templateData: { confirmLink, userName },
        });
    }

    async sendTwoFactor(email: string, token: string, userName?: string): Promise<void> {

        await this.sendEmail({
            to: email,
            template: 'twoFactor',
            templateData: { token, userName, email },
        });
    }

    async sendPasswordResetEmail(email: string, token: string, expires?: String): Promise<void> {
        const domain = process.env.DOMAIN || 'http://localhost:3000';

        const resetLink = `${domain}/auth/new-password?token=${token}`;

        await this.sendEmail({
            to: email,
            template: 'passwordReset',
            templateData: { resetLink, expires },
        });
    }

    async sendWelcomeEmail(email: string, userName: string): Promise<void> {
        const domain = process.env.DOMAIN || 'http://localhost:3000';
        const dashboardLink = `${domain}/dashboard`;

        await this.sendEmail({
            to: email,
            template: 'welcome',
            templateData: { userName, dashboardLink },
        });
    }

    async sendBulkEmails(emails: string[], options: Omit<SendEmailOptions, 'to'>): Promise<void> {
        // Send in batches to avoid overwhelming the system
        const batchSize = 50;

        for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);

            await Promise.all(
                batch.map(email =>
                    this.sendEmail({
                        ...options,
                        to: email,
                    })
                )
            );

            // Delay between batches
            if (i + batchSize < emails.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
}

export const emailService = new EmailService();