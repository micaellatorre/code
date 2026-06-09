"use client"

import GuidedFormStepper, { type GuidedFormStepperStep } from "@/components/forms/GuidedFormStepper"

type AppointmentFormStepperProps = {
  steps: (string | GuidedFormStepperStep)[]
  activeStep: number
  onStepChange: (step: number) => void
}

export default function AppointmentFormStepper({ steps, activeStep, onStepChange }: AppointmentFormStepperProps) {
  return <GuidedFormStepper steps={steps.map((step) => (typeof step === "string" ? { label: step } : step))} activeStep={activeStep} onStepChange={onStepChange} />
}
