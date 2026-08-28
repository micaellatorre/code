"use client"

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import BranchAutocomplete, { type BranchOption } from "@/components/branches/BranchAutocomplete"
import ProductCatalogSelectors from "@/components/products/ProductCatalogSelectors"
import { DialogSummaryActions } from "@/components/ui/dialog"
import { CONDITION_LABELS, CONDITION_OPTIONS } from "@/lib/products/display"

export const dynamic = "force-dynamic"

type ProductType = "PHONE" | "ACCESSORY"
type SupplierOption = { id: string; name: string }

type NewProductFormProps = {
  presentation?: "page" | "dialog"
  onSuccess?: () => void
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSubmittingChange?: (submitting: boolean) => void
}

const emptyProductForm = {
  modelName: "",
  location: "",
  branchId: "",
  supplierId: "",
  origin: "",
  brand: "",
  imei: "",
  capacityGB: "",
  condition: "",
  color: "",
  batteryPct: "",
  costPrice: "",
  salePrice: "",
  wholesalePrice: "",
  shippingCost: "",
  catalogModelId: "",
  catalogCapacityId: "",
  catalogColorId: "",
  type: "PHONE" as ProductType,
  senado: false,
  notes: "",
}

export default function NewProductForm({
  presentation = "page",
  onSuccess,
  onCancel,
  onDirtyChange,
  onSubmittingChange,
}: NewProductFormProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.activeRole === "ADMIN"
  const activeRole = session?.user?.activeRole ?? null
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [wholesaleEnabled, setWholesaleEnabled] = useState(false)
  const [currentBranch, setCurrentBranch] = useState<BranchOption | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyProductForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const initialSnapshot = useMemo(() => JSON.stringify(emptyProductForm), [])
  const dirty = JSON.stringify(form) !== initialSnapshot

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    onSubmittingChange?.(isSubmitting)
  }, [isSubmitting, onSubmittingChange])

  useEffect(() => {
    fetch("/api/users/me/branches")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setBranches(data?.branches ?? [])
        setCurrentBranch(data?.currentBranch ?? null)
        if (data?.currentBranch) setForm((prev) => ({ ...prev, branchId: prev.branchId || data.currentBranch.id }))
      })
    fetch("/api/suppliers?pageSize=100", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSuppliers(Array.isArray(data?.suppliers) ? data.suppliers.map((supplier: SupplierOption) => ({ id: supplier.id, name: supplier.name })) : []))
      .catch(() => setSuppliers([]))
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    fetch("/api/config/settings", { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)).then((settings) => {
      setWholesaleEnabled(Boolean(settings?.settings?.wholesalePricesEnabled))
    }).catch(() => {
      setWholesaleEnabled(false)
    })
  }, [isAdmin])

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    if (!form.catalogModelId) {
      setError("Selecciona un modelo del catalogo.")
      setIsSubmitting(false)
      return
    }
    const payload: any = {
      modelName: form.modelName,
      location: form.location || null,
      branchId: form.branchId || null,
      supplierId: form.supplierId || null,
      origin: form.origin || null,
      brand: form.brand || null,
      imei: form.imei || null,
      capacityGB: form.type === "PHONE" && form.capacityGB ? Number(form.capacityGB) : null,
      condition: form.condition || null,
      color: form.color || null,
      batteryPct: form.batteryPct ? Number(form.batteryPct) : null,
      costPrice: parseFloat(form.costPrice) || 0,
      salePrice: parseFloat(form.salePrice) || 0,
      ...(isAdmin && wholesaleEnabled ? { wholesalePrice: form.wholesalePrice ? parseFloat(form.wholesalePrice) : null } : {}),
      shippingCost: form.shippingCost ? parseFloat(form.shippingCost) : null,
      catalogModelId: form.catalogModelId,
      catalogCapacityId: form.type === "PHONE" && form.catalogCapacityId ? form.catalogCapacityId : null,
      catalogColorId: form.catalogColorId || null,
      type: form.type,
      senado: form.senado,
      notes: form.notes || null,
    }
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    try {
      if (res.ok) {
        if (onSuccess) {
          onSuccess()
        } else {
          router.push("/dashboard/products")
        }
        router.refresh()
      } else {
        const payload = await res.json().catch(() => null)
        setError(payload?.error ?? "Error al crear producto")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const productTypeLabel = form.type === "PHONE" ? "Telefono" : "Accesorio"
  const selectedSupplier = suppliers.find((supplier) => supplier.id === form.supplierId)
  const selectedBranchName = isAdmin
    ? branches.find((branch) => branch.id === form.branchId)?.name
    : currentBranch?.name

  const summaryContent = (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-base-content/60">Tipo</dt>
        <dd className="font-medium">{productTypeLabel}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-base-content/60">Modelo</dt>
        <dd className="text-right font-medium">{form.modelName || "Pendiente"}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-base-content/60">Origen</dt>
        <dd className="text-right font-medium">{form.origin || "Pendiente"}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-base-content/60">Proveedor</dt>
        <dd className="text-right font-medium">{selectedSupplier?.name || "Sin asociar"}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-base-content/60">Sucursal</dt>
        <dd className="text-right font-medium">{selectedBranchName || form.location || "Pendiente"}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-base-content/60">Venta</dt>
        <dd className="font-medium">{form.salePrice ? `USD ${form.salePrice}` : "Pendiente"}</dd>
      </div>
    </dl>
  )

  const formContent = (
      <form
        onSubmit={handleSubmit}
        className={`relative grid grid-cols-1 gap-4 pb-28 sm:pb-28 ${presentation === "dialog" ? "lg:pb-28" : "sm:p-4 lg:grid-cols-[1fr_320px] lg:pb-4"}`}
      >
        {error ? <div className="alert alert-error py-3 text-sm lg:col-span-2">{error}</div> : null}

        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">1. Datos del producto</h2>
            <p className="text-sm text-base-content/60">Carga inicial para inventario, costos y ubicacion fisica.</p>
          </div>

          <div className="space-y-6">
            <div>
              <div className="mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Clasificacion</h3>
                <p className="text-sm text-base-content/60">Define el tipo de articulo que entra al stock.</p>
              </div>
              <div className="join">
                {(["PHONE", "ACCESSORY"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={form.type === type}
                    className={`btn btn-sm join-item ${form.type === type ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      type,
                      catalogModelId: prev.type === type ? prev.catalogModelId : "",
                      modelName: prev.type === type ? prev.modelName : "",
                      catalogCapacityId: type === "PHONE" ? prev.catalogCapacityId : "",
                      capacityGB: type === "PHONE" ? prev.capacityGB : "",
                    }))}
                    disabled={isSubmitting}
                  >
                    {type === "PHONE" ? "Telefono" : "Accesorio"}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-base-300 pt-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Ubicacion y origen</h3>
                <p className="text-sm text-base-content/60">Sucursal de entrada y procedencia comercial del producto.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="form-control">
                  {isAdmin ? (
                    <>
                      <BranchAutocomplete value={form.branchId || null} branches={branches} onChange={(branchId) => setForm((prev) => ({ ...prev, branchId }))} />
                      <span className="label-text-alt mt-1 text-base-content/50">Ubicacion fisica inicial del producto.</span>
                    </>
                  ) : (
                    <>
                      <label className="label"><span className="label-text">Sucursal</span></label>
                      <div className="rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm">{currentBranch?.name ?? "Sin sucursal actual"}</div>
                    </>
                  )}
                </div>
                {/* <div className="form-control">
                  <label className="label"><span className="label-text">Ubicacion legacy</span></label>
                  <input type="text" name="location" value={form.location} onChange={handleChange} className="input  input-bordered" disabled={isSubmitting} />
                  <span className="label-text-alt mt-1 text-base-content/50">Fallback si no se elige sucursal.</span>
                </div> */}
                <div className="form-control md:col-span-2">
                  <label className="label"><span className="label-text">Proveedor</span></label>
                  <select name="supplierId" value={form.supplierId} onChange={handleChange} className="select select-bordered" disabled={isSubmitting || suppliers.length === 0}>
                    <option value="">Sin proveedor asociado</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                  <span className="label-text-alt mt-1 text-base-content/50">Relacion normalizada. Origen queda como dato legacy.</span>
                </div>
                <div className="form-control md:col-span-2">
                  <label className="label"><span className="label-text">Origen *</span></label>
                  <input type="text" name="origin" value={form.origin} onChange={handleChange} required className="input  input-bordered" disabled={isSubmitting} />
                  <span className="label-text-alt mt-1 text-base-content/50">Ej: Alex, MercadoLibre, Cambio Apple, Plan Canje.</span>
                </div>
              </div>
            </div>

            <div className="border-t border-base-300 pt-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Identificacion</h3>
                <p className="text-sm text-base-content/60">Datos que permiten reconocer el equipo o accesorio.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <ProductCatalogSelectors
                    type={form.type}
                    activeRole={activeRole}
                    disabled={isSubmitting}
                    modelId={form.catalogModelId || null}
                    modelName={form.modelName}
                    capacityId={form.catalogCapacityId || null}
                    capacityGB={form.capacityGB}
                    colorId={form.catalogColorId || null}
                    color={form.color}
                    onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                  />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Marca</span></label>
                  <input type="text" name="brand" value={form.brand} onChange={handleChange} className="input  input-bordered" disabled={isSubmitting} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">IMEI / serie</span></label>
                  <input type="text" name="imei" value={form.imei} onChange={handleChange} className="input  input-bordered" disabled={isSubmitting} />
                </div>
              </div>
            </div>

            <div className="border-t border-base-300 pt-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Atributos</h3>
                <p className="text-sm text-base-content/60">Condicion fisica y especificaciones relevantes.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="form-control">
                  <label className="label"><span className="label-text">Condicion</span></label>
                  <select name="condition" value={form.condition} onChange={handleChange} className="select select-bordered" disabled={isSubmitting}>
                    <option value="">Seleccionar</option>
                    {CONDITION_OPTIONS.map((condition) => (
                      <option key={condition} value={condition}>{CONDITION_LABELS[condition]}</option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">% Bateria</span></label>
                  <input type="number" name="batteryPct" value={form.batteryPct} onChange={handleChange} className="input  input-bordered" disabled={isSubmitting} />
                </div>
                <label className="label mt-7 cursor-pointer justify-start gap-3 rounded-lg border border-base-300 px-3 py-2">
                  <input type="checkbox" name="senado" checked={form.senado} onChange={handleChange} className="checkbox checkbox-sm" disabled={isSubmitting} />
                  <span className="label-text">Producto senado</span>
                </label>
              </div>
            </div>

            <div className="border-t border-base-300 pt-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Valores</h3>
                <p className="text-sm text-base-content/60">Costos y precio de venta estimado en USD.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="form-control">
                  <label className="label"><span className="label-text">Costo (USD) *</span></label>
                  <input type="number" step="0.01" name="costPrice" value={form.costPrice} onChange={handleChange} required className="input  input-bordered" disabled={isSubmitting} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Precio venta (USD) *</span></label>
                  <input type="number" step="0.01" name="salePrice" value={form.salePrice} onChange={handleChange} required className="input  input-bordered" disabled={isSubmitting} />
                </div>
                {isAdmin && wholesaleEnabled ? (
                  <div className="form-control">
                    <label className="label"><span className="label-text">Precio mayorista (USD)</span></label>
                    <input type="number" step="0.01" name="wholesalePrice" value={form.wholesalePrice} onChange={handleChange} className="input input-bordered" disabled={isSubmitting} />
                  </div>
                ) : null}
                <div className="form-control">
                  <label className="label"><span className="label-text">Costo envio (USD)</span></label>
                  <input type="number" step="0.01" name="shippingCost" value={form.shippingCost} onChange={handleChange} className="input  input-bordered" disabled={isSubmitting} />
                </div>
              </div>
            </div>

            <div className="border-t border-base-300 pt-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-base-content/70">Notas</h3>
                <p className="text-sm text-base-content/60">Informacion interna para compras, stock o venta.</p>
              </div>
              <div className="form-control">
                <textarea
                  className="textarea textarea-bordered min-h-28"
                  name="notes"
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>
        </section>

        <DialogSummaryActions
          layout={presentation === "dialog" ? "drawer" : "aside"}
          title="Resumen"
          mobileLabel={productTypeLabel}
          mobileValue={form.salePrice ? `USD ${form.salePrice}` : "Sin precio"}
          summary={summaryContent}
          actions={({ compact }) => (
            <>
              <button type="submit" className={`btn btn-primary ${compact ? "" : "w-full"}`} disabled={isSubmitting}>
                {isSubmitting ? <span className="loading loading-spinner loading-xs" /> : null}
                {isSubmitting ? (compact ? "..." : "Creando...") : compact ? "Crear" : "Crear producto"}
              </button>
              <button type="button" className={`btn btn-ghost ${compact ? "" : "w-full"}`} onClick={onCancel ?? (() => router.back())} disabled={isSubmitting}>
                Volver
              </button>
            </>
          )}
        />
      </form>
  )

  if (presentation === "dialog") return formContent

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Productos", href: "/dashboard/products" },
          { label: "Nuevo Producto" },
        ]}
      />
      {formContent}
    </DashboardLayout>
  )
}
