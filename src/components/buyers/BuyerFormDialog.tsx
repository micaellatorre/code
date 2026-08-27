"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import BuyerForm, { normalizeBuyerFormInitialData, type BuyerFormInitialData } from "./BuyerForm"
import { FormDialog } from "@/components/ui/dialog"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"

type BuyerFormDialogProps = {
  mode: "create" | "edit"
  buyerId?: string
}

async function readApiError(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const body = await response.json().catch(() => null) as { error?: string; message?: string } | null
    return body?.error || body?.message || "Error inesperado."
  }
  return (await response.text().catch(() => "")) || "Error inesperado."
}

export default function BuyerFormDialog({ mode, buyerId }: BuyerFormDialogProps) {
  const router = useRouter()
  const confirmDialog = useConfirmDialog()
  const [initialData, setInitialData] = useState<BuyerFormInitialData | null>(null)
  const [loading, setLoading] = useState(mode === "edit")
  const [submitting, setSubmitting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== "edit" || !buyerId) return

    let mounted = true

    async function loadBuyer() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/buyers/${buyerId}`, { cache: "no-store" })
        if (!response.ok) throw new Error(await readApiError(response))

        const payload = await response.json() as { buyer?: unknown }
        if (!payload.buyer) throw new Error("No se encontro el cliente.")
        if (mounted) setInitialData(normalizeBuyerFormInitialData(payload.buyer))
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Error cargando el cliente.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadBuyer()
    return () => {
      mounted = false
    }
  }, [buyerId, mode])

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

  const title = mode === "create" ? "Nuevo cliente" : "Editar cliente"
  const description =
    mode === "create"
      ? "Carga un cliente minorista o mayorista sin salir del listado."
      : "Actualiza los datos comerciales, fiscales y de contacto del cliente."
  const ready = mode === "create" || Boolean(initialData)

  return (
    <FormDialog
      open
      title={title}
      description={description}
      size="xl"
      responsiveFullscreen
      loading={loading || submitting}
      dirty={dirty}
      onBeforeClose={confirmClose}
      onClose={closeDialog}
    >
      {loading ? (
        <div className="flex min-h-72 items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : null}

      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      {!loading && !error && ready ? (
        <BuyerForm
          mode={mode}
          initialData={initialData ?? undefined}
          presentation="dialog"
          onDirtyChange={setDirty}
          onSubmittingChange={setSubmitting}
          onCancel={closeDialog}
          onSuccess={() => {
            router.refresh()
            closeDialog()
          }}
        />
      ) : null}
    </FormDialog>
  )
}
