import { getToken } from "./get-token";


// Response types
interface EmailResponse {
    success?: boolean;
    message?: string;
    error?: string;
}

interface SendEmailPayload {
    to: string;
    subject: string;
    html: string;
}

interface CampaignPayload {
    emails: string[];
    template: string;
    templateData: any;
}

class EmailClient {
    private baseURL: string;

    constructor() {
        this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
    }

    /**
     * @description Generic request handler. Automatically fetches and injects the Authorization token.
     * @param endpoint - The API endpoint path.
     * @param options - Standard RequestInit options.
     * @param requireAuth - If true, throws an error if the token cannot be found.
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        requireAuth: boolean = false
    ): Promise<T> {
        let token: string | undefined | null;

        // Automatically fetch the token client-side
        if (requireAuth) {
          token = await getToken()

            if (!token) {
                throw new Error("Authorization token is missing. Please log in.");
            }
        }

        const headers: HeadersInit = {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const res = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers,
        });

        // Handle 401 Unauthorized
        if (res.status === 401) {
            console.log(res);
            throw new Error("Unauthorized");
        }

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(
                errorData.error || `Request failed with ${res.status}`
            );
        }

        return res.json();
    }

    /**
     * Send verification email
     * @param email - Recipient email
     * @param token - Verification token
     * @param userName - Optional user name
     */
    async sendVerification(
        email: string,
        token: string,
        userName?: string
    ): Promise<EmailResponse> {
        return this.request<EmailResponse>(
            "/api/emails/verification",
            {
                method: "POST",
                body: JSON.stringify({ email, token, userName }),
            },
        );
    }

    /**
   * Send verification email
   * @param email - Recipient email
   * @param token - Verification token
   * @param userName - Optional user name
   */
    async sendTwoFactor(
        email: string,
        token: string,
        userName?: string
    ): Promise<EmailResponse> {
        return this.request<EmailResponse>(
            "/api/emails/twoFactor",
            {
                method: "POST",
                body: JSON.stringify({ email, token, userName }),
            },
        );
    }

    /**
     * Send password reset email
     * @param email - Recipient email
     * @param token - Password reset token
     * @param userName - Optional user name
     */
    async sendPasswordReset(
        email: string,
        token: string,
        expires?: string
    ): Promise<EmailResponse> {
        return this.request<EmailResponse>(
            "/api/emails/password-reset",
            {
                method: "POST",
                body: JSON.stringify({ email, token, expires }),
            }
        );
    }

    /**
     * Send welcome email
     * @param email - Recipient email
     * @param userName - User name
     */
    async sendWelcome(
        email: string,
        userName: string
    ): Promise<EmailResponse> {
        return this.request<EmailResponse>(
            "/api/emails/welcome",
            {
                method: "POST",
                body: JSON.stringify({ email, userName }),
            },
        );
    }

    /**
     * Send custom email
     * @param to - Recipient email(s)
     * @param subject - Email subject
     * @param html - Email HTML content
     */
    async sendCustom(
        to: string,
        subject: string,
        html: string
    ): Promise<EmailResponse> {
        return this.request<EmailResponse>(
            "/api/emails/send",
            {
                method: "POST",
                body: JSON.stringify({ to, subject, html }),
            }
        );
    }

    /**
     * Send campaign emails to multiple recipients
     * @param emails - Array of recipient emails
     * @param template - Template name to use
     * @param templateData - Data for template
     */
    async sendCampaign(
        emails: string[],
        template: string,
        templateData: any
    ): Promise<EmailResponse> {
        return this.request<EmailResponse>(
            "/api/emails/campaign",
            {
                method: "POST",
                body: JSON.stringify({ emails, template, templateData }),
            }
        );
    }

    /**
     * Send email using template
     * @param to - Recipient email(s)
     * @param template - Template name
     * @param templateData - Data for template
     * @param subject - Optional custom subject (overrides template subject)
     */
    async sendWithTemplate(
        to: string | string[],
        template: string,
        templateData: any,
        subject?: string
    ): Promise<EmailResponse> {
        return this.request<EmailResponse>(
            "/api/emails/send",
            {
                method: "POST",
                body: JSON.stringify({ to, template, templateData, subject }),
            }
        );
    }
}

// Export a singleton instance
export const emailClient = new EmailClient();

// Also export the class for testing or multiple instances
export default EmailClient;