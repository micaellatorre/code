import { Prisma, type Currency, type PaymentMethod } from "@prisma/client"
import prisma from "@/lib/prisma"
import { fetchDolarUpstream } from "@/app/lib/dolar"
import { ensureTenantSettings } from "@/lib/config/settings"
import { normalizeAmountUsd } from "@/lib/domain/money"

type Tx = Prisma.TransactionClient

export type ExchangeRateSnapshot = {
  rate: Prisma.Decimal
  source: "DOLAR_BLUE_VENTA"
  fetchedAt: Date
}

export type PaymentPricingSettings = {
  transferFeeEnabled: boolean
  transferFeeRatePct: Prisma.Decimal
  bnaInstallmentsEnabled: boolean
  bnaMarkupRatePct: Prisma.Decimal
  bnaDefaultInstallments: number
  bnaCustomerRebatePct: Prisma.Decimal
  bnaCustomerRebateCapArs: Prisma.Decimal
}

export type PaymentPricingResult = {
  method: PaymentMethod
  currency: Currency
  amount: Prisma.Decimal
  coveredUsd: Prisma.Decimal
  amountUsd: Prisma.Decimal | null
  exchangeRate: Prisma.Decimal | null
  surchargePct: Prisma.Decimal
  surchargeAmount: Prisma.Decimal
  installments: number | null
  installmentAmount: Prisma.Decimal | null
  customerRebatePct: Prisma.Decimal | null
  customerRebateAmount: Prisma.Decimal | null
}

function money(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

function usd(value: Prisma.Decimal) {
  return value.toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP)
}

function rateMultiplier(ratePct: Prisma.Decimal) {
  return new Prisma.Decimal(1).add(ratePct.div(100))
}

function assertPositive(value: Prisma.Decimal, label: string) {
  if (!value.isFinite() || value.lessThanOrEqualTo(0)) {
    throw new Error(`${label} debe ser mayor a 0.`)
  }
}

function assertInstallments(value: number | null | undefined, fallback: number) {
  const installments = value ?? fallback
  if (!Number.isInteger(installments) || installments < 1 || installments > 12) {
    throw new Error("La cantidad de cuotas BNA debe estar entre 1 y 12.")
  }
  return installments
}

function expectedCurrency(method: PaymentMethod): Currency | null {
  switch (method) {
    case "EFECTIVO_PESOS":
    case "TRANSFERENCIA_ARS":
    case "TARJETA":
    case "BNA_CUOTAS":
      return "ARS"
    case "EFECTIVO_USD":
    case "TRANSFERENCIA_USD":
    case "PLAN_CANJE":
      return "USD"
    case "USDT":
      return "USDT"
    default:
      return null
  }
}

export function validatePaymentCurrency(method: PaymentMethod, currency: Currency) {
  const expected = expectedCurrency(method)
  if (expected && expected !== currency) {
    throw new Error(`El medio ${method} debe utilizar moneda ${expected}.`)
  }
}

export async function getPaymentPricingSettings(
  tenantId: string,
  tx: Tx = prisma,
): Promise<PaymentPricingSettings> {
  const settings = await ensureTenantSettings(tenantId, tx)
  return {
    transferFeeEnabled: settings.financialFeeEnabled,
    transferFeeRatePct: settings.financialFeeRatePct,
    bnaInstallmentsEnabled: settings.bnaInstallmentsEnabled,
    bnaMarkupRatePct: settings.bnaMarkupRatePct,
    bnaDefaultInstallments: settings.bnaDefaultInstallments,
    bnaCustomerRebatePct: settings.bnaCustomerRebatePct,
    bnaCustomerRebateCapArs: settings.bnaCustomerRebateCapArs,
  }
}

export async function getBlueSellRateSnapshot(): Promise<ExchangeRateSnapshot> {
  const response = await fetchDolarUpstream({ revalidateSeconds: 60, useStaleOnError: true })
  const blue = response.panel.find((item) => item.titulo.toLocaleLowerCase("es-AR").includes("blue"))
  const sale = blue?.venta
  if (sale == null || !Number.isFinite(sale) || sale <= 0) {
    throw new Error("No se pudo obtener Dolar Blue Venta.")
  }
  return {
    rate: new Prisma.Decimal(String(sale)),
    source: "DOLAR_BLUE_VENTA",
    fetchedAt: new Date(),
  }
}

function surchargePctFor(method: PaymentMethod, settings: PaymentPricingSettings) {
  if (method === "TRANSFERENCIA_ARS" && settings.transferFeeEnabled) {
    return settings.transferFeeRatePct
  }
  if (method === "BNA_CUOTAS") {
    if (!settings.bnaInstallmentsEnabled) throw new Error("Cuotas BNA no estan habilitadas.")
    return settings.bnaMarkupRatePct
  }
  return new Prisma.Decimal(0)
}

