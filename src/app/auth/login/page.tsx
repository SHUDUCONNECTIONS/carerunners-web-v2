"use client"
import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Check, Mail, Lock } from "lucide-react"
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
      // Query the firms collection where adminId matches the authentication UID
      const firmsRef = collection(db, 'firms')
      const q = query(firmsRef, where('adminId', '==', uid))
      const querySnapshot = await getDocs(q)

      // If we find any documents, this UID is an admin of a firm
      const isFirmAdmin = !querySnapshot.empty

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
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError("Invalid email or password.")
          break
        case 'auth/too-many-requests':
          setError("Too many failed attempts. Please try again later.")
          break
        case 'auth/network-request-failed':
          setError("Network error. Please check your connection.")
          break
        case 'auth/operation-not-allowed':
          setError("Email/password sign-in is not enabled. Contact support.")
          break
        default:
          setError(`An error occurred during login. (${error.code})`)
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      {/* Card wrapper */}
      <div className="w-full max-w-4xl flex flex-col md:flex-row rounded-2xl shadow-2xl overflow-hidden">

        {/* Left panel — teal brand panel */}
        <div className="bg-teal-600 text-white flex flex-col items-center justify-center
                        px-8 py-8 md:py-12 md:w-5/12 shrink-0">
          {/* Mobile: compact header bar; desktop: full brand column */}
          <img
            src="/carerunnerlogo.png"
            alt="Carerunners Logo"
            className="w-20 h-20 md:w-32 md:h-32 object-contain mb-3 md:mb-6"
          />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-center">
            Carerunners
          </h1>
          <p className="mt-2 text-teal-100 text-sm md:text-base text-center leading-relaxed max-w-xs hidden md:block">
            The law firm portal for managing care runner services — fast, secure, and built for your practice.
          </p>
          <p className="mt-1 text-teal-100 text-xs text-center md:hidden">
            Law Firm Portal
          </p>
        </div>

        {/* Right panel — white form area */}
        <div className="bg-white flex-1 flex flex-col justify-center px-8 py-10 md:px-12 md:py-14">
          <div className="max-w-sm w-full mx-auto">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-sm text-gray-500 mb-8">
              Sign in to your firm administrator account.
            </p>

            {/* Google sign-in */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300
                         rounded-lg px-4 py-3 text-sm font-medium text-gray-700
                         hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         shadow-sm mb-6"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google logo"
                className="h-5 w-5"
              />
              Continue with Google
            </button>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-gray-400 uppercase tracking-wide">or sign in with email</span>
              </div>
            </div>

            {/* Email / password form */}
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <Label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className={`pl-10 py-3 w-full rounded-lg border text-sm transition-colors
                      focus:ring-2 focus:ring-teal-500 focus:border-teal-500
                      ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    placeholder="you@yourfirm.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={loading}
                    className="text-xs text-teal-600 hover:text-teal-500 font-medium transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading && isResettingPassword ? "Sending…" : "Forgot password?"}
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-400" />
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className={`pl-10 py-3 w-full rounded-lg border text-sm transition-colors
                      focus:ring-2 focus:ring-teal-500 focus:border-teal-500
                      ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success message */}
              {resetEmailSent && (
                <div className="flex items-start gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                  <Check className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Password reset email sent! Check your inbox.</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 rounded-lg
                           transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading && !isResettingPassword ? "Signing in…" : "Sign In"}
              </Button>
            </form>

            {/* Register link */}
            <p className="mt-6 text-center text-sm text-gray-500">
              New firm?{" "}
              <button
                type="button"
                onClick={handleSignUp}
                className="font-medium text-teal-600 hover:text-teal-500 transition-colors"
              >
                Register here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
