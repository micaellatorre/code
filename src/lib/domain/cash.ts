import { Prisma, type CashMovementCategory, type CashMovementDirection, type CashMovementSource, type Currency, type UserRole } from "@prisma/client"
import { formatInTimeZone, toDate } from "date-fns-tz"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { AR_TIME_ZONE } from "@/lib/timezone"
import { createAuditLog } from "@/lib/domain/audit"
import { decimal, normalizeAmountUsd, optionalDecimal } from "@/lib/domain/money"
import { resolveUserBranchContext } from "@/lib/domain/user-branches"

const cashMovementCategories = [
  "SALE_PAYMENT",
  "RESERVATION_DEPOSIT",
  "PURCHASE_PAYMENT",
  "EXPENSE",
  "SERVICE_PAYMENT",
  "COMMISSION_PAYMENT",
  "TRANSFER",
  "CONVERSION",
  "ADJUSTMENT",
  "REVERSAL",
] as const

const manualCategories = ["EXPENSE", "SERVICE_PAYMENT", "COMMISSION_PAYMENT", "ADJUSTMENT"] as const

export const cashAccountSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.enum(["CASH", "BANK", "DIGITAL_WALLET", "CRYPTO", "OTHER"]),
  currency: z.enum(["ARS", "USD", "USDT"]),
  scope: z.enum(["TENANT", "BRANCH"]).optional().default("TENANT"),
  branchId: z.string().trim().min(1).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional(),
})

export const cashMovementSchema = z.object({
  accountId: z.string().min(1),
  direction: z.enum(["INCOME", "EXPENSE"]),
  category: z.enum(cashMovementCategories).default("ADJUSTMENT"),
  detail: z.string().trim().min(1),
  amount: z.union([z.string(), z.number()]),
  currency: z.enum(["ARS", "USD", "USDT"]),
  exchangeRate: z.union([z.string(), z.number()]).optional().nullable(),
})

export const cashTransferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  kind: z.enum(["TRANSFER", "CONVERSION"]).optional().default("TRANSFER"),
  fromAmount: z.union([z.string(), z.number()]),
  toAmount: z.union([z.string(), z.number()]).optional().nullable(),
  exchangeRate: z.union([z.string(), z.number()]).optional().nullable(),
  detail: z.string().optional().nullable(),
})

export const cashMovementsQuerySchema = z.object({
  search: z.string().optional().nullable(),
  direction: z.enum(["INCOME", "EXPENSE"]).optional().nullable(),
  accountId: z.string().optional().nullable(),
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
})

export const cashCloseSchema = z.object({
  businessDate: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

type Tx = Prisma.TransactionClient

type ActorParams = {
  tenantId: string
  actorUserId: string
  actorRole: UserRole | string
}

function money(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2)
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function serializeDecimal(value: Prisma.Decimal | number | string | null | undefined) {
  return toNumber(value)
}

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function businessDateFrom(value?: string | Date | null) {
  if (value instanceof Date) return formatInTimeZone(value, AR_TIME_ZONE, "yyyy-MM-dd")
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return formatInTimeZone(new Date(), AR_TIME_ZONE, "yyyy-MM-dd")
}

function businessDayRange(value?: string | Date | null) {
  const businessDate = businessDateFrom(value)
  return {
    businessDate,
    from: toDate(`${businessDate}T00:00:00`, { timeZone: AR_TIME_ZONE }),
    to: toDate(`${businessDate}T23:59:59.999`, { timeZone: AR_TIME_ZONE }),
  }
}

function currencySymbol(currency: Currency | string) {
  if (currency === "ARS") return "$"
  if (currency === "USDT") return "USDT"
  return "u$d"
}

export function getCashMovementCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    SALE_PAYMENT: "Cobro de venta",
    RESERVATION_DEPOSIT: "Sena de reserva",
    CUSTOMER_ORDER_PAYMENT: "Cobro de pedido",
    PURCHASE_PAYMENT: "Pago de compra",
    EXPENSE: "Gasto",
    SERVICE_PAYMENT: "Servicio tecnico",
    COMMISSION_PAYMENT: "Comision",
    TRANSFER: "Transferencia",
    CONVERSION: "Conversion",
    ADJUSTMENT: "Ajuste",
    REVERSAL: "Reversa",
  }
  return labels[category] ?? category
}

export function getCashMovementDirectionLabel(direction: string) {
  return direction === "INCOME" ? "Ingreso" : "Egreso"
}

export function getCashAccountScopeLabel(scope: string) {
  return scope === "BRANCH" ? "Sucursal" : "Global"
}

export function getCashTransferKindLabel(kind: string) {
  return kind === "CONVERSION" ? "Conversion" : "Transferencia"
}

export function formatCashAmount(params: { amount: number | Prisma.Decimal | null | undefined; currency: Currency | string; direction?: string | null }) {
  if (params.amount == null) return "-"
  const value = Math.abs(Number(params.amount))
  const sign = params.direction === "INCOME" ? "+ " : params.direction === "EXPENSE" ? "- " : ""
  if (params.currency === "ARS") return `${sign}$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value)}`
  if (params.currency === "USDT") return `${sign}USDT ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}`
  return `${sign}u$d ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}`
}

export function formatUsdEquivalent(value: number | Prisma.Decimal | null | undefined, direction?: string | null) {
  return formatCashAmount({ amount: value, currency: "USD", direction })
}

async function assertAccountScope(input: z.infer<typeof cashAccountSchema>, tenantId: string, tx: Tx) {
  if (input.scope === "TENANT") return { branchId: null }
  if (!input.branchId) throw new Error("La caja de sucursal requiere una sucursal")
  const branch = await tx.branch.findFirst({ where: { id: input.branchId, tenantId, isActive: true }, select: { id: true } })
  if (!branch) throw new Error("Sucursal no disponible")
  return { branchId: branch.id }
}

