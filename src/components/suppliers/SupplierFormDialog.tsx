"use client"

import { useEffect, useId, useState } from "react"
import { useRouter } from "next/navigation"
import { FormDialog } from "@/components/ui/dialog"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import SupplierForm from "./SupplierForm"
import type { SupplierListItem } from "./types"

type SupplierFormDialogProps = {
  mode: "create" | "edit"
  supplierId?: string
}

async function readApiError(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const body = await response.json().catch(() => null) as { error?: string; message?: string } | null
    return body?.error || body?.message || "Error inesperado."
  }
  return (await response.text().catch(() => "")) || "Error inesperado."
}

export default function SupplierFormDialog({ mode, supplierId }: SupplierFormDialogProps) {
  const router = useRouter()
  const confirmDialog = useConfirmDialog()
  const formId = useId()
  const [supplier, setSupplier] = useState<SupplierListItem | null>(null)
  const [loading, setLoading] = useState(mode === "edit")
  const [submitting, setSubmitting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== "edit" || !supplierId) return

    let mounted = true

    async function loadSupplier() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/suppliers/${supplierId}`, { cache: "no-store" })
        if (!response.ok) throw new Error(await readApiError(response))
        const payload = await response.json() as SupplierListItem
        if (mounted) setSupplier(payload)
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Error cargando el proveedor.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadSupplier()
    return () => {
      mounted = false
    }
  }, [mode, supplierId])

  function closeDialog() {
    router.back()
  }

  async function confirmClose() {
    if (!dirty) return true
    return confirmDialog.confirm({
      variant: "warning",
      title: "Descartar cambios",
      description: "Hay informacion modificada en el formulario. Si cerras ahora, esos cambios se perderan.",
      confirmLabel: "Descartar",
      cancelLabel: "Seguir editando",
    })
  }

  return (
    <FormDialog
      open
      title={mode === "create" ? "Nuevo proveedor" : "Editar proveedor"}
      description="Carga datos comerciales, ubicacion y cobertura por sucursal."
      size="lg"
      responsiveFullscreen
      loading={loading || submitting}
      dirty={dirty}
      onBeforeClose={confirmClose}
      onClose={closeDialog}
      footer={
        !loading && !error && (mode === "create" || supplier) ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" form={formId} className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
              {mode === "create" ? "Crear proveedor" : "Guardar cambios"}
            </button>
          </>
        ) : null
      }
    >
      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : null}
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      {!loading && !error && (mode === "create" || supplier) ? (
        <SupplierForm
          mode={mode}
          supplier={supplier ?? undefined}
          formId={formId}
          hideActions
          onDirtyChange={setDirty}
          onSubmittingChange={setSubmitting}
          onCancel={closeDialog}
          onSuccess={() => {
            router.refresh()
            closeDialog()
          }}
        />
      ) : null}
    </FormDialog>
  )
}
