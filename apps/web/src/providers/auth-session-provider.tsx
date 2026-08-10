"use client";

import { SessionProvider } from "next-auth/react";
import { SessionSyncProvider } from "@/providers/session-sync-provider";
import type { Session } from "next-auth";

interface AuthSessionProviderProps {
  children: React.ReactNode;
  session: Session | null;
}

export function AuthSessionProvider({ children, session }: AuthSessionProviderProps) {
  return (
    <SessionProvider
      session={session}
      refetchInterval={5 * 60}
      refetchOnWindowFocus={true}
    >
      <SessionSyncProvider>  {/*  moved inside the client boundary */}
        {children}
      </SessionSyncProvider>
    </SessionProvider>
  );
}