"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import CustomerOrderCreateForm, {
  type CustomerOrderCreateSuccess,
  type CustomerOrderProductOption,
} from "@/components/customer-orders/CustomerOrderCreateForm"
import { FormDialog } from "@/components/ui/dialog"

type CustomerOrderFormDialogProps = {
  branchId: string
  defaultDeliveryDays: number
  products: CustomerOrderProductOption[]
}

export default function CustomerOrderFormDialog({
  branchId,
  defaultDeliveryDays,
  products,
}: CustomerOrderFormDialogProps) {
  const router = useRouter()
  const formId = useId()
  const [busy, setBusy] = useState(false)

  function closeDialog() {
    router.back()
  }

  function handleSuccess(_payload: CustomerOrderCreateSuccess) {
    router.refresh()
    closeDialog()
  }

  return (
    <FormDialog
      open
      title="Nuevo pedido"
      description="Carga preventas y pedidos bajo demanda sin salir del listado."
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
            {busy ? <span className="loading loading-spinner loading-xs" /> : null}
            Confirmar pedido
          </button>
        </>
      }
    >
      <CustomerOrderCreateForm
        branchId={branchId}
        defaultDeliveryDays={defaultDeliveryDays}
        products={products}
        formId={formId}
        hideActions
        onSuccess={handleSuccess}
        onCancel={closeDialog}
        onSubmittingChange={setBusy}
      />
    </FormDialog>
  )
}
