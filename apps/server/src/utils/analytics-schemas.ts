import { z } from "zod";

// Session Schema - matches AnalyticsSession model
export const analyticsSessionSchema = z.object({
    sessionId: z.string().min(1, "Session ID is required"),
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
export type AnalyticsSessionInput = z.infer<typeof analyticsSessionSchema>;

// Page Visit Create Schema - matches PageVisit model
// Page Visit Create Schema - matches PageVisit model
export const pageVisitCreateSchema = z.object({
    id: z.string().min(1, "Page visit ID is required"),
    sessionId: z.string().min(1, "Session ID is required"),
    path: z.string().min(1, "Path is required").startsWith("/", "Path must start with '/'"),
    query: z.string().optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    duration: z.number().int().min(0).optional(),
});

export type PageVisitCreateInput = z.infer<typeof pageVisitCreateSchema>;

// Page Visit Update Schema - for ending page visits
export const pageVisitUpdateSchema = z.object({
    id: z.string().min(1, "Page visit ID is required"),
    url: z.string().optional(), // For tracking, not stored in DB
    query: z.string().optional(),
    endTime: z.string().datetime().optional(),
    duration: z.number().int().min(0).optional(),
    scrollDepth: z.number().min(0).max(100).optional(), // For tracking, may not be in DB yet
});

export type PageVisitUpdateInput = z.infer<typeof pageVisitUpdateSchema>;

// Analytics Event Schema - matches AnalyticsEvent model
export const analyticsEventSchema = z.object({
    sessionId: z.string().min(1, "Session ID is required"),
    type: z.string().min(1, "Event type is required"),
    url: z.string().min(1, "URL is required"),
    element: z.string().optional().nullable(),
    data: z.record(z.any()).optional().nullable(),
    timestamp: z.string().datetime().optional(),
});

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;

// Analytics Event Batch Schema
export const analyticsEventBatchSchema = z.object({
    sessionId: z.string().min(1, "Session ID is required"),
    events: z.array(analyticsEventSchema).min(1).max(100),
});

export type AnalyticsEventBatchInput = z.infer<typeof analyticsEventBatchSchema>;

// Click Event Schema - matches ClickEvent model
export const clickEventSchema = z.object({
    sessionId: z.string().min(1, "Session ID is required"),
    path: z.string().min(1, "Path is required"),
    element: z.string().min(1, "Element is required"),
    timestamp: z.string().datetime().optional(),
});

export type ClickEventInput = z.infer<typeof clickEventSchema>;

// Helper function to validate datetime strings
export function isValidDateTime(dateString: string): boolean {
    try {
        const date = new Date(dateString);
        return !isNaN(date.getTime());
    } catch {
        return false;
    }
}

// Helper function to validate that endTime is after startTime
export function validateTimeRange(startTime: string, endTime: string): boolean {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return end >= start;
}