async function resolveCashBranchContext(params: ActorParams, tx: Tx = prisma) {
  const user = await tx.user.findFirst({
    where: { id: params.actorUserId, tenantId: params.tenantId, isActive: true },
    select: { currentBranchId: true },
  })
  if (!user?.currentBranchId) throw new Error("Selecciona una sucursal actual antes de operar Caja.")
  const context = await resolveUserBranchContext(
    { userId: params.actorUserId, tenantId: params.tenantId, role: params.actorRole },
    tx,
  )
  if (!context.currentBranch) throw new Error("Selecciona una sucursal actual antes de operar Caja.")
  if (context.currentBranch.id !== user.currentBranchId) throw new Error(context.error ?? "La sucursal actual no esta disponible.")
  return context.currentBranch
}

function accessibleAccountWhere(tenantId: string, branchId: string): Prisma.CashAccountWhereInput {
  return {
    tenantId,
    isActive: true,
    OR: [
      { scope: "TENANT" },
      { scope: "BRANCH", branchId },
    ],
  }
}

export function isMonetaryPaymentMethod(method: string | null | undefined) {
  return Boolean(method && method !== "PLAN_CANJE")
}

async function getAccessibleAccount(accountId: string, tenantId: string, branchId: string, tx: Tx) {
  return tx.cashAccount.findFirst({
    where: { id: accountId, ...accessibleAccountWhere(tenantId, branchId) },
    include: { branch: { select: { id: true, name: true, code: true } } },
  })
}

async function assertDomainCashAccount(params: {
  tenantId: string
  branchId: string
  accountId?: string | null
  currency: Currency
}, tx: Tx) {
  if (!params.accountId) throw new Error("Selecciona una caja para registrar el movimiento.")
  const account = await getAccessibleAccount(params.accountId, params.tenantId, params.branchId, tx)
  if (!account) throw new Error("Cuenta de caja no disponible para esta sucursal.")
  if (account.currency !== params.currency) throw new Error("La moneda del pago debe coincidir con la moneda de la caja.")
  return account
}

function sameDecimal(left: Prisma.Decimal | number | string | null | undefined, right: Prisma.Decimal | number | string | null | undefined) {
  if (left == null && right == null) return true
  if (left == null || right == null) return false
  return new Prisma.Decimal(left).equals(new Prisma.Decimal(right))
}

function sameDate(left: Date | null | undefined, right: Date | null | undefined) {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null)
}

async function findActiveSourceMovement(params: {
  tenantId: string
  sourceType: CashMovementSource
  sourceId: string
}, tx: Tx) {
  const movements = await tx.cashMovement.findMany({
    where: {
      tenantId: params.tenantId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      category: { not: "REVERSAL" },
    },
    orderBy: { createdAt: "desc" },
    include: { reversedBy: { select: { id: true } } },
  })
  return movements.find((movement) => !movement.reversedBy) ?? null
}

async function createReversalForMovement(params: ActorParams & {
  original: Prisma.CashMovementGetPayload<{ include: { reversedBy: { select: { id: true } } } }>
  reason: string
}, tx: Tx) {
  if (params.original.category === "REVERSAL" || params.original.reversalOfId || params.original.reversedBy) {
    throw new Error("El movimiento ya tiene una reversa.")
  }
  if (params.original.branchId) {
    await assertCashBusinessDateOpen({ tenantId: params.tenantId, branchId: params.original.branchId, date: params.original.occurredAt }, tx)
  }
  const reversal = await tx.cashMovement.create({
    data: {
      tenantId: params.tenantId,
      branchId: params.original.branchId,
      accountId: params.original.accountId,
      userId: params.actorUserId,
      direction: params.original.direction === "INCOME" ? "EXPENSE" : "INCOME",
      category: "REVERSAL",
      detail: `Reversa: ${params.reason}`,
      amount: params.original.amount,
      currency: params.original.currency,
      exchangeRate: params.original.exchangeRate,
      amountUsd: params.original.amountUsd,
      sourceType: "MANUAL",
      sourceId: `reversal:${params.original.id}`,
      reversalOfId: params.original.id,
      occurredAt: new Date(),
    },
  })
  await createAuditLog({
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    actorRole: params.actorRole as UserRole,
    action: "CASH_MOVEMENT_CORRECTED",
    module: "CASH",
    entityType: "CashMovement",
    entityId: params.original.id,
    detail: params.reason,
    metadata: { originalMovementId: params.original.id, reversalMovementId: reversal.id },
  }, tx)
  return reversal
}

async function postDomainPaymentMovement(params: ActorParams & {
  tx: Tx
  branchId: string | null | undefined
  accountId: string | null | undefined
  paymentId: string
  paymentMethod: string
  amount: Prisma.Decimal
  currency: Currency
  exchangeRate?: Prisma.Decimal | null
  amountUsd?: Prisma.Decimal | null
  occurredAt: Date
  direction: CashMovementDirection
  category: CashMovementCategory
  sourceType: CashMovementSource
  detail: string
}) {
  if (!isMonetaryPaymentMethod(params.paymentMethod)) return null
  if (!params.branchId) throw new Error("No se pudo resolver la sucursal operativa del movimiento.")
  await assertCashBusinessDateOpen({ tenantId: params.tenantId, branchId: params.branchId, date: params.occurredAt }, params.tx)
  const account = await assertDomainCashAccount({
    tenantId: params.tenantId,
    branchId: params.branchId,
    accountId: params.accountId,
    currency: params.currency,
  }, params.tx)
  const amountUsd = params.amountUsd ?? normalizeAmountUsd(params.amount, params.currency, params.exchangeRate ?? null)
  const active = await findActiveSourceMovement({
    tenantId: params.tenantId,
    sourceType: params.sourceType,
    sourceId: params.paymentId,
  }, params.tx)
  const isSame =
    active &&
    active.accountId === account.id &&
    active.branchId === params.branchId &&
    active.direction === params.direction &&
    active.category === params.category &&
    active.currency === params.currency &&
    sameDecimal(active.amount, params.amount) &&
    sameDecimal(active.exchangeRate, params.exchangeRate ?? null) &&
    sameDecimal(active.amountUsd, amountUsd ?? null) &&
    sameDate(active.occurredAt, params.occurredAt)
  if (isSame) return active
  if (active) {
    await createReversalForMovement({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      original: active,
      reason: `Correccion de ${params.sourceType} ${params.paymentId}`,
    }, params.tx)
  }
  const movement = await params.tx.cashMovement.create({
    data: {
      tenantId: params.tenantId,
      branchId: params.branchId,
      accountId: account.id,
      userId: params.actorUserId,
      direction: params.direction,
      category: params.category,
      detail: params.detail,
      amount: params.amount,
      currency: params.currency,
      exchangeRate: params.exchangeRate ?? null,
      amountUsd,
      sourceType: params.sourceType,
      sourceId: params.paymentId,
      occurredAt: params.occurredAt,
    },
  })
  await createAuditLog({
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    actorRole: params.actorRole as UserRole,
    action: params.direction === "INCOME" ? "CASH_IN" : "CASH_OUT",
    module: "CASH",
    entityType: "CashMovement",
    entityId: movement.id,
    detail: params.detail,
    metadata: { sourceType: params.sourceType, sourceId: params.paymentId, accountId: account.id },
  }, params.tx)
  return movement
}

