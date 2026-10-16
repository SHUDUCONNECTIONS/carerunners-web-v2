import ProtectedLayout from "../(main)/ProtectedLayout"

// The admin pages share the app's sidebar, footer and sign-in check. (Each admin page still checks that the
// person is an admin.) The Google Maps loader isn't included: only /admin/sync needs it, and it loads its own.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedLayout>{children}</ProtectedLayout>
}
