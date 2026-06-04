"use client"

import { useEffect, useState } from "react"
import BatteryRangesManager from "./BatteryRangesManager"
import DeductionRulesManager from "./DeductionRulesManager"
import TradeInPricesMatrix from "./TradeInPricesMatrix"
import type { TradeInConfigDto } from "./types"

export default function TradeInConfigPanel() {
  const [config, setConfig] = useState<TradeInConfigDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = async () => {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/trade-in/config", { cache: "no-store" })
    if (!res.ok) {
      setError("No se pudo cargar la configuracion")
      setLoading(false)
      return
    }
    setConfig(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    void loadConfig()
  }, [])

  if (loading) {
    return <div className="flex min-h-[320px] items-center justify-center"><span className="loading loading-spinner loading-lg" /></div>
  }

  if (error || !config) {
    return <div className="alert alert-error">{error ?? "Configuracion no disponible"}</div>
  }

  return (
    <div className="space-y-5">
      <BatteryRangesManager ranges={config.batteryRanges} onChange={loadConfig} />
      <TradeInPricesMatrix ranges={config.batteryRanges.filter((range) => range.isActive)} prices={config.prices} onChange={loadConfig} />
      <DeductionRulesManager rules={config.deductionRules} onChange={loadConfig} />
    </div>
  )
}
