"use client"

import { Suspense } from "react"
import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { FormDialog } from "@/components/ui/dialog"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import CommissionPlanForm from "./CommissionPlanForm"

export default function CommissionPlanFormDialog() {
  const router = useRouter()
  const confirmDialog = useConfirmDialog()
  const formId = useId()
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

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
      title="Nuevo plan de comision"
      description="Configura la regla base antes de asignar comisiones a vendedores."
      size="md"
      responsiveFullscreen
      loading={busy}
      dirty={dirty}
      onBeforeClose={confirmClose}
      onClose={closeDialog}
      footer={
        <Suspense fallback={null}>
          <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : null}
            Crear plan
          </button>
        </Suspense>
      }
    >
      <Suspense fallback={<div className="p-6">Cargando formulario...</div>}>
        <CommissionPlanForm
          formId={formId}
          hideActions
          onDirtyChange={setDirty}
          onSubmittingChange={setBusy}
          onCancel={closeDialog}
          onSuccess={() => {
            router.refresh()
            closeDialog()
          }}
        />
      </Suspense>
    </FormDialog>
  )
}
