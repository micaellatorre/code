"use client"

type StepStatus = "completed" | "active" | "pending"

type Step = {
  id: number
  label: string
  status: StepStatus
  canVisit: boolean
}

export default function TradeInStepper({ steps, onSelect }: { steps: Step[]; onSelect: (step: number) => void }) {
  return (
    <nav className="rounded-lg border border-base-300 bg-base-100 p-3">
      <ol className="grid gap-2 sm:grid-cols-4">
        {steps.map((step) => (
          <li key={step.id}>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                step.status === "active"
                  ? "border-primary bg-primary/10 text-primary"
                  : step.status === "completed"
                    ? "border-success/40 bg-success/10"
                    : "border-base-300 bg-base-200/40 text-base-content/50"
              } ${step.canVisit ? "hover:border-primary/60" : "cursor-not-allowed opacity-60"}`}
              disabled={!step.canVisit}
              onClick={() => onSelect(step.id)}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.status === "completed" ? "bg-success text-success-content" : step.status === "active" ? "bg-primary text-primary-content" : "bg-base-300"}`}>
                {step.status === "completed" ? "✓" : step.id}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{step.label}</span>
                <span className="block text-xs opacity-70">{step.status === "active" ? "Activo" : step.status === "completed" ? "Completo" : "Pendiente"}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
