"use client"

import * as React from "react"
import { Check, Copy, Download, Facebook, Mail, MessageCircle, MessageSquare, Send, Share2, Twitter } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Apps offered when the device has no share sheet of its own (most desktop browsers, or the site
// opened over plain http). Each opens that app's own "share this link" page.
function shareTargets(url: string, text: string) {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(text)
  return [
    { label: "WhatsApp", icon: MessageCircle, color: "text-[#25D366]", href: `https://wa.me/?text=${t}%20${u}` },
    { label: "Facebook", icon: Facebook, color: "text-[#1877F2]", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: "X (Twitter)", icon: Twitter, color: "text-gray-900", href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { label: "Telegram", icon: Send, color: "text-[#229ED9]", href: `https://t.me/share/url?url=${u}&text=${t}` },
    { label: "Text message", icon: MessageSquare, color: "text-green-600", href: `sms:?&body=${t}%20${u}` },
    { label: "Email", icon: Mail, color: "text-gray-600", href: `mailto:?subject=${t}&body=${t}%0A%0A${u}` },
  ]
}

// Shares a listing's link: the phone's own share sheet (every installed app) where there is one,
// otherwise a menu of the common apps plus "Copy link".
export function ShareButton({
  listingId,
  title,
  variant = "full",
  className = "",
}: {
  listingId: string
  title: string
  variant?: "full" | "icon"
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [url, setUrl] = React.useState("")
  React.useEffect(() => setUrl(`${window.location.origin}/marketplace/${listingId}`), [listingId])
  const text = `${title} on MarketPortal`
  const cardUrl = `/api/marketplace/listings/${encodeURIComponent(listingId)}/card`
  const cardName = `${title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "item"}.jpg`

  // The item's card picture travels with the link, so it shows even where the app builds no
  // preview (email, most chats). It's fetched as soon as the pointer or focus reaches the button:
  // phones only allow the share sheet for a moment after the tap.
  const card = React.useRef<Promise<File | null> | null>(null)
  const loadCard = () => {
    if (!navigator.share) return null
    card.current ??= fetch(cardUrl)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? new File([b], cardName, { type: "image/jpeg" }) : null))
      .catch(() => null)
    return card.current
  }

  const share = async () => {
    if (navigator.share) {
      const file = await Promise.race([loadCard(), new Promise<null>((r) => setTimeout(() => r(null), 2500))])
      const withCard = file && navigator.canShare?.({ files: [file] }) ? { files: [file] } : {}
      try {
        // A link line in the text keeps the link when an app takes only the text and picture.
        await navigator.share({ title, text: withCard.files ? `${text}\n${url}` : text, url, ...withCard })
        return
      } catch (err: any) {
        if (err?.name === "AbortError") return
        // Blocked or failed: fall back to the menu.
      }
    }
    setOpen(true)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("Copy this link", url)
    }
  }

  const Icon = copied ? Check : Share2
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          // The menu only opens through share(), so the phone's share sheet gets the first go.
          onPointerDown={(e) => {
            e.preventDefault()
            loadCard()
          }}
          onPointerEnter={loadCard}
          onFocus={loadCard}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault()
              share()
            }
          }}
          onClick={(e) => {
            // The button can sit over a card that is itself a link.
            e.preventDefault()
            e.stopPropagation()
            share()
          }}
          aria-label={variant === "icon" ? (copied ? "Link copied" : `Share ${title}`) : undefined}
          title={variant === "icon" ? (copied ? "Link copied" : "Share") : undefined}
          className={
            variant === "icon"
              ? `rounded-full bg-white/90 p-2 text-gray-700 shadow hover:bg-white hover:text-[var(--brand-700)] ${className}`
              : `inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 ${className}`
          }
        >
          <Icon className={`h-4 w-4 ${copied ? "text-green-600" : ""}`} />
          {variant === "full" && (copied ? "Link copied" : "Share")}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 bg-white">
        <DropdownMenuLabel>Share via</DropdownMenuLabel>
        {shareTargets(url, text).map(({ label, icon: AppIcon, color, href }) => (
          <DropdownMenuItem key={label} asChild className="cursor-pointer gap-3 py-2">
            <a href={href} target="_blank" rel="noopener noreferrer">
              <AppIcon className={`h-4 w-4 ${color}`} />
              {label}
            </a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer gap-3 py-2">
          <a href={cardUrl} download={cardName}>
            <Download className="h-4 w-4 text-gray-600" />
            Download picture
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={copy} className="cursor-pointer gap-3 py-2">
          <Copy className="h-4 w-4 text-gray-600" />
          Copy link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
