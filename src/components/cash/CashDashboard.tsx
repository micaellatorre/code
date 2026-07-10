"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDownTrayIcon,
  ArrowsRightLeftIcon,
  ArrowPathRoundedSquareIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  ScaleIcon,
  TrashIcon,
  WalletIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import BranchContextSwitcher from "@/components/branches/BranchContextSwitcher"

type CashDashboardData = any

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function formatDateInput(date?: string | null) {
  if (!date) return new Date().toISOString().slice(0, 10)
  return date.slice(0, 10)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}

function formatCashAmount(amount: number | null | undefined, currency: string, direction?: string | null) {
  if (amount == null) return "-"
  const value = Math.abs(amount)
  const sign = direction === "INCOME" ? "+ " : direction === "EXPENSE" ? "- " : amount < 0 ? "- " : ""
  if (currency === "ARS") return `${sign}$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value)}`
  if (currency === "USDT") return `${sign}USDT ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}`
  return `${sign}u$d ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}`
}

function accountIcon(type: string, currency: string) {
  if (currency === "USDT" || type === "CRYPTO" || type === "DIGITAL_WALLET") return WalletIcon
  if (type === "BANK") return BuildingLibraryIcon
  return BanknotesIcon
}

function AccountCard({ account, dolarBlue }: { account: any; dolarBlue: number | null }) {
  const Icon = accountIcon(account.type, account.currency)
  const negative = Number(account.balance ?? 0) < 0
  return (
    <article className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{account.name}</p>
          <p className="mt-1 text-xs text-base-content/55">{account.scopeLabel}</p>
        </div>
        <span className={cx("grid size-9 shrink-0 place-items-center rounded-md bg-base-200", negative ? "text-error" : "text-primary")}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className={cx("mt-5 text-2xl font-bold tabular-nums", negative ? "text-error" : "text-base-content")}>
        {formatCashAmount(account.balance, account.currency)}
      </p>
      {dolarBlue && account.currency === "ARS" ? (
        <p className="mt-2 text-xs text-base-content/55">Referencia: $ {new Intl.NumberFormat("es-AR").format(dolarBlue)} Blue</p>
      ) : null}
    </article>
  )
}

function SummaryCard({ label, value, direction }: { label: string; value: number; direction?: "INCOME" | "EXPENSE" }) {
  const negative = value < 0 || direction === "EXPENSE"
  return (
    <article className="rounded-lg border border-base-300 bg-base-100 p-4">
      <p className="text-xs font-semibold uppercase text-base-content/50">{label}</p>
      <p className={cx("mt-3 text-2xl font-bold tabular-nums", negative ? "text-error" : "text-primary")}>
        {formatCashAmount(Math.abs(value), "USD", direction ?? (value < 0 ? "EXPENSE" : "INCOME"))}
      </p>
    </article>
  )
}

function DirectionBadge({ direction }: { direction: string }) {
  return (
    <span className={cx("badge badge-sm", direction === "INCOME" ? "badge-success" : "badge-error")}>
      {direction === "INCOME" ? "Ingreso" : "Egreso"}
    </span>
  )
}

