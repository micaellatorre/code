"use client"

import { XMarkIcon } from "@heroicons/react/24/outline"
import type { ReactNode } from "react"

type DialogHeaderProps = {
  titleId: string
  title: ReactNode
  description?: ReactNode
  loading?: boolean
  onClose: () => void
}

export function DialogHeader({ titleId, title, description, loading, onClose }: DialogHeaderProps) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-base-300 bg-base-100 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h2 id={titleId} className="text-xl font-semibold leading-7">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm leading-6 text-base-content/60">{description}</p> : null}
      </div>
      <button
        type="button"
        className="btn btn-square btn-ghost btn-sm shrink-0"
        onClick={onClose}
        disabled={loading}
        aria-label="Cerrar dialogo"
        title="Cerrar"
      >
        <XMarkIcon className="size-5" />
      </button>
    </div>
  )
}
