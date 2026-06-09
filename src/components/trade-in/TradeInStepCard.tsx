"use client"

import type { ReactNode } from "react"

type TradeInStepCardProps = {
  stepNumber: number
  title: string
  description?: string
  status: "completed" | "active" | "pending"
  isActive: boolean
  summary?: string
  onClick?: () => void
  children: ReactNode
}

export default function TradeInStepCard({ stepNumber, title, description, status, isActive, summary, onClick, children }: TradeInStepCardProps) {
  return (
    <section className={`rounded-lg border bg-base-100 ${isActive ? "border-primary/40 shadow-sm" : "border-base-300"}`}>
      <button type="button" className="flex w-full items-center gap-3 p-2 sm:p-4 text-left" onClick={onClick}>
        <span className={`mt-0.5 flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${status === "completed" ? "bg-success text-success-content" : status === "active" ? "bg-primary text-primary-content" : "bg-base-300 text-base-content/60"}`}>
          {status === "completed" ? "✓" : stepNumber}
        </span>
        <span className="min-w-0 flex-1 flex justify-between flex-row">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{title}</span>
            <span className={`badge badge-sm ${status === "active" ? "badge-primary" : status === "completed" ? "badge-success" : "badge-ghost"}`}>{status === "active" ? "Activo" : status === "completed" ? "Completo" : "Pendiente"}</span>
          </span>
          {isActive && description ? <span className="mt-1 block text-sm text-base-content/70">{description}</span> : null}
          {!isActive && summary ? <span className="mt-1 block text-sm text-base-content/60">{summary}</span> : null}
        </span>
      </button>
      {isActive ? <div className="border-t border-base-300 p-4">{children}</div> : null}
    </section>
  )
}
