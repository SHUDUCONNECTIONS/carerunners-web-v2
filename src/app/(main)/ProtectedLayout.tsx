'use client'

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/utils/firebase"; // Adjust this import path if necessary
import LoadingComponent from "@/components/loader";
import Sidebar from "@/components/Sidebar";

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
      <Sidebar onSignOut={handleSignOut} />
      <div className="flex flex-col flex-grow md:pl-64">
        <main className="flex-grow container mx-auto px-4 py-8">
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
    </div>
  );
}
