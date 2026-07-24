"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { CommissionPlanDto, SellerCommissionDto, SellerCommissionSaleDto } from "@/lib/domain/commissions"

type Seller = {
  id: string
  name: string | null
  email: string
  isActive: boolean
  currentBranch: { id: string; code: string; name: string } | null
}

type Props = {
  seller: Seller
  plans: CommissionPlanDto[]
  sales: SellerCommissionSaleDto[]
  commissions: SellerCommissionDto[]
}

function money(value: string | number, currency = "USD") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value))
}

function statusBadge(status: string) {
  if (status === "PAID") return "badge-success"
  if (status === "APPROVED") return "badge-info"
  if (status === "CANCELLED") return "badge-error"
  return "badge-warning"
}

export default function SellerCommissionEditor({ seller, plans, sales, commissions }: Props) {
  const router = useRouter()
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "")
  const [ratePct, setRatePct] = useState("")
  const [creatingSaleId, setCreatingSaleId] = useState<string | null>(null)
  const [updatingCommissionId, setUpdatingCommissionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null
  const availableSales = useMemo(() => sales.filter((sale) => !sale.hasCommission), [sales])
  const pipelineAmount = availableSales.reduce((sum, sale) => sum + Number(selectedPlan?.base === "SALE_TOTAL" ? sale.total : sale.profit), 0)

  async function createCommission(saleId: string) {
    setError(null)
    setCreatingSaleId(saleId)
    const response = await fetch("/api/commissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saleId,
        closerId: seller.id,
        planId: selectedPlanId || null,
        ratePct: ratePct.trim() ? ratePct : null,
      }),
    })
    const payload = await response.json().catch(() => null)
    setCreatingSaleId(null)

    if (!response.ok) {
      setError(payload?.error ?? "No se pudo crear la comision")
      return
    }

    router.refresh()
  }

  async function updateStatus(commissionId: string, status: string) {
    setError(null)
    setUpdatingCommissionId(commissionId)
    const response = await fetch(`/api/commissions/${commissionId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    const payload = await response.json().catch(() => null)
    setUpdatingCommissionId(null)

    if (!response.ok) {
      setError(payload?.error ?? "No se pudo actualizar la comision")
      return
    }

    router.refresh()
  }

  return (
    <div className="space-y-4">
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="text-xs uppercase text-base-content/50">Vendedor</div>
          <div className="mt-1 font-semibold">{seller.name ?? seller.email}</div>
          <div className="text-xs text-base-content/60">{seller.email}</div>
        </div>
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="text-xs uppercase text-base-content/50">Sucursal actual</div>
          <div className="mt-1 font-semibold">{seller.currentBranch?.name ?? "-"}</div>
          <div className="text-xs text-base-content/60">{seller.currentBranch?.code ?? ""}</div>
        </div>
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="text-xs uppercase text-base-content/50">Ventas sin comision</div>
          <div className="mt-1 text-2xl font-bold">{availableSales.length}</div>
        </div>
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="text-xs uppercase text-base-content/50">Base potencial</div>
          <div className="mt-1 text-2xl font-bold">{money(pipelineAmount)}</div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Crear comisiones</h2>
            <p className="text-sm text-base-content/60">Selecciona el plan y genera una comision sobre una venta del vendedor.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_140px]">
            <label className="form-control">
              <span className="label-text">Plan</span>
              <select className="select select-bordered select-sm" value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} ({Number(plan.ratePct).toFixed(2)}%)</option>)}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text">% manual</span>
              <input className="input input-bordered input-sm" type="number" min="0" max="100" step="0.01" value={ratePct} onChange={(event) => setRatePct(event.target.value)} placeholder={selectedPlan?.ratePct ?? "0"} />
            </label>
          </div>
        </div>

        {!plans.length ? (
          <div className="alert alert-warning text-sm">No hay planes activos. Crea un plan para poder generar comisiones.</div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Venta</th>
                <th>Fecha</th>
                <th>Sucursal</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Ganancia</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {availableSales.length ? availableSales.map((sale) => (
                <tr key={sale.id}>
                  <td className="font-mono text-xs">{sale.id.slice(-8)}</td>
                  <td>{dateLabel(sale.date)}</td>
                  <td>{sale.branch?.name ?? "-"}</td>
                  <td><span className="badge badge-outline badge-sm">{sale.status}</span></td>
                  <td>{money(sale.total)}</td>
                  <td>{money(sale.profit)}</td>
                  <td className="text-right">
                    <button className="btn btn-primary btn-xs" disabled={!plans.length || creatingSaleId === sale.id} onClick={() => createCommission(sale.id)}>
                      {creatingSaleId === sale.id ? <span className="loading loading-spinner loading-xs" /> : null}
                      Generar
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="py-8 text-center text-sm text-base-content/60">No hay ventas pendientes de comision.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
        <div>
          <h2 className="text-lg font-semibold">Comisiones del vendedor</h2>
          <p className="text-sm text-base-content/60">Seguimiento administrativo de comisiones generadas.</p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Venta</th>
                <th>Fecha</th>
                <th>Plan</th>
                <th>Base</th>
                <th>%</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {commissions.length ? commissions.map((commission) => (
                <tr key={commission.id}>
                  <td className="font-mono text-xs">{commission.saleId.slice(-8)}</td>
                  <td>{dateLabel(commission.earnedAt)}</td>
                  <td>{commission.planName ?? "Manual"}</td>
                  <td>{money(commission.baseAmount, commission.currency)}</td>
                  <td>{Number(commission.ratePct).toFixed(2)}%</td>
                  <td className="font-medium">{money(commission.amount, commission.currency)}</td>
                  <td>
                    {commission.status === "PAID" ? (
                      <span className={`badge badge-sm ${statusBadge(commission.status)}`}>PAID</span>
                    ) : (
                      <select
                        className={`select select-bordered select-xs ${statusBadge(commission.status)}`}
                        value={commission.status}
                        disabled={updatingCommissionId === commission.id}
                        onChange={(event) => updateStatus(commission.id, event.target.value)}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="py-8 text-center text-sm text-base-content/60">Este vendedor todavia no tiene comisiones generadas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
