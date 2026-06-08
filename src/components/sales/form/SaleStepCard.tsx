"use client"

import type { ReactNode } from "react"

export default function SaleStepCard({
  index,
  title,
  summary,
  activeStep,
  onStepChange,
  children,
}: {
  index: number
  title: string
  summary: string
  activeStep: number
  onStepChange: (step: number) => void
  children: ReactNode
}) {
  const active = activeStep === index
  const done = activeStep > index
  return (
    <section className={`rounded-lg border bg-base-100 ${active ? "border-primary/40 shadow-sm" : "border-base-300"}`}>
      <button type="button" className="flex w-full items-start gap-3 p-4 text-left" onClick={() => onStepChange(index)}>
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-success text-success-content" : active ? "bg-primary text-primary-content" : "bg-base-300 text-base-content/60"}`}>
          {done ? "OK" : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{title}</span>
            <span className={`badge badge-sm ${done ? "badge-success" : active ? "badge-primary" : "badge-ghost"}`}>
              {done ? "Completo" : active ? "Activo" : "Pendiente"}
            </span>
          </span>
          <span className="mt-1 block text-sm text-base-content/60">{summary}</span>
        </span>
      </button>
      {active ? <div className="border-t border-base-300 p-4">{children}</div> : null}
    </section>
  )
}
