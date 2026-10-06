import { GoogleMapsLoaderProvider } from "@/components/GoogleMapsLoaderProvider"

// The company and listing forms use Google address search, which needs the
// shared Maps loader (customer pages get it from the (main) layout).
export default function AdminMarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <GoogleMapsLoaderProvider>{children}</GoogleMapsLoaderProvider>
}
