"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { onAuthStateChanged, type User } from "firebase/auth"
import { auth } from "@/utils/firebase"
import { isAdminAccount } from "@/utils/isAdminAccount"

// Shared by the MarketPortal admin pages: waits for auth, sends signed-out
// users to login and flags non-admins. (The API routes enforce admin access
// again on the server; this is only for the UI.)
export function useAdminGuard(): { loading: boolean; denied: boolean; user: User | null } {
  const router = useRouter()
  const [state, setState] = useState<{ loading: boolean; denied: boolean; user: User | null }>({
    loading: true,
    denied: false,
    user: null,
  })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth/login")
        return
      }
      setState({ loading: false, denied: !(await isAdminAccount(user)), user })
    })
    return () => unsubscribe()
  }, [router])

  return state
}
