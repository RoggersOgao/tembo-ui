// services/email.transporter.ts
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { emailConfig } from '../config/email.config';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '@repo/logger';

interface OAuth2Tokens {
    access_token: string;
    refresh_token: string;
    expiry_date: number;
}

// How long before expiry we proactively refresh (5 minutes)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
// Minimum time between refresh attempts — prevents tight loops (10 minutes)
const MIN_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
// Fallback schedule if expiry_date comes back unusable (55 minutes)
const FALLBACK_REFRESH_MS = 55 * 60 * 1000;

// Single canonical redirect URI, shared by the setup script and this file.
// Override via env if you ever need a different port/host.
const OAUTH_REDIRECT_URI =
    process.env.GMAIL_OAUTH_REDIRECT_URI || 'http://localhost:8080/auth/google/callback';

class EmailTransporter {
    private transporter: nodemailer.Transporter | null = null;
    private oauth2Client: any = null;
    private accessToken: string | null = null;
    private tokenExpiryTime: number = 0;
    private refreshTokenValue: string | null = null;
    private tokenFilePath: string;

    // True when the refresh token came from env/secrets rather than a local file.
    // When true, we never persist tokens to disk.
    private usingEnvRefreshToken: boolean = false;

    // ── Loop-guard state ───────────────────────────────────────────────────
    private isRefreshing: boolean = false;
    private refreshTimer: NodeJS.Timeout | null = null;

    constructor() {
        this.tokenFilePath = process.env.OAUTH2_TOKEN_FILE || './data/gmail-tokens.json';
    }

    async initialize() {
        try {
            const useOAuth2 =
                emailConfig.service === 'gmail' &&
                process.env.EMAIL_AUTH_METHOD === 'oauth2' &&
                emailConfig.oauth2?.clientId;

            if (useOAuth2) {
                logger.info('[-] Initializing Gmail with OAuth2...');
                this.transporter = await this.initializeGmailOAuth2();
            } else {
                logger.info('[-] Initializing standard SMTP...');
                this.transporter = await this.initializeStandardSMTP();
            }

            await this.transporter.verify();
            logger.info(`[-] Email transporter ready (${emailConfig.service || emailConfig.host})`);
            return this.transporter;
        } catch (error) {
            logger.error('   Email transporter initialization failed:', { error });
            throw error;
        }
    }

