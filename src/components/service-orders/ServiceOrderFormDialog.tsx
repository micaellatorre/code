"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import ServiceOrderForm from "@/components/service-orders/ServiceOrderForm"
import { FormDialog } from "@/components/ui/dialog"

export default function ServiceOrderFormDialog() {
  const router = useRouter()
  const formId = useId()
  const [busy, setBusy] = useState(false)

  function closeDialog() {
    router.back()
  }

  function handleSuccess() {
    router.refresh()
    closeDialog()
  }

  return (
    <FormDialog
      open
      title="Nueva orden de servicio"
      description="Registra el equipo, diagnostico, responsable y valores sin salir del tablero."
      size="fullscreen"
      responsiveFullscreen={false}
      loading={busy}
      onClose={closeDialog}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={busy}>
            Volver
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : null}
            Crear orden
          </button>
        </>
      }
    >
      <ServiceOrderForm formId={formId} hideActions onSuccess={handleSuccess} onCancel={closeDialog} onSubmittingChange={setBusy} />
    </FormDialog>
  )
}
