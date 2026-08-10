"use server"
import { emailClient } from "@/lib/email.api";
import { ResetSchema } from "@/lib/schemas";
import { generatePasswordResetToken } from "@/lib/token";
import { userClient } from "@/loginActions/user-actions";
import { z } from "zod";

export const ResetPassword = async (values: z.infer<typeof ResetSchema>) => {
    try {
        const validatedFields = ResetSchema.safeParse(values);
        if (!validatedFields.success) {
            return { error: "Invalid Email!" };
        }

        const { email } = validatedFields.data;

        const existingUser = await userClient.getUserByEmail(email);
        if (!existingUser) {
            return { success: "If that email exists, a reset link has been sent!" };
        }

        // Generate token
        const passwordResetToken = await generatePasswordResetToken(email);

        //  Check cooldown BEFORE sending email
        if (!passwordResetToken.success) {
            return { error: passwordResetToken.error }; // "Please wait X seconds..."
        }

        console.log("passwordReset", {
            email: existingUser.data?.user.email,
            token: passwordResetToken.token,
            expires: passwordResetToken.expiresAt,
        });

        await emailClient.sendPasswordReset(
            existingUser.data?.user.email as string,
            passwordResetToken.token as string,
            passwordResetToken.expiresAt?.toDateString()
        );

        return { success: "Reset email sent!" };

    } catch (error) {
        console.error("Reset password error:", error);
        return { error: JSON.stringify(error) };
    }
};