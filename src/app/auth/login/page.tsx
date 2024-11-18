"use client"
import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Lock, AlertCircle, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { auth } from "@/utils/firebase"
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from "firebase/auth"
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore'

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const router = useRouter()
  const db = getFirestore()

  const checkIsFirm = async (uid: string) => {
    try {
      // console.log("Checking firm status for UID:", uid)
      
      // Query the firms collection where adminId matches the authentication UID
      const firmsRef = collection(db, 'firms')
      const q = query(firmsRef, where('adminId', '==', uid))
      const querySnapshot = await getDocs(q)
      
      // If we find any documents, this UID is an admin of a firm
       const isFirmAdmin = !querySnapshot.empty
      
      console.log("Is firm admin:", isFirmAdmin)
      if (isFirmAdmin) {
      }
      
      return isFirmAdmin
    } catch (error) {
      console.error("Error checking firm status:", error)
      return false
    }
  }
  
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
      // console.log("User UID:", userCredential.user.uid)
      
      // Check if the user's UID matches any firm's adminId
      const isFirm = await checkIsFirm(userCredential.user.uid)
      
      if (!isFirm) {
        // Sign out the user if they're not a firm admin
        await auth.signOut()
        setError("Access denied. Only registered law firm administrators can access this portal.")
        return
      }
  
      router.push("/dashboard")
    } catch (error: any) {
      console.error("Error during login:", error)
      
      switch (error.code) {
        case 'auth/invalid-email':
          setError("Invalid email address format.")
          break
        case 'auth/user-disabled':
          setError("This account has been disabled.")
          break
        case 'auth/user-not-found':
          setError("No account found with this email.")
          break
        case 'auth/wrong-password':
          setError("Incorrect password.")
          break
        case 'auth/too-many-requests':
          setError("Too many failed attempts. Please try again later.")
          break
        case 'auth/network-request-failed':
          setError("Network error. Please check your connection.")
          break
        default:
          setError("An error occurred during login. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError("")
    setLoading(true)
    
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      
      // Check if the user's UID matches any firm's adminId
      const isFirm = await checkIsFirm(result.user.uid)
      
      if (!isFirm) {
        // Sign out the user if they're not a firm admin
        await auth.signOut()
        setError("Access denied. Only registered law firm administrators can access this portal.")
        return
      }

      router.push("/dashboard")
    } catch (error) {
      console.error("Error during Google login:", error)
      setError("An error occurred during Google sign-in. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = () => {
    router.push("/auth/sign-up")
  }

  const handlePasswordReset = async () => {
    if (!email) {
      setError("Please enter your email address to reset password.")
      return
    }

    setError("")
    setLoading(true)
    setIsResettingPassword(true)
    
    try {
      await sendPasswordResetEmail(auth, email)
      setResetEmailSent(true)
      setError("")
    } catch (error: any) {
      console.error("Error sending password reset email:", error)
      switch (error.code) {
        case 'auth/user-not-found':
          setError("No user found with this email address.")
          break
        case 'auth/invalid-email':
          setError("Please enter a valid email address.")
          break
        default:
          setError("An error occurred. Please try again.")
      }
    } finally {
      setLoading(false)
      setTimeout(() => {
        setIsResettingPassword(false)
        setResetEmailSent(false)
      }, 5000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-teal-600 text-white">
          <CardTitle className="text-2xl font-bold text-center">Law Firm Portal Login</CardTitle>
        </CardHeader>
        <div className="mx-auto w-32 h-32">
          <img
            src="/carerunnerlogo.png"
            alt="Care Runners Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <CardContent className="mt-6">
          <div className="mb-4 text-sm text-gray-600 text-center">
            This portal is exclusively for registered law firm administrators.
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </Label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User aria-hidden="true" />
                </div>
                <Input
                  id="email"
                  name="email"
                  autoComplete="email"
                  required
                  className="pl-10 block w-full"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock aria-hidden="true" />
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="pl-10 block w-full"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm flex items-center">
                <AlertCircle aria-hidden="true" className="mr-2" />
                {error}
              </div>
            )}

            {resetEmailSent && (
              <div className="text-green-600 text-sm flex items-center">
                <Check aria-hidden="true" className="mr-2" />
                Password reset email sent! Check your inbox.
              </div>
            )}

            <div>
              <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white" disabled={loading}>
                {loading && !isResettingPassword ? "Signing In..." : "Sign In"}
              </Button>
            </div>
            <div className="mt-6 text-center">
              <Button onClick={handleSignUp} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                Register as a Law Firm
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <Button
                onClick={handleGoogleLogin}
                className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                disabled={loading}
              >
                <img
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt="Google logo"
                  className="h-5 w-5 mr-2"
                />
                Sign in with Google
              </Button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Button
              onClick={handlePasswordReset}
              className="text-sm text-teal-600 hover:text-teal-500"
              variant="link"
              disabled={loading}
            >
              {loading && isResettingPassword ? "Sending reset email..." : "Forgot your password?"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}