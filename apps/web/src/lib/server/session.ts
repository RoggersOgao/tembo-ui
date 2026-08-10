"use server"

import { auth } from "@/auth";

/**
 * Get full server session. Use this inside server components, API routes,
 * or any Node runtime (NOT middleware).
 */
export async function getServerSession(req?: Request) {
    // auth() from your auth.ts returns the session when called in Node
    try {
        const session = await auth();
        return session ?? null;
    } catch (err) {
        console.error("getServerSession error:", err);
        return null;
    }
}
