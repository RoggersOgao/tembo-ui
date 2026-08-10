import { Response } from "express";
import {
    ProfileService,
} from "../../../../services/user/profile.service";
import { AuthRequest } from "../../../../middlewares/auth.middleware";
import { createValidationRules, validateRequest, validateRequestParams, ValidationResult, validationSchemas } from "../../../../middlewares/request-validation";
import {
    createSuccessResponse,
    createErrorResponse,
    createValidationErrorResponse,
    createNotFoundResponse,
    createUnauthorizedResponse,
    createConflictResponse,
    createPaginatedResponse,
    ResponseBuilder
} from "@repo/api-utils";
import { ProfileInput } from "../../../../config/schemas/profile.schemas";
import { logger } from "@repo/logger";
import { db, DeliveryMode } from "@repo/database";

// Define validation rules using the validation utility
const profileValidationRules = createValidationRules({
    bio: {
        required: false,
        string: true,
        max: 1000
    },
    website: {
        required: false,
        string: true,
        custom: (value: string) => {
            if (!value) return true;
            try {
                new URL(value);
                return true;
            } catch {
                return 'Invalid URL format';
            }
        }
    },
    userId: {
        required: false,
        string: true,
        cuid: true
    }
});

const profileQueryValidationRules = createValidationRules({
    userId: validationSchemas.cuid(false),
    search: {
        required: false,
        string: true,
        max: 100
    },
    page: validationSchemas.page(),
    limit: validationSchemas.limit(100)
});


export class ProfileController {
    // Get profiles with filters
    static getProfiles = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Validate query parameters
            const validationResult: ValidationResult = await validateRequest(req, profileQueryValidationRules);

            if (!validationResult.isValid) {
                const apiResponse = createValidationErrorResponse(
                    validationResult.errors,
                    "Invalid query parameters"
                );
                res.status(400).json(apiResponse);
                return;
            }

            const filters = validationResult.data;
            const result = await ProfileService.getProfiles(filters);

