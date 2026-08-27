"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { FormDialog } from "@/components/ui/dialog"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import ReservationForm from "./ReservationForm"
import ReservationEditForm from "./ReservationEditForm"

type ReservationFormDialogProps = {
  mode: "create" | "edit"
  initial?: { id: string; pickupAt: string; agreedTotal: string; notes: string }
}

export default function ReservationFormDialog({ mode, initial }: ReservationFormDialogProps) {
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

  function handleSuccess() {
    router.refresh()
    closeDialog()
  }

  return (
    <FormDialog
      open
      title={mode === "create" ? "Nueva reserva" : "Editar reserva"}
      description="Gestiona cliente, item reservado, sena, regalos y condiciones de retiro."
      size={mode === "create" ? "xl" : "md"}
      responsiveFullscreen
      loading={busy}
      dirty={dirty}
      onBeforeClose={confirmClose}
      onClose={closeDialog}
      footer={
        mode === "create" || initial ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={busy}>
              Volver
            </button>
            <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>
              {busy ? <span className="loading loading-spinner loading-xs" /> : null}
              {mode === "create" ? "Crear reserva" : "Guardar"}
            </button>
          </>
        ) : null
      }
    >
      {mode === "create" ? (
        <ReservationForm formId={formId} hideActions onDirtyChange={setDirty} onSubmittingChange={setBusy} onCancel={closeDialog} onSuccess={handleSuccess} />
      ) : initial ? (
        <ReservationEditForm initial={initial} formId={formId} hideActions onDirtyChange={setDirty} onSubmittingChange={setBusy} onCancel={closeDialog} onSuccess={handleSuccess} />
      ) : (
        <div className="alert alert-error text-sm">No se pudo cargar la reserva.</div>
      )}
    </FormDialog>
  )
}
