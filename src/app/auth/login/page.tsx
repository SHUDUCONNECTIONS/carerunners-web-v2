"use client"
import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Lock, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { auth } from "@/utils/firebase"
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError("Please enter both email and password.")
      return
    }
    
    setError("")
    setLoading(true)
    
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // Successful login
      router.push("/dashboard") // Redirect to dashboard or appropriate page
    } catch (error) {
      console.error("Error during login:", error)
      setError("Invalid email or password. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError("")
    setLoading(true)
    
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      // Successful Google login
      router.push("/dashboard") // Redirect to dashboard or appropriate page
    } catch (error) {
      console.error("Error during Google login:", error)
      setError("An error occurred during Google sign-in. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = () => {
    router.push("/auth/sign-up") // Redirect to sign-up page
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-teal-600 text-white">
          <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
        </CardHeader>
        <div className="mx-auto w-32 h-32">
          <img
            src="/carerunnerlogo.png"
            alt="Care Runners Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <CardContent className="mt-6">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </Label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  id="email"
                  name="email"
                  type="email"
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
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
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
                <AlertCircle className="h-4 w-4 mr-2" />
                {error}
              </div>
            )}

            <div>
              <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white" disabled={loading}>
                {loading ? "Signing In..." : "Sign In"}
              </Button>
            </div>
            <div className="mt-6 text-center">
            <Button onClick={handleSignUp} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
              Sign Up
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
            <a href="#" className="text-sm text-teal-600 hover:text-teal-500">
              Forgot your password?
            </a>
          </div>


        </CardContent>
      </Card>
    </div>
  )
}
