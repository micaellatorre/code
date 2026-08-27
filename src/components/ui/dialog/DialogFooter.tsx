import type { ReactNode } from "react"

export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-4 sm:px-6">
      <div className="pointer-events-auto mx-auto flex w-full max-w-3xl flex-col-reverse gap-2 rounded-lg border border-base-300 bg-base-100/95 p-3 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-end [&_.btn]:btn-sm">
        {children}
      </div>
    </div>
  )
}
