'use client'

import React, { useEffect, useState } from "react";
import Link from "next/link";
import InstallButton from "@/components/InstallButton";
import { COMPANY_ADDRESS, COMPANY_DIRECTOR, COMPANY_NAME, COMPANY_REG_NO, SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_LINK } from "@/lib/contact";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/utils/firebase"; // Adjust this import path if necessary
import LoadingComponent from "@/components/loader";
import Sidebar from "@/components/Sidebar";
import { isAdminAccount } from "@/utils/isAdminAccount";
import { withNext } from "@/lib/authRedirect";

// Pages people can look at before making an account. Everything else sends guests to log in.
const GUEST_PAGES = ["/marketplace", "/marketplace/terms", "/marketplace/returns"];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const guestAllowed = GUEST_PAGES.includes(pathname);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Only decides whether the sidebar shows the admin link; checked without holding up the page.
        isAdminAccount(currentUser).then(setIsAdmin);
      } else {
        setUser(null);
        if (!guestAllowed) {
          // A MarketPortal item opened without an account goes to sign-up; anything else to log in.
          // Either way they come back to the page afterwards.
          const page = pathname + window.location.search;
          router.push(withNext(pathname.startsWith("/marketplace/") ? "/auth/sign-up" : "/auth/login", page));
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname, guestAllowed]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/auth/login'); // Adjust this path if necessary
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (loading) {
    return <LoadingComponent/> // Or any loading indicator
  }

  if (!user && guestAllowed) {
    return <GuestLayout>{children}</GuestLayout>;
  }

  if (!user) {
    return null; // This will prevent any flash of content before redirect
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <Sidebar
        onSignOut={handleSignOut}
        isAdmin={isAdmin}
        userName={user.displayName}
        userEmail={user.email}
      />
      <div className="flex flex-col flex-grow md:pl-64">
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

// What a visitor without an account sees around the public pages: no sidebar, just a way in.
function GuestLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/marketplace" className="flex items-center gap-2">
            <img src="/carerunnerlogo.png" alt="" className="h-9 w-9 rounded-lg object-contain" />
            <span className="text-lg font-bold text-gray-900">Care Runners</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={withNext("/auth/login", pathname)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Log in
            </Link>
            <Link
              href={withNext("/auth/sign-up", pathname)}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-grow container mx-auto px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="relative isolate mt-auto overflow-hidden bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 text-white">
      <div className="h-1 w-full bg-gradient-to-r from-teal-300 via-emerald-300 to-teal-300" aria-hidden="true" />

      <div className="container mx-auto grid gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 lg:col-span-1">
          <p className="text-xl font-bold leading-tight">Care Runners</p>
          <p className="text-sm font-medium text-teal-100">Fast. Safe. Reliable.</p>
          <p className="max-w-xs text-sm text-teal-100/80">
            Pick-ups, deliveries and a local marketplace, run by people you can trust.
          </p>
        </div>

        <nav aria-label="Services" className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-200">Services</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/request" className="text-white/80 transition-colors hover:text-white">Request Pick-up</Link></li>
            <li><Link href="/trips" className="text-white/80 transition-colors hover:text-white">My Trips</Link></li>
            <li><Link href="/marketplace" className="text-white/80 transition-colors hover:text-white">MarketPortal</Link></li>
          </ul>
        </nav>

        <nav aria-label="Account" className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-200">Account</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/profile" className="text-white/80 transition-colors hover:text-white">Profile</Link></li>
            <li><Link href="/billing" className="text-white/80 transition-colors hover:text-white">Billing</Link></li>
            <li><Link href="/records" className="text-white/80 transition-colors hover:text-white">Records</Link></li>
          </ul>
        </nav>

        <nav aria-label="Legal" className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-200">Legal</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/marketplace/terms" className="text-white/80 transition-colors hover:text-white">Terms &amp; Conditions</Link></li>
            <li><Link href="/marketplace/returns" className="text-white/80 transition-colors hover:text-white">Returns &amp; Refunds</Link></li>
          </ul>
          <InstallButton className="inline-flex items-center rounded-lg border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20" />
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-teal-100/80 sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} Care Runners. All rights reserved. Support:{" "}
            <a href={SUPPORT_PHONE_LINK} className="font-medium text-white hover:underline">{SUPPORT_PHONE}</a>
            {" · "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-white hover:underline">{SUPPORT_EMAIL}</a>
            <span className="mt-1 block">
              Care Runners is operated by {COMPANY_NAME}, Reg. No. {COMPANY_REG_NO}, {COMPANY_ADDRESS}. Director: {COMPANY_DIRECTOR}.
            </span>
          </p>
          <div className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-3 pr-1.5">
            <span>A</span>
            <span className="font-semibold tracking-wide text-white">SHUDU CONNECTIONS</span>
            <span>company</span>
            <img src="/shudu.png" alt="Shudu Connections" className="h-6 w-auto rounded-full bg-white object-contain px-1" />
          </div>
        </div>
      </div>
    </footer>
  );
}
