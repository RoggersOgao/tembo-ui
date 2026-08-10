import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { logger } from '@repo/logger';

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_ALGORITHM = 'HS256';

if (!JWT_SECRET) {
    logger.warn('[!]  JWT_SECRET is not set — using fallback. Set it in production!');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole =
    | 'SUPER_ADMIN'
    | 'ADMIN'
    | 'MANAGER'
    | 'SUPPLIER'
    | 'DELIVERY'
    | 'STAFF'
    | 'CUSTOMER'
    | 'SUPPORT'
    | 'VIEWER';

export interface AuthUser {
    userId: string;
    email: string;
    role: UserRole;
    supplierId?: string;  // set when role === 'SUPPLIER'
    storeId?: string;  // future multi-store support
    phoneNumber?: string;
    isVerified?: boolean;
    verificationLevel?: string;
    iat?: number;
    exp?: number;
}

export interface AuthRequest extends Request {
    user?: AuthUser;
}

// ─── Token Schema ─────────────────────────────────────────────────────────────

const authTokenSchema = z.object({
    userId: z.string(),
    email: z.string().email(),
    role: z.enum([
        'SUPER_ADMIN',
        'ADMIN',
        'MANAGER',
        'SUPPLIER',
        'STAFF',
        'CUSTOMER',
        'SUPPORT',
        'VIEWER',
    ]),
    supplierId: z.string().optional(),
    storeId: z.string().optional(),
    phoneNumber: z.string().optional(),
    isVerified: z.boolean().optional(),
    verificationLevel: z.string().optional(),
    iat: z.number().optional(),
    exp: z.number().optional(),
});

// ─── Auth Middleware ──────────────────────────────────────────────────────────

export const authMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({
                error: 'No token provided',
                message: 'Authorization header must be in format: Bearer <token>',
            });
            return;
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
        const parsed = authTokenSchema.parse(decoded);

        req.user = {
            userId: parsed.userId,
            email: parsed.email,
            role: parsed.role,
            supplierId: parsed.supplierId,
            storeId: parsed.storeId,
            phoneNumber: parsed.phoneNumber,
            isVerified: parsed.isVerified,
            verificationLevel: parsed.verificationLevel,
            iat: parsed.iat,
            exp: parsed.exp,
        };

        logger.info('[AUTH] ✓ Authenticated', {
            userId: req.user.userId,
            role: req.user.role,
            path: req.path,
            method: req.method,
        });

        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            logger.error('[AUTH] Token structure invalid', { errors: error.errors });
            res.status(401).json({
                error: 'Token validation failed',
                message: 'Token structure is invalid',
                details: error.errors.map(e => ({
                    field: e.path.join('.'),
                    message: e.message,
                })),
            });
            return;
        }

        if (error instanceof jwt.TokenExpiredError) {
            logger.warn('[AUTH] Token expired', { expiredAt: error.expiredAt });
            res.status(401).json({
                error: 'Token expired',
                message: 'Your session has expired. Please log in again.',
                expiredAt: error.expiredAt,
            });
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            logger.error('[AUTH] Invalid token', { message: error.message });
            res.status(401).json({
                error: 'Invalid token',
                message: 'Token signature is invalid or token is malformed',
            });
            return;
        }

        logger.error('[AUTH] Authentication failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(401).json({
            error: 'Authentication failed',
            message: 'Unable to authenticate request',
        });
    }
};

// ─── requireRole ─────────────────────────────────────────────────────────────

/**
 * @example
 * router.delete('/:id', authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN'), handler);
 */
export const requireRole = (...roles: UserRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        if (!roles.includes(req.user.role)) {
            logger.warn('[ROLE] ✗ Access denied', {
                userId: req.user.userId,
                currentRole: req.user.role,
                requiredRoles: roles,
                path: req.path,
            });
            res.status(403).json({
                error: 'Insufficient permissions',
                message: `Role '${req.user.role}' cannot access this resource`,
                required: roles,
                current: req.user.role,
            });
            return;
        }

        logger.info('[ROLE] ✓ Access granted', {
            userId: req.user.userId,
            role: req.user.role,
            path: req.path,
        });

        next();
    };
};

// ─── requireSupplier ──────────────────────────────────────────────────────────

