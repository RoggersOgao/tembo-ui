import { Queue } from 'bullmq';
import { queueConnection } from './redis-connection';

export const analyticsQueue = new Queue('analytics', {
    connection: queueConnection,
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
    },
});