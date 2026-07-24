"use client"

import { useMemo, useState } from "react"

export type SellerScoreRow = {
  sellerId: string
  sellerName: string
  sellerEmail: string
  branchId: string | null
  branchName: string
  branchCode: string | null
  salesCount: number
  confirmedCount: number
  senadaCount: number
  total: number
  amountPaid: number
  balanceDue: number
  profit: number
  lastSaleAt: string | null
}

type ViewMode = "ALL" | "BY_BRANCH"

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(value))
}

function score(row: SellerScoreRow) {
  const paidRatio = row.total > 0 ? row.amountPaid / row.total : 0
  const marginRatio = row.total > 0 ? row.profit / row.total : 0
  return Math.round((row.salesCount * 12) + (row.confirmedCount * 5) + (row.total / 100) + (paidRatio * 18) + (marginRatio * 20))
}

function analysis(row: SellerScoreRow) {
  if (row.salesCount === 0) return "Sin ventas registradas"
  const paidRatio = row.total > 0 ? row.amountPaid / row.total : 0
  const marginRatio = row.total > 0 ? row.profit / row.total : 0
  if (row.balanceDue > 0 && paidRatio < 0.8) return "Buen volumen, revisar saldos pendientes"
  if (marginRatio < 0.12) return "Ventas activas con margen ajustado"
  if (paidRatio >= 0.95 && row.salesCount >= 3) return "Cierre fuerte y cobranza saludable"
  if (row.senadaCount > row.confirmedCount) return "Pipeline con senas por convertir"
  return "Rendimiento estable"
}

function aggregateRows(rows: SellerScoreRow[]) {
  const map = new Map<string, SellerScoreRow>()

  for (const row of rows) {
    const existing = map.get(row.sellerId)
    if (!existing) {
      map.set(row.sellerId, { ...row, branchId: null, branchName: "Todas", branchCode: null })
      continue
    }

    existing.salesCount += row.salesCount
    existing.confirmedCount += row.confirmedCount
    existing.senadaCount += row.senadaCount
    existing.total += row.total
    existing.amountPaid += row.amountPaid
    existing.balanceDue += row.balanceDue
    existing.profit += row.profit
    if (!existing.lastSaleAt || (row.lastSaleAt && row.lastSaleAt > existing.lastSaleAt)) {
      existing.lastSaleAt = row.lastSaleAt
    }
  }

  return Array.from(map.values())
}

export default function UsersTopSellersTable({ rows }: { rows: SellerScoreRow[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("ALL")
  const visibleRows = useMemo(() => {
    const source = viewMode === "ALL" ? aggregateRows(rows) : rows
    return source
      .map((row) => ({ ...row, points: score(row), analysis: analysis(row) }))
      .sort((a, b) => b.points - a.points || b.total - a.total || b.salesCount - a.salesCount)
      .slice(0, viewMode === "ALL" ? 10 : 15)
  }, [rows, viewMode])

  return (
    <section className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Score points / Analisis</h2>
          <p className="text-sm text-base-content/60">Top sellers por ventas no canceladas, cobranza y margen.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-base-content/70">Sucursales:</span>
          <div className="join">
            <button
              type="button"
              className={`btn btn-sm join-item ${viewMode === "ALL" ? "btn-active btn-primary" : "btn-outline"}`}
              onClick={() => setViewMode("ALL")}
            >
              Todas
            </button>
            <button
              type="button"
              className={`btn btn-sm join-item ${viewMode === "BY_BRANCH" ? "btn-active btn-primary" : "btn-outline"}`}
              onClick={() => setViewMode("BY_BRANCH")}
            >
              Por Sucursal
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-base-300">
        <table className="table table-sm w-full">
          <thead>
            <tr>
              <th>#</th>
              <th>Vendedor</th>
              <th>Sucursal</th>
              <th>Ventas</th>
              <th>Total</th>
              <th>Abonado</th>
              <th>Margen</th>
              <th>Points</th>
              <th>Ultima</th>
              <th>Analisis</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? visibleRows.map((row, index) => (
              <tr key={`${row.sellerId}-${row.branchId ?? "all"}`}>
                <td><span className="badge badge-ghost badge-sm">{index + 1}</span></td>
                <td>
                  <div className="font-medium">{row.sellerName}</div>
                  <div className="text-xs text-base-content/60">{row.sellerEmail}</div>
                </td>
                <td>
                  <div>{row.branchName}</div>
                  {row.branchCode ? <div className="text-xs text-base-content/50">{row.branchCode}</div> : null}
                </td>
                <td>
                  <div className="font-medium">{row.salesCount}</div>
                  <div className="text-xs text-base-content/50">{row.confirmedCount} confirmadas / {row.senadaCount} senadas</div>
                </td>
                <td>{formatMoney(row.total)}</td>
                <td>{formatMoney(row.amountPaid)}</td>
                <td>{formatMoney(row.profit)}</td>
                <td><span className="badge badge-primary badge-outline">{row.points}</span></td>
                <td>{formatDate(row.lastSaleAt)}</td>
                <td className="max-w-xs text-sm text-base-content/70">{row.analysis}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={10} className="py-8 text-center text-sm text-base-content/60">
                  Sin ventas de vendedores para analizar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
