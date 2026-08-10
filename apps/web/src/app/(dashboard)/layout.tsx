"use client"

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SiteHeader } from "@/components/dashboard/dash-home/site-header";
import { useOnlineStatus } from "@/hooks/use-online-status";

import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";
import React, { useEffect } from "react";
import { toast } from "sonner";



export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!isOnline) {
      toast.error("No Internet Connection", {
        description: "Please check your network settings.",
        duration: Infinity,
        id: "offline-toast"
      });
    } else {
      toast.dismiss("offline-toast");
    }
  }, [isOnline]);

  return (
    
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />


          {children}
        </SidebarInset>
      </SidebarProvider>
    

  );
}
