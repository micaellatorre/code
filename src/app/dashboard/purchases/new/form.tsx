"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import BranchAutocomplete, { type BranchOption } from "@/components/branches/BranchAutocomplete"
import { toArgDateInputValue } from "@/lib/timezone"

type PurchaseKind = "PHONE" | "ACCESSORY"
type ConditionValue = "A_PLUS" | "OEM" | "ASIS" | "ASIS_PLUS" | "SEALED"
type CurrencyValue = "USD" | "ARS" | "USDT"
type PaymentMethodValue = "EFECTIVO_PESOS" | "EFECTIVO_USD" | "TRANSFERENCIA_ARS" | "TRANSFERENCIA_USD" | "TARJETA" | "USDT"

type SupplierOption = {
  id: string
  name: string
}

type PurchaseItemForm = {
  id: string
  type: PurchaseKind
  modelName: string
  relatedModel: string
  color: string
  capacityGB: string
  physicalState: "NEW" | "USED"
  condition: ConditionValue
  batteryPct: string
  quantity: number
  unitCost: string
  salePrice: string
  notes: string
  imeis: string[]
  unitNotes: string[]
}

type PaymentForm = {
  id: string
  method: PaymentMethodValue
  currency: CurrencyValue
  amount: string
  exchangeRate: string
  note: string
}

