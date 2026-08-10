// services/delivery/delivery-settings.service.ts
import { db, DeliveryMode, Prisma } from "@repo/database";
import {
    CreateDeliveryAddressInput,
    CreateDeliveryModeSettingsInput,
    DeliveryAddress,
    DeliveryModeSettings,
    UpdateDeliveryAddressInput,
} from "../../types/profile.types";
import { logger } from '@repo/logger';
import deliverySettingsCacheService from "../../cache/user/deliverySettings.cache.service";

export class DeliverySettingsService {
    // ─── Delivery Address CRUD ────────────────────────────────────────────────────

    /**
     * Add a delivery address to a user's profile
     */
    static async addDeliveryAddress(
        userId: string,
        addressData: CreateDeliveryAddressInput
    ): Promise<DeliveryAddress> {
        const profile = await this.assertProfileExists({ userId });

        const resolvedDeliveryMode: DeliveryMode = addressData.deliveryMode ?? DeliveryMode.DELIVERY;

        const deliveryAddress = await db.deliveryAddress.create({
            data: {
                profileId: profile.id,
                label: addressData.label ?? null,
                addressLine1: addressData.addressLine1,
                addressLine2: addressData.addressLine2 ?? null,
                city: addressData.city,
                county: addressData.county ?? null,
                postalCode: addressData.postalCode ?? null,
                country: addressData.country ?? "KE",
                latitude: addressData.latitude ?? null,
                longitude: addressData.longitude ?? null,
                instructions: addressData.instructions ?? null,
                deliveryMode: resolvedDeliveryMode,
                isDefault: addressData.isDefault ?? false,
                isActive: true,
            },
        });

        if (deliveryAddress.isDefault) {
            await db.deliveryAddress.updateMany({
                where: {
                    profileId: profile.id,
                    id: { not: deliveryAddress.id },
                },
                data: { isDefault: false },
            });
        }

        // Invalidate caches
        await deliverySettingsCacheService.invalidateUserAddresses(userId);
        await deliverySettingsCacheService.invalidateAddressStats(userId);

        logger.info('Delivery address added', { addressId: deliveryAddress.id, userId });

        return deliveryAddress as DeliveryAddress;
    }

    /**
     * Get all active delivery addresses for a user
     */
    static async getDeliveryAddresses(
        userId: string,
        deliveryMode?: DeliveryMode
    ): Promise<DeliveryAddress[]> {
        // Try to get from cache
        const cachedAddresses = await deliverySettingsCacheService.getUserAddresses(userId, deliveryMode);
        if (cachedAddresses) {
            logger.debug('User addresses cache hit', { userId, deliveryMode });
            return cachedAddresses;
        }

        logger.debug('User addresses cache miss, fetching from DB', { userId, deliveryMode });

        const profile = await this.assertProfileExists({ userId });

        const addresses = await db.deliveryAddress.findMany({
            where: {
                profileId: profile.id,
                isActive: true,
                ...(deliveryMode ? { deliveryMode } : {}),
            },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        });

        const result = addresses as DeliveryAddress[];

        // Cache the result
        await deliverySettingsCacheService.setUserAddresses(userId, result, deliveryMode);

        return result;
    }

    /**
     * Get a single delivery address by ID with ownership verification
     */
    static async getDeliveryAddressById(
        addressId: string,
        userId: string
    ): Promise<DeliveryAddress | null> {
        // Try to get from cache
        const cachedAddress = await deliverySettingsCacheService.getAddress(addressId);
        if (cachedAddress) {
            // Verify ownership
            if ((cachedAddress as any).profile?.userId === userId) {
                logger.debug('Delivery address cache hit', { addressId, userId });
                return cachedAddress;
            }
        }

        logger.debug('Delivery address cache miss, fetching from DB', { addressId, userId });

        const profile = await this.assertProfileExists({ userId });

        const address = await db.deliveryAddress.findFirst({
            where: {
                id: addressId,
                profileId: profile.id,
                isActive: true,
            },
        });

        if (address) {
            // Cache the address
            await deliverySettingsCacheService.setAddress(addressId, address);
        }

        return (address as DeliveryAddress) ?? null;
    }