    private async initializeGmailOAuth2(): Promise<nodemailer.Transporter> {
        this.oauth2Client = new google.auth.OAuth2(
            emailConfig.oauth2!.clientId,
            emailConfig.oauth2!.clientSecret,
            OAUTH_REDIRECT_URI
        );

        await this.loadOrInitializeTokens();

        if (!this.refreshTokenValue) {
            throw new Error(
                'No refresh token available. Please run setup to authorize the app.\n' +
                'Run: npm run setup-gmail-oauth'
            );
        }

        this.oauth2Client.setCredentials({
            refresh_token: this.refreshTokenValue,
        });

        // Get initial access token
        await this.refreshAccessToken();

        // Schedule future refreshes — only called once here
        this.scheduleTokenRefresh();

        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: emailConfig.auth.user,
                clientId: emailConfig.oauth2!.clientId,
                clientSecret: emailConfig.oauth2!.clientSecret,
                refreshToken: this.refreshTokenValue,
                accessToken: this.accessToken as string,
            },
        } as any);
    }

    private async loadOrInitializeTokens(): Promise<void> {
        // Preferred production path: refresh token comes from env/secrets manager.
        // Nothing is read from or written to disk in this case.
        if (emailConfig.oauth2?.refreshToken) {
            logger.info('[-] Using refresh token from environment/secrets');
            this.refreshTokenValue = emailConfig.oauth2.refreshToken;
            this.usingEnvRefreshToken = true;
            return;
        }

        // Local-dev fallback: read the token file produced by setup-gmail-oauth.
        try {
            const fileContent = await fs.readFile(this.tokenFilePath, 'utf-8');
            const tokens: OAuth2Tokens = JSON.parse(fileContent);

            this.refreshTokenValue = tokens.refresh_token;
            this.accessToken = tokens.access_token;
            this.tokenExpiryTime = tokens.expiry_date;

            logger.info('[-] Loaded OAuth2 tokens from file');
        } catch {
            logger.warn('   No stored tokens found — will fetch fresh tokens on first refresh');
        }
    }

    private async saveTokens(tokens: OAuth2Tokens): Promise<void> {
        // Never persist to disk when the refresh token is sourced from env/secrets.
        // This is what stops fresh tokens from ever landing in a file that could
        // be accidentally committed, logged via a file watcher, etc.
        if (this.usingEnvRefreshToken) {
            return;
        }

        try {
            const dir = path.dirname(this.tokenFilePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.tokenFilePath, JSON.stringify(tokens, null, 2));
            logger.info('[-] OAuth2 tokens saved to file');
        } catch (error) {
            logger.error('   Failed to save tokens:', { error });
        }
    }

    /**
     * Refresh the access token.
     * Protected by `isRefreshing` so concurrent calls are no-ops.
     */
    private async refreshAccessToken(): Promise<void> {
        if (this.isRefreshing) {
            logger.warn('   Token refresh already in progress — skipping duplicate call');
            return;
        }

        this.isRefreshing = true;
        try {
            const { credentials } = await this.oauth2Client.refreshAccessToken();

            if (!credentials.access_token) {
                throw new Error('Failed to obtain access token');
            }

            this.accessToken = credentials.access_token;

            // Google returns expiry_date in ms; fall back to 1 hour if absent
            this.tokenExpiryTime = credentials.expiry_date
                ? credentials.expiry_date
                : Date.now() + 3600 * 1000;

            await this.saveTokens({
                access_token: this.accessToken!,
                refresh_token: this.refreshTokenValue!,
                expiry_date: this.tokenExpiryTime,
            });

            logger.info('[-] OAuth2 access token refreshed');
        } catch (error) {
            // Only log a safe summary — avoid dumping the raw error object, which
            // can embed request/response bodies (and therefore tokens) from the
            // underlying HTTP client.
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.error('   Failed to refresh access token:', { message });
            throw error;
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Schedule the NEXT single refresh before expiry.
     *
     * Key rules that prevent the loop:
     *  1. Clear any existing timer before setting a new one.
     *  2. Never schedule sooner than MIN_REFRESH_INTERVAL_MS.
     *  3. Use FALLBACK_REFRESH_MS when expiry_date looks invalid.
     */
    private scheduleTokenRefresh(): void {
        // Clear any previously scheduled refresh
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        const msUntilExpiry = this.tokenExpiryTime - Date.now();
        const idealRefreshIn = msUntilExpiry - REFRESH_BUFFER_MS;

        // Enforce a minimum gap — this is what stops the tight loop
        const refreshIn = Math.max(idealRefreshIn, MIN_REFRESH_INTERVAL_MS);

        // If the calculated time looks unreasonable, use the safe fallback
        const scheduleIn = refreshIn > 0 && refreshIn < 24 * 60 * 60 * 1000
            ? refreshIn
            : FALLBACK_REFRESH_MS;

        this.refreshTimer = setTimeout(async () => {
            this.refreshTimer = null;
            try {
                await this.refreshAccessToken();
            } catch (err) {
                logger.error('[*] Scheduled token refresh failed — will retry in fallback interval');
            }
            // Schedule the next one only AFTER this one completes
            this.scheduleTokenRefresh();
        }, scheduleIn);

        logger.info(`[-] Next token refresh scheduled in ${Math.round(scheduleIn / 60_000)} minutes`);
    }

    private async initializeStandardSMTP(): Promise<nodemailer.Transporter> {
        const transportOptions: SMTPTransport.Options = {
            host: emailConfig.host,
            port: emailConfig.port,
            secure: emailConfig.secure,
            auth: {
                user: emailConfig.auth.user!,
                pass: emailConfig.auth.pass!,
            },
        };

        if (!emailConfig.secure && emailConfig.port !== 25) {
            transportOptions.tls = {
                ciphers: 'SSLv3',
                rejectUnauthorized: false,
            };
        }

        return nodemailer.createTransport(transportOptions);
    }

    getTransporter(): nodemailer.Transporter {
        if (!this.transporter) {
            throw new Error('Email transporter not initialized. Call initialize() first.');
        }
        return this.transporter;
    }

    isInitialized(): boolean {
        return this.transporter !== null;
    }

    getOAuth2Client() {
        if (!emailConfig.oauth2?.clientId) {
            throw new Error('OAuth2 credentials not configured');
        }
        return new google.auth.OAuth2(
            emailConfig.oauth2.clientId,
            emailConfig.oauth2.clientSecret,
            OAUTH_REDIRECT_URI
        );
    }

    async storeInitialTokens(tokens: any): Promise<void> {
        this.refreshTokenValue = tokens.refresh_token;
        this.accessToken = tokens.access_token;
        this.tokenExpiryTime = tokens.expiry_date;

        await this.saveTokens({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date,
        });
    }

    async close(): Promise<void> {
        try {
            // Cancel any pending refresh before closing
            if (this.refreshTimer) {
                clearTimeout(this.refreshTimer);
                this.refreshTimer = null;
            }

            if (this.transporter) {
                this.transporter.close();
                this.transporter = null;
                logger.info('📪 Email transporter closed');
            }

            this.oauth2Client = null;
            this.accessToken = null;
            this.tokenExpiryTime = 0;

            logger.info('[-] Email transporter resources cleaned up');
        } catch (error) {
            logger.error('[*] Error closing email transporter:', { error });
            throw error;
        }
    }
}

export const emailTransporter = new EmailTransporter();