import { Request, Response } from "express";
import { DeliveryMode } from "@repo/database";
import { AuthRequest } from "../../../../middlewares/auth.middleware";
import { ValidationResult, validateRequest, validateRequestBody } from "../../../../middlewares/request-validation";
import {
    createErrorResponse,
    createValidationErrorResponse,
    createNotFoundResponse,
    ResponseBuilder,
} from "@repo/api-utils";
import { DeliverySettingsService } from "../../../../services/user/deliverySettings.service";
import { logger } from "@repo/logger";



export class DeliverySettingsController {
    // ─── Delivery Address CRUD ────────────────────────────────────────────────────

    /**
     * Add a new delivery address
     */
    static addDeliveryAddress = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const validationResult: ValidationResult = await validateRequest(req, {
                label: 'string|max:100',
                addressLine1: 'required|string|max:255',
                addressLine2: 'string|max:255',
                city: 'required|string|max:100',
                county: 'string|max:100',
                postalCode: 'string|max:20',
                country: 'string|size:2',
                latitude: 'numeric|min:-90|max:90',
                longitude: 'numeric|min:-180|max:180',
                instructions: 'string|max:500',
                deliveryMode: 'string|in:DELIVERY,PICKUP',
                isDefault: 'boolean'
            });

            if (!validationResult.isValid) {
                res.status(400).json(createValidationErrorResponse(
                    validationResult.errors,
                    "Invalid delivery address data"
                ));
                return;
            }