    /**
     * Update a delivery address
     */
    static async updateDeliveryAddress(
        addressId: string,
        userId: string,
        data: UpdateDeliveryAddressInput
    ): Promise<DeliveryAddress> {
        const profile = await this.assertProfileExists({ userId });
        await this.assertAddressOwnership(addressId, profile.id);

        const updated = await db.deliveryAddress.update({
            where: { id: addressId },
            data: {
                ...data,
            },
        });

        if (data.isDefault) {
            await db.deliveryAddress.updateMany({
                where: {
                    profileId: profile.id,
                    id: { not: addressId },
                },
                data: { isDefault: false },
            });
        }

        // Invalidate caches
        await deliverySettingsCacheService.invalidateAddress(addressId, userId);
        await deliverySettingsCacheService.invalidateAddressStats(userId);

        logger.info('Delivery address updated', { addressId, userId });

        return updated as DeliveryAddress;
    }

    /**
     * Soft-delete a delivery address
     */
    static async removeDeliveryAddress(
        addressId: string,
        userId: string
    ): Promise<{ id: string }> {
        const profile = await this.assertProfileExists({ userId });
        await this.assertAddressOwnership(addressId, profile.id);

        await db.deliveryAddress.update({
            where: { id: addressId },
            data: { isActive: false },
        });

        // Invalidate caches
        await deliverySettingsCacheService.invalidateAddress(addressId, userId);
        await deliverySettingsCacheService.invalidateAddressStats(userId);

        logger.info('Delivery address removed', { addressId, userId });

        return { id: addressId };
    }

    /**
     * Set a delivery address as default
     */
    static async setDefaultDeliveryAddress(
        addressId: string,
        userId: string
    ): Promise<DeliveryAddress> {
        const profile = await this.assertProfileExists({ userId });
        await this.assertAddressOwnership(addressId, profile.id);

        // Set this address as default
        const updated = await db.deliveryAddress.update({
            where: { id: addressId },
            data: { isDefault: true },
        });

        // Unset default on all other addresses
        await db.deliveryAddress.updateMany({
            where: {
                profileId: profile.id,
                id: { not: addressId },
            },
            data: { isDefault: false },
        });

        // Invalidate caches
        await deliverySettingsCacheService.invalidateUserAddresses(userId);
        await deliverySettingsCacheService.invalidateAddressStats(userId);

        logger.info('Default delivery address set', { addressId, userId });

        return updated as DeliveryAddress;
    }

    /**
     * Batch update multiple delivery addresses
     */
    static async batchUpdateDeliveryAddresses(
        userId: string,
        updates: Array<{ id: string } & UpdateDeliveryAddressInput>
    ): Promise<Array<DeliveryAddress | { id: string; error: string }>> {
        const profile = await this.assertProfileExists({ userId });
        const results = [];

        for (const update of updates) {
            try {
                await this.assertAddressOwnership(update.id, profile.id);
                
                const updated = await db.deliveryAddress.update({
                    where: { id: update.id },
                    data: update,
                });
                
                results.push(updated);
            } catch (error: any) {
                results.push({ id: update.id, error: error.message });
            }
        }

        // Handle default address logic if any address was set as default
        const defaultUpdates = updates.filter(u => u.isDefault === true);
        if (defaultUpdates.length > 0) {
            // Only the last default update should actually be default
            const lastDefault = defaultUpdates[defaultUpdates.length - 1];
            await db.deliveryAddress.updateMany({
                where: {
                    profileId: profile.id,
                    id: { not: lastDefault.id },
                },
                data: { isDefault: false },
            });
        }

        // Invalidate caches
        await deliverySettingsCacheService.invalidateUserAddresses(userId);
        await deliverySettingsCacheService.invalidateAddressStats(userId);

        logger.info('Batch delivery addresses updated', { userId, count: updates.length });

        return results;
    }

