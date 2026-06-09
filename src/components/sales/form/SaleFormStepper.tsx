"use client"

import GuidedFormStepper, { type GuidedFormStepperStep } from "@/components/forms/GuidedFormStepper"

export default function SaleFormStepper({
  steps,
  activeStep,
  onStepChange,
}: {
  steps: (string | GuidedFormStepperStep)[]
  activeStep: number
  onStepChange: (step: number) => void
}) {
  return <GuidedFormStepper steps={steps.map((step) => (typeof step === "string" ? { label: step } : step))} activeStep={activeStep} onStepChange={onStepChange} />
}
