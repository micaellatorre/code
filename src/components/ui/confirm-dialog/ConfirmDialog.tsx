"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import type { Role } from "@/lib/auth/roles"
import type { ConfirmActionOptions, ConfirmDialogDetail, ConfirmDialogOptions, ConfirmDialogVariant } from "./types"

type ConfirmDialogProps = {
  options: ConfirmDialogOptions | ConfirmActionOptions
  open: boolean
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}

const variantButtonClass: Record<ConfirmDialogVariant, string> = {
  default: "btn-primary",
  info: "btn-info",
  success: "btn-success",
  warning: "btn-warning",
  danger: "btn-error",
}

const bannerClass = {
  info: "alert-info",
  success: "alert-success",
  warning: "alert-warning",
  danger: "alert-error",
}

function canSeeDetail(detail: ConfirmDialogDetail, activeRole?: Role) {
  if (detail.visibleForRoles?.length) {
    return Boolean(activeRole && detail.visibleForRoles.includes(activeRole))
  }

  if (!detail.sensitive) return true

  return activeRole === "ADMIN" || activeRole === "SOCIO"
}

export function ConfirmDialog({ options, open, loading, onCancel, onConfirm }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const [confirmationText, setConfirmationText] = useState("")
  const { data: session } = useSession()
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole

  const variant = options.variant ?? "default"
  const confirmLabel = loading ? (options.loadingLabel ?? options.confirmLabel ?? "Confirmando...") : (options.confirmLabel ?? "Confirmar")
  const cancelLabel = options.cancelLabel ?? "Cerrar"
  const textConfirmationMatches = !options.requireTextConfirmation || confirmationText === options.requireTextConfirmation

  const details = useMemo(() => options.details ?? [], [options.details])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
      window.setTimeout(() => confirmButtonRef.current?.focus(), 0)
    }

    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    if (open) setConfirmationText("")
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onCancel={(event) => {
        if (loading) {
          event.preventDefault()
          return
        }

        onCancel()
      }}
    >
      <div className="modal-box max-w-xl rounded-lg">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{options.title}</h2>
            {options.description ? (
              <p className="mt-2 text-sm leading-6 text-base-content/70">{options.description}</p>
            ) : null}
          </div>

          {options.banner ? (
            <div className={`alert py-3 text-sm ${bannerClass[options.banner.variant]}`}>
              <div>
                {options.banner.title ? <p className="font-semibold">{options.banner.title}</p> : null}
                <p>{options.banner.description}</p>
              </div>
            </div>
          ) : null}

          {details.length ? (
            <dl className="divide-y divide-base-300 rounded-lg border border-base-300 bg-base-200/40">
              {details.map((detail, index) => {
                const visible = canSeeDetail(detail, activeRole)

                return (
                  <div key={`${detail.label}-${index}`} className="grid grid-cols-1 gap-1 px-3 py-2 sm:grid-cols-[160px_1fr]">
                    <dt className="text-xs font-semibold uppercase text-base-content/50">{detail.label}</dt>
                    <dd className="min-w-0 break-words text-sm">
                      {visible ? detail.value : <span className="text-base-content/50">Restringido por rol</span>}
                    </dd>
                  </div>
                )
              })}
            </dl>
          ) : null}

          {options.requireTextConfirmation ? (
            <label className="form-control">
              <span className="label">
                <span className="label-text">
                  Escribí <span className="font-semibold">{options.requireTextConfirmation}</span> para confirmar
                </span>
              </span>
              <input
                className="input input-bordered"
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                disabled={loading}
              />
            </label>
          ) : null}
        </div>

        <div className="modal-action">
          {!options.hideCancel ? (
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>
              {cancelLabel}
            </button>
          ) : null}
          <button
            ref={confirmButtonRef}
            type="button"
            className={`btn ${variantButtonClass[variant]}`}
            onClick={onConfirm}
            disabled={loading || !textConfirmationMatches}
          >
            {loading ? <span className="loading loading-spinner loading-xs" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
