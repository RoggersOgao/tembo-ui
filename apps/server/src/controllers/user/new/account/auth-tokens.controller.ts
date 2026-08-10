import { Request, Response } from "express";
import {
    AuthTokensService,
    PasswordTokenSchema,
    TwoFactorTokenSchema,
    VerificationTokenSchema,
    EmailChangeTokenSchema,
    PhoneChangeTokenSchema,
    TwoFactorConfirmationSchema
} from "../../../../services/user/auth-tokens.service";
import {
    createSuccessResponse,
    createErrorResponse,
    createNotFoundResponse,
    createValidationErrorResponse,
    ErrorCode,
    ApiError
} from '@repo/api-utils';
import { validateRequest, validateRequestQuery, validateRequestParams, ValidationError } from "../../../../middlewares/request-validation";
import { logger } from "@repo/logger";
import { z } from "zod";
import { TokenMethod } from "@repo/database";

// Helper function to transform ValidationError[] to ApiError[]
const transformValidationErrors = (errors: ValidationError[]): ApiError[] => {
    return errors.map(error => ({
        code: error.code || ErrorCode.VALIDATION_ERROR,
        message: error.message,
        field: error.field
    }));
};

export class AuthTokensController {
    // Password Token Operations
    // CONTROLLER
    static getPasswordToken = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestQuery(req, {
            token: 'optional|string|min:6',
            email: 'optional|email|max:255'
        });

        if (!validationResult.isValid) {
            const response = createValidationErrorResponse(validationResult.errors.map(err => ({
                field: err.field,
                message: err.message
            })));
            res.status(400).json(response);
            return;
        }

