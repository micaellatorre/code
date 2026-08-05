import { Prisma, type Currency, type PaymentMethod, type UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getProductDisplayModel, getProductDisplayParts, type ProductCatalogDisplayProduct } from "@/lib/products/display"
import { productCatalogDisplaySelect } from "@/lib/products/selects"

export type DatabaseTabKey =
  | "cash"
  | "retail"
  | "wholesale"
  | "purchases"
  | "reservations"
  | "closers"
  | "service"
  | "audit"
  | "buyers"

export type DatabasePeriodKey = "today" | "week" | "month" | "previous-month" | "last-30" | "custom"

export type DatabaseDateRange = {
  from: Date
  to: Date
  label: string
}

export type MoneyValue = {
  amount: number | null
  currency: Currency | "USD" | "ARS" | "USDT"
}

export type DatabaseKpis = {
  totalSales: number
  retailMargin: number | null
  wholesaleMargin: number | null
  serviceMargin: number | null
  grossMarginPct: number | null
}

export type DatabasePaymentLine = {
  method: PaymentMethod | string
  currency: Currency | string
  amount: number
  exchangeRate: number | null
  amountUsd: number | null
}

export type DatabaseRetailSaleRow = {
  id: string
  date: string
  seller: string
  branch: string
  customer: string
  itemSummary: string
  itemMeta: string | null
  total: number
  amountPaid: number
  balanceDue: number
  payments: DatabasePaymentLine[]
  costTotal: number | null
  profit: number | null
  status: string
  financialStatus: string
}

export type DatabaseWholesaleSaleRow = DatabaseRetailSaleRow & {
  agreedPrice: number
  originalAmount: string
  paidUsd: number | null
}

export type DatabasePurchaseRow = {
  id: string
  date: string
  supplier: string
  supplierProvince: string | null
  supplierCity: string | null
  model: string
  imeiSerial: string | null
  code: string
  total: number
  currency: Currency | string
  amountPaid: number | null
  quantity: number
  debt: number | null
}

export type DatabaseReservationRow = {
  id: string
  source: "RESERVATION" | "LEGACY"
  reservedAt: string
  customer: string
  item: string
  pickupAt: string | null
  agreedPrice: number | null
  depositUsd: number | null
  gifts: string | null
  status: string
}

export type DatabaseServiceOrderRow = {
  id: string
  date: string
  type: string
  customerEquipment: string
  modelFailure: string
  technician: string
  costAmount: number | null
  priceAmount: number | null
  currency: Currency | string
  status: string
}

export type DatabaseAuditRow = {
  id: string
  date: string
  action: string
  module: string
  detail: string
  user: string
}

export type DatabaseCashRow = {
  id: string
  source: "CASH_MOVEMENT" | "LEGACY_PAYMENT" | "LEGACY_PURCHASE" | "LEGACY_REVERSAL"
  date: string
  detail: string
  amount: number
  account: string
  currency: Currency | string
  exchangeRate: number | null
  amountUsd: number | null
  type: string
}

export type DatabaseBuyerRow = {
  id: string
  name: string
  type: string
  province: string | null
  registeredBranch: string | null
  instagram: string | null
  phone: string | null
  lastPurchaseAt: string | null
  operations: number
  totalPurchased: number
  balanceDue: number
}

export type DatabaseCloserRow = {
  id: string
  date: string
  closer: string
  sale: string
  baseAmount: number
  ratePct: number
  amount: number
  currency: Currency | string
  status: string
}

export type DatabaseReadModel = {
  kpis: DatabaseKpis
  cash: DatabaseCashRow[]
  retail: DatabaseRetailSaleRow[]
  wholesale: DatabaseWholesaleSaleRow[]
  purchases: DatabasePurchaseRow[]
  reservations: DatabaseReservationRow[]
  closers: DatabaseCloserRow[]
  service: DatabaseServiceOrderRow[]
  audit: DatabaseAuditRow[]
  buyers: DatabaseBuyerRow[]
}

