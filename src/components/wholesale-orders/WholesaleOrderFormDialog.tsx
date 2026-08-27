"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import NewWholesaleOrderForm from "@/app/dashboard/wholesale-orders/new/form"
import { FormDialog } from "@/components/ui/dialog"

export default function WholesaleOrderFormDialog() {
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
      title="Nuevo pedido mayorista"
      description="Carga la solicitud mayorista y vuelve al listado actualizado."
      size="md"
      loading={busy}
      onClose={closeDialog}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : null}
            Crear pedido
          </button>
        </>
      }
    >
      <NewWholesaleOrderForm presentation="dialog" formId={formId} hideActions onSuccess={handleSuccess} onCancel={closeDialog} onSubmittingChange={setBusy} />
    </FormDialog>
  )
}