    /**
     * Get delivery address statistics
     */
    static async getDeliveryAddressStats(userId: string): Promise<{
        total: number;
        byMode: Record<DeliveryMode, number>;
        hasDefault: boolean;
        defaultAddress: DeliveryAddress | null;
        recentAddresses: DeliveryAddress[];
    }> {
        // Try to get from cache
        const cachedStats = await deliverySettingsCacheService.getAddressStats(userId);
        if (cachedStats) {
            logger.debug('Address stats cache hit', { userId });
            return cachedStats;
        }

        logger.debug('Address stats cache miss, fetching from DB', { userId });

        const addresses = await this.getDeliveryAddresses(userId);
        
        const byMode = {
            [DeliveryMode.DELIVERY]: 0,
            [DeliveryMode.PICKUP]: 0,
        };
        
        addresses.forEach(addr => {
            byMode[addr.deliveryMode] = (byMode[addr.deliveryMode] || 0) + 1;
        });

        const stats = {
            total: addresses.length,
            byMode,
            hasDefault: addresses.some(a => a.isDefault),
            defaultAddress: addresses.find(a => a.isDefault) || null,
            recentAddresses: addresses.slice(0, 5),
        };

        // Cache the stats
        await deliverySettingsCacheService.setAddressStats(userId, stats);

        return stats;
    }

    // ─── Delivery Mode Settings ───────────────────────────────────────────────────

    /**
     * Get delivery mode settings
     */
    static async getDeliveryModeSettings(userId: string): Promise<DeliveryModeSettings | null> {
        // Try to get from cache
        const cachedSettings = await deliverySettingsCacheService.getDeliverySettings(userId);
        if (cachedSettings) {
            logger.debug('Delivery settings cache hit', { userId });
            return cachedSettings;
        }

        logger.debug('Delivery settings cache miss, fetching from DB', { userId });

        const profile = await this.assertProfileExists({ userId });

        const settings = await db.deliveryModeSetting.findUnique({
            where: { profileId: profile.id },
        });

        if (settings) {
            // Cache the settings
            await deliverySettingsCacheService.setDeliverySettings(userId, settings);
        }

        return settings as DeliveryModeSettings | null;
    }

    /**
     * Get delivery mode settings with additional details
     */
    static async getDeliveryModeSettingsWithDetails(userId: string): Promise<{
        settings: DeliveryModeSettings | null;
        addressSummary: {
            total: number;
            byMode: Record<DeliveryMode, number>;
            hasDefault: boolean;
            defaultAddress: DeliveryAddress | null;
        };
    }> {
        // Try to get from cache
        const cachedData = await deliverySettingsCacheService.getDeliverySettingsWithDetails(userId);
        if (cachedData) {
            logger.debug('Delivery settings with details cache hit', { userId });
            return cachedData;
        }

        logger.debug('Delivery settings with details cache miss, fetching from DB', { userId });

        const [settings, addresses] = await Promise.all([
            this.getDeliveryModeSettings(userId),
            this.getDeliveryAddresses(userId),
        ]);

        const byMode = {
            [DeliveryMode.DELIVERY]: 0,
            [DeliveryMode.PICKUP]: 0,
        };
        
        addresses.forEach(addr => {
            byMode[addr.deliveryMode] = (byMode[addr.deliveryMode] || 0) + 1;
        });

        const result = {
            settings,
            addressSummary: {
                total: addresses.length,
                byMode,
                hasDefault: addresses.some(a => a.isDefault),
                defaultAddress: addresses.find(a => a.isDefault) || null,
            },
        };

        // Cache the result
        await deliverySettingsCacheService.setDeliverySettingsWithDetails(userId, result);

        return result;
    }

