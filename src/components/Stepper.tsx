"use client"

import React from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"

interface StepIndicatorProps {
  steps: string[]
  currentStep: number
  onStepClick?: (index: number) => void
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="mb-8">
      {/* Desktop / tablet: full horizontal stepper */}
      <ol className="hidden sm:flex items-center w-full">
        {steps.map((label, index) => {
          const completed = index < currentStep
          const active = index === currentStep
          const clickable = Boolean(onStepClick) && index <= currentStep
          return (
            <li key={label} className={`flex items-center ${index === steps.length - 1 ? "" : "flex-1"}`}>
              <button
                type="button"
                onClick={clickable ? () => onStepClick?.(index) : undefined}
                disabled={!clickable}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-2 rounded-xl px-1 py-1 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                  clickable ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-200 ${
                    completed
                      ? "bg-teal-600 text-white"
                      : active
                      ? "bg-teal-600 text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {completed ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <span className={active ? "text-teal-700" : completed ? "text-gray-700" : "text-gray-400"}>
                  {label}
                </span>
              </button>
              {index !== steps.length - 1 && (
                <div className={`mx-3 h-px flex-1 ${completed ? "bg-teal-600" : "bg-gray-200"}`} />
              )}
            </li>
          )
        })}
      </ol>

      {/* Mobile: compact "Step X of N" + progress bar */}
      <div className="sm:hidden">
        <p className="text-sm font-medium text-gray-500 mb-2">
          Step {currentStep + 1} of {steps.length}: <span className="text-teal-700 font-semibold">{steps[currentStep]}</span>
        </p>
        <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-teal-600 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

interface StepNavProps {
  currentStep: number
  totalSteps: number
  onBack: () => void
  onNext: () => void
  isLastStep: boolean
  submitLabel?: string
  loading?: boolean
  nextDisabled?: boolean
}

export function StepNav({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  isLastStep,
  submitLabel = "Submit",
  loading = false,
  nextDisabled = false,
}: StepNavProps) {
  return (
    <div className="flex items-center justify-between gap-3 mt-6">
      {currentStep > 0 ? (
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="rounded-xl focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          Back
        </Button>
      ) : (
        <span />
      )}

      {isLastStep ? (
        <Button
          type="submit"
          disabled={loading || nextDisabled}
          className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          {loading ? "Submitting…" : submitLabel}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onNext}
          disabled={loading || nextDisabled}
          className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          Next
        </Button>
      )}
    </div>
  )
}
