"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

const CLASS =
  "inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"

// The back button for sub-pages. With `smart` (for a page reached from several places), it returns
// to the previous page, or goes to `href` when there is none (e.g. opened in a new tab from a
// notification or a shared link).
export default function BackLink({ href, label, smart = false, className = "" }: { href: string; label: string; smart?: boolean; className?: string }) {
  const router = useRouter()
  if (!smart) {
    return (
      <Link href={href} className={`${CLASS} ${className}`}>
        <ArrowLeft className="mr-1 h-4 w-4" /> {label}
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push(href)
      }}
      className={`${CLASS} ${className}`}
    >
      <ArrowLeft className="mr-1 h-4 w-4" /> {label}
    </button>
  )
}
