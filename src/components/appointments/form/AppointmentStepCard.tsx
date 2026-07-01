"use client"

import type { ReactNode } from "react"

type AppointmentStepCardProps = {
  index: number
  title: string
  summary: string
  activeStep: number
  onStepChange: (step: number) => void
  children: ReactNode
}

export default function AppointmentStepCard({
  index,
  title,
  summary,
  activeStep,
  onStepChange,
  children,
}: AppointmentStepCardProps) {
  const isActive = activeStep === index
  const isDone = activeStep > index

  return (
    <section className={`rounded-lg border bg-base-100 ${isActive ? "border-primary/40 shadow-sm" : "border-base-300"}`}>
      <button
        type="button"
        className="flex w-full items-start gap-3 p-2 sm:p-4 text-left"
        onClick={() => onStepChange(index)}
      >
        <span className={`mt-0.5 flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isDone ? "bg-success text-success-content" : isActive ? "bg-primary text-primary-content" : "bg-base-300 text-base-content/60"}`}>
          {isDone ? "OK" : index + 1}
        </span>
        <span className="min-w-0 flex-1 flex justify-between flex-row">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{title}</span>
            <span className={`text-nowrap badge badge-sm ${isDone ? "badge-success" : isActive ? "badge-primary" : "badge-ghost"}`}>
              {isDone ? "Completo" : isActive ? "Activo" : "Pendiente"}
            </span>
          </span>
          <span className="mt-1 block text-sm text-base-content/60">{summary}</span>
        </span>
      </button>
      {isActive ? <div className="border-t border-base-300 p-4">{children}</div> : null}
    </section>
  )
}
