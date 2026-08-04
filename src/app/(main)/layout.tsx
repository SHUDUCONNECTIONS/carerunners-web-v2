import ProtectedLayout from './ProtectedLayout'
import { GoogleMapsLoaderProvider } from '@/components/GoogleMapsLoaderProvider'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <GoogleMapsLoaderProvider>
      <ProtectedLayout>{children}</ProtectedLayout>
    </GoogleMapsLoaderProvider>
  )
}