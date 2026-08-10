import { db, DeliveryMode, Prisma } from "@repo/database";
import {
    VerificationStatus,
    VerificationMethod,
} from "@repo/database";
import {
    CreateDeliveryAddressInput,
    CreateDeliveryModeSettingsInput,
    CreateProfileInput,
    DeliveryAddress,
    DeliveryModeSettings,
    PaginatedProfiles,
    ProfileCompletionMetrics,
    ProfileFilters,
    ProfileStats,
    ProfileWithUser,
    UpdateDeliveryAddressInput,
    UpdateProfileInput,
} from "../../types/profile.types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PROFILE_WITH_USER_INCLUDE = {
    user: {
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
            role: true,
            isActive: true,
            isSuspended: true,
            createdAt: true,
        },
    },
    deliveryAddresses: {
        where: { isActive: true },
        select: {
            id: true,
            label: true,
            addressLine1: true,
            city: true,
            isDefault: true,
            isActive: true,
        },
        orderBy: { isDefault: "desc" as const },
    },
    // Include the one-to-one delivery mode settings relation
    deliveryMode: true,
} satisfies Prisma.ProfileInclude;

// ─── Service ──────────────────────────────────────────────────────────────────

export class ProfileService {
    /**
     * Get all profiles (paginated) or a single profile by userId
     */
    static async getProfiles(
        filters?: ProfileFilters
    ): Promise<ProfileWithUser | PaginatedProfiles> {
        const {
            userId,
            firstName,
            lastName,
            city,
            county,
            idVerificationStatus,
            search,
            page = 1,
            limit = 20,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = filters ?? {};

        // Single profile lookup
        if (userId) {
            return this.getProfileByUserId(userId);
        }

        // Build filter
        const where: Prisma.ProfileWhereInput = { deletedAt: null };

        if (firstName) where.firstName = { contains: firstName, mode: "insensitive" };
        if (lastName) where.lastName = { contains: lastName, mode: "insensitive" };
        if (city) where.city = { contains: city, mode: "insensitive" };
        if (county) where.county = { contains: county, mode: "insensitive" };
        if (idVerificationStatus) where.idVerificationStatus = idVerificationStatus;

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { displayName: { contains: search, mode: "insensitive" } },
                { city: { contains: search, mode: "insensitive" } },
                { bio: { contains: search, mode: "insensitive" } },
                {
                    user: {
                        OR: [
                            { name: { contains: search, mode: "insensitive" } },
                            { email: { contains: search, mode: "insensitive" } },
                            { phone: { contains: search, mode: "insensitive" } },
                        ],
                    },
                },
            ];
        }

        const skip = (page - 1) * limit;

        // Build orderBy — only allow fields that actually exist on Profile
        const allowedSortFields: Record<string, Prisma.ProfileOrderByWithRelationInput> = {
            createdAt: { createdAt: sortOrder },
            updatedAt: { updatedAt: sortOrder },
            firstName: { firstName: sortOrder },
            lastName: { lastName: sortOrder },
            totalOrders: { totalOrders: sortOrder },
            totalSpent: { totalSpent: sortOrder },
        };
        const orderBy: Prisma.ProfileOrderByWithRelationInput =
            allowedSortFields[sortBy] ?? { createdAt: sortOrder };

        const [profiles, total] = await Promise.all([
            db.profile.findMany({
                where,
                include: PROFILE_WITH_USER_INCLUDE,
                orderBy,
                skip,
                take: limit,
            }),
            db.profile.count({ where }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            profiles: profiles as unknown as ProfileWithUser[],
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasMore: page < totalPages,
            },
        };
    }

    // ─── CRUD ──────────────────────────────────────────────────────────────────

    /**
     * Create a profile for a user
     */
    static async createProfile(data: CreateProfileInput): Promise<ProfileWithUser> {
        if (!data.userId) throw new Error("User ID is required to create a profile");

        const user = await db.user.findUnique({
            where: { id: data.userId },
            select: { id: true },
        });
        if (!user) throw new Error(`User ${data.userId} not found`);

        const existing = await db.profile.findUnique({
            where: { userId: data.userId },
            select: { id: true },
        });
        if (existing) throw new Error(`Profile already exists for user ${data.userId}`);

        const profileData = this.prepareProfileData(data);

        const created = await db.profile.create({
            data: {
                ...profileData,
                user: { connect: { id: data.userId } },
            } as unknown as Prisma.ProfileCreateInput,
            include: PROFILE_WITH_USER_INCLUDE,
        });

        return created as unknown as ProfileWithUser;
    }