export async function postSalePaymentToCash(params: ActorParams & {
  tx: Tx
  sale: { id: string; branchId: string | null; customerName?: string | null }
  payment: {
    id: string
    method: string
    currency: Currency
    amount: Prisma.Decimal
    exchangeRate?: Prisma.Decimal | null
    amountUsd?: Prisma.Decimal | null
    paidAt: Date
    cashAccountId?: string | null
    originReservationPaymentId?: string | null
    originCustomerOrderPaymentId?: string | null
  }
}) {
  if (params.payment.originReservationPaymentId || params.payment.originCustomerOrderPaymentId) return null
  return postDomainPaymentMovement({
    ...params,
    branchId: params.sale.branchId,
    accountId: params.payment.cashAccountId,
    paymentId: params.payment.id,
    paymentMethod: params.payment.method,
    amount: params.payment.amount,
    currency: params.payment.currency,
    exchangeRate: params.payment.exchangeRate,
    amountUsd: params.payment.amountUsd,
    occurredAt: params.payment.paidAt,
    direction: "INCOME",
    category: "SALE_PAYMENT",
    sourceType: "SALE_PAYMENT",
    detail: `Cobro de venta ${params.sale.id}`,
  })
}

export async function postReservationPaymentToCash(params: ActorParams & {
  tx: Tx
  reservation: { id: string; branchId: string | null }
  payment: {
    id: string
    method: string
    currency: Currency
    amount: Prisma.Decimal
    exchangeRate?: Prisma.Decimal | null
    amountUsd?: Prisma.Decimal | null
    paidAt: Date
    cashAccountId?: string | null
  }
}) {
  return postDomainPaymentMovement({
    ...params,
    branchId: params.reservation.branchId,
    accountId: params.payment.cashAccountId,
    paymentId: params.payment.id,
    paymentMethod: params.payment.method,
    amount: params.payment.amount,
    currency: params.payment.currency,
    exchangeRate: params.payment.exchangeRate,
    amountUsd: params.payment.amountUsd,
    occurredAt: params.payment.paidAt,
    direction: "INCOME",
    category: "RESERVATION_DEPOSIT",
    sourceType: "RESERVATION_PAYMENT",
    detail: `Sena de reserva ${params.reservation.id}`,
  })
}

export async function postPurchasePaymentToCash(params: ActorParams & {
  tx: Tx
  purchase: { id: string; branchId: string | null }
  payment: {
    id: string
    method: string
    currency: Currency
    amount: Prisma.Decimal
    exchangeRate?: Prisma.Decimal | null
    amountUsd?: Prisma.Decimal | null
    paidAt: Date
    cashAccountId?: string | null
  }
}) {
  return postDomainPaymentMovement({
    ...params,
    branchId: params.purchase.branchId,
    accountId: params.payment.cashAccountId,
    paymentId: params.payment.id,
    paymentMethod: params.payment.method,
    amount: params.payment.amount,
    currency: params.payment.currency,
    exchangeRate: params.payment.exchangeRate,
    amountUsd: params.payment.amountUsd,
    occurredAt: params.payment.paidAt,
    direction: "EXPENSE",
    category: "PURCHASE_PAYMENT",
    sourceType: "PURCHASE_PAYMENT",
    detail: `Pago de compra ${params.purchase.id}`,
  })
}

export async function postCommissionPaymentToCash(params: ActorParams & {
  tx: Tx
  commission: {
    id: string
    saleId: string
    branchId: string | null
    amount: Prisma.Decimal
    currency: Currency
    paidAt: Date
    cashAccountId?: string | null
  }
}) {
  return postDomainPaymentMovement({
    ...params,
    branchId: params.commission.branchId,
    accountId: params.commission.cashAccountId,
    paymentId: params.commission.id,
    paymentMethod: "COMMISSION_PAYMENT",
    amount: params.commission.amount,
    currency: params.commission.currency,
    exchangeRate: null,
    amountUsd: normalizeAmountUsd(params.commission.amount, params.commission.currency, null),
    occurredAt: params.commission.paidAt,
    direction: "EXPENSE",
    category: "COMMISSION_PAYMENT",
    sourceType: "CLOSER_COMMISSION",
    detail: `Pago de comision ${params.commission.id}`,
  })
}

export async function reverseSourceCashMovement(params: ActorParams & {
  tx: Tx
  sourceType: CashMovementSource
  sourceId: string
  reason: string
}) {
  const active = await findActiveSourceMovement(params, params.tx)
  if (!active) return null
  return createReversalForMovement({ ...params, original: active, reason: params.reason }, params.tx)
}

