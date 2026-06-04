// code\src\components\trade-in\BatteryRangesManager.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import type { TradeInBatteryRangeDto } from "./types"

type Draft = TradeInBatteryRangeDto

type ValidationResult = {
  message: string
  blocking: boolean
} | null

const TEMP_ID_PREFIX = "new-"

function sortRanges(a: Draft, b: Draft) {
  return a.sortOrder - b.sortOrder || a.minPct - b.minPct || a.maxPct - b.maxPct
}

function buildRangeLabel(minPct: number, maxPct: number) {
  return `${minPct} - ${maxPct}`
}

function clampPct(value: number) {
  if (Number.isNaN(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function parseInputNumber(value: string, fallback = 0) {
  if (value.trim() === "") return fallback
  const parsed = Number(value)
  return Number.isNaN(parsed) ? fallback : parsed
}

function getRangeColor(index: number, total: number) {
  if (total <= 1) {
    return {
      background: "linear-gradient(135deg, rgba(34,197,94,0.22), rgba(22,163,74,0.34))",
      border: "rgba(34,197,94,0.45)",
      color: "rgb(21,128,61)",
    }
  }

  const ratio = index / (total - 1)
  const hue = Math.round(0 + ratio * 130)

  return {
    background: `linear-gradient(135deg, hsla(${hue}, 85%, 56%, 0.20), hsla(${hue}, 85%, 46%, 0.34))`,
    border: `hsla(${hue}, 75%, 42%, 0.45)`,
    color: `hsl(${hue}, 75%, 28%)`,
  }
}

function getRangeBadgeLabel(index: number, total: number) {
  if (total <= 1) return "Único rango"
  if (index === 0) return "Bajo"
  if (index === total - 1) return "Alto"
  return "Medio"
}

function recalculateRanges(ranges: Draft[]) {
  const sorted = ranges.map((range) => ({ ...range })).sort(sortRanges)
  const active = sorted.filter((range) => range.isActive)

  if (active.length) {
    active.forEach((range, index) => {
      if (index === 0) {
        range.minPct = 0
      } else {
        range.minPct = clampPct(active[index - 1].maxPct + 1)
      }

      if (index === active.length - 1) {
        range.maxPct = 100
      } else if (range.maxPct < range.minPct) {
        range.maxPct = range.minPct
      }

      range.sortOrder = index
      range.label = buildRangeLabel(range.minPct, range.maxPct)
    })
  }

  let inactiveOrder = active.length

  return sorted
    .map((range) => {
      if (range.isActive) return range

      const nextRange = {
        ...range,
        minPct: clampPct(range.minPct),
        maxPct: clampPct(range.maxPct),
        sortOrder: inactiveOrder,
      }

      if (nextRange.minPct > nextRange.maxPct) {
        nextRange.maxPct = nextRange.minPct
      }

      inactiveOrder += 1
      return nextRange
    })
    .sort(sortRanges)
}

export default function BatteryRangesManager({
  ranges,
  onChange,
}: {
  ranges: TradeInBatteryRangeDto[]
  onChange: () => Promise<void>
}) {
  const confirmDialog = useConfirmDialog()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [deletedRangeIds, setDeletedRangeIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDrafts(ranges.map((range) => ({ ...range })).sort(sortRanges))
    setDeletedRangeIds([])
  }, [ranges])

  const sortedDrafts = useMemo(() => {
    return drafts.map((range) => ({ ...range })).sort(sortRanges)
  }, [drafts])

  const activeDrafts = useMemo(() => {
    return sortedDrafts.filter((range) => range.isActive)
  }, [sortedDrafts])

  const hasUnsavedNewRanges = useMemo(() => {
    return drafts.some((range) => range.id.startsWith(TEMP_ID_PREFIX))
  }, [drafts])

  const hasDeletedRanges = deletedRangeIds.length > 0

  const validation = useMemo<ValidationResult>(() => {
    if (!activeDrafts.length) {
      return {
        message: "Debe existir al menos un rango activo",
        blocking: true,
      }
    }

    for (const range of sortedDrafts) {
      if (range.minPct < 0 || range.maxPct > 100 || range.minPct > range.maxPct) {
        return {
          message: "Hay un rango inválido. Revisá que los porcentajes estén entre 0 y 100 y que mínimo no supere máximo.",
          blocking: true,
        }
      }
    }

    if (activeDrafts[0].minPct !== 0) {
      return {
        message: "El primer rango activo debe empezar en 0.",
        blocking: true,
      }
    }

    if (activeDrafts[activeDrafts.length - 1].maxPct !== 100) {
      return {
        message: "El último rango activo debe terminar en 100.",
        blocking: true,
      }
    }

    for (let i = 0; i < activeDrafts.length; i += 1) {
      const range = activeDrafts[i]
      const next = activeDrafts[i + 1]

      if (next && next.minPct !== range.maxPct + 1) {
        return {
          message: "No puede haber huecos ni solapamientos entre rangos activos.",
          blocking: true,
        }
      }
    }

    return null
  }, [activeDrafts, sortedDrafts])

  const updateRange = (id: string, patch: Partial<Draft>, changedBound?: "min" | "max") => {
    setError(null)

    setDrafts((current) => {
      const next = current.map((range) => ({ ...range })).sort(sortRanges)
      const index = next.findIndex((range) => range.id === id)

      if (index < 0) return current

      next[index] = {
        ...next[index],
        ...patch,
      }

      if (typeof patch.minPct === "number") {
        next[index].minPct = clampPct(patch.minPct)
      }

      if (typeof patch.maxPct === "number") {
        next[index].maxPct = clampPct(patch.maxPct)
      }

      if (changedBound === "max" && next[index + 1]) {
        const nextMin = clampPct(next[index].maxPct + 1)
        next[index + 1].minPct = nextMin

        if (next[index + 1].maxPct < nextMin) {
          next[index + 1].maxPct = nextMin
        }

        next[index + 1].label = buildRangeLabel(next[index + 1].minPct, next[index + 1].maxPct)
      }

      if (changedBound === "min" && next[index - 1]) {
        const previousMax = clampPct(next[index].minPct - 1)
        next[index - 1].maxPct = previousMax

        if (next[index - 1].minPct > previousMax) {
          next[index - 1].minPct = previousMax
        }

        next[index - 1].label = buildRangeLabel(next[index - 1].minPct, next[index - 1].maxPct)
      }

      if (changedBound === "min" || changedBound === "max") {
        next[index].label = buildRangeLabel(next[index].minPct, next[index].maxPct)
      }

      return next.sort(sortRanges)
    })
  }

  const addRange = () => {
    setError(null)

    const tempId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `${TEMP_ID_PREFIX}${crypto.randomUUID()}`
        : `${TEMP_ID_PREFIX}${Date.now()}`

    const newRange: Draft = {
      id: tempId,
      label: "0 - 0",
      minPct: 0,
      maxPct: 0,
      sortOrder: 0,
      isActive: false,
    }

    setDrafts((current) => [newRange, ...current].sort(sortRanges))
  }

  const removeRange = async (id: string) => {
    const range = sortedDrafts.find((item) => item.id === id)
    if (!range) return

    const confirmed = await confirmDialog.confirm({
      variant: "danger",
      title: "Eliminar rango de bateria",
      description: "Esta accion quitara el rango y recalculara los limites de los rangos restantes.",
      details: [
        { label: "Rango", value: range.label },
        { label: "Minimo", value: `${range.minPct}%` },
        { label: "Maximo", value: `${range.maxPct}%` },
        { label: "Estado", value: range.isActive ? "Activo" : "Inactivo" },
      ],
      banner: {
        variant: "warning",
        title: "Recalculo automatico",
        description: "El cambio queda pendiente hasta que guardes la configuracion de rangos.",
      },
      confirmLabel: "Eliminar",
      cancelLabel: "Cerrar",
    })

    if (!confirmed) return

    setError(null)
    setDrafts((current) => recalculateRanges(current.filter((range) => range.id !== id)))

    if (!id.startsWith(TEMP_ID_PREFIX)) {
      setDeletedRangeIds((current) => (current.includes(id) ? current : [...current, id]))
    }
  }

  const saveAll = async () => {
    if (validation?.blocking) {
      setError(validation.message)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch("/api/trade-in/battery-ranges/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ranges: drafts, deletedRangeIds }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? "No se pudieron guardar los rangos")
        setSaving(false)
        return
      }

      await onChange()
      setDeletedRangeIds([])
    } catch {
      setError("No se pudieron guardar los rangos")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Rangos de batería</h2>
            {hasUnsavedNewRanges ? (
              <span className="badge badge-warning badge-sm">Hay rangos nuevos sin guardar</span>
            ) : null}
            {hasDeletedRanges ? (
              <span className="badge badge-error badge-sm">Hay rangos para eliminar</span>
            ) : null}
          </div>

          <p className="mt-1 text-sm text-base-content/60">
            Las cotas adyacentes se ajustan automáticamente. El menor rango se marca en rojo y el mayor en verde.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={addRange} disabled={saving}>
            Agregar rango
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={saveAll}
            disabled={saving || Boolean(validation?.blocking)}
          >
            {saving ? <span className="loading loading-spinner loading-xs" /> : null}
            {saving ? "Guardando" : "Guardar rangos"}
          </button>
        </div>
      </div>

      {error || validation ? (
        <div className={`alert mb-4 py-2 text-sm ${validation?.blocking || error ? "alert-warning" : "alert-info"}`}>
          <span>{error ?? validation?.message}</span>
        </div>
      ) : null}

      {saving ? (
        <div className="alert alert-info mb-4 py-2 text-sm">
          <span className="loading loading-spinner loading-xs" />
          <span>Actualizando rangos...</span>
        </div>
      ) : null}

      <div className="mb-4 rounded-xl border border-base-300 bg-base-200/40 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            Preview de rangos activos
          </span>
          <span className="text-xs text-base-content/50">{activeDrafts.length} activos</span>
        </div>

        {activeDrafts.length ? (
          <div className="flex min-h-14 overflow-hidden rounded-lg border border-base-300 bg-base-100">
            {activeDrafts.map((range, index) => {
              const colors = getRangeColor(index, activeDrafts.length)
              const width = `${Math.max(4, range.maxPct - range.minPct + 1)}%`

              return (
                <div
                  key={range.id}
                  className="flex min-w-16 flex-col items-center justify-center border-r px-2 text-center last:border-r-0"
                  style={{
                    width,
                    background: colors.background,
                    borderColor: colors.border,
                    color: colors.color,
                  }}
                  title={`${range.label} · orden ${range.sortOrder}`}
                >
                  <span className="text-xs font-bold">{range.label}</span>
                  <span className="text-[10px] font-medium opacity-75">
                    {getRangeBadgeLabel(index, activeDrafts.length)}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-base-300 bg-base-100 p-4 text-sm text-base-content/60">
            No hay rangos activos.
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-base-300">
        <table className="table table-sm">
          <thead className="bg-base-200/70">
            <tr>
              <th>Color</th>
              <th>Label</th>
              <th>Mínimo %</th>
              <th>Máximo %</th>
              <th>Orden</th>
              <th>Activo</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {sortedDrafts.map((range) => {
              const activeIndex = activeDrafts.findIndex((activeRange) => activeRange.id === range.id)
              const colors = range.isActive
                ? getRangeColor(activeIndex, activeDrafts.length)
                : {
                    background: "rgba(148,163,184,0.12)",
                    border: "rgba(148,163,184,0.35)",
                    color: "rgb(100,116,139)",
                  }

              return (
                <tr key={range.id} className={!range.isActive ? "opacity-60" : undefined}>
                  <td>
                    <div
                      className="h-7 w-14 rounded-full border"
                      style={{
                        background: colors.background,
                        borderColor: colors.border,
                      }}
                      title={range.isActive ? getRangeBadgeLabel(activeIndex, activeDrafts.length) : "Inactivo"}
                    />
                  </td>

                  <td>
                    <input
                      className="input input-bordered input-sm w-32"
                      value={range.label}
                      onChange={(event) => updateRange(range.id, { label: event.target.value })}
                    />
                  </td>

                  <td>
                    <input
                      className="input input-bordered input-sm w-24"
                      type="number"
                      min={0}
                      max={100}
                      value={range.minPct}
                      onChange={(event) =>
                        updateRange(
                          range.id,
                          { minPct: parseInputNumber(event.target.value, range.minPct) },
                          "min"
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="input input-bordered input-sm w-24"
                      type="number"
                      min={0}
                      max={100}
                      value={range.maxPct}
                      onChange={(event) =>
                        updateRange(
                          range.id,
                          { maxPct: parseInputNumber(event.target.value, range.maxPct) },
                          "max"
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="input input-bordered input-sm w-20"
                      type="number"
                      value={range.sortOrder}
                      onChange={(event) =>
                        updateRange(range.id, {
                          sortOrder: parseInputNumber(event.target.value, range.sortOrder),
                        })
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="toggle toggle-sm"
                      type="checkbox"
                      checked={range.isActive}
                      onChange={(event) => updateRange(range.id, { isActive: event.target.checked })}
                    />
                  </td>

                  <td className="text-right">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => removeRange(range.id)}
                      disabled={saving || sortedDrafts.length <= 1}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              )
            })}

            {!sortedDrafts.length ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-base-content/60">
                  No hay rangos cargados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