    /**
     * Update a profile by profile ID
     */
    static async updateProfile(
        id: string,
        data: UpdateProfileInput
    ): Promise<ProfileWithUser> {
        await this.assertProfileExists({ id });

        const updated = await db.profile.update({
            where: { id },
            data: this.prepareProfileData(data) as Prisma.ProfileUpdateInput,
            include: PROFILE_WITH_USER_INCLUDE,
        });

        return updated as unknown as ProfileWithUser;
    }

    /**
     * Update a profile by user ID
     */
    static async updateProfileByUserId(
        userId: string,
        data: UpdateProfileInput
    ): Promise<ProfileWithUser> {
        await this.assertProfileExists({ userId });

        const updated = await db.profile.update({
            where: { userId },
            data: this.prepareProfileData(data) as Prisma.ProfileUpdateInput,
            include: PROFILE_WITH_USER_INCLUDE,
        });

        return updated as unknown as ProfileWithUser;
    }

    /**
     * Get a profile by profile ID
     */
    static async getProfileById(id: string): Promise<ProfileWithUser> {
        const profile = await db.profile.findUnique({
            where: { id },
            include: PROFILE_WITH_USER_INCLUDE,
        });
        if (!profile) throw new Error(`Profile ${id} not found`);
        return profile as unknown as ProfileWithUser;
    }

    /**
     * Get a profile by user ID
     */
    static async getProfileByUserId(userId: string): Promise<ProfileWithUser> {
        const profile = await db.profile.findUnique({
            where: { userId },
            include: PROFILE_WITH_USER_INCLUDE,
        });
        if (!profile) throw new Error(`Profile not found for user ${userId}`);
        return profile as unknown as ProfileWithUser;
    }

    /**
     * Soft-delete a profile by profile ID
     */
    static async deleteProfile(id: string): Promise<{ id: string; userId: string }> {
        const existing = await this.assertProfileExists({ id });

        await db.profile.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        return { id, userId: existing.userId };
    }

    /**
     * Soft-delete a profile by user ID
     */
    static async deleteProfileByUserId(
        userId: string
    ): Promise<{ id: string; userId: string }> {
        const existing = await this.assertProfileExists({ userId });

        await db.profile.update({
            where: { userId },
            data: { deletedAt: new Date() },
        });

        return { id: existing.id, userId };
    }

    // ─── Verification ──────────────────────────────────────────────────────────

    /**
     * Mark a user's ID as verified
     */
    static async verifyIdentity(
        userId: string,
        method: VerificationMethod = VerificationMethod.MANUAL
    ): Promise<ProfileWithUser> {
        return this.updateProfileByUserId(userId, {
            idVerificationStatus: VerificationStatus.VERIFIED,
            idVerifiedAt: new Date().toISOString(),
            idVerificationMethod: method,
        });
    }

    /**
     * Reject a user's ID verification
     */
    static async rejectIdentityVerification(userId: string): Promise<ProfileWithUser> {
        return this.updateProfileByUserId(userId, {
            idVerificationStatus: VerificationStatus.REJECTED,
        });
    }

    // ─── Stats ─────────────────────────────────────────────────────────────────