export async function assertCashBusinessDateOpen(params: { tenantId: string; branchId: string; date?: string | Date | null }, tx: Tx = prisma) {
  const range = businessDayRange(params.date)
  const close = await tx.cashDailyClose.findUnique({
    where: { tenantId_branchId_businessDate: { tenantId: params.tenantId, branchId: params.branchId, businessDate: range.from } },
    select: { id: true },
  })
  if (close) throw new Error("La fecha operativa de la sucursal se encuentra cerrada.")
}

export async function createCashAccount(params: ActorParams & { input: z.infer<typeof cashAccountSchema> }) {
  const input = cashAccountSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    const scope = await assertAccountScope(input, params.tenantId, tx)
    const account = await tx.cashAccount.create({
      data: {
        tenantId: params.tenantId,
        code: input.code,
        name: input.name,
        type: input.type,
        currency: input.currency,
        scope: input.scope,
        branchId: scope.branchId,
        sortOrder: input.sortOrder,
        isActive: input.isActive ?? true,
      },
      include: { branch: { select: { id: true, name: true, code: true } } },
    })
    await createAuditLog({ tenantId: params.tenantId, actorUserId: params.actorUserId, actorRole: params.actorRole as UserRole, action: "CREATE", module: "CASH", entityType: "CashAccount", entityId: account.id, detail: `Cuenta creada: ${account.name}` }, tx)
    return account
  })
}

export async function updateCashAccount(params: ActorParams & { accountId: string; input: Partial<z.infer<typeof cashAccountSchema>> }) {
  const input = cashAccountSchema.partial().parse(params.input)
  return prisma.$transaction(async (tx) => {
    const current = await tx.cashAccount.findFirst({ where: { id: params.accountId, tenantId: params.tenantId }, include: { branch: true } })
    if (!current) throw new Error("Cuenta no encontrada")
    if (input.currency && input.currency !== current.currency) {
      const movements = await tx.cashMovement.count({ where: { tenantId: params.tenantId, accountId: current.id } })
      if (movements > 0) throw new Error("No se puede modificar la moneda de una caja con movimientos registrados.")
    }
    const nextScope = input.scope ?? current.scope
    const scope = await assertAccountScope({ ...current, ...input, scope: nextScope } as z.infer<typeof cashAccountSchema>, params.tenantId, tx)
    const account = await tx.cashAccount.update({
      where: { id: current.id },
      data: {
        code: input.code ?? undefined,
        name: input.name ?? undefined,
        type: input.type ?? undefined,
        currency: input.currency ?? undefined,
        scope: nextScope,
        branchId: scope.branchId,
        sortOrder: input.sortOrder ?? undefined,
        isActive: input.isActive ?? undefined,
      },
      include: { branch: { select: { id: true, name: true, code: true } } },
    })
    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole as UserRole,
      action: "UPDATE",
      module: "CASH",
      entityType: "CashAccount",
      entityId: account.id,
      detail: `Cuenta actualizada: ${account.name}`,
      oldValue: { scope: current.scope, branchId: current.branchId, currency: current.currency, isActive: current.isActive },
      newValue: { scope: account.scope, branchId: account.branchId, currency: account.currency, isActive: account.isActive },
    }, tx)
    return account
  })
}

export async function getCashAccountBalance(params: { tenantId: string; accountId: string; branchId?: string | null }, tx: Tx = prisma) {
  const movements = await tx.cashMovement.findMany({
    where: { tenantId: params.tenantId, accountId: params.accountId, ...(params.branchId ? { branchId: params.branchId } : {}) },
    select: { direction: true, amount: true },
  })
  return movements.reduce((sum, movement) => (
    movement.direction === "INCOME" ? sum.plus(movement.amount) : sum.minus(movement.amount)
  ), new Prisma.Decimal(0))
}

async function getCashAccountBalances(params: { tenantId: string; accountIds: string[] }, tx: Tx = prisma) {
  const balances = new Map<string, Prisma.Decimal>()
  params.accountIds.forEach((id) => balances.set(id, new Prisma.Decimal(0)))
  const movements = await tx.cashMovement.findMany({
    where: { tenantId: params.tenantId, accountId: { in: params.accountIds } },
    select: { accountId: true, direction: true, amount: true },
  })
  for (const movement of movements) {
    const current = balances.get(movement.accountId) ?? new Prisma.Decimal(0)
    balances.set(movement.accountId, movement.direction === "INCOME" ? current.plus(movement.amount) : current.minus(movement.amount))
  }
  return balances
}

function movementUsdValue(movement: { currency: Currency; amount: Prisma.Decimal; amountUsd: Prisma.Decimal | null }) {
  if (movement.amountUsd != null) return movement.amountUsd
  if (movement.currency === "USD" || movement.currency === "USDT") return movement.amount
  return null
}

async function getTodaySummary(params: { tenantId: string; branchId: string; date?: string | Date | null }, tx: Tx = prisma) {
  const range = businessDayRange(params.date)
  const movements = await tx.cashMovement.findMany({
    where: { tenantId: params.tenantId, branchId: params.branchId, occurredAt: { gte: range.from, lte: range.to } },
    select: { direction: true, amount: true, currency: true, amountUsd: true },
  })
  let incomeUsd = new Prisma.Decimal(0)
  let expenseUsd = new Prisma.Decimal(0)
  let unconvertedMovementCount = 0
  for (const movement of movements) {
    const usd = movementUsdValue(movement)
    if (!usd) {
      if (movement.currency === "ARS") unconvertedMovementCount += 1
      continue
    }
    if (movement.direction === "INCOME") incomeUsd = incomeUsd.plus(usd)
    else expenseUsd = expenseUsd.plus(usd)
  }
  return {
    businessDate: range.businessDate,
    incomeUsd: money(incomeUsd),
    expenseUsd: money(expenseUsd),
    netUsd: money(incomeUsd.minus(expenseUsd)),
    unconvertedMovementCount,
  }
}