export const databaseTabLabels: Record<DatabaseTabKey, string> = {
  cash: "Caja",
  retail: "Minorista",
  wholesale: "Mayorista",
  purchases: "Proveedores",
  reservations: "Guardados",
  closers: "Closers",
  service: "Serv. Tecnico",
  audit: "Trazabilidad",
  buyers: "Compradores",
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

export function resolveDatabaseDateRange(period: DatabasePeriodKey, from?: string | null, to?: string | null): DatabaseDateRange {
  const now = new Date()
  const todayStart = startOfDay(now)

  if (period === "custom" && from && to) {
    return {
      from: startOfDay(new Date(`${from}T00:00:00`)),
      to: endOfDay(new Date(`${to}T00:00:00`)),
      label: `${from} - ${to}`,
    }
  }

  if (period === "today") {
    return { from: todayStart, to: endOfDay(now), label: "Hoy" }
  }

  if (period === "week") {
    const day = todayStart.getDay() || 7
    return { from: new Date(todayStart.getTime() - (day - 1) * MS_PER_DAY), to: endOfDay(now), label: "Esta semana" }
  }

  if (period === "previous-month") {
    const firstCurrent = new Date(now.getFullYear(), now.getMonth(), 1)
    const firstPrevious = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return { from: firstPrevious, to: endOfDay(new Date(firstCurrent.getTime() - MS_PER_DAY)), label: "Mes anterior" }
  }

  if (period === "last-30") {
    return { from: startOfDay(new Date(now.getTime() - 29 * MS_PER_DAY)), to: endOfDay(now), label: "Ultimos 30 dias" }
  }

  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: endOfDay(now),
    label: "Este mes",
  }
}

export function normalizeDatabasePeriod(value: string | string[] | undefined): DatabasePeriodKey {
  const current = Array.isArray(value) ? value[0] : value
  if (current === "today" || current === "week" || current === "month" || current === "previous-month" || current === "last-30" || current === "custom") {
    return current
  }
  return "month"
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function nullableNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return null
  return toNumber(value)
}

function displayUser(user: { name: string | null; email: string } | null | undefined) {
  return user?.name?.trim() || user?.email || "-"
}

function buyerName(buyer: { name: string; surname: string | null; businessName?: string | null } | null | undefined, fallback?: string | null) {
  if (!buyer) return fallback?.trim() || "Consumidor Final"
  const fullName = [buyer.name, buyer.surname].filter(Boolean).join(" ").trim()
  return buyer.businessName ? `${fullName} (${buyer.businessName})` : fullName
}

function productCode(index: number) {
  return `A${String(index + 1).padStart(3, "0")}`
}

function saleItemSummary(items: Array<{ units: number; product: ProductCatalogDisplayProduct & { type?: string | null; modelName: string; capacityGB: number | null; color: string | null; imei: string | null } }>) {
  const first = items[0]
  if (!first) return { summary: "Sin items", meta: null }
  const parts = getProductDisplayParts(first.product)
  const suffix = items.length > 1 ? ` +${items.length - 1} items` : ""
  return {
    summary: `${parts.join(" ")}${suffix}`,
    meta: first.product.imei ? `IMEI ${first.product.imei}` : null,
  }
}

function resolveSaleType(sale: { saleType: string | null; buyer: { type: string } | null }) {
  return sale.saleType ?? sale.buyer?.type ?? "MINORISTA"
}

function paymentLine(payment: {
  method: PaymentMethod | string
  currency: Currency | string
  amount: Prisma.Decimal
  exchangeRate?: Prisma.Decimal | null
  amountUsd?: Prisma.Decimal | null
}): DatabasePaymentLine {
  return {
    method: payment.method,
    currency: payment.currency,
    amount: toNumber(payment.amount),
    exchangeRate: nullableNumber(payment.exchangeRate),
    amountUsd: nullableNumber(payment.amountUsd),
  }
}

function financialStatus(balanceDue: Prisma.Decimal | number | string | null | undefined) {
  const balance = toNumber(balanceDue)
  return balance <= 0 ? "SALDADO" : `DEBE USD ${balance.toFixed(2)}`
}

export function canSeeDatabaseFinancials(role: UserRole | string) {
  return role === "ADMIN" || role === "SOCIO"
}

