"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Mail, Clock, ArrowRight } from "lucide-react"

export default function DriverSignUpConfirmation() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-teal-600 text-white text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-white mb-4" />
          <CardTitle className="text-2xl font-bold">Application Received!</CardTitle>
        </CardHeader>
        <CardContent className="mt-6 text-center">
          <div className="space-y-6">
            <p className="text-lg text-gray-700">
              Thank you for applying to be a driver with us. We&aposve received your application and are excited to review it!
            </p>
            <div className="flex items-center justify-center text-teal-600">
              <Clock className="h-6 w-6 mr-2" />
              <span className="text-lg font-semibold">What&aposs Next?</span>
            </div>
            <ul className="text-left text-gray-600 space-y-4">
              <li className="flex items-start">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-teal-500" />
                </div>
                <p className="ml-3">Our team will carefully review your application.</p>
              </li>
              <li className="flex items-start">
                <div className="flex-shrink-0">
                  <Mail className="h-6 w-6 text-teal-500" />
                </div>
                <p className="ml-3">We&aposll send you an email within 3-5 business days with the next steps or if we need any additional information.</p>
              </li>
            </ul>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Mail className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Please keep an eye on your email inbox, including your spam folder, for messages from us.
                  </p>
                </div>
              </div>
            </div>
            <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">
              Return to Homepage
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}