    /**
     * Create or update delivery mode settings
     */
    static async upsertDeliveryModeSettings(
        userId: string,
        data: CreateDeliveryModeSettingsInput
    ): Promise<DeliveryModeSettings> {
        const profile = await this.assertProfileExists({ userId });

        const preferredDeliveryDate =
            data.preferredDeliveryDate instanceof Date
                ? data.preferredDeliveryDate
                : data.preferredDeliveryDate
                ? new Date(data.preferredDeliveryDate)
                : undefined;

        const settings = await db.deliveryModeSetting.upsert({
            where: { profileId: profile.id },
            update: {
                ...(data.defaultDeliveryMode !== undefined && {
                    defaultDeliveryMode: data.defaultDeliveryMode,
                }),
                ...(data.preferredDeliveryTime !== undefined && {
                    preferredDeliveryTime: data.preferredDeliveryTime,
                }),
                ...(preferredDeliveryDate !== undefined && { preferredDeliveryDate }),
                ...(data.contactlessDelivery !== undefined && {
                    contactlessDelivery: data.contactlessDelivery,
                }),
                ...(data.leaveAtDoor !== undefined && { leaveAtDoor: data.leaveAtDoor }),
                ...(data.expressDeliveryEnabled !== undefined && {
                    expressDeliveryEnabled: data.expressDeliveryEnabled,
                }),
                ...(data.expressDeliveryRadius !== undefined && {
                    expressDeliveryRadius: data.expressDeliveryRadius,
                }),
                ...(data.preferredPickupLocation !== undefined && {
                    preferredPickupLocation: data.preferredPickupLocation,
                }),
                ...(data.pickupInstructions !== undefined && {
                    pickupInstructions: data.pickupInstructions,
                }),
            },
            create: {
                profileId: profile.id,
                defaultDeliveryMode: data.defaultDeliveryMode ?? DeliveryMode.DELIVERY,
                preferredDeliveryTime: data.preferredDeliveryTime ?? null,
                preferredDeliveryDate: preferredDeliveryDate ?? null,
                contactlessDelivery: data.contactlessDelivery ?? false,
                leaveAtDoor: data.leaveAtDoor ?? false,
                expressDeliveryEnabled: data.expressDeliveryEnabled ?? false,
                expressDeliveryRadius: data.expressDeliveryRadius ?? null,
                preferredPickupLocation: data.preferredPickupLocation ?? null,
                pickupInstructions: data.pickupInstructions ?? null,
            },
        });

        // Invalidate delivery settings cache
        await deliverySettingsCacheService.invalidateDeliverySettings(userId);

        logger.info('Delivery mode settings upserted', { userId });

        return settings as DeliveryModeSettings;
    }

    /**
     * Update address delivery mode
     */
    static async updateAddressDeliveryMode(
        addressId: string,
        userId: string,
        deliveryMode: DeliveryMode
    ): Promise<DeliveryAddress> {
        const profile = await this.assertProfileExists({ userId });
        await this.assertAddressOwnership(addressId, profile.id);

        const updated = await db.deliveryAddress.update({
            where: { id: addressId },
            data: { deliveryMode },
        });

        // Invalidate caches
        await deliverySettingsCacheService.invalidateAddress(addressId, userId);
        await deliverySettingsCacheService.invalidateAddressStats(userId);

        logger.info('Address delivery mode updated', { addressId, userId, deliveryMode });

        return updated as DeliveryAddress;
    }

    /**
     * Get addresses by delivery mode
     */
    static async getAddressesByDeliveryMode(
        userId: string,
        deliveryMode: DeliveryMode
    ): Promise<DeliveryAddress[]> {
        return this.getDeliveryAddresses(userId, deliveryMode);
    }

    /**
     * Get default address for specific delivery mode
     */
    static async getDefaultAddressByDeliveryMode(
        userId: string,
        deliveryMode: DeliveryMode
    ): Promise<DeliveryAddress | null> {
        // Try to get from cache
        const cachedAddress = await deliverySettingsCacheService.getDefaultAddress(userId, deliveryMode);
        if (cachedAddress) {
            logger.debug('Default address by mode cache hit', { userId, deliveryMode });
            return cachedAddress;
        }

        logger.debug('Default address by mode cache miss, fetching from DB', { userId, deliveryMode });

        const addresses = await this.getDeliveryAddresses(userId, deliveryMode);
        const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0] || null;

        if (defaultAddress) {
            // Cache the default address
            await deliverySettingsCacheService.setDefaultAddress(userId, defaultAddress, deliveryMode);
        }

