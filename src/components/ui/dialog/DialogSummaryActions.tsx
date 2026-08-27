"use client"

import { useState, type ReactNode } from "react"

type DialogSummaryActionsProps = {
  title?: ReactNode
  summary: ReactNode
  mobileLabel: ReactNode
  mobileValue?: ReactNode
  layout?: "aside" | "drawer"
  actions: (options: { compact: boolean }) => ReactNode
}

export function DialogSummaryActions({
  title = "Resumen",
  summary,
  mobileLabel,
  mobileValue,
  layout = "aside",
  actions,
}: DialogSummaryActionsProps) {
  const [expanded, setExpanded] = useState(false)
  const drawerOnly = layout === "drawer"

  return (
    <>
      {!drawerOnly ? (
        <aside className="hidden lg:block">
          <div className="sticky top-0 max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-lg border border-base-300 bg-base-100 p-4">
            <h2 className="font-semibold">{title}</h2>
            <div className="mt-3">{summary}</div>
            <div className="mt-4 flex flex-col gap-2">{actions({ compact: false })}</div>
          </div>
        </aside>
      ) : null}

      <div className={`fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${drawerOnly ? "" : "lg:hidden"}`}>
        <div className="mx-auto max-w-xl overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-2xl lg:max-w-3xl [&_.btn]:btn-sm">
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              className="btn btn-ghost min-h-9 flex-1 justify-start px-2 text-left"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              <span className="truncate font-semibold">{mobileLabel}</span>
              {mobileValue ? <span className="ml-auto truncate text-base-content/60">{mobileValue}</span> : null}
            </button>
            <div className="flex shrink-0 items-center gap-1">{actions({ compact: true })}</div>
          </div>

          <div className={`overflow-hidden border-t border-base-300 transition-[max-height] duration-200 ${expanded ? "max-h-[70dvh]" : "max-h-0 border-t-0"}`}>
            <div className="max-h-[70dvh] overflow-y-auto p-3">
              <h2 className="font-semibold">{title}</h2>
              <div className="mt-3">{summary}</div>
              <div className="mt-4 grid gap-2">{actions({ compact: false })}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
