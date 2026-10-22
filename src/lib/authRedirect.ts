// Where to send someone after they log in or sign up: the page they were on before (?next=),
// e.g. a MarketPortal item a guest clicked. Only paths on this site are allowed, so a crafted
// link can't bounce people to another website.
export function nextPath(): string | null {
  if (typeof window === "undefined") return null
  const next = new URLSearchParams(window.location.search).get("next")
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null
}

/** A login or sign-up link that brings the person back to `path` afterwards. */
export function withNext(href: string, path: string | null): string {
  return path ? `${href}?next=${encodeURIComponent(path)}` : href
}
