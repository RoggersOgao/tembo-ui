// queues/redis-connection.ts
import IORedis from 'ioredis';
import { logger } from '@repo/logger';

export const queueConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
});

queueConnection.on('error', (err) => {
    logger.error('[queue-redis] connection error', { error: err.message });
});

queueConnection.on('connect', () => {
    logger.info('[queue-redis] connected');
});