            // Check the type of result using type guard
            if (ProfileService.isPaginatedProfiles(result)) {
                // Return paginated results
                const apiResponse = createPaginatedResponse(
                    result.profiles,
                    result.pagination,
                    "Profiles retrieved successfully"
                );
                res.status(200).json(apiResponse);
            } else if (ProfileService.isSingleProfile(result)) {
                // Return single profile
                const apiResponse = ResponseBuilder.success(
                    { profile: result },
                    "Profile retrieved successfully"
                );
                res.status(200).json(apiResponse);
            } else {
                // This should never happen, but TypeScript needs it
                const apiResponse = createErrorResponse(
                    "Unexpected result type from service",
                    "Internal server error"
                );
                res.status(500).json(apiResponse);
            }
        } catch (error: any) {
            logger.error("Error getting profiles:", error);

            if (error.message.includes("not found")) {
                const apiResponse = createNotFoundResponse("Profile", error.message);
                res.status(404).json(apiResponse);
            } else {
                const apiResponse = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while fetching profiles"
                );
                res.status(500).json(apiResponse);
            }
        }
    }

    // Get profile by ID
    static getProfileById = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Validate path parameter
            const validationResult: ValidationResult = await validateRequest(req, {
                id: 'required|string|cuid'
            });

            if (!validationResult.isValid) {
                const apiResponse = createValidationErrorResponse(
                    validationResult.errors,
                    "Invalid profile ID"
                );
                res.status(400).json(apiResponse);
                return;
            }

            const { id } = validationResult.data;
            const profile = await ProfileService.getProfileById(id);

            const apiResponse = ResponseBuilder.success(
                { profile },
                "Profile retrieved successfully"
            );
            res.status(200).json(apiResponse);
        } catch (error: any) {
            logger.error("Error getting profile by ID:", error);

            if (error.message.includes("not found")) {
                const apiResponse = createNotFoundResponse("Profile", req.params.id as string);
                res.status(404).json(apiResponse);
            } else {
                const apiResponse = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while fetching profile"
                );
                res.status(500).json(apiResponse);
            }
        }
    }

    // Get profile by user ID
    static getProfileByUserId = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Validate path parameter
            const validationResult: ValidationResult = await validateRequest(req, {
                userId: 'required|string|cuid'
            });

            if (!validationResult.isValid) {
                const apiResponse = createValidationErrorResponse(
                    validationResult.errors,
                    "Invalid user ID"
                );
                res.status(400).json(apiResponse);
                return;
            }

            const { userId } = validationResult.data;
            const profile = await ProfileService.getProfileByUserId(userId);

            const apiResponse = ResponseBuilder.success(
                { profile },
                "Profile retrieved successfully"
            );
            res.status(200).json(apiResponse);
        } catch (error: any) {
            logger.error("Error getting profile by user ID:", error);

            if (error.message.includes("not found")) {
                const apiResponse = createNotFoundResponse(
                    "Profile",
                    `for user ${req.params.userId}`
                );
                res.status(404).json(apiResponse);
            } else {
                const apiResponse = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while fetching profile"
                );
                res.status(500).json(apiResponse);
            }
        }
    }

    // Create a new profile
    static createProfile = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Validate request body
            const validationResult: ValidationResult = await validateRequest(req, {
                ...profileValidationRules,
                userId: {
                    ...(profileValidationRules.userId as object),
                    required: true
                }
            });

            if (!validationResult.isValid) {
                const apiResponse = createValidationErrorResponse(
                    validationResult.errors,
                    "Profile creation validation failed"
                );
                res.status(400).json(apiResponse);
                return;
            }

            const data = validationResult.data as ProfileInput & { userId: string };
            const newProfile = await ProfileService.createProfile(data);

            const apiResponse = ResponseBuilder.success(
                { profile: newProfile },
                "Profile created successfully"
            );
            res.status(201).json(apiResponse);
        } catch (error: any) {
            logger.error("Error creating profile:", error);

            if (error.message.includes("not found")) {
                const apiResponse = createNotFoundResponse("User", (req.body as any)?.userId);
                res.status(404).json(apiResponse);
            } else if (error.message.includes("already exists")) {
                const apiResponse = createConflictResponse(
                    "Profile already exists for this user",
                    error.message
                );
                res.status(409).json(apiResponse);
            } else if (error.message.includes("required")) {
                const apiResponse = createValidationErrorResponse(
                    [{ field: 'userId', message: error.message }],
                    "Validation failed"
                );
                res.status(400).json(apiResponse);
            } else {
                const apiResponse = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while creating profile"
                );
                res.status(500).json(apiResponse);
            }
        }
    }

    // Update profile by ID
    static updateProfileById = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Validate path parameter
            const paramValidation: ValidationResult = await validateRequest(req, {
                id: 'required|string|cuid'
            });

            if (!paramValidation.isValid) {
                const apiResponse = createValidationErrorResponse(
                    paramValidation.errors,
                    "Invalid profile ID"
                );
                res.status(400).json(apiResponse);
                return;
            }

            // Validate request body
            const bodyValidation: ValidationResult = await validateRequest(req, profileValidationRules);

            if (!bodyValidation.isValid) {
                const apiResponse = createValidationErrorResponse(
                    bodyValidation.errors,
                    "Profile update validation failed"
                );
                res.status(400).json(apiResponse);
                return;
            }

            const { id } = paramValidation.data;
            const updateData = bodyValidation.data as ProfileInput;

            const updatedProfile = await ProfileService.updateProfile(id, updateData);

            const apiResponse = ResponseBuilder.success(
                { profile: updatedProfile },
                "Profile updated successfully"
            );
            res.status(200).json(apiResponse);
        } catch (error: any) {
            logger.error("Error updating profile:", error);

            if (error.message.includes("not found")) {
                const apiResponse = createNotFoundResponse("Profile", req.params.id as string);
                res.status(404).json(apiResponse);
            } else {
                const apiResponse = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while updating profile"
                );
                res.status(500).json(apiResponse);
            }
        }
    }

    // Update profile by user ID
    static updateProfileByUserId = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Validate path parameter
            const paramValidation: ValidationResult = await validateRequest(req, {
                userId: 'required|string|cuid'
            });

            if (!paramValidation.isValid) {
                const apiResponse = createValidationErrorResponse(
                    paramValidation.errors,
                    "Invalid user ID"
                );
                res.status(400).json(apiResponse);
                return;
            }

            // Validate request body
            const bodyValidation: ValidationResult = await validateRequest(req, profileValidationRules);

            if (!bodyValidation.isValid) {
                const apiResponse = createValidationErrorResponse(
                    bodyValidation.errors,
                    "Profile update validation failed"
                );
                res.status(400).json(apiResponse);
                return;
            }

            const { userId } = paramValidation.data;
            const updateData = bodyValidation.data as ProfileInput;

            const updatedProfile = await ProfileService.updateProfileByUserId(userId, updateData);

            const apiResponse = ResponseBuilder.success(
                { profile: updatedProfile },
                "Profile updated successfully"
            );
            res.status(200).json(apiResponse);
        } catch (error: any) {
            logger.error("Error updating profile by user ID:", error);

            if (error.message.includes("not found")) {
                const apiResponse = createNotFoundResponse(
                    "Profile",
                    `for user ${req.params.userId}`
                );
                res.status(404).json(apiResponse);
            } else {
                const apiResponse = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while updating profile"
                );
                res.status(500).json(apiResponse);
            }
        }
    }

    // Delete profile by ID
    static deleteProfileById = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Validate path parameter
            const validationResult: ValidationResult = await validateRequest(req, {
                id: 'required|string|cuid'
            });

            if (!validationResult.isValid) {
                const apiResponse = createValidationErrorResponse(
                    validationResult.errors,
                    "Invalid profile ID"
                );
                res.status(400).json(apiResponse);
                return;
            }

            const { id } = validationResult.data;
            const result = await ProfileService.deleteProfile(id);

            const apiResponse = ResponseBuilder.success(
                { deletedProfile: result },
                "Profile deleted successfully"
            );
            res.status(200).json(apiResponse);
        } catch (error: any) {
            logger.error("Error deleting profile:", error);

            if (error.message.includes("not found")) {
                const apiResponse = createNotFoundResponse("Profile", req.params.id as string);
                res.status(404).json(apiResponse);
            } else {
                const apiResponse = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while deleting profile"
                );
                res.status(500).json(apiResponse);
            }
        }
    }

    // Delete profile by user ID
    static deleteProfileByUserId = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Validate path parameter
            const validationResult: ValidationResult = await validateRequest(req, {
                userId: 'required|string|cuid'
            });

            if (!validationResult.isValid) {
                const apiResponse = createValidationErrorResponse(
                    validationResult.errors,
                    "Invalid user ID"
                );
                res.status(400).json(apiResponse);
                return;
            }

            const { userId } = validationResult.data;
            const result = await ProfileService.deleteProfileByUserId(userId);

            const apiResponse = ResponseBuilder.success(
                { deletedProfile: result },
                "Profile deleted successfully"
            );
            res.status(200).json(apiResponse);
        } catch (error: any) {
            logger.error("Error deleting profile by user ID:", error);

            if (error.message.includes("not found")) {
                const apiResponse = createNotFoundResponse(
                    "Profile",
                    `for user ${req.params.userId}`
                );
                res.status(404).json(apiResponse);
            } else {
                const apiResponse = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while deleting profile"
                );
                res.status(500).json(apiResponse);
            }
        }
    }

    // Get profile statistics
    static getProfileStats = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const stats = await ProfileService.getProfileStats();

            const apiResponse = ResponseBuilder.success(
                { stats },
                "Profile statistics retrieved successfully"
            );
            res.status(200).json(apiResponse);
        } catch (error: any) {
            logger.error("Error getting profile stats:", error);

            const apiResponse = createErrorResponse(
                error.message,
                "An unexpected error occurred while fetching profile statistics"
            );
            res.status(500).json(apiResponse);
        }
    }

    // Update current user's profile (using authenticated user)
    static updateMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Get user ID from auth middleware
            const userId = req.user?.userId;

            if (!userId) {
                const apiResponse = createUnauthorizedResponse(
                    "User not authenticated"
                );
                res.status(401).json(apiResponse);
                return;
            }

            // Validate request body
            const validationResult: ValidationResult = await validateRequest(req, profileValidationRules);

            if (!validationResult.isValid) {
                const apiResponse = createValidationErrorResponse(
                    validationResult.errors,
                    "Profile update validation failed"
                );
                res.status(400).json(apiResponse);
                return;
            }

            const updateData = validationResult.data as ProfileInput;

            // Check if profile exists, create if not
            let profile;
            try {
                profile = await ProfileService.updateProfileByUserId(userId, updateData);
            } catch (error: any) {
                if (error.message.includes("not found")) {
                    // Profile doesn't exist, create one
                    profile = await ProfileService.createProfile({
                        ...updateData,
                        userId
                    });
                } else {
                    throw error;
                }
            }

            const apiResponse = ResponseBuilder.success(
                { profile },
                "Profile updated successfully"
            );
            res.status(200).json(apiResponse);
        } catch (error: any) {
            logger.error("Error updating my profile:", error);

            if (error.message.includes("not found")) {
                const apiResponse = createNotFoundResponse("User", req.user?.userId);
                res.status(404).json(apiResponse);
            } else if (error.message.includes("already exists")) {
                const apiResponse = createConflictResponse(
                    "Profile already exists",
                    error.message
                );
                res.status(409).json(apiResponse);
            } else if (error.message.includes("required")) {
                const apiResponse = createValidationErrorResponse(
                    [{ field: 'userId', message: error.message }],
                    "Validation failed"
                );
                res.status(400).json(apiResponse);
            } else {
                const apiResponse = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while updating profile"
                );
                res.status(500).json(apiResponse);
            }
        }
    }

    // Get current user's profile
    static getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Get user ID from auth middleware
            const userId = req.user?.userId;

            if (!userId) {
                const apiResponse = createUnauthorizedResponse(
                    "User not authenticated"
                );
                res.status(401).json(apiResponse);
                return;
            }

            const profile = await ProfileService.getProfileByUserId(userId);

            const apiResponse = ResponseBuilder.success(
                { profile },
                "Profile retrieved successfully"
            );
            res.status(200).json(apiResponse);
        } catch (error: any) {
            logger.error("Error getting my profile:", error);

            if (error.message.includes("not found")) {
                const apiResponse = createNotFoundResponse(
                    "Profile",
                    `for user ${req.user?.userId}`
                );
                res.status(404).json(apiResponse);
            } else {
                const apiResponse = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while fetching profile"
                );
                res.status(500).json(apiResponse);
            }
        }
    }
    
}