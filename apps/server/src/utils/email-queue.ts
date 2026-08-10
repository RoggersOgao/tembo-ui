import { emailConfig } from "../config/email.config";
import {logger} from '@repo/logger';
import { emailTransporter } from "../services/email-transporter";

interface QueuedEmail {
    id: string;
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
    attachments?: any[];
    attempts: number;
    maxAttempts: number;
    scheduledFor?: Date;
    createdAt: Date;
}

class EmailQueue {
    private queue: QueuedEmail[] = [];
    private processing = false;

    add(email: Omit<QueuedEmail, 'id' | 'attempts' | 'createdAt'>) {
        const queuedEmail: QueuedEmail = {
            ...email,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            attempts: 0,
            createdAt: new Date(),
        };
        this.queue.push(queuedEmail);
        this.process();
    }

    private async process() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        while (this.queue.length > 0) {
            const email = this.queue[0];

            // Check if email is scheduled for future
            if (email.scheduledFor && email.scheduledFor > new Date()) {
                break;
            }

            try {
                const transporter = emailTransporter.getTransporter();
                await transporter.sendMail({
                    from: email.from || emailConfig.auth.user,
                    to: email.to,
                    subject: email.subject,
                    html: email.html,
                    text: email.text,
                    attachments: email.attachments,
                });

                logger.info(`Email sent successfully: ${email.id}`);
                this.queue.shift();
            } catch (error) {
                logger.error(`Failed to send email ${email.id}:`, {error:error});
                email.attempts++;

                if (email.attempts >= email.maxAttempts) {
                    logger.error(`Email ${email.id} failed after ${email.maxAttempts} attempts`);
                    this.queue.shift();
                } else {
                    // Move to end of queue with exponential backoff
                    this.queue.shift();
                    email.scheduledFor = new Date(Date.now() + Math.pow(2, email.attempts) * 1000);
                    this.queue.push(email);
                }
            }

            // Rate limiting between emails
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        this.processing = false;
    }
}

export const emailQueue = new EmailQueue();