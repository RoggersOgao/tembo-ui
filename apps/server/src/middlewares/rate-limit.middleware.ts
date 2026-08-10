import rateLimit from 'express-rate-limit';

export const createProductRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many products created, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});
export const createUserRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: 'Too many products created, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

export const createOrderRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    message: 'Too many properties created, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

export const generalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});


export const directionsRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 300 requests per 15 minutes (20 per minute)
    message: 'Direction request limit exceeded',
    standardHeaders: true,
    legacyHeaders: false,
});

export const uploadRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});