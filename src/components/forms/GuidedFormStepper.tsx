"use client"

type GuidedFormStepperStep = {
  label: string
  summary?: string
}

export default function GuidedFormStepper({
  steps,
  activeStep,
  onStepChange,
}: {
  steps: GuidedFormStepperStep[]
  activeStep: number
  onStepChange: (step: number) => void
}) {
  return (
    <nav className="rounded-lg border border-base-300 bg-base-100 p-3">
      <ol className="grid min-w-[44rem] gap-2 md:min-w-0 md:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        {steps.map((step, index) => {
          const status = index === activeStep ? "active" : index < activeStep ? "completed" : "pending"
          const statusLabel = status === "active" ? "Activo" : status === "completed" ? "Completo" : "Pendiente"

          return (
            <li key={`${index}-${step.label}`}>
              <button
                type="button"
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                  status === "active"
                    ? "border-primary bg-primary/10 text-primary"
                    : status === "completed"
                      ? "border-success/40 bg-success/10"
                      : "border-base-300 bg-base-200/40 text-base-content/55"
                } hover:border-primary/60`}
                onClick={() => onStepChange(index)}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    status === "completed"
                      ? "bg-success text-success-content"
                      : status === "active"
                        ? "bg-primary text-primary-content"
                        : "bg-base-300 text-base-content/60"
                  }`}
                >
                  {status === "completed" ? "OK" : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{step.label}</span>
                  <span className="block truncate text-xs opacity-70">{step.summary || statusLabel}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
