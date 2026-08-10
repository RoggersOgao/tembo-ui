// config/env.ts
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

export const ENV = {
    // AWS Configuration
    AWS_REGION: process.env.AWS_REGION!,
    AWS_BUCKET: process.env.AWS_BUCKET!,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
    SIGNED_URL_EXPIRY_SECONDS: Number(process.env.SIGNED_URL_EXPIRY_SECONDS ?? 3600),

    // CORS Configuration
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,


    // AUTHENTICATON  method
    EMAIL_AUTH_METHOD: process.env.EMAIL_AUTH_METHOD,
    // Email Service Configuration
    EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'smtp',
    EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
    EMAIL_PORT: parseInt(process.env.EMAIL_PORT || '587'),
    EMAIL_SECURE: process.env.EMAIL_SECURE === 'true',
    EMAIL_USER: process.env.EMAIL_USER!,
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD!,
    EMAIL_FROM: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
    // Gmail OAuth2 Configuration (Optional)
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
    OAUTH2_TOKEN_FILE: process.env.OAUTH2_TOKEN_FILE,

    // Email Rate Limiting
    RATE_LIMIT_PER_SECOND: parseInt(process.env.RATE_LIMIT_PER_SECOND || '5'),
    RATE_LIMIT_PER_HOUR: parseInt(process.env.RATE_LIMIT_PER_HOUR || '100'),
    RATE_LIMIT_PER_DAY: parseInt(process.env.RATE_LIMIT_PER_DAY || '500'),

    // Email Retry Configuration
    EMAIL_RETRY_ATTEMPTS: parseInt(process.env.EMAIL_RETRY_ATTEMPTS || '3'),
    EMAIL_RETRY_BACKOFF: parseInt(process.env.EMAIL_RETRY_BACKOFF || '1000'),

    MAPBOX_TOKEN: process.env.MAPBOX_TOKEN
};
