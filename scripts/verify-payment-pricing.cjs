const path = require("path")
const Module = require("module")

const root = path.resolve(__dirname, "..")
process.env.DATABASE_URL ||= "postgresql://postgres:postgres@localhost:5432/postgres"
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "CommonJS",
  moduleResolution: "node",
})

const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(root, "src", request.slice(2)), parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

require("ts-node/register/transpile-only")

const { Prisma } = require("@prisma/client")
const {
  buildPaymentPricingSnapshot,
  priceNativePayment,
  quoteFromCoveredUsd,
} = require("../src/lib/domain/payment-pricing")

const D = (value) => new Prisma.Decimal(String(value))

const settings = {
  transferFeeEnabled: true,
  transferFeeRatePct: D("3.5"),
  bnaInstallmentsEnabled: true,
  bnaMarkupRatePct: D("40"),
  bnaDefaultInstallments: 12,
  bnaCustomerRebatePct: D("10"),
  bnaCustomerRebateCapArs: D("30000"),
}

const changedSettings = {
  ...settings,
  transferFeeRatePct: D("7"),
  bnaMarkupRatePct: D("25"),
}

const rateSnapshot = {
  rate: D("1530"),
  source: "DOLARHOY_BLUE_VENTA",
  fetchedAt: new Date("2026-08-15T12:00:00.000Z"),
}

function assertDecimal(label, actual, expected, tolerance = "0") {
  const delta = D(actual).sub(D(expected)).abs()
  if (delta.greaterThan(D(tolerance))) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

const usdCash = quoteFromCoveredUsd({ method: "EFECTIVO_USD", coveredUsd: D("1000"), settings })
assertDecimal("USD 1000 -> efectivo USD", usdCash.amount, "1000.00")
assertDecimal("USD cash covered", usdCash.coveredBaseUsd, "1000.000000")

const arsCash = quoteFromCoveredUsd({ method: "EFECTIVO_PESOS", coveredUsd: D("1000"), exchangeRate: rateSnapshot.rate, settings })
assertDecimal("USD 1000 x 1530 -> efectivo ARS", arsCash.amount, "1530000.00")

const transfer = quoteFromCoveredUsd({ method: "TRANSFERENCIA_ARS", coveredUsd: D("1000"), exchangeRate: rateSnapshot.rate, settings })
assertDecimal("USD 1000 x 1530 x 1.035 -> transferencia", transfer.amount, "1583550.00")

const transferInverse = priceNativePayment({ method: "TRANSFERENCIA_ARS", currency: "ARS", amount: D("1583550"), exchangeRate: rateSnapshot.rate, settings })
assertDecimal("ARS 1583550 inverse -> USD 1000", transferInverse.coveredBaseUsd, "1000.000000")

const usdt = quoteFromCoveredUsd({ method: "USDT", coveredUsd: D("1000"), settings })
assertDecimal("USD 1000 -> USDT 1000", usdt.amount, "1000.00")

const bna12 = quoteFromCoveredUsd({ method: "BNA_CUOTAS", coveredUsd: D("1000"), exchangeRate: rateSnapshot.rate, settings, installments: 12 })
assertDecimal("USD 1000 x 1530 x 1.40 -> BNA", bna12.amount, "2142000.00")
assertDecimal("BNA 12 cuotas", bna12.installmentAmount, "178500.00")
assertDecimal("BNA amountUsd separates financial equivalent", bna12.amountUsd, "1400.00")
assertDecimal("BNA coveredBaseUsd remains commercial total", bna12.coveredBaseUsd, "1000.000000")

const bna6 = quoteFromCoveredUsd({ method: "BNA_CUOTAS", coveredUsd: D("1000"), exchangeRate: rateSnapshot.rate, settings, installments: 6 })
assertDecimal("BNA 6 cuotas", bna6.installmentAmount, "357000.00")

const bnaInverse = priceNativePayment({ method: "BNA_CUOTAS", currency: "ARS", amount: D("2142000"), exchangeRate: rateSnapshot.rate, settings, installments: 12 })
assertDecimal("BNA forward/inverse", bnaInverse.coveredBaseUsd, "1000.000000", "0.000001")

const mixedCash = priceNativePayment({ method: "EFECTIVO_PESOS", currency: "ARS", amount: D("300000"), exchangeRate: rateSnapshot.rate, settings })
const mixedTransfer = priceNativePayment({ method: "TRANSFERENCIA_ARS", currency: "ARS", amount: D("300000"), exchangeRate: rateSnapshot.rate, settings })
const remaining = D("1000").sub(mixedCash.coveredBaseUsd).sub(mixedTransfer.coveredBaseUsd)
assertDecimal("Mixed cash coverage", mixedCash.coveredBaseUsd, "196.078431", "0.000001")
assertDecimal("Mixed transfer coverage", mixedTransfer.coveredBaseUsd, "189.447760", "0.000001")
assertDecimal("Mixed remaining", remaining, "614.473809", "0.000001")
const mixedBna = quoteFromCoveredUsd({ method: "BNA_CUOTAS", coveredUsd: remaining, exchangeRate: rateSnapshot.rate, settings, installments: 12 })
assertDecimal("Completar restante BNA", mixedBna.coveredBaseUsd, remaining, "0.000001")

const snapshot = buildPaymentPricingSnapshot(transfer, rateSnapshot)
const repricedWithChangedConfig = quoteFromCoveredUsd({ method: "TRANSFERENCIA_ARS", coveredUsd: D("1000"), exchangeRate: rateSnapshot.rate, settings: changedSettings })
assertEqual("Snapshot freezes old transfer pct", snapshot.surchargePct, "3.50")
assertDecimal("Changed config affects new quote only", repricedWithChangedConfig.amount, "1637100.00")

console.log("payment-pricing verification passed")
