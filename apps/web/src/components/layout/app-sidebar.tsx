"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  ChevronRight,
  Tag,
  Sparkles,
  ShoppingBag,
  Percent,
  Menu,
} from "lucide-react"
import type { IconType } from "react-icons"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"
import IsLogo from "./Is_logo"

import { mapTreeToSidebarCategories } from "@/components/layout/category-sidebar-mapper"
import { useCategoriesWithProducts } from "@/hooks/products/category/useCategory"

const promotions = [
  { title: "Buy 2 Get 1 Free", url: "/promotions/b2g1", icon: Percent },
  { title: "Family Pack Deals", url: "/promotions/family-pack", icon: Tag },
  { title: "Weekly Specials", url: "/promotions/weekly", icon: Sparkles },
  { title: "New Customer Discount", url: "/promotions/new-customer", icon: ShoppingBag },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  // Returns CategoryTreeNode[] now that the type alias is in place
  const { data: tree = [], isLoading } = useCategoriesWithProducts({ minProductCount: 1 })

  // mapTreeToSidebarCategories accepts CategoryTreeNode[] — no cast needed.
  // NOTE: this assumes the mapper already resolves the `icon` string (e.g. "GiChicken")
  // into a real react-icons component via a lookup map, and that `category.icon` therefore
  // comes out typed as IconType, not string. If that's not the case yet, the lookup needs to
  // live in the mapper — see the note below where the icon is rendered.
  const chickenCategories = React.useMemo(() => mapTreeToSidebarCategories(tree), [tree])

  const [openCategories, setOpenCategories] = React.useState<string[]>([])
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => { setMounted(true) }, [])

  React.useEffect(() => {
    if (chickenCategories.length > 0 && openCategories.length === 0) {
      const first = chickenCategories[0]
      if (first) setOpenCategories([first.title])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chickenCategories])

  const toggleCategory = (title: string) =>
    setOpenCategories(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    )

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/"
    return pathname?.startsWith(url) ?? false
  }

  return (
    <Sidebar
      {...props}
      className="border-none"
      style={{ position: "sticky", top: 0, height: "100dvh", alignSelf: "flex-start" }}
    >
      <SidebarMenuButton size="lg" asChild className="h-18 bg-background">
        <Link href="/">
          <div className="flex items-center gap-2">
            <Menu strokeWidth={2} size={30} />
            <IsLogo fill="white" className="w-30 h-auto fill-black dark:fill-white" />
          </div>
        </Link>
      </SidebarMenuButton>

      <SidebarContent className="bg-background">
        <SidebarGroup>
          <SidebarMenu>

            {/* ── Loading skeleton ─────────────────────────────────────── */}
            {mounted && isLoading && (
              <div className="space-y-2 px-2 py-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-9 rounded-md bg-muted animate-pulse"
                    style={{ opacity: 1 - i * 0.15 }}
                  />
                ))}
              </div>
            )}

            {/* ── Empty state (loaded, but nothing to show) ───────────── */}
            {mounted && !isLoading && chickenCategories.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No categories available.
              </div>
            )}

            {/* ── Dynamic categories ───────────────────────────────────── */}
            {mounted && !isLoading && chickenCategories.map((category) => {
              // `category.icon` should already be a resolved IconType component coming out of
              // mapTreeToSidebarCategories. If it's still a raw string (e.g. "GiChicken") at this
              // point, do NOT cast it here — fix the lookup in the mapper instead, otherwise this
              // throws at render: rendering a string as a JSX component crashes.
              const Icon = category.icon
              const isOpen = openCategories.includes(category.title)
              const categoryActive = isActive(category.url)
              const hasActiveChild = category.items.some(item => isActive(item.url))

              return (
                <Collapsible
                  key={category.id}
                  open={isOpen}
                  onOpenChange={() => toggleCategory(category.title)}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={categoryActive || hasActiveChild}
                        className="w-full font-medium text-neutral-600 dark:text-white h-9"
                      >
                        <span>
                          {Icon && <Icon size={20} className="mr-2 shrink-0" />}
                        </span>
                        <span className="flex-1 text-left">{category.title}</span>
                        <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {category.items.map((item) => (
                          <SidebarMenuSubItem key={item.id}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActive(item.url)}
                              className="text-muted-foreground"
                            >
                              <Link href={item.url} className="flex items-center justify-between w-full">
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            })}

            {/* ── Promotions ───────────────────────────────────────────── */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive("/promotions")}
                className="text-amber-600 hover:text-amber-600 data-[active=true]:bg-amber-50 data-[active=true]:text-amber-700 h-9"
              >
                <Link href="/promotions" className="font-medium">
                  <Percent className="mr-2 size-4" />
                  <span>Special Offers</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuSub>
              {promotions.map((item) => {
                const Icon = item.icon
                const active = isActive(item.url)
                return (
                  <SidebarMenuSubItem key={item.title}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={active}
                      className="data-[active=true]:bg-amber-50 data-[active=true]:text-amber-700 text-muted-foreground h-9"
                    >
                      <Link href={item.url} className="flex items-center gap-2">
                        <span>
                          <Icon className="size-5" strokeWidth={3} color="rgb(223, 112, 1)" />
                        </span>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )
              })}
            </SidebarMenuSub>

          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}