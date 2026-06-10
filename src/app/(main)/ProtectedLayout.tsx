'use client'

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/utils/firebase"; // Adjust this import path if necessary
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  Truck,
  User,
  LogOut,
  Menu,
  FileSpreadsheet,
  Car,
  Upload,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import LoadingComponent from "@/components/loader";

const menuItems = [
  { icon: Home, label: "HOME", link: '/dashboard' },
  { icon: User, label: "PROFILE", link: '/profile' },
  { icon: FileSpreadsheet, label: "RECORDS", link: '/records' },
  { icon: Truck, label: "REQUEST PICK-UP", link: '/request' },
  { icon: Car, label: "TRIPS", link: '/trips' },
  { icon: Receipt, label: "BILLING", link: '/billing' },
  { icon: Upload, label: "UPLOAD", link: '/upload' },
];

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/auth/login'); // Adjust this path if your login page is elsewhere
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

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

  if (!user) {
    return null; // This will prevent any flash of content before redirect
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="sticky top-0 z-50 bg-teal-600 text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href='/dashboard'>
            <div className="flex items-center space-x-3">
              <img
                src="/carerunnerlogo.png"
                alt="Logo"
                className="h-9 w-9 bg-white rounded-lg shrink-0"
              />
              <h1 className="text-xl font-bold">Carerunners</h1>
            </div>
          </Link>
          <nav className="hidden md:flex items-center space-x-1">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link key={index} href={item.link}>
                  <Button
                    variant="ghost"
                    className="text-white hover:bg-teal-700 px-2 py-1 h-auto text-xs"
                  >
                    <Icon className="mr-1 h-3.5 w-3.5 shrink-0" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
            <Button
              variant="ghost"
              className="text-white hover:bg-teal-700 px-2 py-1 h-auto text-xs"
              onClick={handleSignOut}
            >
              <LogOut className="mr-1 h-3.5 w-3.5 shrink-0" />
              SIGN OUT
            </Button>
          </nav>
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Menu</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {menuItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={index}>
                      <Link href={item.link} className="flex items-center w-full">
                        <Icon className="mr-2 h-4 w-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  SIGN OUT
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="flex-grow container mx-auto px-4 py-8 mt-16">
        {children}
      </main>
      <footer className="bg-teal-600 text-white mt-auto">
        <div className="container mx-auto flex justify-center items-center h-12">
          <div className="flex items-center">
            <span className="text-lg font-semibold mr-2">SHUDU</span>
            <img
              src="/shudu.png"
              alt="Connections Logo"
              className="h-10 w-20 mx-2"
            />
            <span className="text-lg font-semibold ml-2">CONNECTIONS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}