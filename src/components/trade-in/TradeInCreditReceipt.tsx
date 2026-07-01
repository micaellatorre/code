"use client"

import { formatUsd } from "@/lib/trade-in/calculateTradeIn"
import ImeiDisplay from "@/components/common/ImeiDisplay"
import type { TradeInDeviceDraft } from "./types"

export default function TradeInCreditReceipt({
  devices,
  total,
  onEdit,
  onRemove,
}: {
  devices: TradeInDeviceDraft[]
  total: number
  onEdit: (device: TradeInDeviceDraft) => void
  onRemove: (id: string) => void
}) {
  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <h2 className="mb-3 text-lg font-semibold">Ticket de credito</h2>
      {devices.length === 0 ? <p className="text-sm text-base-content/60">Todavia no hay equipos entregados.</p> : null}
      <div className="space-y-3">
        {devices.map((device) => (
          <div key={device.id} className="rounded-lg border border-dashed border-base-300 bg-base-200/40 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{device.modelName} - {device.capacityGB} GB</p>
                <p className="flex flex-wrap items-baseline gap-x-1 text-xs text-base-content/60">
                  <span>{device.batteryRangeLabel}</span>
                  {device.color ? <span>- {device.color}</span> : null}
                  {device.imei ? (
                    <span className="inline-flex items-baseline gap-1">
                      - IMEI <ImeiDisplay imei={device.imei} />
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="text-right font-semibold">{formatUsd(device.finalValue)}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <span>Referencia: {formatUsd(device.referencePrice)}</span>
              <span>Final: {formatUsd(device.finalValue)}</span>
            </div>
            {device.deductions.length ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium">Ver descuentos</summary>
                <ul className="mt-2 space-y-1 text-xs">
                  {device.deductions.map((deduction) => <li key={deduction.id} className="flex justify-between"><span>{deduction.label}</span><span>-{formatUsd(deduction.amount)}</span></li>)}
                </ul>
              </details>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn btn-xs" onClick={() => onEdit(device)}>Editar</button>
              <button type="button" className="btn btn-xs btn-outline" onClick={() => onRemove(device.id)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-base-300 pt-3 font-bold">
        <span>Total credito</span>
        <span>{formatUsd(total)}</span>
      </div>
    </section>
  )
}
