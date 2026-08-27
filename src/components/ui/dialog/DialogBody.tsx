import type { ReactNode } from "react"

export function DialogBody({ children, withFloatingFooter = false }: { children: ReactNode; withFloatingFooter?: boolean }) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 ${withFloatingFooter ? "pb-28 sm:pb-28" : ""}`}>
      {children}
    </div>
  )
}
