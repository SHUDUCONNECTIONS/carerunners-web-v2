import ProtectedLayout from './ProtectedLayout'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedLayout>{children}</ProtectedLayout>
}