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
  Receipt,
  type LucideIcon,
} from "lucide-react"

interface MenuItem {
  icon: LucideIcon
  label: string
  link: string
}

const menuItems: MenuItem[] = [
  { icon: Home, label: "Home", link: "/dashboard" },
  { icon: User, label: "Profile", link: "/profile" },
  { icon: FileSpreadsheet, label: "Records", link: "/records" },
  { icon: Truck, label: "Request Pick-up", link: "/request" },
  { icon: Car, label: "Trips", link: "/trips" },
  { icon: Receipt, label: "Billing", link: "/billing" },
  { icon: Upload, label: "Upload", link: "/upload" },
]

function isActive(pathname: string, link: string): boolean {
  if (link === "/dashboard") {
    return pathname === "/dashboard"
  }
  return pathname === link || pathname.startsWith(`${link}/`)
}

function SidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {menuItems.map((item) => {
        const Icon = item.icon
        const active = isActive(pathname, item.link)
        return (
          <Link
            key={item.link}
            href={item.link}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-600 ${
              active
                ? "bg-white text-teal-700"
                : "text-white/90 hover:bg-teal-700 hover:text-white"
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${
                active
                  ? "bg-teal-600 text-white"
                  : "bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarBrand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-3 px-4 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-600 rounded-xl"
    >
      <img
        src="/carerunnerlogo.png"
        alt="Logo"
        className="h-9 w-9 bg-white rounded-lg shrink-0 border border-white/20"
      />
      <h1 className="text-lg font-bold text-white">Carerunners</h1>
    </Link>
  )
}

export default function Sidebar({
  onSignOut,
}: {
  onSignOut: () => void | Promise<void>
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-teal-600 shadow-md px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img
            src="/carerunnerlogo.png"
            alt="Logo"
            className="h-8 w-8 bg-white rounded-lg shrink-0 border border-white/20"
          />
          <span className="text-base font-bold text-white">Carerunners</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          className="text-white hover:bg-teal-700 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-600"
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
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-teal-600 shadow-xl flex flex-col transition-transform duration-200 ease-in-out ${
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
            className="mr-3 text-white hover:bg-teal-700 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-600"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>
        <SidebarNav pathname={pathname ?? ""} onNavigate={() => setMobileOpen(false)} />
        <div className="border-t border-white/10 p-3">
          <Button
            variant="ghost"
            onClick={() => {
              setMobileOpen(false)
              onSignOut()
            }}
            className="w-full justify-start gap-3 rounded-xl px-3 py-2.5 h-auto text-sm font-medium text-white/90 hover:bg-teal-700 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-600"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/80">
              <LogOut className="h-5 w-5" />
            </span>
            Sign Out
          </Button>
        </div>
      </div>

      {/* Desktop fixed sidebar */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:z-30 md:w-64 md:flex-col bg-teal-600 shadow-md">
        <div className="border-b border-white/10">
          <SidebarBrand />
        </div>
        <SidebarNav pathname={pathname ?? ""} />
        <div className="border-t border-white/10 p-3">
          <Button
            variant="ghost"
            onClick={onSignOut}
            className="w-full justify-start gap-3 rounded-xl px-3 py-2.5 h-auto text-sm font-medium text-white/90 hover:bg-teal-700 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-600"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/80">
              <LogOut className="h-5 w-5" />
            </span>
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  )
}
