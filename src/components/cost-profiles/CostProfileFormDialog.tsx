"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { FormDialog } from "@/components/ui/dialog"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import CostProfileForm from "./CostProfileForm"

export default function CostProfileFormDialog() {
  const router = useRouter()
  const confirmDialog = useConfirmDialog()
  const formId = useId()
  const [dirty, setDirty] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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
      title="Nuevo perfil de costo"
      description="Define los costos adicionales que se aplican a la rentabilidad de productos vendidos."
      size="md"
      responsiveFullscreen
      loading={submitting}
      dirty={dirty}
      onBeforeClose={confirmClose}
      onClose={closeDialog}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={submitting}>
            {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
            Crear perfil
          </button>
        </>
      }
    >
      <CostProfileForm
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
    </FormDialog>
  )
}
