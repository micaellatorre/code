"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowDownTrayIcon,
  BanknotesIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckIcon,
  ClipboardDocumentListIcon,
  DocumentChartBarIcon,
  MagnifyingGlassIcon,
  UserIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline"
import type {
  DatabaseBuyerRow,
  DatabaseCashRow,
  DatabaseCloserRow,
  DatabaseDateRange,
  DatabaseReadModel,
  DatabaseRetailSaleRow,
  DatabaseTabKey,
  DatabaseWholesaleSaleRow,
} from "@/lib/database/read-models"
import { databaseTabLabels } from "@/lib/database/config"

const tabs: DatabaseTabKey[] = ["cash", "retail", "wholesale", "purchases", "reservations", "closers", "service", "audit", "buyers"]
const exportFields = ["cash", "retail", "wholesale", "purchases", "reservations", "service", "audit"] as const
type ExportField = (typeof exportFields)[number]

type Props = {
  data: DatabaseReadModel
  range: DatabaseDateRange
  activeTab: DatabaseTabKey
  period: string
  dateFrom: string
  dateTo: string
  canSeeFinancials: boolean
  reporter: string
}

function formatMoney(value: number | null | undefined, currency = "USD") {
  if (value == null) return "Restringido"
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "ARS" ? 0 : 2,
  }).format(value)
}

