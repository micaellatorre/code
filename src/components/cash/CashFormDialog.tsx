"use client"

import { Suspense } from "react"
import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import CashMovementForm from "@/components/cash/CashMovementForm"
import CashTransferForm from "@/components/cash/CashTransferForm"
import { FormDialog } from "@/components/ui/dialog"

type CashFormDialogProps = {
  mode: "movement" | "transfer"
}

export default function CashFormDialog({ mode }: CashFormDialogProps) {
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
      title={mode === "movement" ? "Nuevo movimiento de caja" : "Conversion / transferencia"}
      description={mode === "movement" ? "Registra ingresos, egresos y ajustes manuales." : "Mueve saldo entre cuentas o registra conversiones."}
      size="lg"
      loading={busy}
      onClose={closeDialog}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={busy}>
            Volver
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : null}
            {mode === "movement" ? "Registrar movimiento" : "Registrar operacion"}
          </button>
        </>
      }
    >
      {mode === "movement" ? (
        <Suspense fallback={<div className="p-6">Cargando formulario...</div>}>
          <CashMovementForm formId={formId} hideActions onSuccess={handleSuccess} onCancel={closeDialog} onSubmittingChange={setBusy} />
        </Suspense>
      ) : (
        <CashTransferForm formId={formId} hideActions onSuccess={handleSuccess} onCancel={closeDialog} onSubmittingChange={setBusy} />
      )}
    </FormDialog>
  )
}
