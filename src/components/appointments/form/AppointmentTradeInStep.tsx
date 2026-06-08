"use client"

import TradeInCreditReceipt from "@/components/trade-in/TradeInCreditReceipt"
import TradeInDeviceForm from "@/components/trade-in/TradeInDeviceForm"
import type { TradeInConfigDto, TradeInDeviceDraft } from "@/components/trade-in/types"

export default function AppointmentTradeInStep({
  config,
  loading,
  isAdmin,
  devices,
  editingDevice,
  onEdit,
  onCancelEdit,
  onSubmit,
  onRemove,
  total,
}: {
  config: TradeInConfigDto | null
  loading: boolean
  isAdmin: boolean
  devices: TradeInDeviceDraft[]
  editingDevice: TradeInDeviceDraft | null
  onEdit: (device: TradeInDeviceDraft) => void
  onCancelEdit: () => void
  onSubmit: (device: TradeInDeviceDraft) => void
  onRemove: (id: string) => void
  total: number
}) {
  if (loading) return <div className="loading loading-spinner" />
  if (!config) return <div className="alert alert-warning">No se pudo cargar la configuracion de Plan Canje.</div>

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Plan Canje</h2>
        <p className="text-sm text-base-content/60">Carga los equipos que el cliente entregaria como credito para esta reserva.</p>
      </div>
      <TradeInDeviceForm
        batteryRanges={config.batteryRanges.filter((range) => range.isActive)}
        deductionRules={config.deductionRules.filter((rule) => rule.isActive)}
        prices={config.prices}
        isAdmin={isAdmin}
        editingDevice={editingDevice}
        onCancelEdit={onCancelEdit}
        onSubmit={onSubmit}
      />
      <TradeInCreditReceipt devices={devices} total={total} onEdit={onEdit} onRemove={onRemove} />
      <div className="alert alert-info py-3 text-sm">
        Este credito queda guardado en la reserva y se descuenta del saldo estimado. El ingreso al inventario se completa al confirmar la venta.
      </div>
    </div>
  )
}
