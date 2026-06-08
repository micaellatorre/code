"use client"

import { useEffect, useMemo, useState } from "react"
import type { Buyer, Product, SaleItemKind } from "@prisma/client"
import type { SaleItemDraft } from "@/components/sales/types"
import { formatUsd } from "@/components/sales/salesUtils"

type AppointmentOption = {
  id: string
  scheduledAt: string
  buyer: Buyer | null
  interests: { productId: string; product: Product; notes?: string | null; priority?: number | null }[]
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function getBuyerLabel(buyer: Buyer | null) {
  return buyer ? `${buyer.name} ${buyer.surname ?? ""}`.trim() : "Consumidor Final"
}

function getAppointmentSearchText(appointment: AppointmentOption) {
  return normalizeSearch(
    [
      appointment.id,
      getBuyerLabel(appointment.buyer),
      appointment.interests.map((interest) => interest.product.modelName).join(" "),
    ].join(" "),
  )
}

export default function SaleReservationStep({
  selectedAppointmentId,
  setSelectedAppointmentId,
  setBuyer,
  setItems,
}: {
  selectedAppointmentId: string | null
  setSelectedAppointmentId: (id: string | null) => void
  setBuyer: (buyer: Buyer | null) => void
  setItems: (items: SaleItemDraft[]) => void
}) {
  const [appointments, setAppointments] = useState<AppointmentOption[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let ignore = false

    async function load() {
      setLoading(true)
      try {
        const response = await fetch("/api/appointments", { cache: "no-store" })
        if (!response.ok) throw new Error(await response.text())
        const data = (await response.json()) as AppointmentOption[]
        const filtered = data.filter(
          (appointment: any) =>
            appointment.status === "PROGRAMADA" &&
            ["PENDIENTE", "SENADO", "SENADO_EN_STOCK", "SENADO_EN_CAMINO"].includes(appointment.outcome),
        )
        if (!ignore) setAppointments(filtered)
      } catch (error) {
        console.error("Failed to load appointments", error)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void load()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!selectedAppointmentId || appointments.length === 0) return
    const appointment = appointments.find((item) => item.id === selectedAppointmentId)
    if (appointment) selectAppointment(appointment)
  }, [appointments, selectedAppointmentId])

  const normalizedSearch = normalizeSearch(search)
  const filteredAppointments = useMemo(() => {
    if (!normalizedSearch) return appointments
    return appointments.filter((appointment) => getAppointmentSearchText(appointment).includes(normalizedSearch))
  }, [appointments, normalizedSearch])

  const autocompleteOptions = useMemo(() => {
    const options = appointments.flatMap((appointment) => [
      getBuyerLabel(appointment.buyer),
      ...appointment.interests.map((interest) => interest.product.modelName),
    ])
    return Array.from(new Set(options.filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [appointments])

  function selectAppointment(appointment: AppointmentOption) {
    setSelectedAppointmentId(appointment.id)
    setBuyer(appointment.buyer)
    setItems(
      appointment.interests.map((interest) => ({
        _id: `reservation-${appointment.id}-${interest.productId}`,
        productId: interest.productId,
        product: interest.product,
        units: 1,
        unitPrice: String((interest.product as any).salePrice ?? "0"),
        unitCost: String((interest.product as any).costPrice ?? "0"),
        extraCost: "0",
        kind: "NORMAL" as SaleItemKind,
      })),
    )
  }

  if (loading) return <span className="loading loading-spinner" />

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Seleccionar reserva activa</h2>

      <label className="form-control">
        <span className="label-text mb-1">Buscar reserva</span>
        <div className="join w-full">
          <input
            type="search"
            className="input input-bordered join-item w-full"
            placeholder="Modelo, nombre o apellido"
            list="active-reservations-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search ? (
            <button type="button" className="btn btn-outline join-item" onClick={() => setSearch("")}>
              Limpiar
            </button>
          ) : null}
        </div>
        <datalist id="active-reservations-search">
          {autocompleteOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <span className="label-text-alt mt-1 text-base-content/50">
          {filteredAppointments.length} de {appointments.length} reservas activas
        </span>
      </label>

      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {filteredAppointments.map((appointment) => {
          const total = appointment.interests.reduce((acc, interest) => acc + Number((interest.product as any).salePrice ?? 0), 0)
          return (
            <div key={appointment.id} className={`rounded-lg border p-3 ${selectedAppointmentId === appointment.id ? "border-primary bg-primary/5" : "border-base-300"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    [{appointment.id.slice(-4).toUpperCase()}] {getBuyerLabel(appointment.buyer)}
                  </p>
                  <p className="text-sm text-base-content/60">
                    {appointment.interests.map((interest) => interest.product.modelName).join(" · ")}
                  </p>
                  <p className="text-xs text-base-content/50">Deposito / Sena: USD 0 · Total estimado: {formatUsd(total)}</p>
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => selectAppointment(appointment)}>
                  Seleccionar
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {!appointments.length ? <p className="text-sm text-base-content/60">No hay reservas pendientes disponibles.</p> : null}
      {appointments.length && !filteredAppointments.length ? <p className="text-sm text-base-content/60">No hay reservas que coincidan con la busqueda.</p> : null}
      <div className="alert alert-info py-3 text-sm">Las senas registradas en la reserva se conservan como contexto y se reflejan en el seguimiento comercial.</div>
    </div>
  )
}
