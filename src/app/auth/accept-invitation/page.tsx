"use client"

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { auth, db } from "@/utils/firebase"
import { signInWithPopup, GoogleAuthProvider, User } from "firebase/auth"
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
import LoadingComponent from '@/components/loader'

type InvitationData = {
  email: string;
  firmId: string;
  status: string;
};

function AcceptInvitationPageContent() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const invitationId = searchParams.get('id')

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (user && invitationId) {
      fetchInvitationData(invitationId)
    }
  }, [user, invitationId])

  const fetchInvitationData = async (invitationId: string) => {
    try {
      const invitationDoc = await getDoc(doc(db, "userInvitations", invitationId))
      if (!invitationDoc.exists()) {
        setError('Invitation not found')
        return
      }

      const data = invitationDoc.data() as InvitationData
      if (data.status !== 'pending') {
        setError('This invitation has already been used or is no longer valid')
        return
      }

      setInvitationData(data)
    } catch (error) {
      console.error("Error fetching invitation data:", error)
      setError('An error occurred while fetching invitation data')
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error("Error during Google sign-in:", error)
      setError('An error occurred during sign-in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptInvitation = async () => {
    if (!user || !invitationData || !invitationId) {
      setError('Invalid user or invitation data')
      return
    }

    setLoading(true)
    try {
      // Update user profile
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: user.displayName,
        firmId: invitationData.firmId,
        role: 'user', // You can set a default role here
        createdAt: new Date()
      }, { merge: true })

      // Update invitation status
      await updateDoc(doc(db, "userInvitations", invitationId), {
        status: 'accepted',
        acceptedAt: new Date()
      })

      // Redirect to dashboard or another appropriate page
      router.push('/dashboard')
    } catch (error) {
      console.error("Error accepting invitation:", error)
      setError('An error occurred while accepting the invitation. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingComponent />
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Accept Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center mb-4">Please sign in with Google to accept the invitation.</p>
            <Button onClick={handleGoogleSignIn} className="w-full">
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invitationData) {
    return <LoadingComponent />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Accept Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center mb-4">
            You're signed in as {user.email}. Click the button below to accept the invitation and join the firm.
          </p>
          <Button onClick={handleAcceptInvitation} className="w-full">
            Accept Invitation
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<LoadingComponent />}>
      <AcceptInvitationPageContent />
    </Suspense>
  )
}