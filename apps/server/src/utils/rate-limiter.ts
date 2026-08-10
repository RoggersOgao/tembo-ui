
interface RateLimitEntry {
    count: number;
    resetAt: Date;
}

class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();

    async checkLimit(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
        const now = new Date();
        const entry = this.limits.get(key);

        if (!entry || entry.resetAt < now) {
            this.limits.set(key, {
                count: 1,
                resetAt: new Date(now.getTime() + windowMs),
            });
            return true;
        }

        if (entry.count >= maxRequests) {
            return false;
        }

        entry.count++;
        return true;
    }

    cleanup() {
        const now = new Date();
        for (const [key, entry] of this.limits.entries()) {
            if (entry.resetAt < now) {
                this.limits.delete(key);
            }
        }
    }
}

export const rateLimiter = new RateLimiter();

// Cleanup every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);