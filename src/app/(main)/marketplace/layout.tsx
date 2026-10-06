// MarketPortal uses the Care Runners blue + green. The shared --brand-* tokens
// are re-pointed to blue only inside this subtree (see .marketplace-theme in
// globals.css), so the sidebar and the rest of the app keep their teal.
export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <div className="marketplace-theme">{children}</div>
}
