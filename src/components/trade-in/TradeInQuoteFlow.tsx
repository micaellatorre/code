"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { Role } from "@/lib/auth/roles"
import { calculateQuoteScenarios, calculateTradeInCreditTotal, getSelectedQuoteScenario, formatTradeInDifference, formatUsd } from "@/lib/trade-in/calculateTradeIn"
import InterestedProductAutocomplete from "./InterestedProductAutocomplete"
import InterestedProductsList from "./InterestedProductsList"
import TradeInCreditReceipt from "./TradeInCreditReceipt"
import TradeInDeviceForm from "./TradeInDeviceForm"
import TradeInQuoteSummary from "./TradeInQuoteSummary"
import TradeInShareBox from "./TradeInShareBox"
import TradeInStepCard from "./TradeInStepCard"
import TradeInStepper from "./TradeInStepper"
import TradeInStickySummary from "./TradeInStickySummary"
import type { InterestedProductDraft, TradeInConfigDto, TradeInDeviceDraft } from "./types"

type StepId = 1 | 2 | 3 | 4

export default function TradeInQuoteFlow({ role }: { role: Role }) {
  const [config, setConfig] = useState<TradeInConfigDto | null>(null)
  const [devices, setDevices] = useState<TradeInDeviceDraft[]>([])
  const [editingDevice, setEditingDevice] = useState<TradeInDeviceDraft | null>(null)
  const [interestedProducts, setInterestedProducts] = useState<InterestedProductDraft[]>([])
  const [selectedQuoteProductId, setSelectedQuoteProductId] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<StepId>(1)
  const [stepError, setStepError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/trade-in/config", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudo cargar la configuracion")
        setConfig(await res.json())
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    setSelectedQuoteProductId((current) => {
      if (interestedProducts.length === 0) return null
      if (interestedProducts.length === 1) return interestedProducts[0].id
      return current && interestedProducts.some((product) => product.id === current) ? current : null
    })
  }, [interestedProducts])

  const creditTotal = useMemo(() => calculateTradeInCreditTotal(devices), [devices])
  const scenarios = useMemo(() => calculateQuoteScenarios(interestedProducts, creditTotal), [creditTotal, interestedProducts])
  const selectedScenario = useMemo(() => getSelectedQuoteScenario(scenarios, selectedQuoteProductId), [scenarios, selectedQuoteProductId])
  const isAdmin = role === "ADMIN"

  if (error) return <div className="alert alert-error">{error}</div>
  if (!config) return <div className="flex min-h-[360px] items-center justify-center"><span className="loading loading-spinner loading-lg" /></div>

  const activeRanges = config.batteryRanges.filter((range) => range.isActive)
  const activeRules = config.deductionRules.filter((rule) => rule.isActive)
  const canVisitStep2 = devices.length > 0
  const canVisitStep3 = canVisitStep2 && interestedProducts.length > 0 && Boolean(selectedScenario)
  const canVisitStep4 = canVisitStep3

  const steps = [
    { id: 1, label: "Entrega", status: activeStep === 1 ? "active" as const : devices.length ? "completed" as const : "pending" as const, canVisit: true },
    { id: 2, label: "Interes", status: activeStep === 2 ? "active" as const : interestedProducts.length ? "completed" as const : "pending" as const, canVisit: canVisitStep2 },
    { id: 3, label: "Cotizacion", status: activeStep === 3 ? "active" as const : selectedScenario ? "completed" as const : "pending" as const, canVisit: canVisitStep3 },
    { id: 4, label: "Compartir", status: activeStep === 4 ? "active" as const : "pending" as const, canVisit: canVisitStep4 },
  ]

  const goToStep = (step: number) => {
    setStepError(null)
    if (step === 2 && !canVisitStep2) return setActiveStep(1)
    if (step === 3 && !canVisitStep3) return setActiveStep(2)
    if (step === 4 && !canVisitStep4) return setActiveStep(3)
    setActiveStep(step as StepId)
  }

  const continueFromInterest = () => {
    if (!devices.length || !interestedProducts.length || !selectedScenario) {
      setStepError("Selecciona una opcion de compra para continuar con la cotizacion.")
      return
    }
    setStepError(null)
    setActiveStep(3)
  }

  const upsertDevice = (device: TradeInDeviceDraft) => {
    setDevices((current) => {
      const exists = current.some((item) => item.id === device.id)
      return exists ? current.map((item) => item.id === device.id ? device : item) : [...current, device]
    })
    setEditingDevice(null)
  }

  const actionLabel = !devices.length
    ? "Cargar equipo"
    : !interestedProducts.length
      ? "Seleccionar equipo"
      : !selectedScenario
        ? "Elegir opcion"
        : "Ver cotizacion"

  return (
    <div className="pb-20 lg:pb-0">
      <TradeInStepper steps={steps} onSelect={goToStep} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <TradeInStepCard
            stepNumber={1}
            title="Equipos de entrega"
            description="Carga los equipos que el cliente entrega como credito."
            status={steps[0].status}
            isActive={activeStep === 1}
            summary={devices.length ? `${devices.length} equipos cargados - Credito ${formatUsd(creditTotal)}` : "Sin equipos cargados"}
            onClick={() => goToStep(1)}
          >
            <div className="mb-3 flex justify-end">
              {isAdmin ? <Link href="/dashboard/trade-in/config" className="btn btn-xs btn-outline">Configurar</Link> : null}
            </div>
            <TradeInDeviceForm
              batteryRanges={activeRanges}
              deductionRules={activeRules}
              prices={config.prices}
              isAdmin={isAdmin}
              editingDevice={editingDevice}
              onCancelEdit={() => setEditingDevice(null)}
              onSubmit={upsertDevice}
            />
            <div className="mt-4">
              <TradeInCreditReceipt devices={devices} total={creditTotal} onEdit={setEditingDevice} onRemove={(id) => setDevices((current) => current.filter((item) => item.id !== id))} />
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn btn-primary btn-sm" disabled={!devices.length} onClick={() => goToStep(2)}>Continuar</button>
            </div>
          </TradeInStepCard>

          <TradeInStepCard
            stepNumber={2}
            title="Equipos de interes"
            description="Agrega opciones alternativas de compra y elige una para finalizar."
            status={steps[1].status}
            isActive={activeStep === 2}
            summary={interestedProducts.length ? `${interestedProducts.length} opciones comparadas${selectedScenario ? ` - Seleccionado: ${selectedScenario.productLabel}` : ""}` : "Sin opciones"}
            onClick={() => goToStep(2)}
          >
            {stepError ? <div className="alert alert-warning mb-3 py-2 text-sm">{stepError}</div> : null}
            <InterestedProductAutocomplete
              onAdd={(product) => {
                setInterestedProducts((current) =>
                  current.some((item) => item.id === product.id) ? current : [...current, { ...product, quotedPrice: Number(product.salePrice) || 0 }]
                )
              }}
            />
            <InterestedProductsList
              products={interestedProducts}
              canEditPrice={isAdmin}
              creditTotal={creditTotal}
              selectedProductId={selectedQuoteProductId}
              onSelect={setSelectedQuoteProductId}
              onRemove={(id) => setInterestedProducts((current) => current.filter((item) => item.id !== id))}
              onPriceChange={(id, quotedPrice) => setInterestedProducts((current) => current.map((item) => item.id === id ? { ...item, quotedPrice } : item))}
            />
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn btn-primary btn-sm" disabled={!canVisitStep3} onClick={continueFromInterest}>Continuar a cotizacion</button>
            </div>
          </TradeInStepCard>

          <TradeInStepCard
            stepNumber={3}
            title="Cotizacion"
            description="Calcula la diferencia usando solo la opcion seleccionada."
            status={steps[2].status}
            isActive={activeStep === 3}
            summary={selectedScenario ? formatTradeInDifference(selectedScenario.difference) : "Seleccion pendiente"}
            onClick={() => goToStep(3)}
          >
            <TradeInQuoteSummary devices={devices} creditTotal={creditTotal} selectedScenario={selectedScenario} scenarios={scenarios} />
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn btn-primary btn-sm" disabled={!selectedScenario} onClick={() => goToStep(4)}>Preparar texto</button>
            </div>
          </TradeInStepCard>

          <TradeInStepCard
            stepNumber={4}
            title="Compartir"
            description="Copia un texto claro para enviar al cliente."
            status={steps[3].status}
            isActive={activeStep === 4}
            summary="Texto listo para copiar"
            onClick={() => goToStep(4)}
          >
            <TradeInShareBox devices={devices} interestedProducts={interestedProducts} selectedProductId={selectedQuoteProductId} onBack={() => goToStep(2)} />
          </TradeInStepCard>
        </div>

        <TradeInStickySummary
          devicesCount={devices.length}
          optionsCount={interestedProducts.length}
          creditTotal={creditTotal}
          selectedScenario={selectedScenario}
          selectedLabel={interestedProducts.length > 1 ? "Selecciona una opcion para continuar" : undefined}
          actionLabel={actionLabel}
          onAction={() => {
            if (!devices.length) return goToStep(1)
            if (!interestedProducts.length || !selectedScenario) return goToStep(2)
            return goToStep(3)
          }}
        />
      </div>
    </div>
  )
}