function MovementsTable({ rows, isAdmin, onReverse }: { rows: any[]; isAdmin: boolean; onReverse: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
      <table className="table table-sm w-full">
        <thead>
          <tr>
            <th>Hora</th>
            <th>Tipo</th>
            <th>Detalle</th>
            <th>Caja</th>
            <th>Monto</th>
            <th>Eqv USD</th>
            {isAdmin ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap">{formatDateTime(row.occurredAt)}</td>
              <td><DirectionBadge direction={row.direction} /></td>
              <td>
                <div className="font-medium">{row.detail}</div>
                <div className="text-xs text-base-content/50">{row.categoryLabel} - {row.branch?.name ?? "-"}</div>
              </td>
              <td>{row.account?.name ?? "-"}</td>
              <td className="font-semibold tabular-nums">{formatCashAmount(row.amount, row.currency, row.direction)}</td>
              <td className="tabular-nums">{row.amountUsd == null ? "-" : formatCashAmount(row.amountUsd, "USD", row.direction)}</td>
              {isAdmin ? (
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <button type="button" className="btn btn-ghost btn-xs btn-square" title={row.sourceType === "MANUAL" ? "Corregir desde Caja: genera reversa y reemplazo" : "Editar desde la operacion de origen"} aria-label="Editar movimiento" disabled>
                      <PencilIcon className="size-4" />
                    </button>
                    {row.sourceType === "MANUAL" && !["TRANSFER", "CONVERSION", "REVERSAL"].includes(row.category) ? (
                      <Link className="btn btn-ghost btn-xs btn-square" title="Duplicar como nuevo movimiento manual" aria-label="Duplicar movimiento" href={`/dashboard/cash/new?accountId=${row.account?.id ?? ""}&direction=${row.direction}&category=${row.category}&detail=${encodeURIComponent(row.detail ?? "")}&amount=${row.amount ?? ""}&currency=${row.currency}&exchangeRate=${row.exchangeRate ?? ""}`}>
                        <DocumentDuplicateIcon className="size-4" />
                      </Link>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-xs btn-square" title="No se puede duplicar un movimiento automatico" aria-label="Duplicar movimiento" disabled>
                        <DocumentDuplicateIcon className="size-4" />
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-xs btn-square" title="Cambiar caja desde la operacion de origen" aria-label="Cambiar caja del movimiento" disabled>
                      <ArrowsRightLeftIcon className="size-4" />
                    </button>
                    {row.category !== "REVERSAL" && !row.reversedBy ? (
                      <button type="button" className="btn btn-ghost btn-xs btn-square text-error" title="Anular con contraasiento" aria-label="Eliminar movimiento" onClick={() => onReverse(row.id)}>
                        <TrashIcon className="size-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          )) : (
            <tr>
              <td colSpan={isAdmin ? 7 : 6} className="py-10 text-center">
                <p className="font-medium">Sin movimientos</p>
                <p className="text-sm text-base-content/60">No hay movimientos registrados para los filtros seleccionados.</p>
                {isAdmin ? <Link href="/dashboard/cash/new" className="btn btn-primary btn-sm mt-3"><PlusIcon className="size-4" />Nuevo movimiento</Link> : null}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function FxReport({ open }: { open: boolean }) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetch("/api/cash/fx-report", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : response.json().then((payload) => Promise.reject(new Error(payload?.error ?? "No se pudo cargar el informe"))))
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar el informe"))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null
  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Informe cambiario</h2>
          <p className="text-sm text-base-content/60">Conversiones ARS a USD con resultado historico.</p>
        </div>
        <ScaleIcon className="size-6 text-primary" />
      </div>
      {loading ? <div className="mt-4 h-20 animate-pulse rounded bg-base-200" /> : null}
      {error ? <div className="alert alert-error mt-4 text-sm">{error}</div> : null}
      {!loading && report ? (
        <div className="mt-4 space-y-4">
          {report.warnings?.map((warning: string) => <div key={warning} className="alert alert-warning text-sm">{warning}</div>)}
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label="Conversiones" value={report.summary.conversions ?? 0} />
            <SummaryCard label="Teorico USD" value={report.summary.totalTheoreticalUsd ?? 0} />
            <SummaryCard label="Real USD" value={report.summary.totalRealUsd ?? 0} />
            <SummaryCard label="Resultado FX" value={report.summary.totalFxResultUsd ?? 0} />
          </div>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead><tr><th>Fecha</th><th>Origen</th><th>Destino</th><th>TC aplicado</th><th>Benchmark</th><th>Resultado</th></tr></thead>
              <tbody>
                {report.rows?.length ? report.rows.map((row: any) => (
                  <tr key={row.transferId}>
                    <td>{formatDateTime(row.occurredAt)}</td>
                    <td>{row.fromAccount}</td>
                    <td>{row.toAccount}</td>
                    <td>{row.exchangeRate ?? "-"}</td>
                    <td>{row.benchmarkExchangeRate ?? "-"}</td>
                    <td className={cx("font-semibold tabular-nums", Number(row.fxResultUsd ?? 0) < 0 ? "text-error" : "text-primary")}>{formatCashAmount(row.fxResultUsd, "USD")}</td>
                  </tr>
                )) : <tr><td colSpan={6} className="py-6 text-center text-base-content/60">Sin conversiones</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ConversionModal({
  open,
  accounts,
  onClose,
  onSuccess,
  onError,
}: {
  open: boolean
  accounts: any[]
  onClose: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({ fromAccountId: "", toAccountId: "", fromAmount: "", exchangeRate: "", detail: "" })
  const fromAccount = accounts.find((account) => account.id === form.fromAccountId)
  const toAccount = accounts.find((account) => account.id === form.toAccountId)
  const fromAmount = Number(form.fromAmount)
  const exchangeRate = Number(form.exchangeRate)
  const previewAmount = useMemo(() => {
    if (!fromAccount || !toAccount || !Number.isFinite(fromAmount) || fromAmount <= 0 || !Number.isFinite(exchangeRate) || exchangeRate <= 0) return null
    if (fromAccount.currency === "ARS" && (toAccount.currency === "USD" || toAccount.currency === "USDT")) return fromAmount / exchangeRate
    if ((fromAccount.currency === "USD" || fromAccount.currency === "USDT") && toAccount.currency === "ARS") return fromAmount * exchangeRate
    return null
  }, [exchangeRate, fromAccount, fromAmount, toAccount])
  const isCompatible = Boolean(previewAmount)

  if (!open) return null

  function currencyTone(currency?: string) {
    if (currency === "ARS") return { icon: "bg-warning text-warning-content", border: "border-warning/40", text: "text-warning" }
    if (currency === "USD") return { icon: "bg-success text-success-content", border: "border-success/40", text: "text-success" }
    if (currency === "USDT") return { icon: "bg-emerald-500 text-white", border: "border-emerald-500/40", text: "text-emerald-600" }
    return { icon: "bg-base-300 text-base-content", border: "border-base-300", text: "text-base-content/50" }
  }

  function accountLabel(account: any) {
    if (!account) return "Seleccionar caja"
    return `${account.name} ${account.currency}`
  }

  function previewText() {
    if (previewAmount == null || !toAccount) return "0.00"
    return formatCashAmount(previewAmount, toAccount.currency)
  }

  function swapAccounts() {
    setForm((prev) => ({
      ...prev,
      fromAccountId: prev.toAccountId,
      toAccountId: prev.fromAccountId,
      fromAmount: previewAmount == null ? prev.fromAmount : String(Number(previewAmount.toFixed(2))),
    }))
  }

  function close() {
    if (isSaving) return
    setForm({ fromAccountId: "", toAccountId: "", fromAmount: "", exchangeRate: "", detail: "" })
    onClose()
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!isCompatible) {
      onError("La conversion debe cambiar entre ARS y USD/USDT.")
      return
    }
    setIsSaving(true)
    const response = await fetch("/api/cash-transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "CONVERSION",
        fromAccountId: form.fromAccountId,
        toAccountId: form.toAccountId,
        fromAmount: form.fromAmount,
        exchangeRate: form.exchangeRate,
        detail: form.detail || null,
      }),
    })
    const payload = await response.json().catch(() => null)
    setIsSaving(false)
    if (!response.ok) {
      onError(payload?.error ?? "No se pudo registrar la conversion")
      return
    }
    onSuccess("Conversion registrada correctamente.")
    close()
  }

  return (
    <dialog className="modal modal-open">
      <form onSubmit={submit} className="modal-box max-w-2xl rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Conversion de moneda</h2>
            <p className="mt-1 text-sm text-base-content/60">Operacion atomica entre cajas con tipo de cambio historico.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={close} aria-label="Cerrar">
            <XMarkIcon className="size-5" />
          </button>
        </div>

        <div className="relative mt-5 space-y-2 rounded-lg border border-base-300 bg-base-200/40 p-3">
          <section className={cx("rounded-lg border bg-base-100 p-3 transition-colors", fromAccount ? "border-primary/60 ring-1 ring-primary/20" : "border-base-300")}>
            <p className="text-[11px] font-bold uppercase text-base-content/45">Entregas</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cx("grid size-9 shrink-0 place-items-center rounded-md", currencyTone(fromAccount?.currency).icon)}>
                  <WalletIcon className="size-5" />
                </span>
                <select required className={cx("select select-bordered select-sm min-w-0 flex-1 font-semibold", fromAccount ? currencyTone(fromAccount.currency).border : "border-base-300")} value={form.fromAccountId} onChange={(event) => setForm((prev) => ({ ...prev, fromAccountId: event.target.value }))}>
                  <option value="">{accountLabel(null)}</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>)}
                </select>
              </div>
              <input required type="number" step="0.01" min="0.01" className="input input-bordered input-sm text-right text-xl font-bold tabular-nums focus:border-primary" placeholder="0.00" value={form.fromAmount} onChange={(event) => setForm((prev) => ({ ...prev, fromAmount: event.target.value }))} />
            </div>
          </section>

          <div className="relative z-10 flex justify-center">
            <button type="button" className="btn btn-neutral btn-sm btn-square -my-1 shadow" onClick={swapAccounts} disabled={!form.fromAccountId && !form.toAccountId} aria-label="Invertir conversion" title="Invertir conversion">
              <ArrowPathRoundedSquareIcon className="size-4" />
            </button>
          </div>

          <section className={cx("rounded-lg border bg-base-100 p-3 transition-colors", toAccount ? currencyTone(toAccount.currency).border : "border-base-300")}>
            <p className="text-[11px] font-bold uppercase text-base-content/45">Recibis</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cx("grid size-9 shrink-0 place-items-center rounded-md", currencyTone(toAccount?.currency).icon)}>
                  <CurrencyDollarIcon className="size-5" />
                </span>
                <select required className={cx("select select-bordered select-sm min-w-0 flex-1 font-semibold", toAccount ? currencyTone(toAccount.currency).border : "border-base-300")} value={form.toAccountId} onChange={(event) => setForm((prev) => ({ ...prev, toAccountId: event.target.value }))}>
                  <option value="">{accountLabel(null)}</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>)}
                </select>
              </div>
              <div className={cx("min-h-10 rounded-md border border-base-300 bg-base-200 px-3 py-2 text-right text-xl font-bold tabular-nums", isCompatible ? currencyTone(toAccount?.currency).text : "text-base-content/20")}>
                {previewText()}
              </div>
            </div>
          </section>
        </div>

        <label className="form-control mt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="label-text text-xs font-semibold">Cotizacion (1 USD equivale a)</span>
            <div className="join">
              <input required type="number" step="0.01" min="0.01" className="input input-bordered input-sm join-item w-36 text-right font-bold tabular-nums" value={form.exchangeRate} onChange={(event) => setForm((prev) => ({ ...prev, exchangeRate: event.target.value }))} />
              <span className="join-item grid place-items-center rounded-r-md border border-l-0 border-base-300 bg-base-200 px-3 text-xs font-bold text-base-content/60">ARS</span>
            </div>
          </div>
        </label>

        {isCompatible ? (
          <div className="mt-4 rounded-lg border border-base-300 bg-base-200/60 p-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-base-content/60">Entregas</span><span className="font-bold tabular-nums text-error">-{formatCashAmount(fromAmount, fromAccount.currency)}</span></div>
            <div className="mt-2 flex justify-between gap-3"><span className="text-base-content/60">Recibis</span><span className={cx("font-bold tabular-nums", currencyTone(toAccount.currency).text)}>+{formatCashAmount(previewAmount, toAccount.currency)}</span></div>
            <div className="mt-2 flex justify-between gap-3 border-t border-base-300 pt-2"><span className="text-base-content/60">Tipo de cambio aplicado</span><span className="font-bold tabular-nums">{new Intl.NumberFormat("es-AR").format(exchangeRate)} ARS</span></div>
          </div>
        ) : fromAccount && toAccount ? (
          <div className="alert alert-warning mt-4 text-sm">Selecciona una conversion entre ARS y USD/USDT.</div>
        ) : null}

        <label className="form-control mt-4">
          <span className="sr-only">Detalle de la conversion</span>
          <input className="input input-bordered" placeholder="Detalle de la conversion (Opcional)" value={form.detail} onChange={(event) => setForm((prev) => ({ ...prev, detail: event.target.value }))} />
        </label>

        <div className="modal-action">
          <button className="btn btn-primary min-w-44" disabled={isSaving || !isCompatible}><CheckCircleIcon className="size-4" />{isSaving ? "Registrando..." : "Confirmar conversion"}</button>
          <button type="button" className="btn btn-outline min-w-32" onClick={close} disabled={isSaving}>Cancelar</button>
        </div>
      </form>
    </dialog>
  )
}

export default function CashDashboard({ data, isAdmin }: { data: CashDashboardData; isAdmin: boolean }) {
  const router = useRouter()
  const [fxOpen, setFxOpen] = useState(false)
  const [conversionOpen, setConversionOpen] = useState(false)
  const [rows, setRows] = useState<any[]>(data.recentMovements ?? [])
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const businessDate = formatDateInput(data.todaySummary?.businessDate)
  const [filters, setFilters] = useState({ search: "", from: businessDate, to: businessDate, accountId: "", direction: "" })
  const [exportFilters, setExportFilters] = useState({ from: businessDate, to: businessDate, accountId: "", direction: "" })
  const [dolarBlue, setDolarBlue] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/dolar", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const blue = payload?.data?.panel?.find((item: any) => String(item.titulo).toLowerCase().includes("blue"))
        setDolarBlue(blue?.venta ?? null)
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    if (data.blocked) return
    const controller = new AbortController()
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    setLoadingRows(true)
    fetch(`/api/cash-movements?${params.toString()}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() : response.json().then((payload) => Promise.reject(new Error(payload?.error ?? "No se pudieron cargar los movimientos"))))
      .then((payload) => setRows(payload.items ?? []))
      .catch((err) => {
        if (err.name !== "AbortError") setError(err instanceof Error ? err.message : "No se pudieron cargar los movimientos")
      })
      .finally(() => setLoadingRows(false))
    return () => controller.abort()
  }, [filters, data.blocked])

  const accounts = data.accounts ?? []
  const summary = data.todaySummary ?? { incomeUsd: 0, expenseUsd: 0, netUsd: 0, unconvertedMovementCount: 0 }
  const currentBranchName = data.branch?.name ?? "-"

  const directionOptions = useMemo(() => [
    { label: "Todo", value: "" },
    { label: "Ingresos", value: "INCOME" },
    { label: "Egresos", value: "EXPENSE" },
  ], [])

  async function closeDay() {
    setError(null)
    setSuccess(null)
    const response = await fetch("/api/cash/daily-close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessDate }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setError(payload?.error ?? "No se pudo cerrar la caja")
      return
    }
    setSuccess("Caja diaria cerrada.")
    router.refresh()
  }

  async function reverseMovement(id: string) {
    if (!window.confirm("Anular este movimiento? El asiento original se conservara y se generara una reversa.")) return
    setError(null)
    setSuccess(null)
    const response = await fetch(`/api/cash-movements/${id}/reverse`, { method: "POST" })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setError(payload?.error ?? "No se pudo revertir el movimiento")
      return
    }
    setSuccess("Movimiento revertido.")
    router.refresh()
  }

  async function exportPdf() {
    setError(null)
    const response = await fetch("/api/cash/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...exportFilters, accountId: exportFilters.accountId || null, direction: exportFilters.direction || null }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "No se pudo generar el reporte")
      return
    }
    const html = await response.text()
    const popup = window.open("", "_blank")
    popup?.document.write(html)
    popup?.document.close()
    popup?.print()
    setSuccess("Reporte generado.")
  }

  if (data.blocked) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-5">
        <h1 className="text-2xl font-bold">Selecciona una sucursal</h1>
        <p className="mt-1 text-sm text-base-content/70">Necesitas una sucursal actual para consultar y operar la caja.</p>
        <div className="mt-4"><BranchContextSwitcher /></div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Caja</h1>
          <p className="text-sm text-base-content/60">Saldos, flujo diario y movimientos por cuenta.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="badge badge-ghost">Sucursal actual: {currentBranchName}</span>
            <BranchContextSwitcher />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setFxOpen((value) => !value)}>
            <ChartBarIcon className="size-4" />
            {fxOpen ? "Ocultar informe" : "Informe cambiario"}
          </button>
          {isAdmin ? <button type="button" className="btn btn-outline btn-sm" onClick={() => setConversionOpen(true)}><ArrowPathRoundedSquareIcon className="size-4" />Conversion</button> : null}
          {isAdmin ? <Link href="/dashboard/cash/new" className="btn btn-primary btn-sm"><PlusIcon className="size-4" />Nuevo movimiento</Link> : null}
        </div>
      </header>

      {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      {success ? <div className="alert alert-success text-sm">{success}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {accounts.length ? accounts.map((account: any) => <AccountCard key={account.id} account={account} dolarBlue={dolarBlue} />) : (
          <div className="rounded-lg border border-base-300 bg-base-100 p-5 sm:col-span-2 xl:col-span-4">
            <p className="font-semibold">Sin cajas configuradas</p>
            <p className="mt-1 text-sm text-base-content/60">Configura las cuentas financieras que utiliza esta sucursal o tenant.</p>
            {isAdmin ? <Link href="/dashboard/cash/accounts" className="btn btn-primary btn-sm mt-3">Configurar cajas</Link> : null}
          </div>
        )}
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase text-base-content/50">Resumen de hoy - USD equivalente</p>
        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard label="Ingresos" value={summary.incomeUsd ?? 0} direction="INCOME" />
          <SummaryCard label="Egresos" value={summary.expenseUsd ?? 0} direction="EXPENSE" />
          <SummaryCard label="Flujo neto" value={summary.netUsd ?? 0} />
        </div>
        {summary.unconvertedMovementCount ? (
          <div className="alert alert-warning mt-3 text-sm">{summary.unconvertedMovementCount} movimientos ARS no poseen equivalencia USD historica.</div>
        ) : null}
      </section>

      <FxReport open={fxOpen} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="space-y-3">
          <section className="rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Movimientos</h2>
                <p className="text-sm text-base-content/60">{loadingRows ? "Actualizando..." : `${rows.length} registros`}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {directionOptions.map((option) => (
                  <button key={option.value} type="button" className={cx("btn btn-sm", filters.direction === option.value ? "btn-primary" : "btn-outline")} onClick={() => setFilters((prev) => ({ ...prev, direction: option.value }))}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_150px_150px_190px]">
              <label className="input input-bordered input-sm flex items-center gap-2">
                <MagnifyingGlassIcon className="size-4 text-base-content/50" />
                <input value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder="Buscar por detalle" className="grow" />
              </label>
              <input type="date" className="input input-bordered input-sm" value={filters.from} onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))} />
              <input type="date" className="input input-bordered input-sm" value={filters.to} onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))} />
              <select className="select select-bordered select-sm" value={filters.accountId} onChange={(event) => setFilters((prev) => ({ ...prev, accountId: event.target.value }))}>
                <option value="">Todas las cajas</option>
                {accounts.map((account: any) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>
          </section>
          <MovementsTable rows={rows} isAdmin={isAdmin} onReverse={reverseMovement} />
        </main>

        <aside className="space-y-4">
          <section className="rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Cierre caja</h2>
                <p className="text-sm text-base-content/60">{businessDate}</p>
              </div>
              {data.dailyClose ? <CheckCircleIcon className="size-6 text-success" /> : <ClockIcon className="size-6 text-warning" />}
            </div>
            {data.dailyClose ? (
              <div className="mt-4 rounded-lg bg-base-200 p-3 text-sm">
                <p className="font-medium">Caja cerrada</p>
                <p className="text-base-content/60">{formatDateTime(data.dailyClose.closedAt)}</p>
                <p className="text-base-content/60">Por {data.dailyClose.closedBy?.name ?? data.dailyClose.closedBy?.email ?? "-"}</p>
              </div>
            ) : (
              <button type="button" className="btn btn-primary btn-sm mt-4 w-full" onClick={closeDay} disabled={!isAdmin}>
                Cerrar caja diaria
              </button>
            )}
          </section>

          <section className="rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Exportar movimientos</h2>
              <ArrowDownTrayIcon className="size-5 text-primary" />
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold uppercase text-base-content/50">Periodo</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="input input-bordered input-sm" value={exportFilters.from} onChange={(event) => setExportFilters((prev) => ({ ...prev, from: event.target.value }))} />
                <input type="date" className="input input-bordered input-sm" value={exportFilters.to} onChange={(event) => setExportFilters((prev) => ({ ...prev, to: event.target.value }))} />
              </div>
              <select className="select select-bordered select-sm w-full" value={exportFilters.accountId} onChange={(event) => setExportFilters((prev) => ({ ...prev, accountId: event.target.value }))}>
                <option value="">Todas las cajas</option>
                {accounts.map((account: any) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-1">
                {directionOptions.map((option) => (
                  <button key={option.value} type="button" className={cx("btn btn-xs", exportFilters.direction === option.value ? "btn-primary" : "btn-outline")} onClick={() => setExportFilters((prev) => ({ ...prev, direction: option.value }))}>
                    {option.label}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-outline btn-sm w-full" onClick={exportPdf}>Descargar PDF</button>
            </div>
          </section>
        </aside>
      </div>
      <ConversionModal
        open={conversionOpen}
        accounts={accounts}
        onClose={() => setConversionOpen(false)}
        onError={setError}
        onSuccess={(message) => {
          setSuccess(message)
          router.refresh()
        }}
      />
    </div>
  )
}
