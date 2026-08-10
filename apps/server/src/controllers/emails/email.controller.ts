import { Request, Response, NextFunction } from 'express';
import { emailService } from '../../services/email.service';

// Define AuthRequest interface if not already defined
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        // Add other user properties as needed
    };
}

export class EmailController {
    sendSingle = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { to, subject, template, templateData, html, priority } = req.body;

            if (!to || (!template && !html)) {
                return res.status(400).json({
                    error: "Missing required fields: to and (template or html)",
                });
            }

            // If using custom HTML, subject is required
            if (!template && !subject) {
                return res.status(400).json({
                    error: "Subject is required when not using a template",
                });
            }

            
            const result = await emailService.sendEmail({
                to,
                subject,
                template,
                templateData,
                html,
                priority,
            });

            if (!result.success) {
                return res.status(500).json({ error: result.error });
            }

            res.status(200).json({ message: "Email queued successfully", success: true});
        } catch (error) {
            next(error);
        }
    };

    sendCampaign = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { emails, subject, template, templateData, html } = req.body;

            if (!Array.isArray(emails) || emails.length === 0) {
                return res.status(400).json({ error: "Emails array is required" });
            }

            // If using custom HTML, subject is required
            if (!template && !subject) {
                return res.status(400).json({
                    error: "Subject is required when not using a template",
                });
            }

            await emailService.sendBulkEmails(emails, {
                subject,
                template,
                templateData,
                html,
            });

            res.status(200).json({
                message: `Campaign emails queued successfully for ${emails.length} recipients`,
                success: true
            });
        } catch (error) {
            next(error);
        }
    };

    sendVerification = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, token, userName } = req.body;

            if (!email || !token) {
                return res.status(400).json({
                    error: "Email and token are required",
                });
            }

            await emailService.sendVerificationEmail(email, token, userName);

            res.status(200).json({
                message: "Verification email sent successfully",
                success: true
            });
        } catch (error) {
            next(error);
        }
    };

    sendTwoFactor = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, token, userName } = req.body;

            if (!email || !token) {
                return res.status(400).json({
                    error: "Email and token are required",
                });
            }

            await emailService.sendVerificationEmail(email, token, userName);

            res.status(200).json({
                message: "Verification email sent successfully",
            });
        } catch (error) {
            next(error);
        }
    };

    sendPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, token, expires } = req.body;

            if (!email || !token) {
                return res.status(400).json({
                    error: "Email and token are required",
                });
            }

            await emailService.sendPasswordResetEmail(email, token, expires);

            res.status(200).json({
                message: "Password reset email sent successfully",
            });
        } catch (error) {
            next(error);
        }
    };

    sendWelcome = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { email, userName } = req.body;

            if (!email || !userName) {
                return res.status(400).json({
                    error: "Email and userName are required",
                });
            }

            await emailService.sendWelcomeEmail(email, userName);

            res.status(200).json({
                message: "Welcome email sent successfully",
            });
        } catch (error) {
            next(error);
        }
    };
}
