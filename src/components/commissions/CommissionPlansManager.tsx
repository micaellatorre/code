"use client"

import Link from "next/link"
import { RiVipCrownLine } from "@remixicon/react"
import type { CommissionPlanDto, CommissionSellerDto } from "@/lib/domain/commissions"

export default function CommissionPlansManager({
  plans,
  sellers,
}: {
  plans: CommissionPlanDto[]
  sellers: CommissionSellerDto[]
}) {
  const activePlans = plans.filter((plan) => plan.isActive)
  const pendingTotal = sellers.reduce((sum, seller) => sum + Number(seller.pendingAmount), 0)
  const approvedTotal = sellers.reduce((sum, seller) => sum + Number(seller.approvedAmount), 0)
  const paidTotal = sellers.reduce((sum, seller) => sum + Number(seller.paidAmount), 0)

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Vendedores" value={String(sellers.length)} />
        <Metric label="Planes activos" value={String(activePlans.length)} />
        <Metric label="Pendiente" value={money(pendingTotal)} />
        <Metric label="Pagado" value={money(paidTotal)} detail={`Aprobado: ${money(approvedTotal)}`} />
      </section>

      {!activePlans.length ? (
        <div className="alert alert-warning text-sm">
          No hay planes activos. Crea un plan antes de generar comisiones para vendedores.
          <Link href="/dashboard/commissions/new" className="btn btn-warning btn-sm ml-auto">Crear plan</Link>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Vendedores / Closers</h2>
              <p className="text-sm text-base-content/60">Los closers disponibles son usuarios con rol VENDEDOR.</p>
            </div>
            <Link href="/dashboard/config/users/new" className="btn btn-outline btn-sm">Nuevo vendedor</Link>
          </div>
          <div className="overflow-x-auto rounded-lg border border-base-300">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Sucursal</th>
                  <th>Ventas</th>
                  <th>Comisiones</th>
                  <th>Pendiente</th>
                  <th>Pagado</th>
                  <th>Ultima</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sellers.length ? sellers.map((seller, index) => (
                  <tr key={seller.id}>
                    <td>
                      <div className="flex items-center gap-2 font-medium">
                        <span>{seller.name}</span>
                      </div>
                      <div className="text-xs text-base-content/60">{seller.email}</div>
                    </td>
                    <td>
                      <div>{seller.currentBranch?.name ?? "-"}</div>
                      <div className="text-xs text-base-content/50">{seller.currentBranch?.code ?? ""}</div>
                    </td>
                    <td>{seller.salesCount}</td>
                    <td>{seller.commissionCount}</td>
                    <td>{money(seller.pendingAmount)}</td>
                    <td>{money(seller.paidAmount)}</td>
                    <td>{seller.lastCommissionAt ? dateLabel(seller.lastCommissionAt) : "-"}</td>
                    <td className="text-right">
                      <Link href={`/dashboard/commissions/${seller.id}/edit`} className="btn btn-primary btn-xs">
                        Comisiones
                      </Link>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className="py-8 text-center text-sm text-base-content/60">No hay usuarios vendedores para mostrar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Planes</h2>
              <p className="text-sm text-base-content/60">Reglas de calculo disponibles.</p>
            </div>
            <Link href="/dashboard/commissions/new" className="btn btn-primary btn-sm">Nuevo plan</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead><tr><th>Plan</th><th>Base</th><th>%</th><th>Estado</th></tr></thead>
              <tbody>
                {plans.length ? plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="font-medium">{plan.name}</td>
                    <td>{plan.base === "SALE_PROFIT" ? "Ganancia" : "Total"}</td>
                    <td>{Number(plan.ratePct).toFixed(2)}%</td>
                    <td>
                      <span className={`badge badge-sm ${plan.isActive ? "badge-success" : "badge-ghost"}`}>
                        {plan.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="py-8 text-center text-sm text-base-content/60">Sin planes creados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="text-xs uppercase text-base-content/50">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {detail ? <div className="text-xs text-base-content/60">{detail}</div> : null}
    </div>
  )
}

function money(value: string | number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value))
}
