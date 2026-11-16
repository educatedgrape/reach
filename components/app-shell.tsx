"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowsClockwise } from "@phosphor-icons/react"

import { signOut } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AppShellProps = {
  children: React.ReactNode
  userEmail: string
}

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/contacts", label: "Contacts" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/automate", label: "Automate", icon: ArrowsClockwise },
]

export function AppShell({ children, userEmail }: AppShellProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b bg-sidebar p-4 md:border-r md:border-b-0">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">OutreachHQ</h1>
          <p className="text-sm text-muted-foreground">Charity outreach operations</p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <span className="inline-flex items-center gap-2">
                  {Icon ? <Icon size={16} /> : null}
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>
        <div className="mt-8 border-t pt-4">
          <p className="mb-2 truncate text-xs text-muted-foreground">{userEmail}</p>
          <form action={signOut}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="p-4 md:p-6">{children}</main>
    </div>
  )
}
