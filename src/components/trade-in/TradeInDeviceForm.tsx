"use client"

import { useEffect, useMemo, useState } from "react"
import { IPHONE_TRADE_IN_CATALOG } from "@/lib/trade-in/iphoneCatalog"
import { calculateTradeInDeviceValue, formatUsd } from "@/lib/trade-in/calculateTradeIn"
import type { TradeInBatteryRangeDto, TradeInDeductionCategory, TradeInDeductionRuleDto, TradeInDeviceDraft, TradeInPriceDto } from "./types"
import { getApplicableRulesByCategory, makeClientId, parseApiMoney, TRADE_IN_CATEGORIES, TRADE_IN_CATEGORY_LABELS } from "./utils"

type Props = {
  batteryRanges: TradeInBatteryRangeDto[]
  deductionRules: TradeInDeductionRuleDto[]
  prices: TradeInPriceDto[]
  isAdmin: boolean
  editingDevice: TradeInDeviceDraft | null
  onCancelEdit: () => void
  onSubmit: (device: TradeInDeviceDraft) => void
}

export default function TradeInDeviceForm({ batteryRanges, deductionRules, prices, isAdmin, editingDevice, onCancelEdit, onSubmit }: Props) {
  const [modelName, setModelName] = useState("")
  const [capacityGB, setCapacityGB] = useState("")
  const [batteryRangeId, setBatteryRangeId] = useState("")
  const [color, setColor] = useState("")
  const [imei, setImei] = useState("")
  const [condition, setCondition] = useState("")
  const [notes, setNotes] = useState("")
  const [manualReferencePrice, setManualReferencePrice] = useState("")
  const [selectedRules, setSelectedRules] = useState<Record<TradeInDeductionCategory, string>>({
    PANTALLA_MODULO: "",
    TAPA: "",
    CAMARA: "",
    FUNCIONAMIENTO: "",
    OTRO: "",
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editingDevice) return
    setModelName(editingDevice.modelName)
    setCapacityGB(String(editingDevice.capacityGB))
    setBatteryRangeId(editingDevice.batteryRangeId)
    setColor(editingDevice.color ?? "")
    setImei(editingDevice.imei ?? "")
    setCondition(editingDevice.condition ?? "")
    setNotes(editingDevice.notes ?? "")
    setManualReferencePrice(String(editingDevice.referencePrice))
    setSelectedRules({
      PANTALLA_MODULO: editingDevice.deductions.find((d) => d.category === "PANTALLA_MODULO")?.id ?? "",
      TAPA: editingDevice.deductions.find((d) => d.category === "TAPA")?.id ?? "",
      CAMARA: editingDevice.deductions.find((d) => d.category === "CAMARA")?.id ?? "",
      FUNCIONAMIENTO: editingDevice.deductions.find((d) => d.category === "FUNCIONAMIENTO")?.id ?? "",
      OTRO: editingDevice.deductions.find((d) => d.category === "OTRO")?.id ?? "",
    })
  }, [editingDevice])

  const numericCapacity = capacityGB ? Number(capacityGB) : null
  const selectedCatalogModel = IPHONE_TRADE_IN_CATALOG.flatMap((series) => series.models).find((model) => model.modelName === modelName)
  const referenceFromConfig = useMemo(() => {
    const price = prices.find((item) => item.modelName === modelName && item.capacityGB === Number(capacityGB) && item.batteryRangeId === batteryRangeId)
    return price ? parseApiMoney(price.referencePrice) : 0
  }, [batteryRangeId, capacityGB, modelName, prices])
  const referencePrice = referenceFromConfig > 0 ? referenceFromConfig : parseApiMoney(manualReferencePrice)
  const selectedDeductions = Object.values(selectedRules)
    .map((id) => deductionRules.find((rule) => rule.id === id))
    .filter(Boolean)
    .map((rule) => ({ id: rule!.id, category: rule!.category, label: rule!.label, amount: parseApiMoney(rule!.amount) }))
  const totals = calculateTradeInDeviceValue({ referencePrice, deductions: selectedDeductions })

  const reset = () => {
    setModelName("")
    setCapacityGB("")
    setBatteryRangeId("")
    setColor("")
    setImei("")
    setCondition("")
    setNotes("")
    setManualReferencePrice("")
    setSelectedRules({ PANTALLA_MODULO: "", TAPA: "", CAMARA: "", FUNCIONAMIENTO: "", OTRO: "" })
    setError(null)
  }

  const submit = () => {
    setError(null)
    const range = batteryRanges.find((item) => item.id === batteryRangeId)
    if (!modelName || !capacityGB || !range) {
      setError("Modelo, capacidad y rango de bateria son obligatorios")
      return
    }
    if (referencePrice <= 0) {
      setError(isAdmin ? "Ingresa un valor manual o carga un precio de referencia" : "No hay precio de referencia cargado para este equipo")
      return
    }
    onSubmit({
      id: editingDevice?.id ?? makeClientId("trade-in-device"),
      modelName,
      capacityGB: Number(capacityGB),
      batteryRangeId,
      batteryRangeLabel: range.label,
      color: color.trim() || undefined,
      imei: imei.trim() || undefined,
      condition: condition.trim() || undefined,
      notes: notes.trim() || undefined,
      referencePrice: totals.referencePrice,
      deductions: selectedDeductions,
      finalValue: totals.finalValue,
    })
    reset()
  }

  const renderRuleSelect = (category: TradeInDeductionCategory) => {
    const rules = getApplicableRulesByCategory(deductionRules, category, modelName, numericCapacity)

    return (
      <label className="form-control" key={category}>
        <span className="label-text">{TRADE_IN_CATEGORY_LABELS[category]}</span>
        <select className="select select-bordered" value={selectedRules[category]} onChange={(e) => setSelectedRules({ ...selectedRules, [category]: e.target.value })}>
          <option value="">Sin descuento</option>
          {rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.label} - USD {rule.amount}</option>)}
        </select>
      </label>
    )
  }

  return (
    <div className="space-y-4">
      {error ? <div className="alert alert-warning py-2 text-sm">{error}</div> : null}

      <div>
        <h3 className="mb-2 font-semibold">Datos del equipo</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="form-control">
            <span className="label-text">Modelo</span>
            <select className="select select-bordered" value={modelName} onChange={(e) => { setModelName(e.target.value); setCapacityGB(""); setSelectedRules({ PANTALLA_MODULO: "", TAPA: "", CAMARA: "", FUNCIONAMIENTO: "", OTRO: "" }) }}>
              <option value="">Seleccionar</option>
              {IPHONE_TRADE_IN_CATALOG.map((series) => (
                <optgroup key={series.series} label={series.series}>
                  {series.models.map((model) => <option key={model.modelName} value={model.modelName}>{model.modelName}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Capacidad</span>
            <select className="select select-bordered" value={capacityGB} onChange={(e) => { setCapacityGB(e.target.value); setSelectedRules({ PANTALLA_MODULO: "", TAPA: "", CAMARA: "", FUNCIONAMIENTO: "", OTRO: "" }) }} disabled={!selectedCatalogModel}>
              <option value="">Seleccionar</option>
              {selectedCatalogModel?.capacities.map((capacity) => <option key={capacity} value={capacity}>{capacity} GB</option>)}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Rango bateria</span>
            <select className="select select-bordered" value={batteryRangeId} onChange={(e) => setBatteryRangeId(e.target.value)}>
              <option value="">Seleccionar</option>
              {batteryRanges.map((range) => <option key={range.id} value={range.id}>{range.label}</option>)}
            </select>
          </label>
          <input className="input input-bordered" placeholder="Color" value={color} onChange={(e) => setColor(e.target.value)} />
          <input className="input input-bordered" placeholder="IMEI" value={imei} onChange={(e) => setImei(e.target.value)} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-semibold">Condicion tecnica</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {TRADE_IN_CATEGORIES.filter((category) => category !== "OTRO").map(renderRuleSelect)}
        </div>
      </div>

      <label className="form-control">
        <span className="label-text">Observaciones</span>
        <textarea className="textarea textarea-bordered" placeholder="Detalle funcional, marcas o comentarios internos" value={notes || condition} onChange={(e) => { setNotes(e.target.value); setCondition(e.target.value) }} />
      </label>

      {isAdmin && referenceFromConfig <= 0 ? (
        <label className="form-control max-w-xs">
          <span className="label-text">Valor manual USD</span>
          <input className="input input-bordered" type="number" min={0} value={manualReferencePrice} onChange={(e) => setManualReferencePrice(e.target.value)} />
        </label>
      ) : null}

      <div className="rounded-lg border border-base-300 bg-base-200 p-3">
        <h3 className="font-semibold">Valor reconocido</h3>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <div><span className="block text-base-content/60">Referencia</span><span className="font-semibold">{formatUsd(totals.referencePrice)}</span></div>
          <div><span className="block text-base-content/60">Descuentos</span><span className="font-semibold">{formatUsd(totals.deductionTotal)}</span></div>
          <div><span className="block text-base-content/60">Credito final</span><span className="text-lg font-bold text-primary">{formatUsd(totals.finalValue)}</span></div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          {editingDevice ? <button type="button" className="btn btn-sm" onClick={() => { reset(); onCancelEdit() }}>Cancelar</button> : null}
          <button type="button" className="btn btn-primary btn-sm" onClick={submit}>{editingDevice ? "Guardar cambios" : "Agregar al ticket"}</button>
        </div>
      </div>
    </div>
  )
}
