"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FormDialog } from "@/components/ui/dialog"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import NewProductForm from "@/app/dashboard/products/new/form"
import EditProductForm from "@/app/dashboard/products/[id]/edit/form"

type ProductFormDialogProps = {
  mode: "create" | "edit"
  productId?: string
}

export default function ProductFormDialog({ mode, productId }: ProductFormDialogProps) {
  const router = useRouter()
  const confirmDialog = useConfirmDialog()
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

  const handleSuccess = () => {
    router.refresh()
    closeDialog()
  }

  return (
    <FormDialog
      open
      title={mode === "create" ? "Nuevo producto" : "Editar producto"}
      description="Gestiona inventario, catalogos, stock, costos, proveedor y sucursal."
      size="fullscreen"
      responsiveFullscreen={false}
      loading={busy}
      dirty={dirty}
      onBeforeClose={confirmClose}
      onClose={closeDialog}
    >
      {mode === "create" ? (
        <NewProductForm
          presentation="dialog"
          onDirtyChange={setDirty}
          onSubmittingChange={setBusy}
          onCancel={closeDialog}
          onSuccess={handleSuccess}
        />
      ) : (
        <EditProductForm
          id={productId ?? ""}
          presentation="dialog"
          onDirtyChange={setDirty}
          onSubmittingChange={setBusy}
          onCancel={closeDialog}
          onSuccess={handleSuccess}
        />
      )}
    </FormDialog>
  )
}