export async function createCashMovement(params: ActorParams & { input: z.infer<typeof cashMovementSchema> }) {
  const input = cashMovementSchema.parse(params.input)
  if (!manualCategories.includes(input.category as (typeof manualCategories)[number])) {
    throw new Error("La categoria seleccionada no esta permitida para movimientos manuales.")
  }
  return prisma.$transaction(async (tx) => {
    const branch = await resolveCashBranchContext(params, tx)
    await assertCashBusinessDateOpen({ tenantId: params.tenantId, branchId: branch.id }, tx)
    const account = await getAccessibleAccount(input.accountId, params.tenantId, branch.id, tx)
    if (!account) throw new Error("Cuenta no disponible")
    if (account.currency !== input.currency) throw new Error("La moneda del movimiento debe coincidir con la moneda de la caja.")
    const amount = decimal(input.amount)
    const exchangeRate = optionalDecimal(input.exchangeRate)
    const movement = await tx.cashMovement.create({
      data: {
        tenantId: params.tenantId,
        branchId: branch.id,
        accountId: account.id,
        userId: params.actorUserId,
        direction: input.direction,
        category: input.category,
        detail: input.detail,
        amount,
        currency: input.currency,
        exchangeRate,
        amountUsd: normalizeAmountUsd(amount, input.currency, exchangeRate),
        sourceType: "MANUAL",
      },
      include: { account: true, branch: true, user: { select: { id: true, name: true, email: true } } },
    })
    await createAuditLog({ tenantId: params.tenantId, actorUserId: params.actorUserId, actorRole: params.actorRole as UserRole, action: input.direction === "INCOME" ? "CASH_IN" : "CASH_OUT", module: "CASH", entityType: "CashMovement", entityId: movement.id, detail: input.detail }, tx)
    return movement
  })
}

export async function reverseCashMovement(params: ActorParams & { movementId: string }) {
  return prisma.$transaction(async (tx) => {
    const branch = await resolveCashBranchContext(params, tx)
    await assertCashBusinessDateOpen({ tenantId: params.tenantId, branchId: branch.id }, tx)
    const original = await tx.cashMovement.findFirst({
      where: { id: params.movementId, tenantId: params.tenantId },
      include: { reversedBy: { select: { id: true } } },
    })
    if (!original) throw new Error("Movimiento no encontrado")
    if (original.category === "REVERSAL" || original.reversalOfId) throw new Error("No se puede revertir una reversa.")
    const legacyReversal = await tx.cashMovement.findFirst({
      where: { tenantId: params.tenantId, category: "REVERSAL", OR: [{ reversalOfId: original.id }, { sourceId: original.id }, { sourceId: `reversal:${original.id}` }] },
      select: { id: true },
    })
    if (original.reversedBy || legacyReversal) throw new Error("El movimiento ya tiene una reversa.")
    const reversal = await tx.cashMovement.create({
      data: {
        tenantId: params.tenantId,
        branchId: original.branchId ?? branch.id,
        accountId: original.accountId,
        userId: params.actorUserId,
        direction: original.direction === "INCOME" ? "EXPENSE" : "INCOME",
        category: "REVERSAL",
        detail: `Reversa: ${original.detail}`,
        amount: original.amount,
        currency: original.currency,
        exchangeRate: original.exchangeRate,
        amountUsd: original.amountUsd,
        sourceType: "MANUAL",
        sourceId: `reversal:${original.id}`,
        reversalOfId: original.id,
      },
      include: { account: true, branch: true, reversalOf: { select: { id: true, detail: true } } },
    })
    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole as UserRole,
      action: reversal.direction === "INCOME" ? "CASH_IN" : "CASH_OUT",
      module: "CASH",
      entityType: "CashMovement",
      entityId: reversal.id,
      detail: `Reversa de movimiento ${original.id}`,
      metadata: { reversalOfMovementId: original.id },
    }, tx)
    return reversal
  })
}

async function assertSufficientBalance(params: { tenantId: string; accountId: string; amount: Prisma.Decimal }, tx: Tx) {
  const balance = await getCashAccountBalance({ tenantId: params.tenantId, accountId: params.accountId }, tx)
  if (balance.lessThan(params.amount)) throw new Error("Saldo insuficiente en la cuenta origen.")
}

export async function calculateArsWeightedCostBasis(params: { tenantId: string; accountId: string; before?: Date }, tx: Tx = prisma) {
  const movements = await tx.cashMovement.findMany({
    where: {
      tenantId: params.tenantId,
      accountId: params.accountId,
      currency: "ARS",
      ...(params.before ? { occurredAt: { lt: params.before } } : {}),
    },
    orderBy: { occurredAt: "asc" },
    select: { direction: true, amount: true, amountUsd: true },
  })
  let ars = new Prisma.Decimal(0)
  let usd = new Prisma.Decimal(0)
  for (const movement of movements) {
    if (movement.direction === "INCOME") {
      const movementUsd = movement.amountUsd
      if (!movementUsd || movementUsd.lessThanOrEqualTo(0)) continue
      ars = ars.plus(movement.amount)
      usd = usd.plus(movementUsd)
      continue
    }
    if (ars.lessThanOrEqualTo(0) || usd.lessThanOrEqualTo(0)) continue
    const rate = ars.div(usd)
    const usdConsumed = movement.amount.div(rate)
    const nextArs = ars.minus(movement.amount)
    const nextUsd = usd.minus(usdConsumed)
    ars = nextArs.lessThan(0) ? new Prisma.Decimal(0) : nextArs
    usd = nextUsd.lessThan(0) ? new Prisma.Decimal(0) : nextUsd
  }
  if (ars.lessThanOrEqualTo(0) || usd.lessThanOrEqualTo(0)) return null
  return ars.div(usd).toDecimalPlaces(4)
}

