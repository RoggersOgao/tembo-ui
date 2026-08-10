import type { ReactElement } from "react";
import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { auth } from "@/auth";
import { AuthSessionProvider } from "@/providers/auth-session-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ModalProvider } from "@/providers/zustand/modal-provider";
import { TooltipProvider } from "@workspace/ui/components/tooltip";

import "@geoapify/geocoder-autocomplete/styles/minimal.css";
import "leaflet-control-geocoder/dist/Control.Geocoder.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AnalyticsShell } from "@/components/analytics/analytics-shell";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tembo Object Storage",
  description: "Tembo Object Storage dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<ReactElement> {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistMono.variable} antialiased`}>
        <QueryProvider>
          <AuthSessionProvider session={session}>
            <AnalyticsShell>
              <ModalProvider />
              <TooltipProvider>{children}</TooltipProvider>
            </AnalyticsShell>
          </AuthSessionProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}