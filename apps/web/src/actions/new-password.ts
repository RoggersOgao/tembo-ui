"use server"
import { NewPasswordSchema } from "@/lib/schemas"
import { db } from "@repo/database"
import bcrypt from "bcrypt"
import { z } from "zod"

/**
 * Resets a user's password using a valid reset token
 * @param values - The new password data
 * @param token - The password reset token from email link
 * @returns Success or error message
 */
export const newPassword = async (
    values: z.infer<typeof NewPasswordSchema>,
    token?: string | null
) => {

    try {
        // Validate token exists
        if (!token?.trim()) {
            return { error: "Reset token is missing" }
        }

        // Validate input fields
        const validatedFields = NewPasswordSchema.safeParse(values)
        if (!validatedFields.success) {
            return {
                error: "Invalid password format",
                details: validatedFields.error.flatten().fieldErrors
            }
        }

        const { password } = validatedFields.data

        // Check if token exists in database
        const passwordResetToken = await db.passwordResetToken.findUnique({
            where: { token },
            select: {
                id: true,
                email: true,
                token: true,
                expires: true,
            }
        })

        if (!passwordResetToken) {
            return { error: "Invalid or expired reset token" }
        }

        // Validate that the token has all required fields
        if (!passwordResetToken.email || !passwordResetToken.expires) {
            return { error: "Invalid reset token data" }
        }



        // Check token expiration
        const now = new Date()
        const expiresAt = new Date(passwordResetToken.expires)
        const hasExpired = expiresAt < now


        if (hasExpired) {
            // Clean up expired token
            await db.passwordResetToken.delete({
                where: { id: passwordResetToken.id }
            }).catch((err) => {
                console.log("[!] [CLEANUP] Failed to delete expired token:", err.message)
            })

            return { error: "Reset token has expired. Please request a new one" }
        }

        // Verify user exists

        const existingUser = await db.user.findUnique({
            where: { email: passwordResetToken.email },
            select: {
                id: true,
                email: true,
                name: true
            }
        })

        if (!existingUser) {

            return { error: "User account not found" }
        }

        // Hash the new password with appropriate cost factor

        const hashStartTime = Date.now()
        const hashedPassword = await bcrypt.hash(password, 12)
        const hashDuration = Date.now() - hashStartTime


        // Update password and delete ALL tokens for this email in a transaction

        await db.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: {
                    email: passwordResetToken.email
                },
                data: {
                    password: hashedPassword,
                    updatedAt: new Date()
                }
            })


            const deleteResult = await tx.passwordResetToken.deleteMany({
                where: {
                    email: passwordResetToken.email
                }
            })

        })

        return {
            success: "Password reset successful! You can now log in with your new password"
        }
    } catch (error) {
        console.error("🚨 [ERROR] Password reset failed")
        console.error("🚨 [ERROR] Error type:", error?.constructor?.name)
        console.error("🚨 [ERROR] Full error object:", error)

        // Log detailed error for debugging
        if (error instanceof Error) {
            console.error("🚨 [ERROR] Error message:", error.message)
            console.error("🚨 [ERROR] Error stack:", error.stack)
            console.error("🚨 [ERROR] Error name:", error.name)
        }

        // Log Prisma-specific errors
        if (error && typeof error === 'object' && 'code' in error) {
            console.error("🚨 [PRISMA ERROR] Code:", (error as any).code)
            console.error("🚨 [PRISMA ERROR] Meta:", (error as any).meta)
            console.error("🚨 [PRISMA ERROR] Client version:", (error as any).clientVersion)
        }

        // Don't expose internal errors to users
        return {
            error: "An error occurred while resetting your password. Please try again"
        }
    }
}