import type { ReactNode } from "react"

export type FormDialogSize = "sm" | "md" | "lg" | "xl" | "fullscreen"

export type FormDialogProps = {
  open: boolean
  title: ReactNode
  description?: ReactNode
  size?: FormDialogSize
  responsiveFullscreen?: boolean
  loading?: boolean
  dirty?: boolean
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  onBeforeClose?: () => boolean | Promise<boolean>
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}
