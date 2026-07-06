import { Prisma } from "@prisma/client"

export function decimal(value: unknown) {
  return new Prisma.Decimal(value == null || value === "" ? 0 : String(value))
}

export function optionalDecimal(value: unknown) {
  if (value == null || value === "") return null
  return decimal(value)
}

export function normalizeAmountUsd(amount: Prisma.Decimal, currency: string, exchangeRate?: Prisma.Decimal | null) {
  if (currency === "USD") return amount
  if (currency === "USDT") return amount
  if (currency === "ARS" && exchangeRate && exchangeRate.greaterThan(0)) return amount.div(exchangeRate)
  return null
}
