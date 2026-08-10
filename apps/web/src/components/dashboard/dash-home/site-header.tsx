"use client"


import { ModeToggle } from "@/components/layout/theme-button"
import { CurrentUser } from "@/lib/server/client-current-user"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"

export function SiteHeader() {
  const user = CurrentUser()

  return (
    <header className="flex h-(--header-height) sticky top-0 bg-white/10 dark:bg-black/10 z-10 backdrop-blur-2xl shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">Dashboard</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden sm:flex">
            {user?.role}
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
