"use client"

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { ConfirmDialog } from "./ConfirmDialog"
import { ConfirmDialogContext } from "./useConfirmDialog"
import type { ConfirmActionOptions, ConfirmDialogContextValue, ConfirmDialogOptions } from "./types"

type PendingConfirmation = {
  options: ConfirmDialogOptions | ConfirmActionOptions
  resolve: (confirmed: boolean) => void
}

function isConfirmAction(options: ConfirmDialogOptions | ConfirmActionOptions): options is ConfirmActionOptions {
  return "onConfirm" in options
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null)
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  const openDialog = useCallback((options: ConfirmDialogOptions | ConfirmActionOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve })
    })
  }, [])

  const closeDialog = useCallback(
    (confirmed: boolean) => {
      if (loadingRef.current) return
      pending?.resolve(confirmed)
      setPending(null)
    },
    [pending]
  )

  const handleConfirm = useCallback(async () => {
    if (!pending || loadingRef.current) return

    if (!isConfirmAction(pending.options)) {
      pending.resolve(true)
      setPending(null)
      return
    }

    loadingRef.current = true
    setLoading(true)

    try {
      await pending.options.onConfirm()
      pending.resolve(true)
      setPending(null)
    } catch {
      pending.resolve(false)
      setPending(null)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [pending])

  const value = useMemo<ConfirmDialogContextValue>(
    () => ({
      confirm: openDialog,
      confirmAction: openDialog,
    }),
    [openDialog]
  )

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {pending ? (
        <ConfirmDialog
          options={pending.options}
          open={Boolean(pending)}
          loading={loading}
          onCancel={() => closeDialog(false)}
          onConfirm={() => {
            void handleConfirm()
          }}
        />
      ) : null}
    </ConfirmDialogContext.Provider>
  )
}
