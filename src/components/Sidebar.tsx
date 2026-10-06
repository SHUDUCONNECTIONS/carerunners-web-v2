"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Home,
  Truck,
  User,
  LogOut,
  Menu,
  X,
  FileSpreadsheet,
  Car,
  Upload,
  ShieldCheck,
  Store,
} from "lucide-react"
import BadgeRandSign from "@/components/icons/BadgeRandSign"

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  link: string
  badge?: string
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    label: "Services",
    items: [
      { icon: Home, label: "Home", link: "/dashboard" },
      { icon: Truck, label: "Request Pick-up", link: "/request" },
      { icon: Car, label: "Trips", link: "/trips" },
      { icon: Store, label: "MarketPortal", link: "/marketplace", badge: "New" },
    ],
  },
  {
    label: "Account",
    items: [
      { icon: User, label: "Profile", link: "/profile" },
      { icon: FileSpreadsheet, label: "Records", link: "/records" },
      { icon: BadgeRandSign, label: "Billing", link: "/billing" },
      { icon: Upload, label: "Upload", link: "/upload" },
    ],
  },
]

const adminGroup: MenuGroup = {
  label: "Admin",
  items: [{ icon: ShieldCheck, label: "Admin", link: "/admin" }],
}

function isActive(pathname: string, link: string): boolean {
  if (link === "/dashboard") {
    return pathname === "/dashboard"
  }
  return pathname === link || pathname.startsWith(`${link}/`)
}

function SidebarNav({
  pathname,
  isAdmin,
  onNavigate,
}: {
  pathname: string
  isAdmin?: boolean
  onNavigate?: () => void
}) {
  const groups = isAdmin ? [...menuGroups, adminGroup] : menuGroups
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-white/50">{group.label}</p>
          {group.items.map((item) => {
        const Icon = item.icon
        const active = isActive(pathname, item.link)
        return (
          <Link
            key={item.link}
            href={item.link}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-600)] ${
              active
                ? "bg-white text-[var(--brand-700)]"
                : "text-white/90 hover:bg-[var(--brand-700)] hover:text-white"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center transition-colors duration-200 ${
                active ? "text-[var(--brand-700)]" : "text-white/80 group-hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="truncate flex-1">{item.label}</span>
            {item.badge && (
              <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                {item.badge}
              </span>
            )}
          </Link>
        )
      })}
        </div>
      ))}
    </nav>
  )
}

function SidebarBrand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-3 px-4 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-600)] rounded-xl"
    >
      <span className="flex items-center shrink-0">
        <img
          src="/carerunnerlogo.png"
          alt="Carerunners"
          className="h-9 w-9 bg-white rounded-lg border border-white/20"
        />
      </span>
      <span className="leading-tight">
        <h1 className="text-lg font-bold text-white">Carerunners</h1>
        <span className="block text-[11px] font-medium text-white/70">Fast. Safe. Reliable.</span>
      </span>
    </Link>
  )
}

function UserCard({ name, email }: { name?: string | null; email?: string | null }) {
  const label = name || email || "Account"
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-[var(--brand-700)]">
        {label.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold text-white">{label}</span>
        {name && email && <span className="block truncate text-xs text-white/60">{email}</span>}
      </span>
    </div>
  )
}

export default function Sidebar({
  onSignOut,
  isAdmin,
  userName,
  userEmail,
}: {
  onSignOut: () => void | Promise<void>
  isAdmin?: boolean
  userName?: string | null
  userEmail?: string | null
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-[var(--brand-600)] shadow-md px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img
            src="/carerunnerlogo.png"
            alt="Carerunners"
            className="h-8 w-8 bg-white rounded-lg shrink-0 border border-white/20"
          />
          <span className="text-base font-bold text-white">Carerunners</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          className="text-white hover:bg-[var(--brand-700)] hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-600)]"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Open menu</span>
        </Button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40 transition-opacity duration-200"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-gradient-to-b from-[var(--brand-600)] to-[var(--brand-700)] shadow-xl flex flex-col transition-transform duration-200 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between border-b border-white/10">
          <SidebarBrand />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            className="mr-3 text-white hover:bg-[var(--brand-700)] hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-600)]"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>
        <SidebarNav pathname={pathname ?? ""} isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
        <div className="border-t border-white/10 p-3">
          <UserCard name={userName} email={userEmail} />
          <Button
            variant="ghost"
            onClick={() => {
              setMobileOpen(false)
              onSignOut()
            }}
            className="w-full justify-start gap-3 rounded-xl px-3 py-2.5 h-auto text-sm font-medium text-white/90 hover:bg-[var(--brand-700)] hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-600)]"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-white/80">
              <LogOut className="h-5 w-5" />
            </span>
            Sign Out
          </Button>
        </div>
      </div>

      {/* Desktop fixed sidebar */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:z-30 md:w-64 md:flex-col bg-gradient-to-b from-[var(--brand-600)] to-[var(--brand-700)] shadow-md">
        <div className="border-b border-white/10">
          <SidebarBrand />
        </div>
        <SidebarNav pathname={pathname ?? ""} isAdmin={isAdmin} />
        <div className="border-t border-white/10 p-3">
          <UserCard name={userName} email={userEmail} />
          <Button
            variant="ghost"
            onClick={onSignOut}
            className="w-full justify-start gap-3 rounded-xl px-3 py-2.5 h-auto text-sm font-medium text-white/90 hover:bg-[var(--brand-700)] hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-600)]"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-white/80">
              <LogOut className="h-5 w-5" />
            </span>
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  )
}
