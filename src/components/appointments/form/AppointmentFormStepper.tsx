"use client"

import GuidedFormStepper from "@/components/forms/GuidedFormStepper"

type AppointmentFormStepperProps = {
  steps: string[]
  activeStep: number
  onStepChange: (step: number) => void
}

export default function AppointmentFormStepper({ steps, activeStep, onStepChange }: AppointmentFormStepperProps) {
  return <GuidedFormStepper steps={steps.map((step) => ({ label: step }))} activeStep={activeStep} onStepChange={onStepChange} />
}
