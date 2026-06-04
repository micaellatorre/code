import type { ReactNode } from "react"

export type ConfirmDialogVariant = "default" | "info" | "success" | "warning" | "danger"

export type ConfirmDialogDetail = {
  label: string
  value: ReactNode
  sensitive?: boolean
  visibleForRoles?: string[]
}

export type ConfirmDialogBanner = {
  variant: "info" | "success" | "warning" | "danger"
  title?: string
  description: string
}

export type ConfirmDialogOptions = {
  variant?: ConfirmDialogVariant
  title: string
  description?: string
  details?: ConfirmDialogDetail[]
  banner?: ConfirmDialogBanner
  confirmLabel?: string
  cancelLabel?: string
  loadingLabel?: string
  hideCancel?: boolean
  requireTextConfirmation?: string
}

export type ConfirmActionOptions = ConfirmDialogOptions & {
  onConfirm: () => Promise<void> | void
}

export type ConfirmDialogContextValue = {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>
  confirmAction: (options: ConfirmActionOptions) => Promise<boolean>
}