function customerRebateFor(method: PaymentMethod, amount: Prisma.Decimal, settings: PaymentPricingSettings) {
  if (method !== "BNA_CUOTAS" || settings.bnaCustomerRebatePct.lessThanOrEqualTo(0)) {
    return { pct: null, amount: null }
  }

  const calculated = amount.mul(settings.bnaCustomerRebatePct).div(100)
  const capped = Prisma.Decimal.min(calculated, settings.bnaCustomerRebateCapArs)
  return {
    pct: settings.bnaCustomerRebatePct,
    amount: money(capped),
  }
}

export function priceNativePayment(params: {
  method: PaymentMethod
  currency: Currency
  amount: Prisma.Decimal
  exchangeRate?: Prisma.Decimal | null
  settings: PaymentPricingSettings
  installments?: number | null
}): PaymentPricingResult {
  validatePaymentCurrency(params.method, params.currency)
  assertPositive(params.amount, "El importe")

  const surchargePct = surchargePctFor(params.method, params.settings)
  const isArs = params.currency === "ARS"
  const exchangeRate = isArs ? params.exchangeRate ?? null : null
  if (isArs) {
    if (!exchangeRate) throw new Error("El pago en ARS requiere tipo de cambio.")
    assertPositive(exchangeRate, "El tipo de cambio")
  }

  let coveredUsd: Prisma.Decimal
  let surchargeAmount = new Prisma.Decimal(0)
  let installments: number | null = null
  let installmentAmount: Prisma.Decimal | null = null

  if (params.method === "TRANSFERENCIA_ARS" || params.method === "BNA_CUOTAS") {
    const multiplier = rateMultiplier(surchargePct)
    coveredUsd = params.amount.div((exchangeRate as Prisma.Decimal).mul(multiplier))
    const baseArs = coveredUsd.mul(exchangeRate as Prisma.Decimal)
    surchargeAmount = params.amount.sub(baseArs)
  } else if (isArs) {
    coveredUsd = params.amount.div(exchangeRate as Prisma.Decimal)
  } else {
    coveredUsd = params.amount
  }

  if (params.method === "BNA_CUOTAS") {
    installments = assertInstallments(params.installments, params.settings.bnaDefaultInstallments)
    installmentAmount = money(params.amount.div(installments))
  }

  const customerRebate = customerRebateFor(params.method, params.amount, params.settings)

  return {
    method: params.method,
    currency: params.currency,
    amount: money(params.amount),
    coveredUsd: usd(coveredUsd),
    amountUsd: normalizeAmountUsd(params.amount, params.currency, exchangeRate),
    exchangeRate,
    surchargePct,
    surchargeAmount: money(surchargeAmount),
    installments,
    installmentAmount,
    customerRebatePct: customerRebate.pct,
    customerRebateAmount: customerRebate.amount,
  }
}

export function quoteFromCoveredUsd(params: {
  method: PaymentMethod
  coveredUsd: Prisma.Decimal
  exchangeRate?: Prisma.Decimal | null
  settings: PaymentPricingSettings
  installments?: number | null
}): PaymentPricingResult {
  assertPositive(params.coveredUsd, "El monto USD base")
  const currency = expectedCurrency(params.method)
  if (!currency) throw new Error("Medio de pago no soportado.")
  const isArs = currency === "ARS"
  const exchangeRate = isArs ? params.exchangeRate ?? null : null
  if (isArs) {
    if (!exchangeRate) throw new Error("La cotizacion en ARS requiere tipo de cambio.")
    assertPositive(exchangeRate, "El tipo de cambio")
  }

  const surchargePct = surchargePctFor(params.method, params.settings)
  let amount: Prisma.Decimal
  if (isArs) {
    amount = params.coveredUsd.mul(exchangeRate as Prisma.Decimal)
    if (params.method === "TRANSFERENCIA_ARS" || params.method === "BNA_CUOTAS") {
      amount = amount.mul(rateMultiplier(surchargePct))
    }
  } else {
    amount = params.coveredUsd
  }
  amount = money(amount)

  return priceNativePayment({
    method: params.method,
    currency,
    amount,
    exchangeRate,
    settings: params.settings,
    installments: params.installments,
  })
}

export function serializePricingResult(result: PaymentPricingResult) {
  return {
    method: result.method,
    currency: result.currency,
    amount: result.amount.toFixed(2),
    coveredUsd: result.coveredUsd.toFixed(6),
    amountUsd: result.amountUsd?.toFixed(2) ?? null,
    exchangeRate: result.exchangeRate?.toFixed(4) ?? null,
    surchargePct: result.surchargePct.toFixed(2),
    surchargeAmount: result.surchargeAmount.toFixed(2),
    installments: result.installments,
    installmentAmount: result.installmentAmount?.toFixed(2) ?? null,
    customerRebatePct: result.customerRebatePct?.toFixed(2) ?? null,
    customerRebateAmount: result.customerRebateAmount?.toFixed(2) ?? null,
  }
}
