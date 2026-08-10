// scripts/setup-gmail-oauth.ts
/**
 * First-time OAuth2 setup for Gmail
 * Run with: pnpm run setup-gmail-oauth or tsx scripts/setup-gmail-oauth.ts
 */
import { google } from 'googleapis';
import { createServer } from 'http';
import { parse } from 'url';
import open from 'open';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { ENV } from '../config/config';
import { logger } from '@repo/logger';

dotenv.config();

const SCOPES = ['https://mail.google.com/'];
const REDIRECT_URI = 'http://localhost:8080/auth/google/callback';

interface OAuth2Tokens {
    access_token: string;
    refresh_token: string;
    expiry_date: number;
}

async function setupGmailOAuth() {
    const clientId = ENV.GMAIL_CLIENT_ID;
    const clientSecret = ENV.GMAIL_CLIENT_SECRET;
    const tokenFile = ENV.OAUTH2_TOKEN_FILE || './data/gmail-tokens.json';

    if (!clientId || !clientSecret) {
        console.error('   Missing OAuth2 credentials in .env file');
        logger.info('\nRequired variables:');
        logger.info('  GMAIL_CLIENT_ID');
        logger.info('  GMAIL_CLIENT_SECRET');
        logger.info('\nGet them from: https://console.cloud.google.com/apis/credentials');
        process.exit(1);
    }

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        REDIRECT_URI
    );

    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent', // Force to get refresh token
    });

    logger.info('\n🔐 Gmail OAuth2 Setup\n');
    logger.info('Opening browser for authorization...\n');
    logger.info('If browser doesn\'t open, visit this URL:');
    logger.info(authUrl);
    logger.info('\n');

    // Create temporary server to receive callback
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);

            if (parsedUrl.pathname === '/auth/google/callback') {
                const { code } = parsedUrl.query;

                if (!code) {
                    res.writeHead(400, { 'Content-Type': 'text/html' });
                    res.end('<h1>   Authorization failed - No code received</h1>');
                    server.close();
                    process.exit(1);
                }

                // Exchange code for tokens
                const { tokens } = await oauth2Client.getToken(code as string);

                if (!tokens.refresh_token) {
                    res.writeHead(400, { 'Content-Type': 'text/html' });
                    res.end('<h1>   No refresh token received. Try revoking app access and running again.</h1>');
                    server.close();
                    process.exit(1);
                }

                // Save tokens to file
                const tokenData: OAuth2Tokens = {
                    access_token: tokens.access_token!,
                    refresh_token: tokens.refresh_token,
                    expiry_date: tokens.expiry_date!,
                };

                const dir = path.dirname(tokenFile);
                await fs.mkdir(dir, { recursive: true });
                await fs.writeFile(tokenFile, JSON.stringify(tokenData, null, 2));

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                        <body style="font-family: Arial; padding: 40px; text-align: center;">
                            <h1>Authorization Successful!</h1>
                            <p>Your Gmail OAuth2 tokens have been saved.</p>
                            <p>You can close this window and return to your terminal.</p>
                            <hr/>
                            <p>Tokens saved to: <code>${tokenFile}</code></p>
                            <p><strong>Next steps:</strong></p>
                            <ol style="text-align: left; max-width: 500px; margin: 20px auto;">
                                <li>Ensure <code>EMAIL_AUTH_METHOD=oauth2</code> in your .env file</li>
                                <li>Start your application</li>
                                <li>Tokens will auto-refresh automatically</li>
                            </ol>
                        </body>
                    </html>
                `);

                logger.info('\n OAuth2 setup complete!');
                logger.info(`📁 Tokens saved to: ${tokenFile}`);
                logger.info('\n📝 Your .env should have:');
                logger.info('   EMAIL_AUTH_METHOD=oauth2');
                logger.info('   EMAIL_SERVICE=gmail');
                logger.info(`   GMAIL_CLIENT_ID=${clientId}`);
                logger.info('   GMAIL_CLIENT_SECRET=***');
                logger.info('\n🚀 You can now start your application.');

                setTimeout(() => {
                    server.close();
                    process.exit(0);
                }, 2000);
            }
        } catch (error) {
            console.error('   Error during authorization:', error);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>   Error during authorization</h1>');
            server.close();
            process.exit(1);
        }
    });

    server.listen(8080, () => {
        logger.info('🌐 Listening on http://localhost:8080');
        logger.info('Waiting for authorization...\n');

        // Open browser
        open(authUrl).catch(() => {
            logger.info('Could not open browser automatically. Please open the URL manually.');
        });
    });
}

// Run setup
setupGmailOAuth().catch(error => {
    console.error('   Setup failed:', error);
    process.exit(1);
});