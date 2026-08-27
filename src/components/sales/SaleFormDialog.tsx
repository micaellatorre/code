"use client"

import { Suspense } from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import NewSaleForm from "@/app/dashboard/sales/new/form"
import EditSaleForm from "@/app/dashboard/sales/[id]/edit/form"
import { FormDialog } from "@/components/ui/dialog"
import type { SaleFormSuccess } from "@/components/sales/types"

type SaleFormDialogProps = {
  mode: "create" | "edit"
  saleId?: string
}

export default function SaleFormDialog({ mode, saleId }: SaleFormDialogProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  function closeDialog() {
    router.back()
  }

  function handleSuccess(_success: SaleFormSuccess) {
    router.refresh()
    closeDialog()
  }

  return (
    <FormDialog
      open
      title={mode === "create" ? "Nueva venta" : "Editar venta"}
      description="Carga clientes, productos, pagos, reservas y Plan Canje sin perder el contexto de la tabla."
      size="fullscreen"
      responsiveFullscreen={false}
      loading={busy}
      onClose={closeDialog}
    >
      {mode === "create" ? (
        <Suspense fallback={<div className="p-6">Cargando formulario...</div>}>
          <NewSaleForm presentation="dialog" onSuccess={handleSuccess} onCancel={closeDialog} onSubmittingChange={setBusy} />
        </Suspense>
      ) : (
        <EditSaleForm id={saleId ?? ""} presentation="dialog" onSuccess={handleSuccess} onCancel={closeDialog} onSubmittingChange={setBusy} />
      )}
    </FormDialog>
  )
}
