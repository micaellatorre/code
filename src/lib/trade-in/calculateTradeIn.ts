export type TradeInDeductionInput = {
  id: string
  category: string
  label: string
  amount: number
}

export type TradeInDeviceValueInput = {
  referencePrice: number
  deductions: TradeInDeductionInput[]
}

export type TradeInCreditDevice = TradeInDeviceValueInput & {
  finalValue: number
}

export type InterestedProductValue = {
  id?: string
  modelName?: string
  capacityGB?: number | null
  batteryPct?: number | null
  color?: string | null
  imei?: string | null
  quotedPrice: number
}

export type TradeInQuoteScenario = {
  productId: string
  productLabel: string
  productPrice: number
  creditTotal: number
  difference: number
}

export type TradeInShareQuote = {
  devices: {
    modelName: string
    capacityGB: number
    batteryRangeLabel: string
    color?: string | null
    imei?: string | null
    referencePrice: number
    deductions: TradeInDeductionInput[]
    finalValue: number
  }[]
  interestedProducts: {
    id?: string
    modelName: string
    capacityGB?: number | null
    batteryPct?: number | null
    color?: string | null
    imei?: string | null
    quotedPrice: number
  }[]
  selectedProductId?: string | null
}

export function toMoneyNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0
}

export function formatUsd(value: number) {
  return `USD ${toMoneyNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

export function calculateTradeInDeviceValue(input: TradeInDeviceValueInput) {
  const referencePrice = toMoneyNumber(input.referencePrice)
  const deductionTotal = input.deductions.reduce((total, deduction) => total + toMoneyNumber(deduction.amount), 0)
  const finalValue = Math.max(0, referencePrice - deductionTotal)

  return {
    referencePrice,
    deductionTotal: toMoneyNumber(deductionTotal),
    finalValue: toMoneyNumber(finalValue),
  }
}

export function calculateTradeInCreditTotal(devices: TradeInCreditDevice[]) {
  return toMoneyNumber(devices.reduce((total, device) => total + toMoneyNumber(device.finalValue), 0))
}

export function calculateInterestedProductsTotal(products: InterestedProductValue[]) {
  return toMoneyNumber(products.reduce((total, product) => total + toMoneyNumber(product.quotedPrice), 0))
}

export function calculateTradeInDifference(creditTotal: number, interestedTotal: number) {
  return toMoneyNumber(interestedTotal) - toMoneyNumber(creditTotal)
}

export function buildInterestedProductLabel(product: InterestedProductValue) {
  const parts = [
    product.modelName ?? "Equipo",
    product.capacityGB ? `${product.capacityGB} GB` : null,
    product.batteryPct != null ? `${product.batteryPct}%` : null,
    product.color ?? null,
  ].filter(Boolean)

  return parts.join(" ")
}

export function calculateQuoteScenario(product: InterestedProductValue, creditTotal: number): TradeInQuoteScenario {
  return {
    productId: product.id ?? buildInterestedProductLabel(product),
    productLabel: buildInterestedProductLabel(product),
    productPrice: toMoneyNumber(product.quotedPrice),
    creditTotal: toMoneyNumber(creditTotal),
    difference: toMoneyNumber(product.quotedPrice) - toMoneyNumber(creditTotal),
  }
}

export function calculateQuoteScenarios(products: InterestedProductValue[], creditTotal: number) {
  return products.map((product) => calculateQuoteScenario(product, creditTotal))
}

export function getSelectedQuoteScenario(scenarios: TradeInQuoteScenario[], selectedProductId: string | null) {
  if (scenarios.length === 1) return scenarios[0]
  if (!selectedProductId) return null
  return scenarios.find((scenario) => scenario.productId === selectedProductId) ?? null
}

export function formatTradeInDifference(difference: number) {
  if (difference > 0) return `Resta pagar: ${formatUsd(difference)}`
  if (difference < 0) return `Credito excedente: ${formatUsd(Math.abs(difference))}`
  return "Operacion cubierta por el credito"
}

export function buildTradeInShareText(quote: TradeInShareQuote) {
  const creditTotal = calculateTradeInCreditTotal(quote.devices)
  const scenarios = calculateQuoteScenarios(quote.interestedProducts, creditTotal)
  const selectedScenario = getSelectedQuoteScenario(scenarios, quote.selectedProductId ?? null)

  const deviceLines = quote.devices.length
    ? quote.devices
        .map((device, index) => {
          const discounts = device.deductions.filter((deduction) => deduction.amount > 0)
          const discountText = discounts.length
            ? `\n   Descuentos: ${discounts.map((deduction) => `${deduction.label} (${formatUsd(deduction.amount)})`).join(", ")}`
            : ""
          return `${index + 1}. ${device.modelName} ${device.capacityGB} GB - bateria ${device.batteryRangeLabel}${device.color ? ` - ${device.color}` : ""}${device.imei ? ` - IMEI ${device.imei}` : ""}\n   Referencia: ${formatUsd(device.referencePrice)}\n   Credito reconocido: ${formatUsd(device.finalValue)}${discountText}`
        })
        .join("\n")
    : "Sin equipos entregados."

  const singleOptionText = selectedScenario
    ? [
        "Equipo elegido:",
        `${selectedScenario.productLabel} - ${formatUsd(selectedScenario.productPrice)}`,
        "",
        "Resultado:",
        formatTradeInDifference(selectedScenario.difference),
      ].join("\n")
    : ["Equipo elegido:", "Sin opcion seleccionada."].join("\n")

  const comparisonText = scenarios.length
    ? [
        "Opciones de compra:",
        "",
        scenarios
          .map((scenario, index) =>
            [
              `Opcion ${index + 1}:`,
              `${scenario.productLabel} - ${formatUsd(scenario.productPrice)}`,
              `Aplicando tu credito: ${formatUsd(scenario.creditTotal)}`,
              formatTradeInDifference(scenario.difference),
            ].join("\n")
          )
          .join("\n\n"),
      ].join("\n")
    : ["Opciones de compra:", "Sin equipos seleccionados."].join("\n")

  return [
    "Cotizacion Plan Canje",
    "",
    "Equipos entregados:",
    deviceLines,
    "",
    scenarios.length > 1 ? `Credito total disponible: ${formatUsd(creditTotal)}` : `Credito total: ${formatUsd(creditTotal)}`,
    "",
    scenarios.length > 1 ? comparisonText : singleOptionText,
    "",
    "Nota: Esta cotizacion es informativa y esta sujeta a revision tecnica presencial del equipo entregado, disponibilidad de stock y cotizacion vigente al momento de concretar la operacion.",
  ].join("\n")
}
