// lib/auth-helpers.server.ts  ← for server actions, auth.ts, API routes
import { auth } from "@/auth";
import { jwtDecode } from "jwt-decode";

interface CustomJwtPayload {
  exp: number;
  userId: string;
}

export async function getAccessTokenServer(): Promise<string | null> {
  try {
    const session = await auth(); //  Server-safe: uses next-auth's `auth()`
    const token = session?.user?.token;

    if (!token) return null;

    const decoded = jwtDecode<CustomJwtPayload>(token);
    const currentTime = Date.now() / 1000;
    const isExpiringSoon = decoded.exp - currentTime < 300;

    if (isExpiringSoon) {
      console.warn("[!] Token expiring soon (server context) — session refresh needed.");
      // On the server you can't force a client session refresh.
      // Return the token anyway; the client will handle refresh on next request.
      return token;
    }

    return token;
  } catch (error) {
    console.error("Error checking token validity (server):", error);
    return null;
  }
}