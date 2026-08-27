"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import NewPurchaseForm from "@/app/dashboard/purchases/new/form"
import { FormDialog } from "@/components/ui/dialog"

export default function PurchaseFormDialog() {
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
      title="Nueva compra"
      description="Registra mercaderia, pagos e ingreso a stock manteniendo visible el contexto de compras."
      size="fullscreen"
      responsiveFullscreen={false}
      loading={busy}
      onClose={closeDialog}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>
            Confirmar compra
          </button>
        </>
      }
    >
      <NewPurchaseForm
        presentation="dialog"
        formId={formId}
        hideActions
        onSuccess={handleSuccess}
        onCancel={closeDialog}
        onSubmittingChange={setBusy}
      />
    </FormDialog>
  )
}
