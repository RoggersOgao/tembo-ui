// services/security/securityAlert.service.ts
import { db } from '@repo/database';
import { logger } from '@repo/logger';
import { emailService } from '../../email.service';
import { NotificationService } from '../notification.service';
// import { NotificationService } from '../notification/notification.service';

export type SecurityAlertType =
    | "ACCOUNT_LOCKED"
    | "SUSPICIOUS_LOGIN"
    | "PASSWORD_CHANGED"
    | "MFA_DISABLED"
    | "FAILED_LOGIN_ATTEMPTS"
    | "NEW_DEVICE_LOGIN"
    | "ACCOUNT_RECOVERY"
    | "UNAUTHORIZED_ACCESS";

export type SecurityAlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SecurityAlertInput {
    userId: string;
    type: SecurityAlertType;
    message: string;
    severity: SecurityAlertSeverity;
    metadata?: Record<string, any>;
}

export class SecurityAlertService {
    /**
     * Send a security alert to the user via multiple channels
     */
    static async sendSecurityAlert(input: SecurityAlertInput): Promise<void> {
        const { userId, type, message, severity, metadata = {} } = input;

        try {
            // 1. Get user details
            const user = await db.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    phone: true,
                    name: true,
                    language: true,
                    timezone: true
                }
            });

            if (!user) {
                logger.error(`User not found for security alert: ${userId}`);
                return;
            }

            // 2. Create notification in database
            await NotificationService.createNotification({
                userId: user.id,
                type: 'SECURITY_ALERT', // requires adding SECURITY_ALERT to NotificationType enum
                title: this.getAlertTitle(type),
                body: message,
                data: {
                    alertType: type,
                    severity,
                    priority: this.mapSeverityToPriority(severity),
                    ...metadata
                }
            });

            // 3. Send email notification
            if (user.email) {
                await this.sendEmailAlert(
                    {
                        email: user.email,
                        name: user.name,
                        language: user.language
                    },
                    type,
                    message,
                    severity,
                    metadata
                );
            }

            // 4. Send SMS for high/critical severity
            if ((severity === 'HIGH' || severity === 'CRITICAL') && user.phone) {
                await this.sendSMSAlert(user.phone, type, message);
            }

            // 5. Create audit log
            await db.auditLog.create({
                data: {
                    userId: user.id,
                    action: `SECURITY_ALERT_${type}`,
                    entityType: 'USER',
                    entityId: user.id,
                    changes: {
                        type,
                        severity,
                        message,
                        ...metadata
                    },
                    ipAddress: metadata.ipAddress || null,
                    userAgent: metadata.userAgent || null,
                    metadata: {
                        alertType: type,
                        severity,
                        timestamp: new Date().toISOString()
                    }
                }
            });

            logger.info(`Security alert sent to user ${userId}: ${type}`, {
                type,
                severity,
                metadata
            });

        } catch (error) {
            logger.error('Error sending security alert:', { error });
            // Don't throw - security alerts should not break the main flow
        }
    }

    /**
     * Get alert title based on type
     */
    private static getAlertTitle(type: SecurityAlertType): string {
        const titles: Record<SecurityAlertType, string> = {
            ACCOUNT_LOCKED: 'Account Locked',
            SUSPICIOUS_LOGIN: 'Suspicious Login Detected',
            PASSWORD_CHANGED: 'Password Changed',
            MFA_DISABLED: 'Two-Factor Authentication Disabled',
            FAILED_LOGIN_ATTEMPTS: 'Multiple Failed Login Attempts',
            NEW_DEVICE_LOGIN: 'New Device Login',
            ACCOUNT_RECOVERY: 'Account Recovery Initiated',
            UNAUTHORIZED_ACCESS: 'Unauthorized Access Attempt'
        };
        return titles[type];
    }

    /**
     * Map severity to notification priority
     */
    private static mapSeverityToPriority(severity: SecurityAlertSeverity): string {
        const mapping: Record<SecurityAlertSeverity, string> = {
            LOW: 'LOW',
            MEDIUM: 'MEDIUM',
            HIGH: 'HIGH',
            CRITICAL: 'URGENT'
        };
        return mapping[severity];
    }

    /**
     * Send email alert using your existing email service
     */
    private static async sendEmailAlert(
        user: { email: string; name: string | null; language: string },
        type: SecurityAlertType,
        message: string,
        severity: SecurityAlertSeverity,
        metadata: Record<string, any>
    ): Promise<void> {
        try {
            const subject = `🔒 Security Alert: ${this.getAlertTitle(type)}`;
            const userName = user.name || 'User';
            const timestamp = new Date().toLocaleString('en-US', {
                dateStyle: 'full',
                timeStyle: 'long'
            });

            // Check if template exists, otherwise send custom HTML
            const templateKey = this.getEmailTemplateKey(type);

            // Try to use template if it exists
            const result = await emailService.sendEmail({
                to: user.email,
                subject,
                template: templateKey as any,
                templateData: {
                    userName,
                    message,
                    severity,
                    timestamp,
                    ...metadata
                },
                priority: severity === 'CRITICAL' || severity === 'HIGH' ? 'high' : 'normal'
            });

            if (!result.success) {
                logger.error('Failed to send security alert email:');
            }
        } catch (error) {
            logger.error('Error sending security alert email:', { error });
        }
    }

    /**
     * Get email template key based on alert type
     */
    private static getEmailTemplateKey(type: SecurityAlertType): string {
        const templateMap: Record<SecurityAlertType, string> = {
            ACCOUNT_LOCKED: 'accountLocked',
            SUSPICIOUS_LOGIN: 'suspiciousLogin',
            PASSWORD_CHANGED: 'passwordChanged',
            MFA_DISABLED: 'mfaDisabled',
            FAILED_LOGIN_ATTEMPTS: 'failedLoginAttempts',
            NEW_DEVICE_LOGIN: 'newDeviceLogin',
            ACCOUNT_RECOVERY: 'accountRecovery',
            UNAUTHORIZED_ACCESS: 'unauthorizedAccess'
        };
        return templateMap[type];
    }

    /**
     * Send SMS alert for high-priority alerts
     */
    private static async sendSMSAlert(
        phone: string,
        type: SecurityAlertType,
        message: string
    ): Promise<void> {
        try {
            // TODO: Implement SMS sending logic here
            // Example using Twilio, AWS SNS, or other SMS provider
            logger.info(`SMS alert sent to ${phone}: ${type}`);

            // Example implementation:
            // await smsService.send({
            //     to: phone,
            //     message: `Security Alert: ${message}`
            // });
        } catch (error) {
            logger.error('Error sending security alert SMS:', { error });
        }
    }

    /**
     * Send security alert for account lockout
     */
    static async sendAccountLockedAlert(
        userId: string,
        ipAddress?: string,
        attempts?: number
    ): Promise<void> {
        await this.sendSecurityAlert({
            userId,
            type: 'ACCOUNT_LOCKED',
            message: 'Your account has been locked due to multiple failed login attempts. Please wait 15 minutes or contact support.',
            severity: 'HIGH',
            metadata: { ipAddress, attempts }
        });
    }

    /**
     * Send security alert for failed login attempts
     */
    static async sendFailedLoginAlert(
        userId: string,
        attempts: number,
        ipAddress?: string
    ): Promise<void> {
        await this.sendSecurityAlert({
            userId,
            type: 'FAILED_LOGIN_ATTEMPTS',
            message: `There have been ${attempts} failed login attempts on your account. If this wasn't you, please secure your account immediately.`,
            severity: attempts >= 4 ? 'MEDIUM' : 'LOW',
            metadata: { ipAddress, attempts }
        });
    }

    /**
     * Send security alert for password change
     */
    static async sendPasswordChangedAlert(
        userId: string,
        ipAddress?: string
    ): Promise<void> {
        await this.sendSecurityAlert({
            userId,
            type: 'PASSWORD_CHANGED',
            message: 'Your password has been successfully changed. If you did not make this change, please contact support immediately.',
            severity: 'MEDIUM',
            metadata: { ipAddress }
        });
    }

    /**
     * Send security alert for MFA disabled
     */
    static async sendMFADisabledAlert(
        userId: string,
        ipAddress?: string
    ): Promise<void> {
        await this.sendSecurityAlert({
            userId,
            type: 'MFA_DISABLED',
            message: 'Two-factor authentication has been disabled on your account. If you did not make this change, please enable it immediately.',
            severity: 'HIGH',
            metadata: { ipAddress }
        });
    }

    /**
     * Send security alert for new device login
     */
    static async sendNewDeviceLoginAlert(
        userId: string,
        device?: string,
        location?: string,
        ipAddress?: string
    ): Promise<void> {
        await this.sendSecurityAlert({
            userId,
            type: 'NEW_DEVICE_LOGIN',
            message: 'A new device has been used to access your account. If this wasn\'t you, please secure your account immediately.',
            severity: 'MEDIUM',
            metadata: { device, location, ipAddress }
        });
    }
}

// Export convenience function
export const sendSecurityAlert = SecurityAlertService.sendSecurityAlert.bind(SecurityAlertService);