function formatDate(value: string | null | undefined, withTime = true) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: withTime ? "short" : undefined,
  }).format(new Date(value))
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function searchable(row: unknown) {
  return JSON.stringify(row).toLowerCase()
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 p-3">
      <div className="flex items-center gap-2 text-base-content/50">
        <span className="grid size-8 place-items-center rounded-md bg-base-200 text-primary">{icon}</span>
        <p className="text-xs font-semibold uppercase">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function PaymentsList({ payments }: { payments: DatabaseRetailSaleRow["payments"] }) {
  if (!payments.length) return <span className="text-base-content/50">Sin pagos</span>
  return (
    <div className="space-y-1">
      {payments.map((payment, index) => (
        <div key={`${payment.method}-${index}`} className="flex justify-between gap-3 text-xs">
          <span className="text-base-content/70">{payment.method}</span>
          <span className="font-medium tabular-nums">{formatMoney(payment.amount, payment.currency)}</span>
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ value }: { value: string }) {
  const tone = value.includes("DEBE") || value.includes("PENDING") ? "badge-warning" : value.includes("CANCEL") ? "badge-error" : "badge-success"
  return <span className={`badge ${tone} badge-sm whitespace-nowrap`}>{value}</span>
}

function isWholesaleRow(row: DatabaseRetailSaleRow | DatabaseWholesaleSaleRow): row is DatabaseWholesaleSaleRow {
  return "agreedPrice" in row
}

function SalesLikeTable({ rows, wholesale, canSeeFinancials }: { rows: Array<DatabaseRetailSaleRow | DatabaseWholesaleSaleRow>; wholesale?: boolean; canSeeFinancials: boolean }) {
  return (
    <TableShell empty="No hay ventas en el periodo." colSpan={wholesale ? 10 : 7} hasRows={rows.length > 0}>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Cliente</th>
          <th>Item / IMEI</th>
          {wholesale ? <th>P. acordado</th> : <th>Precio / abonado</th>}
          {wholesale ? <th>Monto orig</th> : <th>Forma de pago</th>}
          {wholesale ? <th>Abonado USD</th> : null}
          {canSeeFinancials ? <th>Costo / margen</th> : null}
          <th>{wholesale ? "Deuda" : "Estado"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              <div className="font-medium">{formatDate(row.date)}</div>
              <div className="text-xs text-base-content/50">{row.seller}</div>
            </td>
            <td>{row.customer}</td>
            <td>
              <div className="font-medium">{row.itemSummary}</div>
              {row.itemMeta ? <div className="text-xs text-base-content/50">{row.itemMeta}</div> : null}
            </td>
            <td>
              <div className="font-semibold tabular-nums">{formatMoney(wholesale && isWholesaleRow(row) ? row.agreedPrice : row.total)}</div>
              {!wholesale ? <div className="text-xs text-base-content/60">Abonado: {formatMoney(row.amountPaid)}</div> : null}
            </td>
            <td>{wholesale && isWholesaleRow(row) ? row.originalAmount || "-" : <PaymentsList payments={row.payments} />}</td>
            {wholesale && isWholesaleRow(row) ? <td className="tabular-nums">{formatMoney(row.paidUsd)}</td> : null}
            {canSeeFinancials ? (
              <td>
                <div className="text-xs text-base-content/60">Costo {formatMoney(row.costTotal)}</div>
                <div className="font-semibold tabular-nums">Margen {formatMoney(row.profit)}</div>
              </td>
            ) : null}
            <td>{wholesale ? formatMoney(row.balanceDue) : <StatusBadge value={row.financialStatus} />}</td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

function TableShell({ children, empty, colSpan, hasRows }: { children: React.ReactNode; empty: string; colSpan: number; hasRows: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
      <table className="table table-sm w-full table-pin-rows">
        {children}
        {!hasRows ? (
          <tbody>
            <tr>
              <td colSpan={colSpan} className="py-10 text-center text-base-content/60">
                {empty}
              </td>
            </tr>
          </tbody>
        ) : null}
      </table>
    </div>
  )
}

function CashTable({ rows }: { rows: DatabaseCashRow[] }) {
  return (
    <TableShell empty="No hay movimientos de caja en el periodo." colSpan={7} hasRows={rows.length > 0}>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Detalle</th>
          <th>Monto</th>
          <th>Caja</th>
          <th>Cotizacion</th>
          <th>Equiv. USD</th>
          <th>Tipo</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.source}-${row.id}`}>
            <td>{formatDate(row.date)}</td>
            <td>
              <div className="font-medium">{row.detail}</div>
              <div className="text-xs text-base-content/50">{row.source}</div>
            </td>
            <td className="font-semibold tabular-nums">{formatMoney(row.amount, row.currency)}</td>
            <td>{row.account}</td>
            <td>{row.exchangeRate ?? "-"}</td>
            <td>{row.amountUsd == null ? "-" : formatMoney(row.amountUsd)}</td>
            <td><StatusBadge value={row.type} /></td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}

function GenericTable({ rows, tab, canSeeFinancials }: { rows: DatabaseReadModel[DatabaseTabKey]; tab: DatabaseTabKey; canSeeFinancials: boolean }) {
  if (tab === "cash") return <CashTable rows={rows as DatabaseReadModel["cash"]} />
  if (tab === "retail") return <SalesLikeTable rows={rows as DatabaseReadModel["retail"]} canSeeFinancials={canSeeFinancials} />
  if (tab === "wholesale") return <SalesLikeTable rows={rows as DatabaseReadModel["wholesale"]} wholesale canSeeFinancials={canSeeFinancials} />

  if (tab === "purchases") {
    const purchaseRows = rows as DatabaseReadModel["purchases"]
    return (
      <TableShell empty="No hay compras en el periodo." colSpan={9} hasRows={purchaseRows.length > 0}>
        <thead><tr><th>Fecha</th><th>Proveedor</th><th>Modelo</th><th>IMEI / serie</th><th>Cod.</th><th>Total</th><th>Abonado</th><th>Cant.</th><th>Deuda</th></tr></thead>
        <tbody>{purchaseRows.map((row) => <tr key={row.id}><td>{formatDate(row.date, false)}</td><td>{row.supplier}</td><td>{row.model}</td><td>{row.imeiSerial ?? "-"}</td><td>{row.code}</td><td>{formatMoney(row.total, row.currency)}</td><td>{row.amountPaid == null ? "-" : formatMoney(row.amountPaid, row.currency)}</td><td>{row.quantity}</td><td>{row.debt == null ? "-" : formatMoney(row.debt, row.currency)}</td></tr>)}</tbody>
      </TableShell>
    )
  }

  if (tab === "reservations") {
    const reservationRows = rows as DatabaseReadModel["reservations"]
    return (
      <TableShell empty="No hay guardados o reservas en el periodo." colSpan={8} hasRows={reservationRows.length > 0}>
        <thead><tr><th>Hora / fecha</th><th>Cliente</th><th>Item</th><th>Cuando pasa</th><th>P. acordado</th><th>Seña USD</th><th>Regalos</th><th>Estado</th></tr></thead>
        <tbody>{reservationRows.map((row) => <tr key={`${row.source}-${row.id}`}><td>{formatDate(row.reservedAt)}</td><td>{row.customer}<div className="text-xs text-base-content/50">{row.source}</div></td><td>{row.item}</td><td>{formatDate(row.pickupAt)}</td><td>{formatMoney(row.agreedPrice)}</td><td>{row.depositUsd == null ? "-" : formatMoney(row.depositUsd)}</td><td>{row.gifts ?? "-"}</td><td><StatusBadge value={row.status} /></td></tr>)}</tbody>
      </TableShell>
    )
  }

  if (tab === "service") {
    const serviceRows = rows as DatabaseReadModel["service"]
    return (
      <TableShell empty="No hay ordenes de servicio tecnico en el periodo." colSpan={7} hasRows={serviceRows.length > 0}>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Cliente / equipo</th><th>Modelo / falla</th><th>Tecnico</th><th>Costo / precio</th><th>Estado</th></tr></thead>
        <tbody>{serviceRows.map((row) => <tr key={row.id}><td>{formatDate(row.date)}</td><td><StatusBadge value={row.type} /></td><td>{row.customerEquipment}</td><td>{row.modelFailure}</td><td>{row.technician}</td><td><div>Precio {formatMoney(row.priceAmount, row.currency)}</div><div className="text-xs text-base-content/60">Costo {formatMoney(row.costAmount, row.currency)}</div></td><td><StatusBadge value={row.status} /></td></tr>)}</tbody>
      </TableShell>
    )
  }

  if (tab === "audit") {
    const auditRows = rows as DatabaseReadModel["audit"]
    return (
      <TableShell empty="No hay eventos de trazabilidad en el periodo." colSpan={5} hasRows={auditRows.length > 0}>
        <thead><tr><th>Fecha</th><th>Accion</th><th>Modulo</th><th>Detalle</th><th>Usuario</th></tr></thead>
        <tbody>{auditRows.map((row) => <tr key={row.id}><td>{formatDate(row.date)}</td><td><StatusBadge value={row.action} /></td><td>{row.module}</td><td>{row.detail}</td><td>{row.user}</td></tr>)}</tbody>
      </TableShell>
    )
  }

  if (tab === "buyers") {
    const buyerRows = rows as DatabaseBuyerRow[]
    return (
      <TableShell empty="No hay compradores con operaciones en el periodo." colSpan={8} hasRows={buyerRows.length > 0}>
        <thead><tr><th>Nombre</th><th>Tipo</th><th>Instagram</th><th>Telefono</th><th>Ultima compra</th><th>Operaciones</th><th>Total comprado</th><th>Saldo</th></tr></thead>
        <tbody>{buyerRows.map((row) => <tr key={row.id}><td className="font-medium">{row.name}</td><td><StatusBadge value={row.type} /></td><td>{row.instagram ?? "-"}</td><td>{row.phone ?? "-"}</td><td>{formatDate(row.lastPurchaseAt, false)}</td><td>{row.operations}</td><td>{formatMoney(row.totalPurchased)}</td><td>{formatMoney(row.balanceDue)}</td></tr>)}</tbody>
      </TableShell>
    )
  }

  const closerRows = rows as DatabaseCloserRow[]
  return (
    <TableShell empty="Sin movimientos. No hay closers con comisiones registradas en este periodo." colSpan={7} hasRows={closerRows.length > 0}>
      <thead><tr><th>Fecha</th><th>Closer</th><th>Venta</th><th>Base</th><th>%</th><th>Comision</th><th>Estado</th></tr></thead>
      <tbody>{closerRows.map((row) => <tr key={row.id}><td>{formatDate(row.date)}</td><td>{row.closer}</td><td>{row.sale}</td><td>{formatMoney(row.baseAmount, row.currency)}</td><td>{row.ratePct}%</td><td>{formatMoney(row.amount, row.currency)}</td><td><StatusBadge value={row.status} /></td></tr>)}</tbody>
    </TableShell>
  )
}

function ExportDatabaseModal({ open, onClose, range, reporter, activeTab }: { open: boolean; onClose: () => void; range: DatabaseDateRange; reporter: string; activeTab: DatabaseTabKey }) {
  const [format, setFormat] = useState<"pdf" | "xlsx">("xlsx")
  const [from, setFrom] = useState(range.from.toISOString().slice(0, 10))
  const [to, setTo] = useState(range.to.toISOString().slice(0, 10))
  const [fields, setFields] = useState<ExportField[]>(exportFields.filter((field) => field !== "audit" || activeTab === "audit"))
  const allSelected = fields.length === exportFields.length

  if (!open) return null

  function toggleField(field: ExportField) {
    setFields((prev) => (prev.includes(field) ? prev.filter((item) => item !== field) : [...prev, field]))
  }

  async function handleExport() {
    const response = await fetch("/api/database/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, from, to, fields }),
    })
    if (!response.ok) return
    if (format === "pdf") {
      const html = await response.text()
      const popup = window.open("", "_blank")
      popup?.document.write(html)
      popup?.document.close()
      popup?.print()
      onClose()
      return
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `base-de-datos-${from}-${to}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-3xl rounded-lg">
        <h2 className="text-xl font-semibold">Exportar Base de Datos</h2>
        <p className="mt-1 text-sm text-base-content/70">Selecciona formato, periodo y campos a exportar</p>
        <div className="mt-5 space-y-5">
          <section>
            <p className="text-xs font-semibold uppercase text-base-content/50">Formato de exportacion</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {[{ key: "pdf", title: "PDF", text: "Documento visual" }, { key: "xlsx", title: "Excel", text: "Hoja de calculo .xlsx" }].map((option) => (
                <button key={option.key} type="button" onClick={() => setFormat(option.key as "pdf" | "xlsx")} className={cx("rounded-lg border p-3 text-left focus:outline-none focus:ring-2 focus:ring-primary", format === option.key ? "border-primary bg-primary/10" : "border-base-300 bg-base-100")}>
                  <div className="flex items-center justify-between"><span className="font-semibold">{option.title}</span>{format === option.key ? <CheckIcon className="size-5 text-primary" /> : null}</div>
                  <p className="text-sm text-base-content/60">{option.text}</p>
                </button>
              ))}
            </div>
          </section>
          <section>
            <p className="text-xs font-semibold uppercase text-base-content/50">Rango de fechas</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <input type="date" className="input input-bordered" value={from} onChange={(event) => setFrom(event.target.value)} />
              <span className="text-center text-base-content/40">a</span>
              <input type="date" className="input input-bordered" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
          </section>
          <section>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase text-base-content/50">Campos a exportar</p>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setFields(allSelected ? [] : [...exportFields])}>{allSelected ? "Deseleccionar todo" : "Seleccionar todo"}</button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {exportFields.map((field) => (
                <label key={field} className="flex cursor-pointer items-center gap-2 rounded-lg border border-base-300 p-3">
                  <input type="checkbox" className="checkbox checkbox-sm" checked={fields.includes(field)} onChange={() => toggleField(field)} />
                  <span className="text-sm">{databaseTabLabels[field]}</span>
                </label>
              ))}
            </div>
          </section>
          <div className="rounded-lg border border-base-300 bg-base-200/60 p-3 text-sm">
            <div className="flex items-center gap-2"><UserIcon className="size-4" /><span className="font-medium">{reporter}</span></div>
            <p className="mt-1 text-base-content/60">Generado: {new Date().toLocaleString("es-AR")}</p>
          </div>
        </div>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!fields.length} onClick={handleExport}>{format === "pdf" ? "Exportar PDF" : "Exportar Excel"}</button>
        </div>
      </div>
    </dialog>
  )
}

export default function DatabaseModule({ data, range, activeTab, period, dateFrom, dateTo, canSeeFinancials, reporter }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState("")
  const [exportOpen, setExportOpen] = useState(false)

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    if (key !== "tab") params.set("tab", activeTab)
    router.push(`${pathname}?${params.toString()}`)
  }

  const activeRows = data[activeTab]
  const filteredRows = useMemo(() => {
    if (!search.trim()) return activeRows
    const needle = search.trim().toLowerCase()
    return activeRows.filter((row) => searchable(row).includes(needle)) as typeof activeRows
  }, [activeRows, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Base de Datos</h1>
          <p className="text-sm text-base-content/60">Reportes financieros y trazabilidad</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="select select-bordered select-sm" value={period} onChange={(event) => updateParam("period", event.target.value)}>
            <option value="today">Hoy</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
            <option value="previous-month">Mes anterior</option>
            <option value="last-30">Ultimos 30 dias</option>
            <option value="custom">Personalizado</option>
          </select>
          {period === "custom" ? (
            <>
              <input type="date" className="input input-bordered input-sm" defaultValue={dateFrom} onBlur={(event) => updateParam("from", event.target.value)} />
              <input type="date" className="input input-bordered input-sm" defaultValue={dateTo} onBlur={(event) => updateParam("to", event.target.value)} />
            </>
          ) : null}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setExportOpen(true)}>
            <ArrowDownTrayIcon className="size-4" />
            Exportar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard icon={<BanknotesIcon className="size-4" />} label="Ventas totales" value={formatMoney(data.kpis.totalSales)} />
        <KpiCard icon={<ChartBarIcon className="size-4" />} label="Margen minorista" value={formatMoney(data.kpis.retailMargin)} />
        <KpiCard icon={<BriefcaseIcon className="size-4" />} label="Margen mayorista" value={formatMoney(data.kpis.wholesaleMargin)} />
        <KpiCard icon={<WrenchScrewdriverIcon className="size-4" />} label="Margen servicio tecnico" value={formatMoney(data.kpis.serviceMargin)} />
        <KpiCard icon={<DocumentChartBarIcon className="size-4" />} label="Margen bruto" value={data.kpis.grossMarginPct == null ? "Restringido" : `${data.kpis.grossMarginPct.toFixed(1)}%`} />
      </div>

      <div className="overflow-x-auto border-b border-base-300">
        <div role="tablist" className="flex min-w-max gap-4">
          {tabs.map((tab) => (
            <button key={tab} role="tab" aria-selected={activeTab === tab} className={cx("border-b-2 px-1 py-3 text-sm font-medium transition-colors", activeTab === tab ? "border-primary text-primary" : "border-transparent text-base-content/60 hover:text-base-content")} onClick={() => updateParam("tab", tab)}>
              {databaseTabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="input input-bordered input-sm flex items-center gap-2 sm:w-96">
          <MagnifyingGlassIcon className="size-4 text-base-content/50" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, equipo, IMEI..." className="grow" />
        </label>
        <div className="flex items-center gap-2 text-sm text-base-content/60">
          <CalendarDaysIcon className="size-4" />
          <span>{range.label} · {filteredRows.length} registros</span>
        </div>
      </div>

      <GenericTable rows={filteredRows} tab={activeTab} canSeeFinancials={canSeeFinancials} />
      <ExportDatabaseModal open={exportOpen} onClose={() => setExportOpen(false)} range={range} reporter={reporter} activeTab={activeTab} />
      {activeTab === "audit" ? (
        <div className="rounded-lg border border-base-300 bg-base-200/60 p-3 text-sm text-base-content/70">
          <ClipboardDocumentListIcon className="mr-1 inline size-4" />
          AuditLog es append-only: esta interfaz no expone acciones para editar o eliminar eventos.
        </div>
      ) : null}
    </div>
  )
}
