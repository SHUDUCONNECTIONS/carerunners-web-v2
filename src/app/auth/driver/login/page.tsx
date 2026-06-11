"use client"
import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Lock, AlertCircle, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { auth } from "@/utils/firebase"
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth"
import { getFirestore, doc, getDoc } from "firebase/firestore"

export default function DriverLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetting, setResetting] = useState(false)
  const router = useRouter()
  const db = getFirestore()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError("Please enter both email and password.")
      return
    }
    setError("")
    setLoading(true)
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const driverDoc = await getDoc(doc(db, "drivers", userCredential.user.uid))

      if (!driverDoc.exists()) {
        await auth.signOut()
        setError("No driver account found with this email.")
        return
      }

      router.push("/driver/dashboard")
    } catch (error: any) {
      switch (error.code) {
        case "auth/invalid-email":
          setError("Invalid email address format.")
          break
        case "auth/user-not-found":
          setError("No account found with this email.")
          break
        case "auth/wrong-password":
          setError("Incorrect password.")
          break
        case "auth/too-many-requests":
          setError("Too many failed attempts. Please try again later.")
          break
        default:
          setError("An error occurred during login. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!email) {
      setError("Please enter your email address first.")
      return
    }
    setError("")
    setResetting(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setResetSent(true)
      setTimeout(() => setResetSent(false), 5000)
    } catch {
      setError("Failed to send reset email. Check your email address.")
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-teal-600 text-white">
          <CardTitle className="text-2xl font-bold text-center">Driver Portal Login</CardTitle>
        </CardHeader>
        <div className="mx-auto w-32 h-32">
          <img src="/carerunnerlogo.png" alt="Care Runners Logo" className="w-full h-full object-contain" />
        </div>
        <CardContent className="mt-6">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</Label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User aria-hidden="true" />
                </div>
                <Input
                  id="email"
                  type="email"
                  className="pl-10 block w-full"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</Label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock aria-hidden="true" />
                </div>
                <Input
                  id="password"
                  type="password"
                  className="pl-10 block w-full"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm flex items-center">
                <AlertCircle className="mr-2 h-4 w-4" />
                {error}
              </div>
            )}

            {resetSent && (
              <div className="text-green-600 text-sm flex items-center">
                <Check className="mr-2 h-4 w-4" />
                Password reset email sent! Check your inbox.
              </div>
            )}

            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white" disabled={loading}>
              {loading ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-4 space-y-2 text-center">
            <Button
              variant="link"
              onClick={handlePasswordReset}
              className="text-sm text-teal-600"
              disabled={resetting}
            >
              {resetting ? "Sending..." : "Forgot your password?"}
            </Button>
            <div>
              <Button
                variant="link"
                onClick={() => router.push("/auth/driver/sign-up")}
                className="text-sm text-teal-600"
              >
                Don&apos;t have an account? Register as a driver
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