    /**
     * Platform-wide profile statistics
     */
    static async getProfileStats(): Promise<ProfileStats> {
        const [
            totalProfiles,
            profilesWithHighCompletion,
            profilesWithVerifiedId,
            avgSpendResult,
            verificationCounts,
            recentUpdates,
            roleCounts,
        ] = await Promise.all([
            db.profile.count({ where: { deletedAt: null } }),

            // "High completion" = has firstName, lastName, city, and verified ID
            db.profile.count({
                where: {
                    deletedAt: null,
                    firstName: { not: null },
                    lastName: { not: null },
                    city: { not: null },
                    idVerificationStatus: VerificationStatus.VERIFIED,
                },
            }),

            db.profile.count({
                where: {
                    deletedAt: null,
                    idVerificationStatus: VerificationStatus.VERIFIED,
                },
            }),

            db.profile.aggregate({
                _avg: { totalSpent: true },
                where: { deletedAt: null },
            }),

            db.profile.groupBy({
                by: ["idVerificationStatus"],
                _count: { idVerificationStatus: true },
                where: { deletedAt: null },
            }),

            db.profile.findMany({
                take: 10,
                orderBy: { updatedAt: "desc" },
                where: { deletedAt: null },
                include: PROFILE_WITH_USER_INCLUDE,
            }),

            db.user.groupBy({
                by: ["role"],
                _count: { role: true },
                where: { profile: { isNot: null } },
            }),
        ]);

        const verification: ProfileStats["verification"] = {
            verified: 0,
            pending: 0,
            notVerified: 0,
        };
        for (const row of verificationCounts) {
            if (row.idVerificationStatus === VerificationStatus.VERIFIED)
                verification.verified = row._count.idVerificationStatus;
            else if (row.idVerificationStatus === VerificationStatus.PENDING)
                verification.pending = row._count.idVerificationStatus;
            else verification.notVerified += row._count.idVerificationStatus;
        }

        const byRole: Record<string, number> = {};
        for (const row of roleCounts) {
            byRole[row.role] = row._count.role;
        }

        return {
            overview: {
                totalProfiles,
                profilesWithHighCompletion,
                profilesWithVerifiedId,
                averageSpend: avgSpendResult._avg.totalSpent ?? 0,
            },
            byRole,
            verification,
            recentUpdates: recentUpdates as unknown as ProfileWithUser[],
        };
    }

    // ─── Profile completion ────────────────────────────────────────────────────

    /**
     * Calculate what percentage of the profile is filled in
     */
    static calculateProfileCompletion(profile: ProfileWithUser): ProfileCompletionMetrics {
        const sections = { personal: 0, contact: 0, address: 0, verification: 0 };
        const missingFields: string[] = [];
        const recommendations: string[] = [];

        // Personal (30%)
        const personalFields = ["firstName", "lastName", "dateOfBirth", "gender"] as const;
        const personalDone = personalFields.filter((f) => profile[f]).length;
        sections.personal = (personalDone / personalFields.length) * 30;
        personalFields.forEach((f) => { if (!profile[f]) missingFields.push(f); });

        // Contact (20%)
        const contactFields = ["secondaryEmail", "secondaryPhone"] as const;
        const contactDone = contactFields.filter((f) => profile[f]).length;
        sections.contact = (contactDone / contactFields.length) * 20;
        contactFields.forEach((f) => { if (!profile[f]) missingFields.push(f); });

        // Address (20%)
        const addressFields = ["addressLine1", "city", "county"] as const;
        const addressDone = addressFields.filter((f) => profile[f]).length;
        sections.address = (addressDone / addressFields.length) * 20;
        addressFields.forEach((f) => { if (!profile[f]) missingFields.push(f); });

        // Verification (30%)
        if (profile.idVerificationStatus === VerificationStatus.VERIFIED) {
            sections.verification = 30;
        } else {
            missingFields.push("idVerificationStatus");
            recommendations.push("Complete ID verification to unlock all features");

            if (profile.idVerificationStatus === VerificationStatus.NOT_VERIFIED) {
                recommendations.push("Upload a valid government-issued ID to get started");
            }
        }

        const completion = Math.round(
            sections.personal + sections.contact + sections.address + sections.verification
        );

        return { completion, sections, missingFields, recommendations };
    }



    // ─── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Prepare raw input data for Prisma — converts ISO date strings to Date objects
     */
    private static prepareProfileData(
        data: CreateProfileInput | UpdateProfileInput
    ): Record<string, unknown> {
        const DATE_FIELDS = new Set(["dateOfBirth", "idVerifiedAt", "idDocumentExpiry"]);
        const result: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(data)) {
            if (value === undefined || key === "userId") continue;
            result[key] = DATE_FIELDS.has(key) && value ? new Date(value as string) : value;
        }

        return result;
    }

    /**
     * Assert a profile exists and return its id + userId; throw if not found
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

    // ─── Type guards ───────────────────────────────────────────────────────────

    static isPaginatedProfiles(
        result: ProfileWithUser | PaginatedProfiles
    ): result is PaginatedProfiles {
        return "pagination" in result && "profiles" in result;
    }

    static isSingleProfile(
        result: ProfileWithUser | PaginatedProfiles
    ): result is ProfileWithUser {
        return "id" in result && "userId" in result && !("pagination" in result);
    }
}