            const result = await DeliverySettingsService.addDeliveryAddress(userId, validationResult.data);
            res.status(201).json(ResponseBuilder.success(
                { deliveryAddress: result },
                "Delivery address added successfully"
            ));
        } catch (error: any) {
            logger.error("Error adding delivery address:", error);
            this.handleError(error, res, "adding delivery address");
        }
    };

    /**
     * Get all delivery addresses
     */
    static getDeliveryAddresses = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const { deliveryMode } = req.query;

            if (deliveryMode && !Object.values(DeliveryMode).includes(deliveryMode as DeliveryMode)) {
                res.status(400).json(createValidationErrorResponse(
                    [{ field: "deliveryMode", message: `Must be one of: ${Object.values(DeliveryMode).join(", ")}` }],
                    "Invalid delivery mode parameter"
                ));
                return;
            }

            const result = await DeliverySettingsService.getDeliveryAddresses(
                userId,
                deliveryMode as DeliveryMode | undefined
            );

            res.status(200).json(ResponseBuilder.success(
                {
                    deliveryAddresses: result,
                    count: result.length,
                    ...(deliveryMode && { deliveryMode })
                },
                "Delivery addresses retrieved successfully"
            ));
        } catch (error: any) {
            logger.error("Error fetching delivery addresses:", error);
            this.handleError(error, res, "fetching delivery addresses");
        }
    };

    /**
     * Get a single delivery address by ID
     */
    static getDeliveryAddressById = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { addressId } = req.params as { addressId: string };
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            if (!addressId) {
                res.status(400).json(createErrorResponse("Bad Request", "Address ID is required"));
                return;
            }

            const result = await DeliverySettingsService.getDeliveryAddressById(addressId, userId);

            if (!result) {
                res.status(404).json(createErrorResponse("Not Found", `Delivery address '${addressId}' not found`));
                return;
            }

            res.status(200).json(ResponseBuilder.success(
                { deliveryAddress: result },
                "Delivery address retrieved successfully"
            ));
        } catch (error: any) {
            logger.error("Error fetching delivery address:", error);
            this.handleError(error, res, "fetching delivery address");
        }
    };
    /**
     * Update a delivery address
     */
    static updateDeliveryAddress = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const { addressId } = req.params as { addressId: string };

            const validationResult: ValidationResult = await validateRequestBody(req, {
                label: 'string|max:100',
                addressLine1: 'string|max:255',
                addressLine2: 'string|max:255',
                city: 'string|max:100',
                county: 'string|max:100',
                postalCode: 'string|max:20',
                country: 'string|size:2',
                latitude: 'numeric|min:-90|max:90',
                longitude: 'numeric|min:-180|max:180',
                instructions: 'string|max:500',
                deliveryMode: 'string|in:DELIVERY,PICKUP',
                isDefault: 'boolean',
                isActive: 'boolean'
            });

            if (!validationResult.isValid) {
                res.status(400).json(createValidationErrorResponse(
                    validationResult.errors,
                    "Invalid delivery address data"
                ));
                return;
            }

            // Destructure out any route params that leaked into validated data
            const { addressId: _, id: __, ...addressData } = validationResult.data;

            const result = await DeliverySettingsService.updateDeliveryAddress(
                addressId,
                userId,
                addressData
            );

            res.status(200).json(ResponseBuilder.success(
                { deliveryAddress: result },
                "Delivery address updated successfully"
            ));
        } catch (error: any) {
            logger.error("Error updating delivery address:", error);
            this.handleError(error, res, "updating delivery address");
        }
    };

    /**
     * Remove a delivery address (soft delete)
     */
    static removeDeliveryAddress = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const { addressId } = req.params as { addressId: string };
            const result = await DeliverySettingsService.removeDeliveryAddress(addressId, userId);

            res.status(200).json(ResponseBuilder.success(
                { id: result.id },
                "Delivery address removed successfully"
            ));
        } catch (error: any) {
            logger.error("Error removing delivery address:", error);
            this.handleError(error, res, "removing delivery address");
        }
    };

    /**
     * Set a delivery address as default
     */
    static setDefaultDeliveryAddress = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const { addressId } = req.params as { addressId: string };
            const result = await DeliverySettingsService.setDefaultDeliveryAddress(addressId, userId);

            res.status(200).json(ResponseBuilder.success(
                { deliveryAddress: result },
                "Default delivery address set successfully"
            ));
        } catch (error: any) {
            logger.error("Error setting default delivery address:", error);
            this.handleError(error, res, "setting default delivery address");
        }
    };

    /**
     * Batch update delivery addresses
     */
    static batchUpdateDeliveryAddresses = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const validationResult: ValidationResult = await validateRequest(req, {
                addresses: 'required|array',
                'addresses.*.id': 'required|string',
                'addresses.*.isDefault': 'boolean',
                'addresses.*.label': 'string|max:100',
                'addresses.*.instructions': 'string|max:500'
            });

            if (!validationResult.isValid) {
                res.status(400).json(createValidationErrorResponse(
                    validationResult.errors,
                    "Invalid batch update data"
                ));
                return;
            }

            const { addresses } = validationResult.data;
            const results = await DeliverySettingsService.batchUpdateDeliveryAddresses(userId, addresses);

            res.status(200).json(ResponseBuilder.success(
                {
                    updatedAddresses: results,
                    successCount: results.filter(r => !('error' in r)).length,
                    failureCount: results.filter(r => 'error' in r).length
                },
                "Batch update completed"
            ));
        } catch (error: any) {
            logger.error("Error in batch update:", error);
            this.handleError(error, res, "batch updating addresses");
        }
    };

    /**
     * Get delivery address statistics
     */
    static getDeliveryAddressStats = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const stats = await DeliverySettingsService.getDeliveryAddressStats(userId);

            res.status(200).json(ResponseBuilder.success(
                { stats },
                "Delivery address statistics retrieved successfully"
            ));
        } catch (error: any) {
            logger.error("Error fetching delivery address stats:", error);
            this.handleError(error, res, "fetching statistics");
        }
    };

    // ─── Delivery Mode Settings ───────────────────────────────────────────────────

    /**
     * Get delivery mode settings
     */
    static getDeliveryModeSettings = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const result = await DeliverySettingsService.getDeliveryModeSettings(userId);

            if (!result) {
                res.status(404).json(createNotFoundResponse("Delivery mode settings", "for this user"));
                return;
            }

            res.status(200).json(ResponseBuilder.success(
                { deliveryModeSettings: result },
                "Delivery mode settings retrieved successfully"
            ));
        } catch (error: any) {
            logger.error("Error fetching delivery mode settings:", error);
            this.handleError(error, res, "fetching delivery mode settings");
        }
    };

    /**
     * Get delivery mode settings with details
     */
    static getDeliveryModeSettingsWithDetails = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const result = await DeliverySettingsService.getDeliveryModeSettingsWithDetails(userId);

            if (!result.settings) {
                res.status(404).json(createNotFoundResponse("Delivery mode settings", "for this user"));
                return;
            }

            res.status(200).json(ResponseBuilder.success(
                { deliveryModeSettings: result },
                "Delivery mode settings retrieved successfully"
            ));
        } catch (error: any) {
            logger.error("Error fetching delivery mode settings with details:", error);
            this.handleError(error, res, "fetching delivery mode settings");
        }
    };

    /**
     * Create or update delivery mode settings
     */
    static upsertDeliveryModeSettings = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const validationResult: ValidationResult = await validateRequest(req, {
                defaultDeliveryMode: 'string|in:DELIVERY,PICKUP',
                preferredDeliveryTime: 'string|in:morning,afternoon,evening',
                preferredDeliveryDate: 'date',
                contactlessDelivery: 'boolean',
                leaveAtDoor: 'boolean',
                expressDeliveryEnabled: 'boolean',
                expressDeliveryRadius: 'numeric|min:0|max:50',
                preferredPickupLocation: 'string|max:255',
                pickupInstructions: 'string|max:1000'
            });

            if (!validationResult.isValid) {
                res.status(400).json(createValidationErrorResponse(
                    validationResult.errors,
                    "Invalid delivery mode settings data"
                ));
                return;
            }

            const result = await DeliverySettingsService.upsertDeliveryModeSettings(userId, validationResult.data);
            res.status(200).json(ResponseBuilder.success(
                { deliveryModeSettings: result },
                "Delivery mode settings updated successfully"
            ));
        } catch (error: any) {
            logger.error("Error updating delivery mode settings:", error);
            this.handleError(error, res, "updating delivery mode settings");
        }
    };

    /**
     * Update delivery mode settings (legacy)
     */
    static updateDeliveryModeSettings = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.upsertDeliveryModeSettings(req, res);
    };

    // ─── Address Delivery Mode Management ────────────────────────────────────────

    /**
     * Update delivery mode for a specific address
     */
    static updateAddressDeliveryMode = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const { addressId } = req.params as { addressId: string };

            const validationResult: ValidationResult = await validateRequest(req, {
                deliveryMode: 'required|string|in:DELIVERY,PICKUP'
            });

            if (!validationResult.isValid) {
                res.status(400).json(createValidationErrorResponse(
                    validationResult.errors,
                    "Invalid delivery mode"
                ));
                return;
            }

            const { deliveryMode } = validationResult.data;
            const result = await DeliverySettingsService.updateAddressDeliveryMode(
                addressId,
                userId,
                deliveryMode
            );

            res.status(200).json(ResponseBuilder.success(
                { deliveryAddress: result },
                "Address delivery mode updated successfully"
            ));
        } catch (error: any) {
            logger.error("Error updating address delivery mode:", error);
            this.handleError(error, res, "updating address delivery mode");
        }
    };

    /**
     * Get addresses by delivery mode
     */
    static getAddressesByDeliveryMode = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const { deliveryMode } = req.params;

            if (!Object.values(DeliveryMode).includes(deliveryMode as DeliveryMode)) {
                res.status(400).json(createValidationErrorResponse(
                    [{ field: "deliveryMode", message: `Must be one of: ${Object.values(DeliveryMode).join(", ")}` }],
                    "Invalid delivery mode parameter"
                ));
                return;
            }

            const result = await DeliverySettingsService.getAddressesByDeliveryMode(
                userId,
                deliveryMode as DeliveryMode
            );

            res.status(200).json(ResponseBuilder.success(
                {
                    deliveryAddresses: result,
                    count: result.length,
                    deliveryMode,
                },
                `Delivery addresses for ${deliveryMode} mode retrieved successfully`
            ));
        } catch (error: any) {
            logger.error("Error fetching addresses by delivery mode:", error);
            this.handleError(error, res, "fetching addresses by delivery mode");
        }
    };

    /**
     * Get default address for specific delivery mode
     */
    static getDefaultAddressByDeliveryMode = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const { deliveryMode } = req.params;

            if (!Object.values(DeliveryMode).includes(deliveryMode as DeliveryMode)) {
                res.status(400).json(createValidationErrorResponse(
                    [{ field: "deliveryMode", message: `Must be one of: ${Object.values(DeliveryMode).join(", ")}` }],
                    "Invalid delivery mode parameter"
                ));
                return;
            }

            const result = await DeliverySettingsService.getDefaultAddressByDeliveryMode(
                userId,
                deliveryMode as DeliveryMode
            );

            res.status(200).json(ResponseBuilder.success(
                { deliveryAddress: result },
                `Default ${deliveryMode} address retrieved successfully`
            ));
        } catch (error: any) {
            logger.error("Error fetching default address by delivery mode:", error);
            this.handleError(error, res, "fetching default address");
        }
    };

    // ─── Address Validation and Geocoding ────────────────────────────────────────

    /**
     * Validate address data
     */
    static validateAddress = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const validationResult: ValidationResult = await validateRequest(req, {
                addressLine1: 'required|string|max:255',
                city: 'required|string|max:100',
                postalCode: 'string|max:20',
                country: 'required|string|size:2',
                latitude: 'numeric|min:-90|max:90',
                longitude: 'numeric|min:-180|max:180'
            });

            if (!validationResult.isValid) {
                res.status(400).json(createValidationErrorResponse(
                    validationResult.errors,
                    "Address validation failed"
                ));
                return;
            }

            const result = await DeliverySettingsService.validateAddress(validationResult.data);

            res.status(200).json(ResponseBuilder.success(
                result,
                "Address validation completed"
            ));
        } catch (error: any) {
            logger.error("Error validating address:", error);
            this.handleError(error, res, "validating address");
        }
    };

    /**
     * Geocode address to get coordinates
     */
    static geocodeAddress = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const validationResult: ValidationResult = await validateRequest(req, {
                addressLine1: 'required|string',
                addressLine2: 'string',
                city: 'required|string',
                county: 'string',
                postalCode: 'string',
                country: 'required|string|size:2'
            });

            if (!validationResult.isValid) {
                res.status(400).json(createValidationErrorResponse(
                    validationResult.errors,
                    "Invalid address data for geocoding"
                ));
                return;
            }

            const result = await DeliverySettingsService.geocodeAddress(validationResult.data);

            res.status(200).json(ResponseBuilder.success(
                { geocodedData: result },
                "Address geocoded successfully"
            ));
        } catch (error: any) {
            logger.error("Error geocoding address:", error);
            this.handleError(error, res, "geocoding address");
        }
    };

    // ─── Express Delivery Specific ───────────────────────────────────────────────

    /**
     * Check express delivery eligibility for an address
     */
    static checkExpressDeliveryEligibility = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const { addressId } = req.params as { addressId: string };
            const result = await DeliverySettingsService.checkExpressDeliveryEligibility(addressId, userId);

            res.status(200).json(ResponseBuilder.success(
                result,
                "Express delivery eligibility checked"
            ));
        } catch (error: any) {
            logger.error("Error checking express delivery eligibility:", error);
            this.handleError(error, res, "checking express delivery eligibility");
        }
    };

    // ─── Address History ─────────────────────────────────────────────────────────

    /**
     * Get address history with usage tracking
     */
    static getAddressHistory = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            const { limit = 10 } = req.query;
            const result = await DeliverySettingsService.getAddressHistory(userId, Number(limit));

            res.status(200).json(ResponseBuilder.success(
                {
                    addresses: result,
                    count: result.length,
                    history: result
                },
                "Address history retrieved successfully"
            ));
        } catch (error: any) {
            logger.error("Error fetching address history:", error);
            this.handleError(error, res, "fetching address history");
        }
    };

    // ─── Admin Functions ─────────────────────────────────────────────────────────

    /**
     * Bulk update delivery mode settings for multiple users (admin only)
     */
    static bulkUpdateDeliveryModeSettings = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            // Admin check should be implemented here
            // if (!await isAdmin(userId)) {
            //     res.status(403).json(createErrorResponse("Forbidden", "Admin access required"));
            //     return;
            // }

            const validationResult: ValidationResult = await validateRequest(req, {
                updates: 'required|array',
                'updates.*.userId': 'required|string',
                'updates.*.defaultDeliveryMode': 'string|in:DELIVERY,PICKUP',
                'updates.*.expressDeliveryEnabled': 'boolean'
            });

            if (!validationResult.isValid) {
                res.status(400).json(createValidationErrorResponse(
                    validationResult.errors,
                    "Invalid bulk update data"
                ));
                return;
            }

            const { updates } = validationResult.data;
            const results = await DeliverySettingsService.bulkUpdateDeliveryModeSettings(updates);

            res.status(200).json(ResponseBuilder.success(
                {
                    results,
                    successCount: results.filter(r => r.success).length,
                    failureCount: results.filter(r => !r.success).length
                },
                "Bulk update completed"
            ));
        } catch (error: any) {
            logger.error("Error in bulk update:", error);
            this.handleError(error, res, "bulk updating settings");
        }
    };

    /**
     * Get all delivery mode settings with pagination (admin only)
     */
    static getAllDeliveryModeSettings = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(createErrorResponse("Unauthorized", "User not authenticated"));
                return;
            }

            // Admin check should be implemented here
            // if (!await isAdmin(userId)) {
            //     res.status(403).json(createErrorResponse("Forbidden", "Admin access required"));
            //     return;
            // }

            const { page = 1, limit = 20 } = req.query;
            const result = await DeliverySettingsService.getAllDeliveryModeSettings(
                Number(page),
                Number(limit)
            );

            res.status(200).json(ResponseBuilder.success(
                result,
                "All delivery mode settings retrieved successfully"
            ));
        } catch (error: any) {
            logger.error("Error fetching all delivery mode settings:", error);
            this.handleError(error, res, "fetching all delivery mode settings");
        }
    };

    // ─── Error Handler Helper ────────────────────────────────────────────────────

    private static handleError(error: any, res: Response, action: string): void {
        if (error.message?.includes("Profile not found")) {
            res.status(404).json(createNotFoundResponse("Profile", "for this user"));
        } else if (error.message?.includes("not found") || error.message?.includes("does not belong")) {
            const match = error.message.match(/address (\S+)/i);
            const id = match ? match[1] : "unknown";
            res.status(404).json(createNotFoundResponse("Delivery address", id));
        } else {
            res.status(500).json(createErrorResponse(
                error.message,
                `An unexpected error occurred while ${action}`
            ));
        }
    }
}