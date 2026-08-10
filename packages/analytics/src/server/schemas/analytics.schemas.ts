import { z } from 'zod';

export const sessionSchema = z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
    duration: z.number().int().min(0).optional(),
    ip: z.string().optional(),
    country: z.string().nullish(),
    region: z.string().nullish(),
    city: z.string().nullish(),
    deviceType: z.string().optional(),
    browser: z.string().optional(),
    os: z.string().optional(),
    referrer: z.string().optional(),
});

export const pageVisitCreateSchema = z.object({
    id: z.string().min(1, 'Page visit ID is required'),
    sessionId: z.string().min(1, 'Session ID is required'),
    path: z.string().min(1, 'Path is required').startsWith('/', "Path must start with '/'"),
    query: z.string().optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    duration: z.number().int().min(0).optional(),
});

export const pageVisitUpdateSchema = z.object({
    id: z.string().min(1, 'Page visit ID is required'),
    url: z.string().optional(),
    query: z.string().optional(),
    endTime: z.string().datetime().optional(),
    duration: z.number().int().min(0).optional(),
    scrollDepth: z.number().min(0).max(100).optional(),
    final: z.boolean().optional(),
});

export const eventSchema = z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
    type: z.string().min(1, 'Event type is required'),
    url: z.string().min(1, 'URL is required'),
    element: z.string().optional().nullable(),
    data: z.record(z.any()).optional().nullable(),
    timestamp: z.string().datetime().optional(),
});

export const eventBatchSchema = z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
    events: z.array(eventSchema).min(1).max(100),
});

export const clickSchema = z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
    path: z.string().min(1, 'Path is required'),
    element: z.string().min(1, 'Element is required'),
    timestamp: z.string().datetime().optional(),
});

export type SessionInput = z.infer<typeof sessionSchema>;
export type PageVisitCreateInput = z.infer<typeof pageVisitCreateSchema>;
export type PageVisitUpdateInput = z.infer<typeof pageVisitUpdateSchema>;
export type EventInput = z.infer<typeof eventSchema>;
export type EventBatchInput = z.infer<typeof eventBatchSchema>;
export type ClickInput = z.infer<typeof clickSchema>;