        try {
            const { token, email } = validationResult.data;

            if (!token && !email) {
                const response = createErrorResponse(
                    [{
                        code: ErrorCode.VALIDATION_ERROR,
                        message: 'Either token or email must be provided',
                        field: 'system'
                    }],
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
                return;
            }

            const result = await AuthTokensService.getPasswordToken(
                token as string | undefined,
                email as string | undefined
            );

            if (!result) {
                const response = createNotFoundResponse('password token not found or expired');
                res.status(404).json(response);
                return;
            }

            logger.info("Password token retrieved", {
                foundBy: token ? 'token' : 'email',
                tokenId: result.id,
                expires: result.expires,
                createdAt: result.createdAt,
                isExpired: AuthTokensService.isTokenExpired(result.expires)
            });

            const response = createSuccessResponse(
                { token: result },
                "Password token retrieved successfully"
            );
            res.status(200).json(response);

        } catch (error: any) {
            logger.error("Error getting password token:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static createPasswordToken = async (req: Request, res: Response): Promise<void> => {
        try {
            const validation = PasswordTokenSchema.safeParse(req.body);
            if (!validation.success) {
                const errors = validation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const token = await AuthTokensService.createPasswordToken(validation.data);
            const response = createSuccessResponse(
                { token },
                "Password token created successfully 🚀"
            );
            res.status(201).json(response);
        } catch (error: any) {
            logger.error("Error creating password token:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static deletePasswordToken = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!validationResult.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validationResult.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = validationResult.data;
            await AuthTokensService.deletePasswordToken(id);
            const response = createSuccessResponse(
                null,
                "Password token deleted successfully 👽"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error deleting password token:", error);
            if (error.code === "P2025") {
                const response = createNotFoundResponse('password token');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Two Factor Token Operations
    static getTwoFactorToken = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestQuery(req, {
            token: 'optional|string|min:6',
            email: 'optional|email|max:255'
        });

        if (!validationResult.isValid) {
            const response = createValidationErrorResponse(validationResult.errors.map(err => ({
                field: err.field,
                message: err.message
            })));
            res.status(400).json(response);
            return;
        }

        try {
            const { token, email } = validationResult.data;

            // Ensure at least one parameter is provided
            if (!token && !email) {
                const response = createErrorResponse(
                    [{
                        code: ErrorCode.VALIDATION_ERROR,
                        message: 'Either token or email must be provided',
                        field: 'system'
                    }],
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
                return;
            }

            const tokens = await AuthTokensService.getTwoFactorToken(token, email);

            if (!tokens) {
                const response = createNotFoundResponse('two-factor token');
                res.status(404).json(response);
                return;
            }

            const response = createSuccessResponse(
                { token: tokens },
                "Two-factor token retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error getting two-factor token:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static createTwoFactorToken = async (req: Request, res: Response): Promise<void> => {
        try {
            const validation = TwoFactorTokenSchema.safeParse(req.body);
            if (!validation.success) {
                const errors = validation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const token = await AuthTokensService.createTwoFactorToken(validation.data);
            const response = createSuccessResponse(
                { token },
                "Two-factor token created successfully 🚀"
            );
            res.status(201).json(response);
        } catch (error: any) {
            logger.error("Error creating two-factor token:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static deleteTwoFactorToken = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!validationResult.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validationResult.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = validationResult.data;
            await AuthTokensService.deleteTwoFactorToken(id);
            const response = createSuccessResponse(
                null,
                "Two-factor token deleted successfully 👽"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error deleting two-factor token:", error);
            if (error.code === "P2025") {
                const response = createNotFoundResponse('two-factor token');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Verification Token Operations
    static getVerificationToken = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestQuery(req, {
            token: 'optional|string|min:6',
            email: 'optional|email|max:255'
        });

        if (!validationResult.isValid) {
            const response = createValidationErrorResponse(validationResult.errors.map(err => ({
                field: err.field,
                message: err.message
            })));
            res.status(400).json(response);
            return;
        }

        try {
            const { token, email } = validationResult.data;

            // Ensure at least one parameter is provided
            if (!token && !email) {
                const response = createErrorResponse(
                    [{
                        code: ErrorCode.VALIDATION_ERROR,
                        message: 'Either token or email must be provided',
                        field: 'system'
                    }],
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
                return;
            }

            const tokens = await AuthTokensService.getVerificationToken(token, email);

            if (!tokens) {
                const response = createNotFoundResponse('verification token');
                res.status(404).json(response);
                return;
            }

            const response = createSuccessResponse(
                { token: tokens },
                "Verification token retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error getting verification token:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static createVerificationToken = async (req: Request, res: Response): Promise<void> => {
        try {
            const validation = VerificationTokenSchema.safeParse(req.body);
            if (!validation.success) {
                const errors = validation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const token = await AuthTokensService.createVerificationToken(validation.data);
            const response = createSuccessResponse(
                { token },
                "Verification token created successfully"
            );
            res.status(201).json(response);
        } catch (error: any) {
            logger.error("Error creating verification token:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static deleteVerificationToken = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!validationResult.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validationResult.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = validationResult.data;
            await AuthTokensService.deleteVerificationToken(id);
            const response = createSuccessResponse(
                null,
                "Verification token deleted successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error deleting verification token:", error);
            if (error.code === "P2025") {
                const response = createNotFoundResponse('verification token');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Email Change Token Operations
    static getEmailChangeToken = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestQuery(req, {
            token: 'optional|string|min:6',
            userId: 'optional|string|cuid'
        });

        if (!validationResult.isValid) {
            const response = createValidationErrorResponse(validationResult.errors.map(err => ({
                field: err.field,
                message: err.message
            })));
            res.status(400).json(response);
            return;
        }

        try {
            const { token, userId } = validationResult.data;

            // Ensure at least one parameter is provided
            if (!token && !userId) {
                const response = createErrorResponse(
                    [{
                        code: ErrorCode.VALIDATION_ERROR,
                        message: 'Either token or userId must be provided',
                        field: 'system'
                    }],
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
                return;
            }

            const emailChangeToken = await AuthTokensService.getEmailChangeToken(token, userId);

            if (!emailChangeToken) {
                const response = createNotFoundResponse('email change token');
                res.status(404).json(response);
                return;
            }

            const response = createSuccessResponse(
                { token: emailChangeToken },
                "Email change token retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error getting email change token:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static createEmailChangeToken = async (req: Request, res: Response): Promise<void> => {
        try {
            const validation = EmailChangeTokenSchema.safeParse(req.body);
            if (!validation.success) {
                const errors = validation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const token = await AuthTokensService.createEmailChangeToken(validation.data);
            const response = createSuccessResponse(
                { token },
                "Email change token created successfully"
            );
            res.status(201).json(response);
        } catch (error: any) {
            logger.error("Error creating email change token:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static deleteEmailChangeToken = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!validationResult.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validationResult.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = validationResult.data;
            await AuthTokensService.deleteEmailChangeToken(id);
            const response = createSuccessResponse(
                null,
                "Email change token deleted successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error deleting email change token:", error);
            if (error.code === "P2025") {
                const response = createNotFoundResponse('email change token');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Phone Change Token Operations
    static getPhoneChangeToken = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestQuery(req, {
            token: 'optional|string|min:6',
            userId: 'optional|string|cuid'
        });

        if (!validationResult.isValid) {
            const response = createValidationErrorResponse(validationResult.errors.map(err => ({
                field: err.field,
                message: err.message
            })));
            res.status(400).json(response);
            return;
        }

        try {
            const { token, userId } = validationResult.data;

            // Ensure at least one parameter is provided
            if (!token && !userId) {
                const response = createErrorResponse(
                    [{
                        code: ErrorCode.VALIDATION_ERROR,
                        message: 'Either token or userId must be provided',
                        field: 'system'
                    }],
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
                return;
            }

            const phoneChangeToken = await AuthTokensService.getPhoneChangeToken(token, userId);

            if (!phoneChangeToken) {
                const response = createNotFoundResponse('phone change token');
                res.status(404).json(response);
                return;
            }

            const response = createSuccessResponse(
                { token: phoneChangeToken },
                "Phone change token retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error getting phone change token:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static createPhoneChangeToken = async (req: Request, res: Response): Promise<void> => {
        try {
            const validation = PhoneChangeTokenSchema.safeParse(req.body);
            if (!validation.success) {
                const errors = validation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const token = await AuthTokensService.createPhoneChangeToken(validation.data);
            const response = createSuccessResponse(
                { token },
                "Phone change token created successfully"
            );
            res.status(201).json(response);
        } catch (error: any) {
            logger.error("Error creating phone change token:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static deletePhoneChangeToken = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!validationResult.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validationResult.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = validationResult.data;
            await AuthTokensService.deletePhoneChangeToken(id);
            const response = createSuccessResponse(
                null,
                "Phone change token deleted successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error deleting phone change token:", error);
            if (error.code === "P2025") {
                const response = createNotFoundResponse('phone change token');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Two Factor Confirmation Operations
    static getTwoFactorConfirmation = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestQuery(req, {
            userId: 'required|string|cuid',
        });

        if (!validationResult.isValid) {
            const response = createValidationErrorResponse(validationResult.errors.map(err => ({
                field: err.field,
                message: err.message
            })));
            res.status(400).json(response);
            return;
        }

        try {
            const { userId } = validationResult.data;

            const confirmation = await AuthTokensService.getTwoFactorConfirmation(userId);

            if (!confirmation) {
                const response = createNotFoundResponse('two-factor confirmation');
                res.status(404).json(response);
                return;
            }

            const response = createSuccessResponse(
                { confirmation },
                "Two-factor confirmation retrieved successfully"
            );

            res.status(200).json(response);

        } catch (error: any) {
            logger.error('Error in getTwoFactorConfirmation:', error);

            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );

            res.status(500).json(response);
        }
    }

    static createTwoFactorConfirmation = async (req: Request, res: Response): Promise<void> => {
        try {
            const validation = TwoFactorConfirmationSchema.safeParse(req.body);
            if (!validation.success) {
                const errors = validation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors);
                res.status(400).json(response);
                return;
            }

            const { userId } = validation.data;
            const confirmation = await AuthTokensService.createTwoFactorConfirmation(userId);
            const response = createSuccessResponse(
                { confirmation },
                "Two-factor confirmation created 🚀"
            );
            res.status(201).json(response);
        } catch (error: any) {
            logger.error("Error creating two-factor confirmation:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static deleteTwoFactorConfirmation = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        if (!validationResult.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validationResult.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = validationResult.data;
            await AuthTokensService.deleteTwoFactorConfirmation(id);
            const response = createSuccessResponse(
                null,
                "Two-factor confirmation deleted successfully "
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error deleting two-factor confirmation:", error);
            if (error.code === "P2025") {
                const response = createNotFoundResponse('two-factor confirmation');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Utility Operations
    static cleanupExpiredTokens = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await AuthTokensService.cleanupExpiredTokens();
            const response = createSuccessResponse(
                result,
                `Cleaned up ${result.total} expired tokens`
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error cleaning up expired tokens:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static getUserTokens = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestParams(req, {
            userId: 'required|string|cuid'
        });

        if (!validationResult.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validationResult.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { userId } = validationResult.data;
            const tokens = await AuthTokensService.getUserTokens(userId);
            const response = createSuccessResponse(
                { tokens },
                "User tokens retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error getting user tokens:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    static deleteAllUserTokens = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestParams(req, {
            userId: 'required|string|cuid'
        });

        if (!validationResult.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validationResult.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { userId } = validationResult.data;
            await AuthTokensService.deleteAllUserTokens(userId);
            const response = createSuccessResponse(
                null,
                "All user tokens deleted successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error deleting user tokens:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    /**
     * 
     * @param req userid & backupcode
     * @param res success or fail
     * @returns user
     */

    static verifyBackupCode = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestParams(req, {
            userId: 'required|string|cuid',
            backupCode: 'required|string'
        });

        if (!validationResult.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validationResult.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { userId, backupCode } = validationResult.data;
            const user = await AuthTokensService.verifyBackupCode(userId, backupCode);

            if (!user) {
                const response = createErrorResponse(
                    "Invalid backup code",
                    ErrorCode.INVALID_STATE
                );
                res.status(401).json(response);
                return;
            }

            const response = createSuccessResponse(
                { user },
                "Backup code verified successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error verifying backup code:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Verify and consume token
    static verifyAndConsumeToken = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestQuery(req, {
            type: 'required|string|in:password,twoFactor,verification,emailChange,phoneChange',
            token: 'required|string|min:6',
            userId: 'optional|string|cuid',
            method: 'optional|string|authenticator,email,sms,backup'
        });

        if (!validationResult.isValid) {
            const response = createValidationErrorResponse(validationResult.errors.map(err => ({
                field: err.field,
                message: err.message
            })));
            res.status(400).json(response);
            return;
        }

        try {
            const { type, token, userId } = validationResult.data;

            const result = await AuthTokensService.verifyAndConsumeToken(
                type as any,
                token,
                userId
            );

            const response = createSuccessResponse(
                result,
                "Token verified and consumed successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error verifying token:", error);

            if (error.message.includes("Invalid or expired") || error.message.includes("does not belong")) {
                const response = createErrorResponse(
                    [{
                        code: ErrorCode.VALIDATION_ERROR,
                        message: error.message,
                        field: 'token'
                    }],
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Generate token
    static generateToken = async (req: Request, res: Response): Promise<void> => {
        const validationResult = await validateRequestQuery(req, {
            type: 'required|string|in:hex,numeric',
            length: 'optional|number|min:4|max:128'
        });

        if (!validationResult.isValid) {
            const response = createValidationErrorResponse(validationResult.errors.map(err => ({
                field: err.field,
                message: err.message
            })));
            res.status(400).json(response);
            return;
        }

        try {
            const { type, length } = validationResult.data;
            let token: string;

            if (type === 'numeric') {
                token = AuthTokensService.generateNumericToken(length || 6);
            } else {
                token = AuthTokensService.generateToken(length || 32);
            }

            const response = createSuccessResponse(
                { token, type, length: length || (type === 'numeric' ? 6 : 32) },
                "Token generated successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error generating token:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }
}