/**
 * Ensures the request comes from a verified supplier with a supplierId.
 * Optionally checks against a specific supplierId (e.g. from route params).
 *
 * @example
 * router.put('/products/:id', authMiddleware, requireSupplier(), handler);
 * router.put('/products/:id', authMiddleware, requireSupplier(req => req.params.supplierId), handler);
 */
export const requireSupplier = (
    getSupplierId?: (req: AuthRequest) => string | undefined
) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        // SUPER_ADMIN and ADMIN bypass supplier checks
        if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
            next();
            return;
        }

        if (req.user.role !== 'SUPPLIER') {
            res.status(403).json({
                error: 'Supplier access required',
                message: 'This resource is only accessible to suppliers',
            });
            return;
        }

        if (!req.user.supplierId) {
            res.status(403).json({
                error: 'Supplier account not configured',
                message: 'Your account is not linked to a supplier record',
            });
            return;
        }

        // If a specific supplierId is required, check it matches
        const requiredSupplierId = getSupplierId?.(req);
        if (requiredSupplierId && req.user.supplierId !== requiredSupplierId) {
            logger.warn('[SUPPLIER] ✗ Supplier ID mismatch', {
                userId: req.user.userId,
                userSupplierId: req.user.supplierId,
                requiredSupplierId,
            });
            res.status(403).json({
                error: 'Supplier access denied',
                message: 'You do not have access to this supplier resource',
            });
            return;
        }

        logger.info('[SUPPLIER] ✓ Supplier access granted', {
            userId: req.user.userId,
            supplierId: req.user.supplierId,
        });

        next();
    };
};

// ─── requireVerification ──────────────────────────────────────────────────────

/**
 * @example
 * router.post('/checkout', authMiddleware, requireVerification('VERIFIED'), handler);
 */
export const requireVerification = (
    minLevel: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'VERIFIED'
) => {
    const hierarchy = { BASIC: 0, INTERMEDIATE: 1, ADVANCED: 2, VERIFIED: 3 };

    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        const userLevel = (req.user.verificationLevel || 'BASIC') as keyof typeof hierarchy;
        const userLevelValue = hierarchy[userLevel] ?? 0;
        const requiredValue = hierarchy[minLevel];

        if (userLevelValue < requiredValue) {
            logger.warn('[VERIFICATION] ✗ Insufficient level', {
                userId: req.user.userId,
                currentLevel: userLevel,
                requiredLevel: minLevel,
            });
            res.status(403).json({
                error: 'Insufficient verification level',
                message: `This action requires ${minLevel} verification`,
                current: userLevel,
                required: minLevel,
            });
            return;
        }

        next();
    };
};

// ─── requireCustomer ─────────────────────────────────────────────────────────

/**
 * Ensures only customers (or admins) can access customer-facing routes.
 *
 * @example
 * router.get('/orders/my', authMiddleware, requireCustomer(), handler);
 */
export const requireCustomer = () => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        const allowed: UserRole[] = ['CUSTOMER', 'ADMIN', 'SUPER_ADMIN'];

        if (!allowed.includes(req.user.role)) {
            res.status(403).json({
                error: 'Customer access required',
                message: 'This resource is only accessible to customers',
            });
            return;
        }

        next();
    };
};

// ─── requireRoleAndVerification ───────────────────────────────────────────────

/**
 * @example
 * router.post('/bulk-order',
 *   authMiddleware,
 *   requireRoleAndVerification(['CUSTOMER', 'MANAGER'], 'VERIFIED'),
 *   handler
 * );
 */
export const requireRoleAndVerification = (
    roles: UserRole[],
    minLevel: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'VERIFIED'
) => {
    const hierarchy = { BASIC: 0, INTERMEDIATE: 1, ADVANCED: 2, VERIFIED: 3 };

    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                error: 'Insufficient permissions',
                required: roles,
                current: req.user.role,
            });
            return;
        }

        const userLevel = (req.user.verificationLevel || 'BASIC') as keyof typeof hierarchy;
        const userLevelValue = hierarchy[userLevel] ?? 0;
        const requiredValue = hierarchy[minLevel];

        if (userLevelValue < requiredValue) {
            res.status(403).json({
                error: 'Insufficient verification level',
                current: userLevel,
                required: minLevel,
            });
            return;
        }

        logger.info('[AUTH] ✓ Role + verification passed', {
            userId: req.user.userId,
            role: req.user.role,
            level: userLevel,
        });

        next();
    };
};