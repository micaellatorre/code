"use client"

import { useEffect, useId, useState } from "react"
import { useRouter } from "next/navigation"
import { FormDialog } from "@/components/ui/dialog"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import BranchForm, { type BranchFormValue } from "./BranchForm"

type BranchFormDialogProps = {
  mode: "create" | "edit"
  branchId?: string
}

async function readApiError(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const body = await response.json().catch(() => null) as { error?: string; message?: string } | null
    return body?.error || body?.message || "Error inesperado."
  }
  return (await response.text().catch(() => "")) || "Error inesperado."
}

function normalizeBranchInitialData(input: unknown): BranchFormValue {
  const branch = input && typeof input === "object" ? input as Record<string, unknown> : {}
  const coverages = Array.isArray(branch.provinceCoverages) ? branch.provinceCoverages : []

  return {
    id: String(branch.id ?? ""),
    code: String(branch.code ?? ""),
    name: String(branch.name ?? ""),
    province: typeof branch.province === "string" ? branch.province : null,
    provinceId: typeof branch.provinceId === "string" ? branch.provinceId : null,
    coverageProvinceIds: coverages
      .map((coverage) => coverage && typeof coverage === "object" ? (coverage as { provinceId?: unknown }).provinceId : null)
      .filter((provinceId): provinceId is string => typeof provinceId === "string"),
    city: typeof branch.city === "string" ? branch.city : null,
    address: typeof branch.address === "string" ? branch.address : null,
    phone: typeof branch.phone === "string" ? branch.phone : null,
    email: typeof branch.email === "string" ? branch.email : null,
    isActive: typeof branch.isActive === "boolean" ? branch.isActive : true,
  }
}

export default function BranchFormDialog({ mode, branchId }: BranchFormDialogProps) {
  const router = useRouter()
  const confirmDialog = useConfirmDialog()
  const formId = useId()
  const [initial, setInitial] = useState<BranchFormValue | null>(null)
  const [loading, setLoading] = useState(mode === "edit")
  const [submitting, setSubmitting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== "edit" || !branchId) return

    let mounted = true

    async function loadBranch() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/branches/${branchId}`, { cache: "no-store" })
        if (!response.ok) throw new Error(await readApiError(response))
        const payload = await response.json() as { branch?: unknown }
        if (!payload.branch) throw new Error("Sucursal no encontrada")
        if (mounted) setInitial(normalizeBranchInitialData(payload.branch))
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Error cargando la sucursal.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadBranch()
    return () => {
      mounted = false
    }
  }, [branchId, mode])

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
      title={mode === "create" ? "Nueva sucursal" : "Editar sucursal"}
      description="Administra ubicacion, contacto, estado y cobertura comercial."
      size="lg"
      responsiveFullscreen
      loading={loading || submitting}
      dirty={dirty}
      onBeforeClose={confirmClose}
      onClose={closeDialog}
      footer={
        !loading && !error && (mode === "create" || initial) ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={submitting}>
              Volver
            </button>
            <button type="submit" form={formId} className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
              Guardar sucursal
            </button>
          </>
        ) : null
      }
    >
      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : null}
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      {!loading && !error && (mode === "create" || initial) ? (
        <BranchForm
          initial={initial ?? undefined}
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
      ) : null}
    </FormDialog>
  )
}
