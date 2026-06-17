"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Mail, Lock, Phone, AlertCircle } from "lucide-react"
import { auth, db } from "@/utils/firebase" // Adjust this import path if necessary
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth"
import { doc, setDoc, collection } from "firebase/firestore"
import { StepIndicator, StepNav } from "@/components/Stepper"

const steps = ["Personal Details", "Account Security"]

export default function UserRegistrationPage() {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [contact, setContact] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const router = useRouter()

  const validateStep1 = (newErrors: { [key: string]: string }) => {
    if (!firstName.trim()) newErrors.firstName = "First name is required"
    if (!lastName.trim()) newErrors.lastName = "Last name is required"
    if (!contact.trim()) newErrors.contact = "Contact number is required"
    else if (!/^\d{10}$/.test(contact)) newErrors.contact = "Contact number must be 10 digits"
  }

  const validateStep2 = (newErrors: { [key: string]: string }) => {
    if (!email.trim()) newErrors.email = "Email is required"
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Email is invalid"
    if (!password) newErrors.password = "Password is required"
    else if (password.length < 8) newErrors.password = "Password must be at least 8 characters"
    if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match"
  }

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    validateStep1(newErrors)
    validateStep2(newErrors)

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    const newErrors: { [key: string]: string } = {}
    validateStep1(newErrors)
    setErrors(newErrors)
    if (Object.keys(newErrors).length === 0) {
      setCurrentStep(1)
    }
  }

  const createUserAndFirm = async (userId: string) => {
    // Create a new firm document
    const firmRef = doc(collection(db, "firms"))
    await setDoc(firmRef, {
      adminId: userId,
      createdAt: new Date(),
      // Add any other initial firm data here
    })

    // Create the user document
    await setDoc(doc(db, "users", userId), {
      firstName,
      lastName,
      contact,
      email,
      type: "COMPANY_ADMIN",
      firmId: firmRef.id
    })

    return firmRef.id
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      setLoading(true)
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        const user = userCredential.user

        const firmId = await createUserAndFirm(user.uid)

        router.push(`/firm-registration?firmId=${firmId}`)
      } catch (error: any) {
        console.error("Error during signup:", error)
        const messages: Record<string, string> = {
          "auth/email-already-in-use": "An account with this email already exists. Please log in instead.",
          "auth/invalid-email": "The email address is not valid.",
          "auth/weak-password": "Password is too weak. Please use at least 8 characters.",
          "auth/network-request-failed": "Network error. Please check your connection and try again.",
        }
        setErrors({ submit: messages[error?.code] ?? "An error occurred during signup. Please try again." })
      } finally {
        setLoading(false)
      }
    }
  }

  const handleGoogleSignUp = async () => {
    setLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      const firmId = await createUserAndFirm(user.uid)

      router.push(`/firm-registration?firmId=${firmId}`)
    } catch (error: any) {
      console.error("Error during Google signup:", error)
      const messages: Record<string, string> = {
        "auth/account-exists-with-different-credential": "An account already exists with this email. Try logging in instead.",
        "auth/popup-closed-by-user": "Sign-in popup was closed. Please try again.",
        "auth/network-request-failed": "Network error. Please check your connection and try again.",
      }
      setErrors({ submit: messages[error?.code] ?? "An error occurred during Google signup. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  // Helper: input class with error state
  const inputClass = (field: string) =>
    `pl-10 py-3 w-full rounded-lg border text-sm transition-colors
     focus:ring-2 focus:ring-teal-500 focus:border-teal-500
     ${errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      {/* Card wrapper */}
      <div className="w-full max-w-4xl flex flex-col md:flex-row rounded-2xl shadow-2xl overflow-hidden">

        {/* Left panel — teal brand panel */}
        <div className="bg-teal-600 text-white flex flex-col items-center justify-center
                        px-8 py-8 md:py-12 md:w-5/12 shrink-0">
          <img
            src="/carerunnerlogo.png"
            alt="Carerunners Logo"
            className="w-20 h-20 md:w-32 md:h-32 object-contain mb-3 md:mb-6"
          />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-center">
            Carerunners
          </h1>
          <p className="mt-2 text-teal-100 text-sm md:text-base text-center leading-relaxed max-w-xs hidden md:block">
            Register your firm and start managing care runner services — fast, secure, and built for your practice.
          </p>
          <p className="mt-1 text-teal-100 text-xs text-center md:hidden">
            Firm Registration
          </p>
        </div>

        {/* Right panel — white form area */}
        <div className="bg-white flex-1 flex flex-col justify-center px-8 py-10 md:px-12 md:py-14 overflow-y-auto">
          <div className="max-w-sm w-full mx-auto">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">Create an account</h2>
            <p className="text-sm text-gray-500 mb-8">
              Register your law firm to get started.
            </p>

            {/* Google sign-up */}
            <button
              type="button"
              onClick={handleGoogleSignUp}
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
                <span className="px-3 bg-white text-gray-400 uppercase tracking-wide">or sign up with email</span>
              </div>
            </div>

            {/* Step indicator */}
            <StepIndicator steps={steps} currentStep={currentStep} />

            {/* Registration form */}
            <form onSubmit={handleSignUp} className="space-y-4">
              {currentStep === 0 && (
                <>
                  {/* First & Last name row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
                        First Name
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-gray-400" />
                        </div>
                        <Input
                          id="firstName"
                          name="firstName"
                          type="text"
                          required
                          className={inputClass("firstName")}
                          placeholder="Jane"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                      </div>
                      {errors.firstName && (
                        <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Last Name
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-gray-400" />
                        </div>
                        <Input
                          id="lastName"
                          name="lastName"
                          type="text"
                          required
                          className={inputClass("lastName")}
                          placeholder="Smith"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </div>
                      {errors.lastName && (
                        <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Contact Number
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-gray-400" />
                      </div>
                      <Input
                        id="contact"
                        name="contact"
                        type="tel"
                        required
                        className={inputClass("contact")}
                        placeholder="10-digit number"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                      />
                    </div>
                    {errors.contact && (
                      <p className="mt-1 text-xs text-red-600">{errors.contact}</p>
                    )}
                  </div>
                </>
              )}

              {currentStep === 1 && (
                <>
                  <div>
                    <Label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email Address
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
                        className={inputClass("email")}
                        placeholder="you@yourfirm.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Password
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-gray-400" />
                      </div>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        className={inputClass("password")}
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-xs text-red-600">{errors.password}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-gray-400" />
                      </div>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        className={inputClass("confirmPassword")}
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
                    )}
                  </div>

                  {/* Submit-level error */}
                  {errors.submit && (
                    <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{errors.submit}</span>
                    </div>
                  )}
                </>
              )}

              <StepNav
                currentStep={currentStep}
                totalSteps={steps.length}
                onBack={() => setCurrentStep(0)}
                onNext={handleNext}
                isLastStep={currentStep === steps.length - 1}
                submitLabel={loading ? "Creating account…" : "Create Account"}
                loading={loading}
              />
            </form>

            {/* Login link */}
            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{" "}
              <a
                href="/auth/login"
                className="font-medium text-teal-600 hover:text-teal-500 transition-colors"
              >
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
