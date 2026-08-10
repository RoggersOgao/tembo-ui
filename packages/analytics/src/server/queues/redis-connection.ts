import IORedis from 'ioredis';

export const queueConnection = new IORedis(
    process.env.REDIS_URL || 'redis://localhost:6379',
    {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    }
);

queueConnection.on('error', (err) => {
    console.error('[Analytics Redis] Connection error:', err.message);
});

queueConnection.on('connect', () => {
    console.log('[Analytics Redis] Connected');
});