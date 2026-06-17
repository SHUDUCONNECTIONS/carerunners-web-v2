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
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
              active
                ? "bg-teal-50 text-teal-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${
                active
                  ? "bg-teal-600 text-white"
                  : "bg-gray-100 text-gray-500 group-hover:bg-teal-50 group-hover:text-teal-600"
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
      className="flex items-center gap-3 px-4 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded-xl"
    >
      <img
        src="/carerunnerlogo.png"
        alt="Logo"
        className="h-9 w-9 bg-white rounded-lg shrink-0 border border-gray-100"
      />
      <h1 className="text-lg font-bold text-gray-900">Carerunners</h1>
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
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-white border-b border-gray-100 shadow-sm px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img
            src="/carerunnerlogo.png"
            alt="Logo"
            className="h-8 w-8 bg-white rounded-lg shrink-0 border border-gray-100"
          />
          <span className="text-base font-bold text-gray-900">Carerunners</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          className="text-gray-700 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
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
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col transition-transform duration-200 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between border-b border-gray-100">
          <SidebarBrand />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            className="mr-3 text-gray-500 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>
        <SidebarNav pathname={pathname ?? ""} onNavigate={() => setMobileOpen(false)} />
        <div className="border-t border-gray-100 p-3">
          <Button
            variant="ghost"
            onClick={() => {
              setMobileOpen(false)
              onSignOut()
            }}
            className="w-full justify-start gap-3 rounded-xl px-3 py-2.5 h-auto text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <LogOut className="h-5 w-5" />
            </span>
            Sign Out
          </Button>
        </div>
      </div>

      {/* Desktop fixed sidebar */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:z-30 md:w-64 md:flex-col bg-white border-r border-gray-100 shadow-sm">
        <div className="border-b border-gray-100">
          <SidebarBrand />
        </div>
        <SidebarNav pathname={pathname ?? ""} />
        <div className="border-t border-gray-100 p-3">
          <Button
            variant="ghost"
            onClick={onSignOut}
            className="w-full justify-start gap-3 rounded-xl px-3 py-2.5 h-auto text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <LogOut className="h-5 w-5" />
            </span>
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  )
}