async function buildFxConversionSnapshot(params: {
  tenantId: string
  fromAccountId: string
  fromCurrency: Currency
  toCurrency: Currency
  fromAmount: Prisma.Decimal
  toAmount: Prisma.Decimal
  now: Date
}, tx: Tx) {
  if (params.fromCurrency !== "ARS" || (params.toCurrency !== "USD" && params.toCurrency !== "USDT")) {
    return { benchmarkExchangeRate: null, theoreticalAmountUsd: null, realAmountUsd: null, fxResultUsd: null }
  }
  const benchmarkExchangeRate = await calculateArsWeightedCostBasis({
    tenantId: params.tenantId,
    accountId: params.fromAccountId,
    before: params.now,
  }, tx)
  if (!benchmarkExchangeRate) return { benchmarkExchangeRate: null, theoreticalAmountUsd: null, realAmountUsd: money(params.toAmount), fxResultUsd: null }
  const theoreticalAmountUsd = money(params.fromAmount.div(benchmarkExchangeRate))
  const realAmountUsd = money(params.toAmount)
  return {
    benchmarkExchangeRate,
    theoreticalAmountUsd,
    realAmountUsd,
    fxResultUsd: money(realAmountUsd.minus(theoreticalAmountUsd)),
  }
}

export async function createCashTransfer(params: ActorParams & { input: z.infer<typeof cashTransferSchema> }) {
  const input = cashTransferSchema.parse(params.input)
  if (input.fromAccountId === input.toAccountId) throw new Error("La cuenta origen y destino deben ser diferentes.")
  return prisma.$transaction(async (tx) => {
    const branch = await resolveCashBranchContext(params, tx)
    await assertCashBusinessDateOpen({ tenantId: params.tenantId, branchId: branch.id }, tx)
    const accounts = await tx.cashAccount.findMany({
      where: { id: { in: [input.fromAccountId, input.toAccountId] }, ...accessibleAccountWhere(params.tenantId, branch.id) },
    })
    if (accounts.length !== 2) throw new Error("Cuentas no disponibles")
    const fromAccount = accounts.find((account) => account.id === input.fromAccountId)!
    const toAccount = accounts.find((account) => account.id === input.toAccountId)!
    const fromAmount = decimal(input.fromAmount)
    const exchangeRate = optionalDecimal(input.exchangeRate)
    if (fromAmount.lessThanOrEqualTo(0)) throw new Error("El monto origen debe ser mayor a cero.")
    await assertSufficientBalance({ tenantId: params.tenantId, accountId: fromAccount.id, amount: fromAmount }, tx)
    let toAmount = input.toAmount == null || input.toAmount === "" ? new Prisma.Decimal(0) : decimal(input.toAmount)
    if (input.kind === "CONVERSION") {
      if (!exchangeRate || exchangeRate.lessThanOrEqualTo(0)) throw new Error("La conversion requiere un tipo de cambio valido.")
      if (fromAccount.currency === "ARS" && (toAccount.currency === "USD" || toAccount.currency === "USDT")) {
        toAmount = money(fromAmount.div(exchangeRate))
      } else if ((fromAccount.currency === "USD" || fromAccount.currency === "USDT") && toAccount.currency === "ARS") {
        toAmount = money(fromAmount.mul(exchangeRate))
      } else {
        throw new Error("La conversion debe cambiar entre ARS y USD/USDT.")
      }
    } else if (toAmount.lessThanOrEqualTo(0)) {
      throw new Error("El monto destino debe ser mayor a cero.")
    }
    const now = new Date()
    const fxSnapshot = input.kind === "CONVERSION"
      ? await buildFxConversionSnapshot({
        tenantId: params.tenantId,
        fromAccountId: fromAccount.id,
        fromCurrency: fromAccount.currency,
        toCurrency: toAccount.currency,
        fromAmount,
        toAmount,
        now,
      }, tx)
      : { benchmarkExchangeRate: null, theoreticalAmountUsd: null, realAmountUsd: null, fxResultUsd: null }
    const detail = input.detail?.trim() || getCashTransferKindLabel(input.kind)
    const transfer = await tx.cashTransfer.create({
      data: {
        tenantId: params.tenantId,
        branchId: branch.id,
        kind: input.kind,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        userId: params.actorUserId,
        fromAmount,
        toAmount,
        exchangeRate,
        ...fxSnapshot,
        detail,
      },
    })
    const category = input.kind === "CONVERSION" ? "CONVERSION" : "TRANSFER"
    await tx.cashMovement.createMany({
      data: [
        { tenantId: params.tenantId, branchId: branch.id, accountId: fromAccount.id, userId: params.actorUserId, direction: "EXPENSE", category, detail, amount: fromAmount, currency: fromAccount.currency, exchangeRate, amountUsd: normalizeAmountUsd(fromAmount, fromAccount.currency, exchangeRate), sourceType: "TRANSFER", transferId: transfer.id },
        { tenantId: params.tenantId, branchId: branch.id, accountId: toAccount.id, userId: params.actorUserId, direction: "INCOME", category, detail, amount: toAmount, currency: toAccount.currency, exchangeRate, amountUsd: normalizeAmountUsd(toAmount, toAccount.currency, exchangeRate), sourceType: "TRANSFER", transferId: transfer.id },
      ],
    })
    await createAuditLog({ tenantId: params.tenantId, actorUserId: params.actorUserId, actorRole: params.actorRole as UserRole, action: input.kind === "CONVERSION" ? "CONVERSION" : "CREATE", module: "CASH", entityType: "CashTransfer", entityId: transfer.id, detail }, tx)
    return transfer
  })
}

