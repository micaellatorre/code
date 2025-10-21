"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import SearchBar from '@/components/SearchBar'

type SerializedSale = {
  id: string
  tenantId: string
  date: string | null
  customerName: string | null
  origin: string | null
  payment: string | null
  notes: string | null
  items?: any[]
  subtotal: string | null
  extraCosts: string | null
  total: string | null
  profit: string | null
  createdAt: string | null
}

export default function FilterableSalesTable({ initial }: { initial: SerializedSale[] }) {
  // Pending values (inputs) vs applied values (used to fetch/apply filters)
  const [pendingQuery, setPendingQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [items, setItems] = useState<SerializedSale[]>(initial)
  const [loading, setLoading] = useState(false)
  // Inline editing state: editing === id when the whole row is editable
  const [editing, setEditing] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<Record<string, { customerName?: string; total?: string; profit?: string; origin?: string; payment?: string; extraCosts?: string }>>({})
  const [savingRow, setSavingRow] = useState<Record<string, boolean>>({})
  // Filters requested: customer name (pendingQuery), date range, total range, profit range
  const [startDate, setStartDate] = useState<string>('') // yyyy-mm-dd (input)
  const [endDate, setEndDate] = useState<string>('') // yyyy-mm-dd (input)
  const [minTotal, setMinTotal] = useState<string>('')
  const [maxTotal, setMaxTotal] = useState<string>('')
  const [minProfit, setMinProfit] = useState<string>('')
  const [maxProfit, setMaxProfit] = useState<string>('')

  const [appliedFilters, setAppliedFilters] = useState<{
    query: string
    startDate: string
    endDate: string
    minTotal: string
    maxTotal: string
    minProfit: string
    maxProfit: string
  }>({
    query: '',
    startDate: '',
    endDate: '',
    minTotal: '',
    maxTotal: '',
    minProfit: '',
    maxProfit: '',
  })

  // Fetch from server when the appliedQuery changes (i.e. when user clicks GO)
  useEffect(() => {
    let mounted = true
    const handle = setTimeout(async () => {
      setLoading(true)
      try {
        const url = new URL('/api/sales/search', location.origin)
        if (appliedQuery) url.searchParams.set('q', appliedQuery)
        const r = await fetch(url.toString())
        const body = await r.json()
        if (mounted) setItems(body.results)
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) setLoading(false)
      }
    }, 300)
    return () => {
      mounted = false
      clearTimeout(handle)
    }
  }, [appliedQuery])

  // Argentina locale formatter: DD/MM/YYYY HH:mm:ss in America/Argentina/Buenos_Aires
  // Keep this component client-only so formatting happens consistently in the browser
  const formatArgentina = (iso: string | null) => {
    if (!iso) return '-'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '-'
    try {
      // Use toLocaleString with es-AR and explicit timeZone. hour12:false gives 24h format.
      return d.toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    } catch (e) {
      // Fallback: manual UTC-based formatting but in DD/MM/YYYY
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      const hh = String(d.getUTCHours()).padStart(2, '0')
      const mm = String(d.getUTCMinutes()).padStart(2, '0')
      const ss = String(d.getUTCSeconds()).padStart(2, '0')
      return `${day}/${m}/${y} ${hh}:${mm}:${ss}`
    }
  }

  // Apply client-side filters on top of fetched items
  const displayed = useMemo(() => {
    return items.filter((s) => {
      const q = (appliedFilters.query ?? '').trim().toLowerCase()
      if (q) {
        const name = (s.customerName ?? '').toLowerCase()
        const id = s.id.toLowerCase()
        if (!name.includes(q) && !id.includes(q)) return false
      }

      // Date range filter (applied)
      if (appliedFilters.startDate || appliedFilters.endDate) {
        if (!s.date) return false
        const t = new Date(s.date).getTime()
        if (appliedFilters.startDate) {
          const sd = new Date(appliedFilters.startDate + 'T00:00:00Z').getTime()
          if (t < sd) return false
        }
        if (appliedFilters.endDate) {
          const ed = new Date(appliedFilters.endDate + 'T23:59:59.999Z').getTime()
          if (t > ed) return false
        }
      }

      // Total range (applied)
      if (appliedFilters.minTotal) {
        const val = s.total ? parseFloat(s.total) : NaN
        if (Number.isFinite(val)) {
          if (val < parseFloat(appliedFilters.minTotal)) return false
        } else return false
      }
      if (appliedFilters.maxTotal) {
        const val = s.total ? parseFloat(s.total) : NaN
        if (Number.isFinite(val)) {
          if (val > parseFloat(appliedFilters.maxTotal)) return false
        } else return false
      }

      // Profit range (applied)
      if (appliedFilters.minProfit) {
        const val = s.profit ? parseFloat(s.profit) : NaN
        if (Number.isFinite(val)) {
          if (val < parseFloat(appliedFilters.minProfit)) return false
        } else return false
      }
      if (appliedFilters.maxProfit) {
        const val = s.profit ? parseFloat(s.profit) : NaN
        if (Number.isFinite(val)) {
          if (val > parseFloat(appliedFilters.maxProfit)) return false
        } else return false
      }

      return true
    })
  }, [items, appliedFilters])

  const beginEdit = (id: string) => {
    setEditing(id)
    setEditingValues((prev) => ({
      ...prev,
      [id]: {
        customerName: prev[id]?.customerName ?? items.find((x) => x.id === id)?.customerName ?? '',
        total: prev[id]?.total ?? items.find((x) => x.id === id)?.total ?? '',
        profit: prev[id]?.profit ?? items.find((x) => x.id === id)?.profit ?? '',
        origin: prev[id]?.origin ?? items.find((x) => x.id === id)?.origin ?? '',
        payment: prev[id]?.payment ?? items.find((x) => x.id === id)?.payment ?? '',
        extraCosts: prev[id]?.extraCosts ?? items.find((x) => x.id === id)?.extraCosts ?? '',
      },
    }))
  }

  const cancelEdit = (id?: string) => {
    if (id) setEditingValues((p) => {
      const copy = { ...p }
      delete copy[id]
      return copy
    })
    setEditing(null)
  }

  const saveEdit = async (id: string) => {
    const vals = editingValues[id]
    if (!vals) {
      setEditing(null)
      return
    }

    const payload: any = {}
    // We always send the three fields (server should handle partial updates)
    payload.customerName = vals.customerName ?? null

    const parsedTotal = vals.total != null && vals.total !== '' ? parseFloat(vals.total) : null
    if (parsedTotal != null && !Number.isFinite(parsedTotal)) {
      alert('Valor de Total inválido')
      return
    }
    payload.total = parsedTotal

    const parsedProfit = vals.profit != null && vals.profit !== '' ? parseFloat(vals.profit) : null
    if (parsedProfit != null && !Number.isFinite(parsedProfit)) {
      alert('Valor de Ganancia inválido')
      return
    }
    payload.profit = parsedProfit

    // include origin/payment/extraCosts
    payload.origin = vals.origin ?? null
    payload.payment = vals.payment ?? null
    const parsedExtra = vals.extraCosts != null && vals.extraCosts !== '' ? parseFloat(vals.extraCosts) : null
    if (parsedExtra != null && !Number.isFinite(parsedExtra)) {
      alert('Valor de Extra inválido')
      return
    }
    payload.extraCosts = parsedExtra

    // Optimistic update locally
    setSavingRow((s) => ({ ...s, [id]: true }))
    const prevItems = items
  setItems((it) => it.map((r) => (r.id === id ? { ...r, customerName: payload.customerName ?? null, total: payload.total == null ? null : String(payload.total), profit: payload.profit == null ? null : String(payload.profit), origin: payload.origin ?? null, payment: payload.payment ?? null, extraCosts: payload.extraCosts == null ? null : String(payload.extraCosts) } : r)))

    try {
      const res = await fetch(`/api/sales/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      const body = await res.json()
      if (body && body.sale) {
        setItems((it) => it.map((r) => (r.id === id ? { ...r, ...body.sale } : r)))
      }
    } catch (err) {
      console.error('Save failed', err)
      alert('No se pudo guardar. Revirtiendo cambios.')
      setItems(prevItems)
    } finally {
      setSavingRow((s) => ({ ...s, [id]: false }))
      setEditing(null)
    }
  }

  const onKeyDownInput = (e: React.KeyboardEvent<any>, id: string) => {
    if (e.key === 'Enter') saveEdit(id)
    if (e.key === 'Escape') cancelEdit(id)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 w-full">
          <SearchBar placeholder="Buscar ventas por cliente, id o fecha..." onSearch={setPendingQuery} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                // Apply pending filters and trigger fetch
                setAppliedFilters({
                  query: pendingQuery,
                  startDate,
                  endDate,
                  minTotal,
                  maxTotal,
                  minProfit,
                  maxProfit,
                })
                setAppliedQuery(pendingQuery)
              }}
            >
              GO
            </button>
            <div className="text-sm text-muted">
              {loading ? 'Buscando...' : `${displayed.length} resultados`}
            </div>
          </div>
        </div>
        {loading && <div className="text-sm text-muted">Buscando...</div>}
      </div>
      {/* Filters: date range and numeric ranges */}
      <div className="flex flex-wrap gap-2">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Desde (fecha)</span>
          </label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input input-bordered" />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">Hasta (fecha)</span>
          </label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input input-bordered" />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Total Min</span></label>
          <input type="number" step="0.01" value={minTotal} onChange={(e) => setMinTotal(e.target.value)} className="input input-bordered" />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Total Max</span></label>
          <input type="number" step="0.01" value={maxTotal} onChange={(e) => setMaxTotal(e.target.value)} className="input input-bordered" />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Gcia. Min</span></label>
          <input type="number" step="0.01" value={minProfit} onChange={(e) => setMinProfit(e.target.value)} className="input input-bordered" />
        </div>
        <div className="form-control">
          <label className="label"><span className="label-text">Gcia. Max</span></label>
          <input type="number" step="0.01" value={maxProfit} onChange={(e) => setMaxProfit(e.target.value)} className="input input-bordered" />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              // Clear both pending inputs and applied filters
              setStartDate('')
              setEndDate('')
              setMinTotal('')
              setMaxTotal('')
              setMinProfit('')
              setMaxProfit('')
              setPendingQuery('')
              setAppliedQuery('')
              setAppliedFilters({ query: '', startDate: '', endDate: '', minTotal: '', maxTotal: '', minProfit: '', maxProfit: '' })
            }}
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Origen</th>
              <th>Pago</th>
              <th>Extra (USD)</th>
              <th>Total (USD)</th>
              <th>Ganancia (USD)</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((s) => (
              <tr key={s.id}>
                <td>{formatArgentina(s.date)}</td>
                <td>
                  {editing === s.id ? (
                    <input
                      className="input input-sm input-bordered w-full"
                      value={editingValues[s.id]?.customerName ?? ''}
                      onChange={(e) => setEditingValues((p) => ({ ...p, [s.id]: { ...(p[s.id] ?? {}), customerName: e.target.value } }))}
                      onKeyDown={(e) => onKeyDownInput(e as any, s.id)}
                      autoFocus
                    />
                  ) : (
                    <span>{s.customerName ?? '-'}</span>
                  )}
                </td>
                <td>
                  {editing === s.id ? (
                    <input className="input input-sm input-bordered w-32" value={editingValues[s.id]?.origin ?? ''} onChange={(e) => setEditingValues((p) => ({ ...p, [s.id]: { ...(p[s.id] ?? {}), origin: e.target.value } }))} onKeyDown={(e) => onKeyDownInput(e, s.id)} />
                  ) : (
                    <span>{s.origin ?? '-'}</span>
                  )}
                </td>
                <td>
                  {editing === s.id ? (
                    <select className="select select-sm" value={editingValues[s.id]?.payment ?? ''} onChange={(e) => setEditingValues((p) => ({ ...p, [s.id]: { ...(p[s.id] ?? {}), payment: e.target.value } }))} onKeyDown={(e) => onKeyDownInput(e, s.id)}>
                      <option value="">-</option>
                      <option value="EFECTIVO_PESOS">EFECTIVO_PESOS</option>
                      <option value="EFECTIVO_USD">EFECTIVO_USD</option>
                      <option value="TRANSFERENCIA_ARS">TRANSFERENCIA_ARS</option>
                      <option value="TRANSFERENCIA_USD">TRANSFERENCIA_USD</option>
                      <option value="TARJETA">TARJETA</option>
                      <option value="USDT">USDT</option>
                    </select>
                  ) : (
                    <span>{s.payment ?? '-'}</span>
                  )}
                </td>
                <td>
                  {editing === s.id ? (
                    <input className="input input-sm input-bordered w-24" value={editingValues[s.id]?.extraCosts ?? ''} onChange={(e) => setEditingValues((p) => ({ ...p, [s.id]: { ...(p[s.id] ?? {}), extraCosts: e.target.value } }))} onKeyDown={(e) => onKeyDownInput(e, s.id)} />
                  ) : (
                    <span>$ {s.extraCosts ? Number(s.extraCosts).toFixed(2) : '-'}</span>
                  )}
                </td>
                <td>
                  {editing === s.id ? (
                    <input
                      className="input input-sm input-bordered w-32"
                      value={editingValues[s.id]?.total ?? ''}
                      onChange={(e) => setEditingValues((p) => ({ ...p, [s.id]: { ...(p[s.id] ?? {}), total: e.target.value } }))}
                      onKeyDown={(e) => onKeyDownInput(e as any, s.id)}
                    />
                  ) : (
                    <span>$ {s.total ? Number(s.total).toFixed(2) : '-'}</span>
                  )}
                </td>
                <td>
                  {editing === s.id ? (
                    <input
                      className="input input-sm input-bordered w-32"
                      value={editingValues[s.id]?.profit ?? ''}
                      onChange={(e) => setEditingValues((p) => ({ ...p, [s.id]: { ...(p[s.id] ?? {}), profit: e.target.value } }))}
                      onKeyDown={(e) => onKeyDownInput(e as any, s.id)}
                    />
                  ) : (
                    <span>$ {s.profit ? Number(s.profit).toFixed(2) : '-'}</span>
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <Link href={`/sales/${s.id}`} className="btn btn-sm btn-outline">
                      Ver
                    </Link>
                    {savingRow[s.id] ? (
                      <span className="text-sm text-muted">Guardando ...</span>
                    ) : editing === s.id ? (
                      <>
                        <button className="btn btn-sm btn-primary" onClick={() => saveEdit(s.id)}>
                          Guardar
                        </button>
                        <button className="btn btn-sm" onClick={() => cancelEdit(s.id)}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-sm btn-ghost" onClick={() => beginEdit(s.id)}>
                          Editar
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