type SuccessPayload = {
  purchase: { id: string }
  productIds: string[]
  summary: {
    currency: CurrencyValue
    totalCost: string
    totalUnits: number
    productCount: number
    paymentStatus: "PAID" | "PARTIAL" | "CURRENT_ACCOUNT"
  }
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function newItem(type: PurchaseKind): PurchaseItemForm {
  return {
    id: makeId(),
    type,
    modelName: "",
    relatedModel: "",
    color: "",
    capacityGB: "",
    physicalState: "USED",
    condition: type === "PHONE" ? "ASIS" : "ASIS",
    batteryPct: "",
    quantity: 1,
    unitCost: "",
    salePrice: "",
    notes: "",
    imeis: type === "PHONE" ? [""] : [],
    unitNotes: type === "PHONE" ? [""] : [],
  }
}

function newPayment(): PaymentForm {
  return { id: makeId(), method: "EFECTIVO_USD", currency: "USD", amount: "", exchangeRate: "", note: "" }
}

function normalizeItemQuantity(item: PurchaseItemForm, quantity: number): PurchaseItemForm {
  const nextQuantity = Math.max(1, quantity)
  if (item.type !== "PHONE") return { ...item, quantity: nextQuantity }
  return {
    ...item,
    quantity: nextQuantity,
    imeis: Array.from({ length: nextQuantity }, (_, index) => item.imeis[index] ?? ""),
    unitNotes: Array.from({ length: nextQuantity }, (_, index) => item.unitNotes[index] ?? ""),
  }
}

function amountUsd(payment: PaymentForm) {
  const amount = Number(payment.amount || 0)
  if (!Number.isFinite(amount)) return 0
  if (payment.currency === "USD" || payment.currency === "USDT") return amount
  const rate = Number(payment.exchangeRate || 0)
  return rate > 0 ? amount / rate : 0
}

function paymentStatusLabel(status: SuccessPayload["summary"]["paymentStatus"]) {
  if (status === "PAID") return "COMPRA SALDADA TOTALMENTE"
  if (status === "PARTIAL") return "SALDO PENDIENTE"
  return "EN CUENTA CORRIENTE"
}

export default function NewPurchaseForm() {
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [supplierFeedback, setSupplierFeedback] = useState<string | null>(null)
  const [form, setForm] = useState({
    supplierId: "",
    branchId: "",
    date: toArgDateInputValue(new Date()),
    currency: "USD" as CurrencyValue,
    notes: "",
  })
  const [items, setItems] = useState<PurchaseItemForm[]>([newItem("PHONE")])
  const [payments, setPayments] = useState<PaymentForm[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessPayload | null>(null)

  useEffect(() => {
    fetch("/api/users/me/branches")
      .then((response) => response.json())
      .then((payload) => {
        const nextBranches = Array.isArray(payload.branches) ? payload.branches : []
        setBranches(nextBranches)
        const currentId = payload.currentBranch?.id ?? nextBranches[0]?.id ?? ""
        setForm((prev) => ({ ...prev, branchId: prev.branchId || currentId }))
      })
      .catch(() => setBranches([]))
  }, [])

  useEffect(() => {
    if (!form.branchId) {
      setSuppliers([])
      setForm((prev) => ({ ...prev, supplierId: "" }))
      return
    }
    fetch(`/api/suppliers?branchId=${encodeURIComponent(form.branchId)}&pageSize=100`)
      .then((response) => response.json())
      .then((payload) => {
        const nextSuppliers = Array.isArray(payload.suppliers) ? payload.suppliers.map((supplier: SupplierOption) => ({ id: supplier.id, name: supplier.name })) : []
        setSuppliers(nextSuppliers)
        setForm((prev) => {
          if (!prev.supplierId || nextSuppliers.some((supplier: SupplierOption) => supplier.id === prev.supplierId)) return prev
          setSupplierFeedback("Selecciona un proveedor con cobertura para esta sucursal.")
          return { ...prev, supplierId: "" }
        })
      })
      .catch(() => setSuppliers([]))
  }, [form.branchId])

  const total = useMemo(() => items.reduce((acc, item) => acc + Number(item.unitCost || 0) * item.quantity, 0), [items])
  const paidUsd = useMemo(() => payments.reduce((acc, payment) => acc + amountUsd(payment), 0), [payments])
  const totalUnits = useMemo(() => items.reduce((acc, item) => acc + item.quantity, 0), [items])

  function updateItem(itemId: string, patch: Partial<PurchaseItemForm>) {
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, ...patch } : item))
  }

  function changeItemType(itemId: string, type: PurchaseKind) {
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId || item.type === type) return item

      if (type === "PHONE") {
        return {
          ...item,
          type,
          relatedModel: "",
          physicalState: "USED",
          condition: "ASIS",
          imeis: Array.from({ length: item.quantity }, () => ""),
          unitNotes: Array.from({ length: item.quantity }, () => ""),
        }
      }

      return {
        ...item,
        type,
        relatedModel: "",
        capacityGB: "",
        physicalState: "USED",
        condition: "ASIS",
        batteryPct: "",
        imeis: [],
        unitNotes: [],
      }
    }))
  }

  function updateItemQuantity(itemId: string, quantity: number) {
    setItems((prev) => prev.map((item) => item.id === itemId ? normalizeItemQuantity(item, quantity) : item))
  }

  function updateImei(itemId: string, index: number, value: string) {
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item
      const imeis = item.imeis.map((imei, imeiIndex) => imeiIndex === index ? value : imei)
      return { ...item, imeis }
    }))
  }

  function updateUnitNote(itemId: string, index: number, value: string) {
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item
      const unitNotes = item.unitNotes.map((note, noteIndex) => noteIndex === index ? value : note)
      return { ...item, unitNotes }
    }))
  }

  function buildPayload() {
    return {
      supplierId: form.supplierId,
      branchId: form.branchId,
      date: form.date,
      currency: form.currency,
      notes: form.notes || null,
      items: items.map((item) => item.type === "PHONE" ? {
        type: "PHONE" as const,
        modelName: item.modelName,
        color: item.color || null,
        capacityGB: item.capacityGB ? Number(item.capacityGB) : null,
        physicalState: item.physicalState,
        condition: item.condition,
        batteryPct: item.batteryPct ? Number(item.batteryPct) : null,
        quantity: item.quantity,
        unitCost: item.unitCost,
        salePrice: item.salePrice || 0,
        notes: item.notes || null,
        imeis: item.imeis,
        unitNotes: item.unitNotes,
      } : {
        type: "ACCESSORY" as const,
        modelName: item.modelName,
        relatedModel: item.relatedModel || null,
        color: item.color || null,
        quantity: item.quantity,
        unitCost: item.unitCost,
        salePrice: item.salePrice || 0,
        notes: item.notes || null,
      }),
      payments: payments.map((payment) => ({
        method: payment.method,
        currency: payment.currency,
        amount: payment.amount,
        exchangeRate: payment.exchangeRate || null,
        note: payment.note || null,
      })),
    }
  }

  async function submit() {
    setSaving(true)
    setError(null)
    const response = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    })
    const payload = await response.json().catch(() => null)
    setSaving(false)
    if (!response.ok) {
      setError(payload?.error ?? "Error al registrar compra")
      setConfirmOpen(false)
      return
    }
    setSuccess(payload as SuccessPayload)
    setConfirmOpen(false)
  }

  if (success) {
    const phoneUnits = items
      .filter((item) => item.type === "PHONE")
      .reduce((acc, item) => acc + item.quantity, 0)
    const accessoryUnits = items
      .filter((item) => item.type === "ACCESSORY")
      .reduce((acc, item) => acc + item.quantity, 0)
    const successUnitsLabel = [
      phoneUnits ? `${phoneUnits} equipos` : null,
      accessoryUnits ? `${accessoryUnits} accesorios` : null,
    ].filter(Boolean).join(" y ")

    return (
      <DashboardLayout>
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Compras", href: "/dashboard/purchases" }, { label: "Nueva compra" }]} />
        <div className="mx-auto max-w-2xl rounded border border-success/30 bg-success/5 p-6 text-center">
          <h1 className="text-2xl font-bold">Compra registrada con exito</h1>
          <p className="mt-2 text-base-content/70">
            {successUnitsLabel || `${success.summary.totalUnits} unidades`} ingresados al inventario - Total: {success.summary.currency} {Number(success.summary.totalCost).toFixed(2)}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link className="btn btn-primary" href="/dashboard/purchases">Ver compras</Link>
            <Link className="btn btn-outline" href="/dashboard/products">Ver inventario</Link>
            {success.productIds.length === 1 ? (
              <Link className="btn btn-outline" href={`/dashboard/products/${success.productIds[0]}/edit`}>Ver producto creado</Link>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>Registrar otra compra</button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Compras", href: "/dashboard/purchases" }, { label: "Nueva compra" }]} />
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Nueva compra</h1>
          <p className="text-sm text-base-content/60">Registra mercaderia, pagos e ingreso automatico a stock.</p>
        </div>

        {error ? <div className="alert alert-error text-sm">{error}</div> : null}
        {supplierFeedback ? <div className="alert alert-warning text-sm" onClick={() => setSupplierFeedback(null)}>{supplierFeedback}</div> : null}

        <section className="space-y-3 rounded border border-base-300 bg-base-100 p-4">
          <h2 className="text-lg font-semibold">Datos principales</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="form-control">
              <span className="label-text">Fecha de compra *</span>
              <input type="date" className="input input-bordered" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
            </label>
            <BranchAutocomplete value={form.branchId || null} branches={branches} onChange={(branchId) => setForm((prev) => ({ ...prev, branchId, supplierId: "" }))} placeholder="Sucursal de compra" />
            <label className="form-control">
              <span className="label-text">Proveedor *</span>
              <select className="select select-bordered" value={form.supplierId} onChange={(event) => setForm((prev) => ({ ...prev, supplierId: event.target.value }))} required>
                <option value="">{form.branchId ? "Seleccionar proveedor" : "Elegi una sucursal primero"}</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
          </div>
          <label className="form-control">
            <span className="label-text">Notas</span>
            <input className="input input-bordered" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </label>
        </section>

        <section className="space-y-3 rounded border border-base-300 bg-base-100 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Items</h2>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setItems((prev) => [...prev, newItem("PHONE")])}>+ Telefono</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setItems((prev) => [...prev, newItem("ACCESSORY")])}>+ Accesorio</button>
            </div>
          </div>
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="rounded border border-base-300 p-3">
                <div className="flex justify-between gap-3">
                  <h3 className="font-semibold">Item {index + 1}</h3>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="join">
                      <button
                        type="button"
                        className={`btn btn-xs join-item ${item.type === "PHONE" ? "btn-primary" : "btn-outline"}`}
                        onClick={() => changeItemType(item.id, "PHONE")}
                      >
                        TELEFONO
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs join-item ${item.type === "ACCESSORY" ? "btn-primary" : "btn-outline"}`}
                        onClick={() => changeItemType(item.id, "ACCESSORY")}
                      >
                        ACCESORIO
                      </button>
                    </div>
                    {items.length > 1 ? <button type="button" className="btn btn-ghost btn-xs" onClick={() => setItems((prev) => prev.filter((candidate) => candidate.id !== item.id))}>Eliminar</button> : null}
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="form-control">
                    <span className="label-text">{item.type === "PHONE" ? "Modelo *" : "Articulo / modelo *"}</span>
                    <input className="input input-bordered" value={item.modelName} onChange={(event) => updateItem(item.id, { modelName: event.target.value })} required />
                  </label>
                  {item.type === "ACCESSORY" ? (
                    <label className="form-control">
                      <span className="label-text">Para modelo</span>
                      <input className="input input-bordered" value={item.relatedModel} onChange={(event) => updateItem(item.id, { relatedModel: event.target.value })} />
                    </label>
                  ) : (
                    <label className="form-control">
                      <span className="label-text">Capacidad *</span>
                      <input className="input input-bordered" type="number" value={item.capacityGB} onChange={(event) => updateItem(item.id, { capacityGB: event.target.value })} />
                    </label>
                  )}
                  <label className="form-control">
                    <span className="label-text">Color</span>
                    <input className="input input-bordered" value={item.color} onChange={(event) => updateItem(item.id, { color: event.target.value })} />
                  </label>
                  {item.type === "PHONE" ? (
                    <>
                      <label className="form-control">
                        <span className="label-text">Estado fisico</span>
                        <select className="select select-bordered" value={item.physicalState} onChange={(event) => updateItem(item.id, { physicalState: event.target.value as "NEW" | "USED" })}>
                          <option value="NEW">Nuevo</option>
                          <option value="USED">Usado</option>
                        </select>
                      </label>
                      <label className="form-control">
                        <span className="label-text">Grado / condition</span>
                        <select className="select select-bordered" value={item.condition} onChange={(event) => updateItem(item.id, { condition: event.target.value as ConditionValue })}>
                          <option value="SEALED">SEALED</option>
                          <option value="A_PLUS">A_PLUS</option>
                          <option value="OEM">OEM</option>
                          <option value="ASIS">ASIS</option>
                          <option value="ASIS_PLUS">ASIS_PLUS</option>
                        </select>
                      </label>
                      <label className="form-control">
                        <span className="label-text">Bateria %</span>
                        <input className="input input-bordered" type="number" min={0} max={100} value={item.batteryPct} onChange={(event) => updateItem(item.id, { batteryPct: event.target.value })} />
                      </label>
                    </>
                  ) : null}
                  <label className="form-control">
                    <span className="label-text">Cantidad *</span>
                    <input className="input input-bordered" type="number" min={1} value={item.quantity} onChange={(event) => updateItemQuantity(item.id, Number(event.target.value))} />
                  </label>
                  <label className="form-control">
                    <span className="label-text">Costo unitario *</span>
                    <input className="input input-bordered" type="number" step="0.01" value={item.unitCost} onChange={(event) => updateItem(item.id, { unitCost: event.target.value })} />
                  </label>
                  <label className="form-control">
                    <span className="label-text">Precio de venta</span>
                    <input className="input input-bordered" type="number" step="0.01" value={item.salePrice} onChange={(event) => updateItem(item.id, { salePrice: event.target.value })} />
                  </label>
                  <label className="form-control md:col-span-3">
                    <span className="label-text">Notas del item</span>
                    <input className="input input-bordered" value={item.notes} onChange={(event) => updateItem(item.id, { notes: event.target.value })} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        {items.some((item) => item.type === "PHONE") ? (
          <section className="space-y-3 rounded border border-base-300 bg-base-100 p-4">
            <h2 className="text-lg font-semibold">Identificacion</h2>
            {items.filter((item) => item.type === "PHONE").map((item) => (
              <div key={item.id} className="space-y-2 rounded border border-base-300 p-3">
                <div className="font-medium">{[item.modelName || "Equipo", item.color, item.capacityGB ? `${item.capacityGB}GB` : null].filter(Boolean).join(" · ")}</div>
                {item.imeis.map((imei, index) => (
                  <div key={`${item.id}-imei-${index}`} className="grid gap-2 md:grid-cols-[80px_1fr_1fr_auto]">
                    <span className="self-center text-sm text-base-content/60">#{index + 1}</span>
                    <input className="input input-bordered" placeholder="IMEI" value={imei} onChange={(event) => updateImei(item.id, index, event.target.value)} />
                    <input className="input input-bordered" placeholder="Nota opcional" value={item.unitNotes[index] ?? ""} onChange={(event) => updateUnitNote(item.id, index, event.target.value)} />
                    <button type="button" className="btn btn-outline" onClick={() => undefined}>Escanear IMEI</button>
                  </div>
                ))}
              </div>
            ))}
          </section>
        ) : null}

        <section className="space-y-3 rounded border border-base-300 bg-base-100 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Pagos</h2>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setPayments((prev) => [...prev, newPayment()])}>+ Agregar otro medio de pago</button>
          </div>
          {!payments.length ? <p className="text-sm text-base-content/60">No se abona la compra al registrarla. Quedara en cuenta corriente.</p> : null}
          <div className="space-y-2">
            {payments.map((payment) => (
              <div key={payment.id} className="grid gap-2 rounded border border-base-300 p-3 md:grid-cols-[1fr_120px_140px_140px_1fr_auto]">
                <select className="select select-bordered" value={payment.method} onChange={(event) => setPayments((prev) => prev.map((row) => row.id === payment.id ? { ...row, method: event.target.value as PaymentMethodValue } : row))}>
                  <option value="EFECTIVO_USD">Efectivo USD</option>
                  <option value="EFECTIVO_PESOS">Efectivo ARS</option>
                  <option value="TRANSFERENCIA_USD">Transferencia USD</option>
                  <option value="TRANSFERENCIA_ARS">Transferencia ARS</option>
                  <option value="USDT">USDT</option>
                  <option value="TARJETA">Tarjeta</option>
                </select>
                <select className="select select-bordered" value={payment.currency} onChange={(event) => setPayments((prev) => prev.map((row) => row.id === payment.id ? { ...row, currency: event.target.value as CurrencyValue } : row))}>
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                  <option value="USDT">USDT</option>
                </select>
                <input className="input input-bordered" type="number" step="0.01" placeholder="Monto" value={payment.amount} onChange={(event) => setPayments((prev) => prev.map((row) => row.id === payment.id ? { ...row, amount: event.target.value } : row))} />
                <input className="input input-bordered" type="number" step="0.01" placeholder="TC" value={payment.exchangeRate} onChange={(event) => setPayments((prev) => prev.map((row) => row.id === payment.id ? { ...row, exchangeRate: event.target.value } : row))} />
                <input className="input input-bordered" placeholder="Nota" value={payment.note} onChange={(event) => setPayments((prev) => prev.map((row) => row.id === payment.id ? { ...row, note: event.target.value } : row))} />
                <button type="button" className="btn btn-ghost" onClick={() => setPayments((prev) => prev.filter((row) => row.id !== payment.id))}>Quitar</button>
              </div>
            ))}
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div>Total compra: <span className="font-semibold">{form.currency} {total.toFixed(2)}</span></div>
            <div>Total abonado USD eq.: <span className="font-semibold">USD {paidUsd.toFixed(2)}</span></div>
            <div>Saldo pendiente: <span className="font-semibold">USD {Math.max(0, total - paidUsd).toFixed(2)}</span></div>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" onClick={() => setConfirmOpen(true)} disabled={!form.branchId || !form.supplierId || saving}>
            Confirmar compra
          </button>
        </div>
      </div>

      {confirmOpen ? (
        <div className="modal modal-open">
          <div className="modal-box max-h-[86vh] max-w-4xl overflow-y-auto rounded-lg">
            <h2 className="text-xl font-semibold">Confirmacion de Compra</h2>
            <p className="text-sm text-base-content/60">Revisa los datos antes de registrar</p>
            <div className="mt-4 space-y-4">
              <section className="rounded border border-base-300 p-3">
                <h3 className="font-semibold">Informacion general</h3>
                <p className="text-sm">Fecha: {form.date}</p>
                <p className="text-sm">Proveedor: {suppliers.find((supplier) => supplier.id === form.supplierId)?.name ?? "-"}</p>
                <p className="text-sm">Sucursal: {branches.find((branch) => branch.id === form.branchId)?.name ?? "-"}</p>
              </section>
              <section className="rounded border border-base-300 p-3">
                <h3 className="font-semibold">Items</h3>
                {items.map((item) => (
                  <div key={item.id} className="mt-2 text-sm">
                    <p className="font-medium">{item.modelName} · {item.quantity} un. · {form.currency} {(Number(item.unitCost || 0) * item.quantity).toFixed(2)}</p>
                    {item.type === "PHONE" ? <p className="text-base-content/60">IMEI: {item.imeis.filter(Boolean).join(", ") || "sin cargar"}</p> : <p className="text-base-content/60">{item.relatedModel ? `Para ${item.relatedModel}` : ""}</p>}
                  </div>
                ))}
              </section>
              <section className="rounded border border-base-300 p-3">
                <h3 className="font-semibold">Costos y pagos</h3>
                <p className="text-sm">Total de compra: {form.currency} {total.toFixed(2)}</p>
                {payments.map((payment) => <p key={payment.id} className="text-sm">{payment.method} · {payment.currency} {payment.amount}</p>)}
                <div className={`alert mt-3 text-sm ${paidUsd >= total ? "alert-success" : "alert-warning"}`}>{paidUsd >= total ? "COMPRA SALDADA TOTALMENTE" : "SALDO PENDIENTE"}</div>
              </section>
            </div>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>Volver y corregir</button>
              <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : null}
                Registrar compra
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !saving && setConfirmOpen(false)} />
        </div>
      ) : null}
    </DashboardLayout>
  )
}
