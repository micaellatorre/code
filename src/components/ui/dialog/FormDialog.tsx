"use client"

import { useCallback, useEffect, useId, useRef } from "react"
import { DialogBody } from "./DialogBody"
import { DialogFooter } from "./DialogFooter"
import { DialogHeader } from "./DialogHeader"
import type { FormDialogProps, FormDialogSize } from "./dialog.types"

const sizeClass: Record<FormDialogSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
  fullscreen: "h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-6xl sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)]",
}

export function FormDialog({
  open,
  title,
  description,
  size = "lg",
  responsiveFullscreen = true,
  loading = false,
  dirty = false,
  closeOnBackdrop = true,
  closeOnEscape = true,
  onBeforeClose,
  onClose,
  children,
  footer,
}: FormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  const requestClose = useCallback(async () => {
    if (loading) return
    if (dirty && !onBeforeClose) return

    const canClose = onBeforeClose ? await onBeforeClose() : true
    if (!canClose) return

    onClose()
  }, [dirty, loading, onBeforeClose, onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
      window.setTimeout(() => {
        const focusTarget = dialog.querySelector<HTMLElement>(
          "[data-autofocus], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        )
        focusTarget?.focus()
      }, 0)
    }

    if (!open && dialog.open) {
      dialog.close()
      previouslyFocusedRef.current?.focus()
      previouslyFocusedRef.current = null
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    return () => {
      if (dialog?.open) dialog.close()
      previouslyFocusedRef.current?.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!closeOnEscape) return
        void requestClose()
      }}
    >
      <div
        className={[
          "modal-box relative flex overflow-hidden p-0",
          size === "fullscreen" ? sizeClass.fullscreen : `max-h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] ${sizeClass[size]}`,
          responsiveFullscreen && size !== "fullscreen" ? "h-[calc(100dvh-1rem)] sm:h-auto sm:min-h-0 rounded-lg" : "rounded-lg",
        ].join(" ")}
      >
        <div className="flex min-h-0 w-full flex-col bg-base-100">
          <DialogHeader titleId={titleId} title={title} description={description} loading={loading} onClose={() => void requestClose()} />
          <DialogBody withFloatingFooter={Boolean(footer)}>{children}</DialogBody>
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </div>
      </div>
      {closeOnBackdrop ? (
        <form method="dialog" className="modal-backdrop">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              void requestClose()
            }}
          >
            cerrar
          </button>
        </form>
      ) : null}
    </dialog>
  )
}
