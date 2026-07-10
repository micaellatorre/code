import { Prisma, PrismaClient, type CashMovementSource, type Currency } from "@prisma/client"

const prisma = new PrismaClient()

type Mode = "dry-run" | "real" | "audit-only"
type Counters = Record<string, number>
type Sample = {
  source: string
  sourceId: string
  date: string
  direction: string
  category: string
  amount: string
  currency: string
  amountUsd: string | null
  account: string
  branch: string | null
  user: string | null
}

function argValue(name: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (direct) return direct.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function hasFlag(name: string) {
  return process.argv.includes(name)
}

function parseAccountMap() {
  const pairs = process.argv
    .filter((arg) => arg.startsWith("--account="))
    .map((arg) => arg.slice("--account=".length))
  const map = new Map<Currency, string>()
  for (const pair of pairs) {
    const [currency, accountId] = pair.split("=")
    if ((currency === "USD" || currency === "ARS" || currency === "USDT") && accountId) {
      map.set(currency, accountId)
    }
  }
  return map
}

function add(counters: Counters, key: string, by = 1) {
  counters[key] = (counters[key] ?? 0) + by
}

function businessDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function money(value: Prisma.Decimal | null | undefined) {
  return value == null ? null : value.toString()
}

async function existingState(sourceType: CashMovementSource, sourceId: string, tenantId: string) {
  const movements = await prisma.cashMovement.findMany({
    where: { tenantId, sourceType, sourceId },
    include: { reversedBy: { select: { id: true } }, reversalOf: { select: { id: true } } },
  })
  if (!movements.length) return "MISSING"
  if (movements.length > 1) return "DUPLICATED"
  const movement = movements[0]
  if (movement.reversedBy || movement.reversalOf || movement.category === "REVERSAL") return "REVERSED"
  return "MATCHED"
}

async function main() {
  const mode: Mode = hasFlag("--audit-only") ? "audit-only" : hasFlag("--dry-run") ? "dry-run" : "real"
  const singleAccountId = argValue("--account-id")
  const accountMap = parseAccountMap()
  if (!singleAccountId && accountMap.size === 0) {
    throw new Error("Indica --account-id <ID> o --account USD=<ID> --account ARS=<ID> --account USDT=<ID>.")
  }

  const accountIds = Array.from(new Set([singleAccountId, ...accountMap.values()].filter((id): id is string => Boolean(id))))
  const accounts = await prisma.cashAccount.findMany({ where: { id: { in: accountIds }, isActive: true }, include: { branch: true } })
  if (accounts.length !== accountIds.length) throw new Error("Una o mas cuentas no existen o no estan activas.")
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const shortcut = singleAccountId ? accountsById.get(singleAccountId) : null
  const tenantIds = new Set(accounts.map((account) => account.tenantId))
  if (tenantIds.size !== 1) throw new Error("Todas las cuentas deben pertenecer al mismo tenant.")
  const tenantId = accounts[0].tenantId

  const counters: Counters = {}
  const nativeIn = new Map<string, Prisma.Decimal>()
  const nativeOut = new Map<string, Prisma.Decimal>()
  let usdIn = new Prisma.Decimal(0)
  let usdOut = new Prisma.Decimal(0)
  const samples: Sample[] = []
  const errors: string[] = []

  async function resolveAccount(currency: Currency) {
    const mappedId = accountMap.get(currency)
    if (mappedId) return accountsById.get(mappedId) ?? null
    if (!shortcut) return null
    return shortcut.currency === currency ? shortcut : null
  }

  async function processCandidate(candidate: {
    source: "SALE_PAYMENT" | "PURCHASE_PAYMENT"
    sourceId: string
    direction: "INCOME" | "EXPENSE"
    category: "SALE_PAYMENT" | "PURCHASE_PAYMENT"
    amount: Prisma.Decimal
    currency: Currency
    amountUsd: Prisma.Decimal | null
    exchangeRate: Prisma.Decimal | null
    occurredAt: Date
    branchId: string | null
    userId: string | null
    detail: string
  }) {
    add(counters, `${candidate.source}_ANALYZED`)
    if (candidate.source === "SALE_PAYMENT" && candidate.detail.includes("PLAN_CANJE")) {
      add(counters, "PLAN_CANJE_EXCLUDED")
      return
    }
    const state = await existingState(candidate.source, candidate.sourceId, tenantId)
    add(counters, state)
    if (state !== "MISSING") return
    if (!candidate.branchId) {
      add(counters, "UNRESOLVED_BRANCH")
      return
    }
    add(counters, "BRANCH_RESOLVED")
    const account = await resolveAccount(candidate.currency)
    if (!account) {
      add(counters, "SKIPPED_CURRENCY_MISMATCH")
      return
    }
    if (candidate.currency === "ARS" && !candidate.amountUsd) add(counters, "UNCONVERTED_ARS")
    const close = await prisma.cashDailyClose.findUnique({
      where: { tenantId_branchId_businessDate: { tenantId, branchId: candidate.branchId, businessDate: businessDate(candidate.occurredAt) } },
      select: { id: true },
    })
    if (close) {
      add(counters, "CLOSED_DATE_DETECTED")
      return
    }
    add(counters, `${candidate.category}_TO_CREATE`)
    const native = candidate.direction === "INCOME" ? nativeIn : nativeOut
    native.set(candidate.currency, (native.get(candidate.currency) ?? new Prisma.Decimal(0)).add(candidate.amount))
    if (candidate.amountUsd) {
      if (candidate.direction === "INCOME") usdIn = usdIn.add(candidate.amountUsd)
      else usdOut = usdOut.add(candidate.amountUsd)
    }
    if (samples.length < 10) {
      samples.push({
        source: candidate.source,
        sourceId: candidate.sourceId,
        date: candidate.occurredAt.toISOString(),
        direction: candidate.direction,
        category: candidate.category,
        amount: candidate.amount.toString(),
        currency: candidate.currency,
        amountUsd: money(candidate.amountUsd),
        account: account.id,
        branch: candidate.branchId,
        user: candidate.userId,
      })
    }
    if (mode === "real") {
      await prisma.cashMovement.create({
        data: {
          tenantId,
          accountId: account.id,
          branchId: candidate.branchId,
          userId: candidate.userId,
          direction: candidate.direction,
          category: candidate.category,
          detail: candidate.detail,
          amount: candidate.amount,
          currency: candidate.currency,
          exchangeRate: candidate.exchangeRate,
          amountUsd: candidate.amountUsd,
          sourceType: candidate.source,
          sourceId: candidate.sourceId,
          occurredAt: candidate.occurredAt,
        },
      })
      add(counters, "CREATED")
    }
  }

  for (let skip = 0; ; skip += 200) {
    const payments = await prisma.payment.findMany({
      where: { sale: { tenantId } },
      skip,
      take: 200,
      orderBy: { paidAt: "asc" },
      include: { sale: { select: { id: true, branchId: true, userId: true } } },
    })
    if (!payments.length) break
    add(counters, "SALE_PAYMENTS_ANALYZED", payments.length)
    for (const payment of payments) {
      if (payment.method === "PLAN_CANJE") {
        add(counters, "PLAN_CANJE_EXCLUDED")
        continue
      }
      await processCandidate({
        source: "SALE_PAYMENT",
        sourceId: payment.id,
        direction: "INCOME",
        category: "SALE_PAYMENT",
        amount: payment.amount,
        currency: payment.currency,
        amountUsd: payment.amountUsd,
        exchangeRate: payment.exchangeRate,
        occurredAt: payment.paidAt,
        branchId: payment.sale.branchId,
        userId: payment.sale.userId,
        detail: `Backfill cobro venta ${payment.sale.id}`,
      }).catch((error) => errors.push(`SALE_PAYMENT ${payment.id}: ${error instanceof Error ? error.message : String(error)}`))
    }
  }

  for (let skip = 0; ; skip += 200) {
    const payments = await prisma.purchasePayment.findMany({
      where: { purchase: { tenantId } },
      skip,
      take: 200,
      orderBy: { paidAt: "asc" },
      include: { purchase: { select: { id: true, branchId: true } } },
    })
    if (!payments.length) break
    add(counters, "PURCHASE_PAYMENTS_ANALYZED", payments.length)
    for (const payment of payments) {
      await processCandidate({
        source: "PURCHASE_PAYMENT",
        sourceId: payment.id,
        direction: "EXPENSE",
        category: "PURCHASE_PAYMENT",
        amount: payment.amount,
        currency: payment.currency,
        amountUsd: payment.amountUsd,
        exchangeRate: payment.exchangeRate,
        occurredAt: payment.paidAt,
        branchId: payment.purchase.branchId,
        userId: null,
        detail: `Backfill pago compra ${payment.purchase.id}`,
      }).catch((error) => errors.push(`PURCHASE_PAYMENT ${payment.id}: ${error instanceof Error ? error.message : String(error)}`))
    }
  }

  const existingLedgerSources = await prisma.cashMovement.findMany({
    where: { tenantId, sourceType: { in: ["SALE_PAYMENT", "PURCHASE_PAYMENT"] }, sourceId: { not: null } },
    select: { sourceType: true, sourceId: true },
    take: 5000,
  })
  for (const movement of existingLedgerSources) {
    if (!movement.sourceId) continue
    if (movement.sourceType === "SALE_PAYMENT") {
      const exists = await prisma.payment.findUnique({ where: { id: movement.sourceId }, select: { id: true } })
      if (!exists) add(counters, "ORPHAN")
    }
    if (movement.sourceType === "PURCHASE_PAYMENT") {
      const exists = await prisma.purchasePayment.findUnique({ where: { id: movement.sourceId }, select: { id: true } })
      if (!exists) add(counters, "ORPHAN")
    }
  }

  console.log(JSON.stringify({
    mode,
    tenantId,
    accounts: accounts.map((account) => ({ id: account.id, name: account.name, currency: account.currency, scope: account.scope, branchId: account.branchId })),
    counters,
    nativeIncomeByCurrency: Object.fromEntries(Array.from(nativeIn.entries()).map(([key, value]) => [key, value.toString()])),
    nativeExpenseByCurrency: Object.fromEntries(Array.from(nativeOut.entries()).map(([key, value]) => [key, value.toString()])),
    knownUsdIncome: usdIn.toString(),
    knownUsdExpense: usdOut.toString(),
    knownUsdNet: usdIn.sub(usdOut).toString(),
    samples,
    errors,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
