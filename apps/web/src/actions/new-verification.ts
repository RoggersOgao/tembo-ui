"use server"
import { validateTokenFormat } from "@/lib/token"
import { UserClient } from "@/lib/user-client-api"
import { deleteVerificationToken, getVerificationTokenByToken } from "@/loginActions/generate-verification-token"
import { ErrorCode } from "@repo/api-utils"

export const newVerification = async (token: string) => {
    try {
        if (!token || typeof token !== 'string') {
            return { error: "Invalid token!" }
        }

        const tokenVerified = validateTokenFormat(token, "uuid")
        if (!tokenVerified) {
            return { error: "Invalid token format!" }
        }

        const existingToken = await getVerificationTokenByToken(token)

        if (!existingToken.success || !existingToken.data) {
            return { error: "Token does not exist!" }
        }

        const tokenData = existingToken.data

        if (!tokenData.token.expires) {
            return { error: "Invalid token format!" }
        }

        const hasExpired = new Date(tokenData.token.expires) < new Date()

        if (hasExpired) {
            try { await deleteVerificationToken(tokenData.token.id) } catch (_) {}
            return { error: "Token has expired! Please request a new verification email." }
        }

        const existingUserResult = await UserClient.getByEmail(
            tokenData.token.email,
            { includePassword: false }
        )

        if (!existingUserResult.success) {
            try { await deleteVerificationToken(tokenData.token.id) } catch (e) {
                console.error("Error deleting token:", e)
            }
            return { error: "Email does not exist!" }
        }

        const userData = existingUserResult.data.user

        if (userData.emailVerified) {
            try { await deleteVerificationToken(tokenData.token.id) } catch (_) {}
            return {
                success: "Email already verified! You can now sign in.",
                alreadyVerified: true
            }
        }

        const verifyResult = await UserClient.verify(
            userData.id,
            tokenData.token.email
        )

        if (!verifyResult.success) {
            console.error("Error updating user:", verifyResult.message)
            return {
                error: "Failed to verify email. Please try again.",
                code: ErrorCode.DATABASE_ERROR
            }
        }

        try { await deleteVerificationToken(tokenData.token.id) } catch (e) {
            console.error("Error deleting token after verification:", e)
        }

        return { success: "Email verified successfully! You can now sign in." }

    } catch (error) {
        console.error("Verification error:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
            token: token?.substring(0, 10) + "...",
        })

        if (error instanceof Error) {
            if (error.message.includes("P2025")) {
                return { error: "Token no longer exists. Please request a new verification email." }
            }
            if (error.message.includes("P2001")) {
                return { error: "User not found. Please register again." }
            }
            if (error.message.includes("P2002")) {
                return { error: "Email already in use by another account." }
            }
        }

        return { error: "Something went wrong during verification. Please try again." }
    }
}