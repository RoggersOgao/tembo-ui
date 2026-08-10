"use server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { SettingsSchema } from "@/lib/schemas";
import { generateVerificationToken } from "@/lib/token";
import { CurrentUser } from "@/lib/server/server-current-user";
import { emailClient } from "@/lib/email.api";
import { userClient } from "@/loginActions/user-actions";
import { db } from "@repo/database";

export const settings = async (values: z.infer<typeof SettingsSchema>) => {
    const user = await CurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    const res = await userClient.getUserByEmail(user.email as string);
    if (!res.success || !res.data?.user) {
        return { error: "Unauthorized" };
    }

    const dbUser = res.data.user;
    const updateData = { ...values };

    // Handle OAuth users
    if (user.isOAuth) {
        updateData.email = undefined;
        updateData.password = undefined;
        updateData.newPassword = undefined;
        updateData.isTwoFactorEnabled = undefined;
    }

    // Check if email needs verification
    if (values.email && values.email !== user.email) {
        const existingUserRes = await userClient.getUserByEmail(values.email);

        if (existingUserRes.success && existingUserRes.data?.user?.id !== user.id) {
            return { error: "Email already in use!" };
        }

        //  Pass userId as second argument
        const verificationToken = await generateVerificationToken(
            values.email,
            dbUser.id,
            { ipAddress: undefined, userAgent: undefined }
        );

        if (!verificationToken?.token) {
            return { error: "Failed to generate verification token." };
        }

        //  Use emailClient instead of sendVerificationEmail
        await emailClient.sendVerification(
            values.email,
            verificationToken.token,
            dbUser.name || 'User'
        );

        await db.user.update({
            where: { id: dbUser.id },
            data: {
                email: values.email,
                emailVerified: undefined,
            },
        });

        return { success: "Verification email sent! Please verify your new email." };
    }

    // Handle password update
    if (values.password && values.newPassword && dbUser.password) {
        const passwordMatch = await bcrypt.compare(values.password, dbUser.password);
        if (!passwordMatch) {
            return { error: "Incorrect password!" };
        }

        updateData.password = await bcrypt.hash(values.newPassword, 15);
        updateData.newPassword = undefined;
    }

    // Filter out undefined values
    const finalUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined)
    );

    await db.user.update({
        where: { id: dbUser.id },
        data: finalUpdateData,
    });

    return { success: "Settings Updated!" };
};