export const ANALYTICS_CONSTANTS = {
    DEFAULT_FLUSH_INTERVAL: 30000,
    MAX_QUEUE_SIZE: 200,
    MAX_RETRY_ATTEMPTS: 5,
    RETRY_BACKOFF_MULTIPLIER: 2,
    INITIAL_RETRY_DELAY: 1000,
    SESSION_HEALTH_CHECK_INTERVAL: 60000,
    MAX_BUFFER_SIZE: 10,
    BATCH_FLUSH_TIMEOUT: 5000,
    MAX_PAGE_VISIT_RETRIES: 3,
    CRITICAL_QUEUE_MAX_SIZE: 50,
} as const;

export const CONSENT_STORAGE_KEY = 'analytics_consent';
export const SESSION_STORAGE_KEYS = {
    SESSION_ID: 'analytics_session_id',
    SESSION_START: 'analytics_session_start',
    INITIALIZED: 'analytics_initialized',
    STATE: 'analytics_state',
    QUEUE: 'analytics_queue',
} as const;

export const EVENT_TYPES = {
    SESSION_START: 'session_start',
    SESSION_END: 'session_end',
    PAGE_VIEW: 'page_view',
    PAGE_EXIT: 'page_exit',
    CLICK: 'click',
    ENGAGEMENT: 'engagement',
    PERFORMANCE: 'performance',
    ERROR: 'error',
    CONVERSION: 'conversion',
    FORM_SUBMIT: 'form_submit',
} as const;

export const DEVICE_TYPES = {
    DESKTOP: 'desktop',
    MOBILE: 'mobile',
    TABLET: 'tablet',
    UNKNOWN: 'unknown',
} as const;

export type DeviceType = (typeof DEVICE_TYPES)[keyof typeof DEVICE_TYPES];
// Resolves to: 'desktop' | 'mobile' | 'tablet' | 'unknown'