function serializeAccount(account: {
  id: string
  code: string
  name: string
  type: string
  currency: Currency
  scope: string
  sortOrder: number
  isActive: boolean
  branch: { id: string; name: string; code: string } | null
}, balance?: Prisma.Decimal | null) {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    currency: account.currency,
    scope: account.scope,
    sortOrder: account.sortOrder,
    isActive: account.isActive,
    branch: account.branch,
    balance: serializeDecimal(balance),
    scopeLabel: account.scope === "BRANCH" ? account.branch?.name ?? "Sucursal" : "Global",
  }
}

function serializeMovement(movement: any) {
  return {
    id: movement.id,
    occurredAt: serializeDate(movement.occurredAt),
    direction: movement.direction,
    directionLabel: getCashMovementDirectionLabel(movement.direction),
    category: movement.category,
    categoryLabel: getCashMovementCategoryLabel(movement.category),
    detail: movement.detail,
    amount: serializeDecimal(movement.amount),
    currency: movement.currency,
    exchangeRate: serializeDecimal(movement.exchangeRate),
    amountUsd: serializeDecimal(movement.amountUsd),
    sourceType: movement.sourceType,
    sourceId: movement.sourceId,
    branch: movement.branch ? { id: movement.branch.id, name: movement.branch.name, code: movement.branch.code } : null,
    account: movement.account ? { id: movement.account.id, name: movement.account.name, code: movement.account.code, currency: movement.account.currency, scope: movement.account.scope } : null,
    user: movement.user ? { id: movement.user.id, name: movement.user.name, email: movement.user.email } : null,
    transfer: movement.transfer ? { id: movement.transfer.id, kind: movement.transfer.kind } : null,
    reversalOf: movement.reversalOf ? { id: movement.reversalOf.id, detail: movement.reversalOf.detail } : null,
    reversedBy: movement.reversedBy ? { id: movement.reversedBy.id, detail: movement.reversedBy.detail } : null,
  }
}

