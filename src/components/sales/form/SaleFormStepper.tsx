"use client"

import GuidedFormStepper from "@/components/forms/GuidedFormStepper"

export default function SaleFormStepper({
  steps,
  activeStep,
  onStepChange,
}: {
  steps: string[]
  activeStep: number
  onStepChange: (step: number) => void
}) {
  return <GuidedFormStepper steps={steps.map((step) => ({ label: step }))} activeStep={activeStep} onStepChange={onStepChange} />
}