export async function getDatabaseReadModel(params: {
  tenantId: string
  range: DatabaseDateRange
  role: UserRole | string
}): Promise<DatabaseReadModel> {
  const canSeeFinancials = canSeeDatabaseFinancials(params.role)
  const whereDate = { gte: params.range.from, lte: params.range.to }

  const [sales, purchases, reservations, legacyReservedProducts, serviceOrders, auditLogs, cashMovements, buyers, closerCommissions] = await Promise.all([
    prisma.sale.findMany({
      where: { tenantId: params.tenantId, date: whereDate },
      orderBy: { date: "desc" },
      include: {
        buyer: { select: { id: true, type: true, name: true, surname: true, businessName: true } },
        branch: { select: { name: true } },
        user: { select: { id: true, name: true, email: true } },
        payments: { orderBy: { paidAt: "asc" } },
        items: {
          include: {
            product: { select: { id: true, type: true, modelName: true, capacityGB: true, color: true, imei: true, ...productCatalogDisplaySelect } },
          },
        },
      },
    }),
    prisma.purchase.findMany({
      where: { tenantId: params.tenantId, date: whereDate },
      orderBy: { date: "desc" },
      include: {
        supplier: { select: { name: true, city: true, provinceRef: { select: { name: true } } } },
        payments: { orderBy: { paidAt: "asc" } },
        items: {
          include: {
            product: { select: { modelName: true, imei: true, ...productCatalogDisplaySelect } },
          },
        },
      },
    }),
    prisma.reservation.findMany({
      where: { tenantId: params.tenantId, reservedAt: whereDate },
      orderBy: { reservedAt: "desc" },
      include: {
        buyer: { select: { name: true, surname: true, businessName: true } },
        payments: true,
        items: { include: { product: { select: { modelName: true, imei: true, ...productCatalogDisplaySelect } } } },
      },
    }),
    prisma.product.findMany({
      where: { tenantId: params.tenantId, senado: true, senadoAt: whereDate },
      orderBy: { senadoAt: "desc" },
      select: { id: true, senadoAt: true, modelName: true, imei: true, salePrice: true, notes: true, ...productCatalogDisplaySelect },
    }),
    prisma.serviceOrder.findMany({
      where: { tenantId: params.tenantId, receivedAt: whereDate },
      orderBy: { receivedAt: "desc" },
      include: {
        buyer: { select: { name: true, surname: true, businessName: true } },
        technician: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { tenantId: params.tenantId, createdAt: whereDate },
      orderBy: { createdAt: "desc" },
      include: { actorUser: { select: { name: true, email: true } } },
    }),
    canSeeFinancials ? prisma.cashMovement.findMany({
      where: { tenantId: params.tenantId, occurredAt: whereDate },
      orderBy: { occurredAt: "desc" },
      include: {
        account: { select: { name: true, code: true } },
      },
    }) : Promise.resolve([]),
    prisma.buyer.findMany({
      where: { tenantId: params.tenantId },
      orderBy: { updatedAt: "desc" },
      take: 300,
      include: {
        provinceRef: { select: { name: true } },
        registeredBranch: { select: { name: true } },
        sales: {
          where: { date: whereDate, status: { not: "CANCELADA" } },
          select: { date: true, total: true, balanceDue: true },
        },
      },
    }),
    prisma.closerCommission.findMany({
      where: { tenantId: params.tenantId, earnedAt: whereDate },
      orderBy: { earnedAt: "desc" },
      include: {
        closer: { select: { name: true, email: true } },
        sale: { select: { id: true } },
      },
    }),
  ])

  const activeSales = sales.filter((sale) => sale.status !== "CANCELADA")
  const retailSales = activeSales.filter((sale) => resolveSaleType(sale) === "MINORISTA")
  const wholesaleSales = activeSales.filter((sale) => resolveSaleType(sale) === "MAYORISTA")
  const serviceMargin = serviceOrders.reduce((sum, order) => sum + toNumber(order.priceAmount) - toNumber(order.costAmount), 0)
  const totalSales = activeSales.reduce((sum, sale) => sum + toNumber(sale.total), 0)
  const totalProfit = activeSales.reduce((sum, sale) => sum + toNumber(sale.profit), 0)

  const toSaleRow = (sale: (typeof sales)[number]): DatabaseRetailSaleRow => {
    const item = saleItemSummary(sale.items)
    return {
      id: sale.id,
      date: sale.date.toISOString(),
      seller: displayUser(sale.user),
      branch: sale.branch?.name ?? "-",
      customer: buyerName(sale.buyer, sale.customerName),
      itemSummary: item.summary,
      itemMeta: item.meta,
      total: toNumber(sale.total),
      amountPaid: toNumber(sale.amountPaid),
      balanceDue: toNumber(sale.balanceDue),
      payments: sale.payments.map(paymentLine),
      costTotal: canSeeFinancials ? toNumber(sale.costTotal) : null,
      profit: canSeeFinancials ? toNumber(sale.profit) : null,
      status: sale.status,
      financialStatus: financialStatus(sale.balanceDue),
    }
  }

  const retail = retailSales.map(toSaleRow)
  const wholesale = wholesaleSales.map((sale) => {
    const row = toSaleRow(sale)
    const agreedPrice = sale.items.reduce((sum, item) => sum + toNumber(item.unitPrice) * item.units, 0)
    const originalAmount = sale.payments.map((payment) => `${payment.currency} ${toNumber(payment.amount).toFixed(2)}`).join(" + ")
    const paidUsd = sale.payments.reduce((sum, payment) => {
      if (payment.amountUsd != null) return sum + toNumber(payment.amountUsd)
      if (payment.currency === "USD" || payment.currency === "USDT") return sum + toNumber(payment.amount)
      return sum
    }, 0)
    return { ...row, agreedPrice, originalAmount, paidUsd }
  })

  const purchaseRows = purchases.map((purchase, index): DatabasePurchaseRow => {
    const firstItem = purchase.items[0]
    const paymentsUsd = purchase.payments.reduce((sum, payment) => {
      if (payment.amountUsd != null) return sum + toNumber(payment.amountUsd)
      if (payment.currency === "USD" || payment.currency === "USDT") return sum + toNumber(payment.amount)
      return sum
    }, 0)
    const legacyPaid = purchase.downPayment != null ? toNumber(purchase.downPayment) : 0
    const amountPaid = purchase.payments.length ? paymentsUsd : legacyPaid
    return {
      id: purchase.id,
      date: purchase.date.toISOString(),
      supplier: purchase.supplier.name,
      supplierProvince: purchase.supplier.provinceRef?.name ?? null,
      supplierCity: purchase.supplier.city,
      model: firstItem?.product ? getProductDisplayModel(firstItem.product) : "Compra sin items",
      imeiSerial: firstItem?.product.imei ?? null,
      code: productCode(index),
      total: toNumber(purchase.totalCost),
      currency: purchase.currency,
      amountPaid,
      quantity: purchase.items.reduce((sum, item) => sum + item.units, 0),
      debt: toNumber(purchase.totalCost) - amountPaid,
    }
  })

  const reservationRows: DatabaseReservationRow[] = [
    ...reservations.map((reservation) => {
      const firstItem = reservation.items[0]
      const depositUsd = reservation.payments.reduce((sum, payment) => {
        if (payment.amountUsd != null) return sum + toNumber(payment.amountUsd)
        if (payment.currency === "USD" || payment.currency === "USDT") return sum + toNumber(payment.amount)
        return sum
      }, 0)
      return {
        id: reservation.id,
        source: "RESERVATION" as const,
        reservedAt: reservation.reservedAt.toISOString(),
        customer: buyerName(reservation.buyer),
        item: firstItem?.product ? getProductDisplayModel(firstItem.product) : firstItem?.itemName ?? "Reserva sin item",
        pickupAt: reservation.pickupAt?.toISOString() ?? null,
        agreedPrice: nullableNumber(reservation.agreedTotal),
        depositUsd,
        gifts: firstItem?.gifts ? "Ver detalle" : null,
        status: reservation.status,
      }
    }),
    ...activeSales.filter((sale) => sale.status === "SENADA").map((sale) => {
      const item = saleItemSummary(sale.items)
      return {
        id: sale.id,
        source: "LEGACY" as const,
        reservedAt: sale.date.toISOString(),
        customer: buyerName(sale.buyer, sale.customerName),
        item: item.summary,
        pickupAt: null,
        agreedPrice: toNumber(sale.total),
        depositUsd: toNumber(sale.amountPaid),
        gifts: null,
        status: "ACTIVE",
      }
    }),
    ...legacyReservedProducts.map((product) => ({
      id: product.id,
      source: "LEGACY" as const,
      reservedAt: (product.senadoAt ?? new Date()).toISOString(),
      customer: "Reserva legacy",
      item: getProductDisplayModel(product),
      pickupAt: null,
      agreedPrice: toNumber(product.salePrice),
      depositUsd: null,
      gifts: null,
      status: "ACTIVE",
    })),
  ].sort((a, b) => b.reservedAt.localeCompare(a.reservedAt))

  const service = serviceOrders.map((order): DatabaseServiceOrderRow => ({
    id: order.id,
    date: order.receivedAt.toISOString(),
    type: order.type,
    customerEquipment: `${buyerName(order.buyer, null)} / ${order.modelName}`,
    modelFailure: `${order.modelName} - ${order.failureDescription}`,
    technician: displayUser(order.technician),
    costAmount: canSeeFinancials ? nullableNumber(order.costAmount) : null,
    priceAmount: nullableNumber(order.priceAmount),
    currency: order.currency,
    status: order.status,
  }))

  const audit = auditLogs.map((log): DatabaseAuditRow => ({
    id: log.id,
    date: log.createdAt.toISOString(),
    action: log.action,
    module: log.module,
    detail: log.detail,
    user: displayUser(log.actorUser),
  }))

  const cash: DatabaseCashRow[] = canSeeFinancials ? [
    ...cashMovements.map((movement) => ({
      id: movement.id,
      source: "CASH_MOVEMENT" as const,
      date: movement.occurredAt.toISOString(),
      detail: movement.detail,
      amount: toNumber(movement.amount),
      account: movement.account.name || movement.account.code,
      currency: movement.currency,
      exchangeRate: nullableNumber(movement.exchangeRate),
      amountUsd: nullableNumber(movement.amountUsd),
      type: movement.direction,
    })),
    ...activeSales.flatMap((sale) =>
      sale.payments.map((payment) => ({
        id: payment.id,
        source: "LEGACY_PAYMENT" as const,
        date: payment.paidAt.toISOString(),
        detail: `Venta ${buyerName(sale.buyer, sale.customerName)}`,
        amount: toNumber(payment.amount),
        account: payment.method,
        currency: payment.currency,
        exchangeRate: nullableNumber(payment.exchangeRate),
        amountUsd: nullableNumber(payment.amountUsd),
        type: "INGRESO",
      })),
    ),
    ...purchases
      .filter((purchase) => purchase.downPayment != null)
      .map((purchase) => ({
        id: `purchase-${purchase.id}`,
        source: "LEGACY_PURCHASE" as const,
        date: purchase.date.toISOString(),
        detail: `Adelanto compra ${purchase.supplier.name}`,
        amount: toNumber(purchase.downPayment),
        account: "Purchase.downPayment",
        currency: purchase.currency,
        exchangeRate: null,
        amountUsd: purchase.currency === "USD" || purchase.currency === "USDT" ? toNumber(purchase.downPayment) : null,
        type: "EGRESO",
      })),
  ].sort((a, b) => b.date.localeCompare(a.date)) : []

  const buyerRows = buyers.map((buyer): DatabaseBuyerRow => {
    const lastPurchase = buyer.sales.reduce<Date | null>((latest, sale) => {
      if (!latest || sale.date > latest) return sale.date
      return latest
    }, null)
    return {
      id: buyer.id,
      name: buyerName(buyer),
      type: buyer.type,
      province: buyer.provinceRef?.name ?? buyer.province,
      registeredBranch: buyer.registeredBranch?.name ?? null,
      instagram: buyer.instagram,
      phone: buyer.phone,
      lastPurchaseAt: lastPurchase?.toISOString() ?? null,
      operations: buyer.sales.length,
      totalPurchased: buyer.sales.reduce((sum, sale) => sum + toNumber(sale.total), 0),
      balanceDue: buyer.sales.reduce((sum, sale) => sum + toNumber(sale.balanceDue), 0),
    }
  })

  const closers = closerCommissions.map((commission): DatabaseCloserRow => ({
    id: commission.id,
    date: commission.earnedAt.toISOString(),
    closer: displayUser(commission.closer),
    sale: commission.sale.id,
    baseAmount: toNumber(commission.baseAmount),
    ratePct: toNumber(commission.ratePct),
    amount: toNumber(commission.amount),
    currency: commission.currency,
    status: commission.status,
  }))

  return {
    kpis: {
      totalSales,
      retailMargin: canSeeFinancials ? retailSales.reduce((sum, sale) => sum + toNumber(sale.profit), 0) : null,
      wholesaleMargin: canSeeFinancials ? wholesaleSales.reduce((sum, sale) => sum + toNumber(sale.profit), 0) : null,
      serviceMargin: canSeeFinancials ? serviceMargin : null,
      grossMarginPct: canSeeFinancials && totalSales > 0 ? (totalProfit / totalSales) * 100 : null,
    },
    cash,
    retail,
    wholesale,
    purchases: purchaseRows,
    reservations: reservationRows,
    closers,
    service,
    audit,
    buyers: buyerRows,
  }
}

export function getProductLocationLabel(product: { branch?: { name: string } | null; location?: string | null }) {
  return product.branch?.name ?? product.location ?? "-"
}