export async function getCashDashboardData(params: ActorParams & { date?: string | Date | null }) {
  const branchContext = await resolveUserBranchContext({ userId: params.actorUserId, tenantId: params.tenantId, role: params.actorRole }, prisma)
  const user = await prisma.user.findFirst({
    where: { id: params.actorUserId, tenantId: params.tenantId, isActive: true },
    select: { currentBranchId: true },
  })
  if (!user?.currentBranchId || !branchContext.currentBranch || branchContext.currentBranch.id !== user.currentBranchId) {
    return { blocked: true as const, branch: null, branchError: branchContext.error ?? "Selecciona una sucursal", accounts: [], todaySummary: null, dailyClose: null, currentExchangeReference: null, recentMovements: [] }
  }
  const branch = branchContext.currentBranch
  const range = businessDayRange(params.date)
  const [accounts, balances, todaySummary, dailyClose, recentMovements] = await prisma.$transaction(async (tx) => {
    const accounts = await tx.cashAccount.findMany({
      where: accessibleAccountWhere(params.tenantId, branch.id),
      include: { branch: { select: { id: true, name: true, code: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
    const balances = await getCashAccountBalances({ tenantId: params.tenantId, accountIds: accounts.map((account) => account.id) }, tx)
    const todaySummary = await getTodaySummary({ tenantId: params.tenantId, branchId: branch.id, date: params.date }, tx)
    const dailyClose = await tx.cashDailyClose.findUnique({
      where: { tenantId_branchId_businessDate: { tenantId: params.tenantId, branchId: branch.id, businessDate: range.from } },
      include: { closedBy: { select: { id: true, name: true, email: true } } },
    })
    const recentMovements = await tx.cashMovement.findMany({
      where: { tenantId: params.tenantId, branchId: branch.id, occurredAt: { gte: range.from, lte: range.to } },
      take: 50,
      orderBy: { occurredAt: "desc" },
      include: {
        account: true,
        branch: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, name: true, email: true } },
        transfer: { select: { id: true, kind: true } },
        reversalOf: { select: { id: true, detail: true } },
        reversedBy: { select: { id: true, detail: true } },
      },
    })
    return [accounts, balances, todaySummary, dailyClose, recentMovements] as const
  })
  return {
    blocked: false as const,
    branch,
    branchError: branchContext.error,
    accounts: accounts.map((account) => serializeAccount(account, balances.get(account.id))),
    todaySummary: {
      ...todaySummary,
      incomeUsd: serializeDecimal(todaySummary.incomeUsd),
      expenseUsd: serializeDecimal(todaySummary.expenseUsd),
      netUsd: serializeDecimal(todaySummary.netUsd),
    },
    dailyClose: dailyClose ? {
      id: dailyClose.id,
      businessDate: businessDateFrom(dailyClose.businessDate),
      closedAt: serializeDate(dailyClose.closedAt),
      closedBy: dailyClose.closedBy ? { id: dailyClose.closedBy.id, name: dailyClose.closedBy.name, email: dailyClose.closedBy.email } : null,
      incomeUsd: serializeDecimal(dailyClose.incomeUsd),
      expenseUsd: serializeDecimal(dailyClose.expenseUsd),
      netUsd: serializeDecimal(dailyClose.netUsd),
      notes: dailyClose.notes,
    } : null,
    currentExchangeReference: null,
    recentMovements: recentMovements.map(serializeMovement),
  }
}

export async function getCashMovements(params: ActorParams & { query: z.infer<typeof cashMovementsQuerySchema> }) {
  const input = cashMovementsQuerySchema.parse(params.query)
  const branch = await resolveCashBranchContext(params)
  const from = input.from ? businessDayRange(input.from).from : undefined
  const to = input.to ? businessDayRange(input.to).to : undefined
  const where: Prisma.CashMovementWhereInput = {
    tenantId: params.tenantId,
    branchId: branch.id,
    ...(input.direction ? { direction: input.direction } : {}),
    ...(input.accountId ? { accountId: input.accountId } : {}),
    ...(from || to ? { occurredAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(input.search?.trim() ? { detail: { contains: input.search.trim(), mode: "insensitive" } } : {}),
  }
  const [total, items] = await prisma.$transaction([
    prisma.cashMovement.count({ where }),
    prisma.cashMovement.findMany({
      where,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      orderBy: { occurredAt: "desc" },
      include: {
        account: true,
        branch: { select: { id: true, name: true, code: true } },
        user: { select: { id: true, name: true, email: true } },
        transfer: { select: { id: true, kind: true } },
        reversalOf: { select: { id: true, detail: true } },
        reversedBy: { select: { id: true, detail: true } },
      },
    }),
  ])
  return {
    items: items.map(serializeMovement),
    pagination: { page: input.page, pageSize: input.pageSize, total, pages: Math.ceil(total / input.pageSize) },
    filtersMeta: { branch },
  }
}

export async function getFxConversionReport(params: ActorParams & { from?: string | null; to?: string | null }) {
  const branch = await resolveCashBranchContext(params)
  const from = businessDayRange(params.from ?? undefined).from
  const to = params.to ? businessDayRange(params.to).to : businessDayRange(new Date()).to
  const transfers = await prisma.cashTransfer.findMany({
    where: { tenantId: params.tenantId, branchId: branch.id, kind: "CONVERSION", occurredAt: { gte: from, lte: to } },
    orderBy: { occurredAt: "desc" },
    include: { fromAccount: true, toAccount: true },
  })
  const rows = transfers
    .filter((transfer) => transfer.fromAccount.currency === "ARS" && (transfer.toAccount.currency === "USD" || transfer.toAccount.currency === "USDT"))
    .map((transfer) => ({
      transferId: transfer.id,
      occurredAt: serializeDate(transfer.occurredAt),
      type: getCashTransferKindLabel(transfer.kind),
      fromAccount: transfer.fromAccount.name,
      toAccount: transfer.toAccount.name,
      fromAmount: serializeDecimal(transfer.fromAmount),
      theoreticalAmountUsd: serializeDecimal(transfer.theoreticalAmountUsd),
      realAmountUsd: serializeDecimal(transfer.realAmountUsd),
      benchmarkExchangeRate: serializeDecimal(transfer.benchmarkExchangeRate),
      exchangeRate: serializeDecimal(transfer.exchangeRate),
      fxResultUsd: serializeDecimal(transfer.fxResultUsd),
      detail: transfer.detail,
      isReconstructed: false,
    }))
  const preciseRows = rows.filter((row) => row.fxResultUsd != null && row.theoreticalAmountUsd != null && row.realAmountUsd != null)
  const summary = preciseRows.reduce((acc, row) => ({
    conversions: acc.conversions + 1,
    totalTheoreticalUsd: acc.totalTheoreticalUsd + (row.theoreticalAmountUsd ?? 0),
    totalRealUsd: acc.totalRealUsd + (row.realAmountUsd ?? 0),
    totalFxResultUsd: acc.totalFxResultUsd + (row.fxResultUsd ?? 0),
  }), { conversions: 0, totalTheoreticalUsd: 0, totalRealUsd: 0, totalFxResultUsd: 0 })
  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      ...summary,
      averageBenchmarkRate: preciseRows.length
        ? preciseRows.reduce((sum, row) => sum + (row.benchmarkExchangeRate ?? 0), 0) / preciseRows.length
        : null,
    },
    rows,
    warnings: rows.length > preciseRows.length ? ["Hay conversiones legacy o sin base historica suficiente excluidas de metricas precisas."] : [],
  }
}

export async function closeCashBusinessDay(params: ActorParams & { input: z.infer<typeof cashCloseSchema> }) {
  const input = cashCloseSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    const branch = await resolveCashBranchContext(params, tx)
    const range = businessDayRange(input.businessDate)
    const existing = await tx.cashDailyClose.findUnique({
      where: { tenantId_branchId_businessDate: { tenantId: params.tenantId, branchId: branch.id, businessDate: range.from } },
      select: { id: true },
    })
    if (existing) throw new Error("La caja diaria ya fue cerrada para esta sucursal.")
    const accounts = await tx.cashAccount.findMany({
      where: accessibleAccountWhere(params.tenantId, branch.id),
      include: { branch: { select: { id: true, name: true, code: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
    const balances = await getCashAccountBalances({ tenantId: params.tenantId, accountIds: accounts.map((account) => account.id) }, tx)
    const summary = await getTodaySummary({ tenantId: params.tenantId, branchId: branch.id, date: range.businessDate }, tx)
    const close = await tx.cashDailyClose.create({
      data: {
        tenantId: params.tenantId,
        branchId: branch.id,
        closedById: params.actorUserId,
        businessDate: range.from,
        incomeUsd: summary.incomeUsd,
        expenseUsd: summary.expenseUsd,
        netUsd: summary.netUsd,
        notes: input.notes?.trim() || null,
        accountSnapshots: {
          create: accounts.map((account) => {
            const balance = balances.get(account.id) ?? new Prisma.Decimal(0)
            return {
              accountId: account.id,
              currency: account.currency,
              balance,
              balanceUsd: account.currency === "ARS" ? null : balance,
            }
          }),
        },
      },
      include: { accountSnapshots: true, closedBy: { select: { id: true, name: true, email: true } } },
    })
    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole as UserRole,
      action: "CASH_CLOSE",
      module: "CASH",
      entityType: "CashDailyClose",
      entityId: close.id,
      detail: `Cierre diario de caja - ${branch.name} - ${range.businessDate}`,
      newValue: {
        incomeUsd: serializeDecimal(close.incomeUsd),
        expenseUsd: serializeDecimal(close.expenseUsd),
        netUsd: serializeDecimal(close.netUsd),
        accountBalances: close.accountSnapshots.map((snapshot) => ({
          accountId: snapshot.accountId,
          currency: snapshot.currency,
          balance: serializeDecimal(snapshot.balance),
          balanceUsd: serializeDecimal(snapshot.balanceUsd),
        })),
      },
    }, tx)
    return close
  })
}
