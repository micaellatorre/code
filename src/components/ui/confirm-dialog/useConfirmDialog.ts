"use client"

import { createContext, useContext } from "react"
import type { ConfirmDialogContextValue } from "./types"

export const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null)

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext)

  if (!context) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider")
  }

  return context
}
