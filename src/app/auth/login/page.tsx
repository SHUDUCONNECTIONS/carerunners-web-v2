"use client"
import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Check, Mail, Lock, MapPin, Zap, ShieldCheck, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { auth } from "@/utils/firebase"
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from "firebase/auth"
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { PartRunnerParticles } from "@/components/PartRunnerParticles"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const router = useRouter()
  const db = getFirestore()

  // Every signup (individual or firm) gets a workspace doc in "firms" and a
  // firmId on their user doc, so this just confirms the account actually
  // finished registration — it's no longer firm-specific despite the name
  // of the underlying collection.
  const hasRegisteredAccount = async (uid: string) => {
    try {
      const firmsRef = collection(db, 'firms')
      const q = query(firmsRef, where('adminId', '==', uid))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) return true

      // Otherwise, check whether this UID belongs to a workspace as an
      // invited member (accept-invitation writes users/{uid}.firmId without
      // ever adding them to firms.adminId)
      const userDoc = await getDoc(doc(db, 'users', uid))
      return userDoc.exists() && !!userDoc.data().firmId
    } catch (error) {
      console.error("Error checking account status:", error)
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

      const registered = await hasRegisteredAccount(userCredential.user.uid)

      if (!registered) {
        await auth.signOut()
        setError("Access denied. This account isn't registered on this portal.")
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

      const registered = await hasRegisteredAccount(result.user.uid)

      if (!registered) {
        await auth.signOut()
        setError("Access denied. This account isn't registered on this portal.")
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
    <div className="relative min-h-screen bg-gray-100 flex items-center justify-center p-4 overflow-hidden">
      <PartRunnerParticles />

      {/* Card wrapper */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col md:flex-row rounded-2xl shadow-2xl overflow-hidden">

        {/* Left panel — teal brand panel */}
        <div className="bg-teal-600 text-white flex flex-col items-center
                        px-6 py-8 md:py-10 md:w-1/2 shrink-0">
          {/* Compact Carerunners header */}
          <div className="flex items-center gap-2.5 self-center md:self-start mb-6 md:mb-8">
            <img
              src="/carerunnerlogo.png"
              alt="Carerunners Logo"
              className="w-9 h-9 object-contain"
            />
            <span className="text-lg font-bold tracking-tight">Carerunners</span>
          </div>

          {/* ── Big Auto Parts Delivery advertisement ── */}
          <div className="relative w-full max-w-sm rounded-3xl p-6 md:p-7 overflow-hidden
                          bg-gradient-to-br from-[#ef2530] via-[#e21b22] to-[#8f1116]
                          shadow-[0_20px_60px_-15px_rgba(226,27,34,0.7)] border border-white/10">
            {/* Decorative glow blobs */}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-14 -left-10 w-44 h-44 rounded-full bg-black/20 blur-2xl pointer-events-none" />

            <div className="relative">
              {/* NEW badge */}
              <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white text-[11px] font-bold uppercase tracking-widest rounded-full px-3 py-1 mb-4">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
                Just launched
              </span>

              {/* Logo + wordmark */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-14 w-14 rounded-2xl bg-white shadow-lg flex items-center justify-center shrink-0">
                  <img src="/partrunnerlogo.png" alt="PartRunner" className="h-10 w-10 object-contain" />
                </div>
                <div>
                  <p className="text-white font-extrabold text-xl leading-none">PartRunner</p>
                  <p className="text-white/70 text-xs font-medium mt-1">by Carerunners</p>
                </div>
              </div>

              {/* Headline */}
              <h3 className="text-white text-2xl md:text-[28px] font-extrabold leading-tight mb-2">
                Need an auto part?<br />We&apos;ll bring it to you.
              </h3>
              <p className="text-white/85 text-sm leading-relaxed mb-5">
                Tell us what your car needs — we find it at a real store nearby and get it to your door, fast.
              </p>

              {/* Feature list */}
              <div className="space-y-2.5 mb-6">
                <div className="flex items-center gap-2.5 text-sm text-white/95">
                  <span className="flex h-7 w-7 rounded-lg bg-white/15 items-center justify-center shrink-0">
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                  Real stores near you, not guesswork
                </div>
                <div className="flex items-center gap-2.5 text-sm text-white/95">
                  <span className="flex h-7 w-7 rounded-lg bg-white/15 items-center justify-center shrink-0">
                    <Zap className="h-3.5 w-3.5" />
                  </span>
                  Same-day delivery to your door
                </div>
                <div className="flex items-center gap-2.5 text-sm text-white/95">
                  <span className="flex h-7 w-7 rounded-lg bg-white/15 items-center justify-center shrink-0">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                  Live tracking from store to your door
                </div>
              </div>

              {/* CTA */}
              <div className="flex items-center justify-between gap-2 bg-white rounded-xl px-4 py-3">
                <span className="text-[#b9151b] font-bold text-sm">Sign in to get started</span>
                <ArrowRight className="h-4 w-4 text-[#b9151b] shrink-0" />
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — white form area */}
        <div className="bg-white flex-1 flex flex-col justify-center px-8 py-10 md:px-12 md:py-14">
          <div className="max-w-sm w-full mx-auto">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-sm text-gray-500 mb-8">
              Sign in to your account.
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
                    placeholder="you@example.com"
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
              Don&apos;t have an account?{" "}
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
