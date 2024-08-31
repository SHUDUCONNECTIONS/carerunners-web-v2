import React from "react"
import { Loader2 } from "lucide-react"

interface LoadingComponentProps {
  size?: "small" | "medium" | "large"
  message?: string
}

export default function LoadingComponent({ size = "medium", message = "Loading..." }: LoadingComponentProps) {
  const sizeClasses = {
    small: "w-6 h-6",
    medium: "w-10 h-10",
    large: "w-16 h-16"
  }

  const textSizeClasses = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg"
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md flex flex-col items-center space-y-4">
        <Loader2 className={`animate-spin text-teal-600 ${sizeClasses[size]}`} />
        <p className={`text-gray-600 font-medium ${textSizeClasses[size]}`}>{message}</p>
      </div>
    </div>
  )
}