        return defaultAddress;
    }

    /**
     * Validate address data
     */
    static async validateAddress(
        addressData: Partial<CreateDeliveryAddressInput>
    ): Promise<{
        isValid: boolean;
        errors: Array<{ field: string; message: string }>;
        validatedData: Partial<CreateDeliveryAddressInput>;
    }> {
        const errors = [];
        const validatedData = { ...addressData };

        // Required fields validation
        if (!addressData.addressLine1) {
            errors.push({ field: 'addressLine1', message: 'Address line 1 is required' });
        }

        if (!addressData.city) {
            errors.push({ field: 'city', message: 'City is required' });
        }

        // Country-specific validation
        const country = addressData.country || 'KE';
        if (country === 'KE' && addressData.postalCode && !/^\d{5}$/.test(addressData.postalCode)) {
            errors.push({
                field: 'postalCode',
                message: 'Invalid Kenyan postal code format (should be 5 digits)'
            });
        }

        // Coordinates validation
        if (addressData.latitude && (addressData.latitude < -90 || addressData.latitude > 90)) {
            errors.push({ field: 'latitude', message: 'Latitude must be between -90 and 90' });
        }

        if (addressData.longitude && (addressData.longitude < -180 || addressData.longitude > 180)) {
            errors.push({ field: 'longitude', message: 'Longitude must be between -180 and 180' });
        }

        return {
            isValid: errors.length === 0,
            errors,
            validatedData,
        };
    }

    /**
     * Geocode address to get coordinates
     */
    static async geocodeAddress(
        addressData: Partial<CreateDeliveryAddressInput>
    ): Promise<{
        latitude: number | null;
        longitude: number | null;
        formattedAddress: string;
        confidence: number;
    }> {
        // This would integrate with a geocoding service like Google Maps, OpenStreetMap, etc.
        // For now, return mock data
        return {
            latitude: -1.286389,
            longitude: 36.817223,
            formattedAddress: `${addressData.addressLine1}, ${addressData.city}, ${addressData.country}`,
            confidence: 0.95,
        };
    }

    /**
     * Check express delivery eligibility for an address
     */
    static async checkExpressDeliveryEligibility(
        addressId: string,
        userId: string
    ): Promise<{
        isEligible: boolean;
        expressDeliveryEnabled: boolean;
        expressDeliveryRadius: number | null;
        address: Partial<DeliveryAddress>;
    }> {
        const address = await this.getDeliveryAddressById(addressId, userId);
        const settings = await this.getDeliveryModeSettings(userId);

        const isEligible = settings?.expressDeliveryEnabled === true;
        
        // In a real implementation, you would check if the address is within the express delivery radius
        const withinRadius = isEligible && settings?.expressDeliveryRadius ? true : false;

        return {
            isEligible: isEligible && withinRadius,
            expressDeliveryEnabled: settings?.expressDeliveryEnabled ?? false,
            expressDeliveryRadius: settings?.expressDeliveryRadius ?? null,
            address: {
                id: address?.id,
                label: address?.label,
                latitude: address?.latitude,
                longitude: address?.longitude,
            },
        };
    }

    /**
     * Get address history (with usage tracking)
     */
    static async getAddressHistory(
        userId: string,
        limit: number = 10
    ): Promise<Array<DeliveryAddress & { lastUsedAt: Date; usageCount: number }>> {
        // Try to get from cache
        const cachedHistory = await deliverySettingsCacheService.getAddressHistory(userId, limit);
        if (cachedHistory) {
            logger.debug('Address history cache hit', { userId, limit });
            return cachedHistory;
        }

        logger.debug('Address history cache miss, fetching from DB', { userId, limit });

        const addresses = await this.getDeliveryAddresses(userId);
        
        // In a real implementation, you would query an address history table
        // For now, return addresses with mock history data
        const history = addresses.slice(0, limit).map(addr => ({
            ...addr,
            lastUsedAt: addr.updatedAt,
            usageCount: 0,
        }));

        // Cache the history
        await deliverySettingsCacheService.setAddressHistory(userId, limit, history);

        return history;
    }

    // ─── Admin Functions ─────────────────────────────────────────────────────────

    /**
     * Bulk update delivery mode settings for multiple users (admin only)
     */
    static async bulkUpdateDeliveryModeSettings(
        updates: Array<{
            userId: string;
            defaultDeliveryMode?: DeliveryMode;
            expressDeliveryEnabled?: boolean;
            contactlessDelivery?: boolean;
        }>
    ): Promise<Array<{ userId: string; success: boolean; settings?: DeliveryModeSettings; error?: string }>> {
        const results = [];

        for (const update of updates) {
            try {
                const settings = await this.upsertDeliveryModeSettings(update.userId, update);
                results.push({ userId: update.userId, success: true, settings });
            } catch (error: any) {
                results.push({ userId: update.userId, success: false, error: error.message });
            }
        }

        logger.info('Bulk delivery mode settings updated', { count: updates.length });

        return results;
    }

    /**
     * Get all delivery mode settings with pagination (admin only)
     */
    static async getAllDeliveryModeSettings(
        page: number = 1,
        limit: number = 20
    ): Promise<{
        settings: Array<DeliveryModeSettings & { profile: { user: { name: string; email: string } } }>;
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }> {
        // Admin queries are not cached as they can be large and admin users expect real-time data
        const skip = (page - 1) * limit;

        const [settings, total] = await Promise.all([
            db.deliveryModeSetting.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    profile: {
                        include: {
                            user: {
                                select: {
                                    name: true,
                                    email: true,
                                },
                            },
                        },
                    },
                },
            }),
            db.deliveryModeSetting.count(),
        ]);

        return {
            settings: settings as any,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get cache statistics for delivery settings
     */
    static async getCacheStats() {
        return deliverySettingsCacheService.getStats();
    }

    /**
     * Clear all delivery settings cache
     */
    static async clearCache(): Promise<void> {
        await deliverySettingsCacheService.clearAll();
    }

    /**
     * Clear cache for a specific user's delivery settings
     */
    static async clearUserCache(userId: string): Promise<void> {
        await deliverySettingsCacheService.invalidateUserAddresses(userId);
        await deliverySettingsCacheService.invalidateDeliverySettings(userId);
        await deliverySettingsCacheService.invalidateAddressStats(userId);
    }

    /**
     * Health check for cache service
     */
    static async healthCheck(): Promise<{
        cacheService: { 
            healthy: boolean; 
            mode: string; 
            memorySize?: number;
            error?: string;
        };
        database: boolean;
        overall: boolean;
    }> {
        try {
            const health = await deliverySettingsCacheService.healthCheck();
            
            // Check database connectivity
            let databaseHealthy = false;
            try {
                await db.$queryRaw`SELECT 1`;
                databaseHealthy = true;
            } catch (error) {
                logger.error('Database health check failed', { error });
            }
            
            return {
                cacheService: health,
                database: databaseHealthy,
                overall: health.healthy && databaseHealthy,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                cacheService: { 
                    healthy: false, 
                    mode: 'unknown',
                    error: errorMessage 
                },
                database: false,
                overall: false,
            };
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    /**
     * Assert a profile exists and return its id + userId
     */
    private static async assertProfileExists(
        where: { id: string } | { userId: string }
    ): Promise<{ id: string; userId: string }> {
        const profile = await db.profile.findUnique({
            where: where as Prisma.ProfileWhereUniqueInput,
            select: { id: true, userId: true },
        });

        if (!profile) {
            const key = "id" in where ? `ID ${where.id}` : `user ${(where as { userId: string }).userId}`;
            throw new Error(`Profile not found for ${key}`);
        }

        return profile;
    }

    /**
     * Assert that a delivery address belongs to the given profileId
     */
    private static async assertAddressOwnership(
        addressId: string,
        profileId: string
    ): Promise<void> {
        const address = await db.deliveryAddress.findFirst({
            where: { id: addressId, profileId, isActive: true },
            select: { id: true },
        });

        if (!address) {
            throw new Error(`Delivery address ${addressId} not found or does not belong to this profile`);
        }
    }
}