"use client";
import { getSession, signOut } from "next-auth/react";
import { jwtDecode } from "jwt-decode";

interface CustomJwtPayload {
  exp: number;
  userId: string;
}

export async function getAccessTokenClient(): Promise<string | null> {
  try {
    const session = await getSession();
    const token = session?.user?.token;

    if (!token) return null;

    const decoded = jwtDecode<CustomJwtPayload>(token);
    const currentTime = Date.now() / 1000;
    const isExpiringSoon = decoded.exp - currentTime < 300;

    if (isExpiringSoon) {
      console.log("[!] Token expiring soon. Refreshing via session endpoint...");

      // Manually hit the NextAuth session endpoint with a POST
      // to trigger the jwt callback with trigger="update"
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrfToken: await getCsrfToken() }),
      });

      if (response.ok) {
        // Re-fetch the updated session
        const newSession = await getSession();
        if (newSession?.user?.token) {
          console.log(" Token refreshed successfully.");
          return newSession.user.token;
        }
      }

      // If refresh failed, session is dead
      console.error("[*] Session refresh failed. Logging out.");
      await signOut({ callbackUrl: "/auth/login" });
      return null;
    }

    return token;
  } catch (error) {
    console.error("Error checking token validity (client):", error);
    return null;
  }
}

async function getCsrfToken(): Promise<string> {
  const res = await fetch("/api/auth/csrf");
  const data = await res.json();
  return data.csrfToken ?? "";
}