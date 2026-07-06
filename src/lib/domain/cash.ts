import { Prisma, type UserRole } from "@prisma/client"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/domain/audit"
import { decimal, normalizeAmountUsd, optionalDecimal } from "@/lib/domain/money"

export const cashAccountSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.enum(["CASH", "BANK", "DIGITAL_WALLET", "CRYPTO", "OTHER"]),
  currency: z.enum(["ARS", "USD", "USDT"]),
  isActive: z.boolean().optional(),
})

export const cashMovementSchema = z.object({
  accountId: z.string().min(1),
  direction: z.enum(["INCOME", "EXPENSE"]),
  category: z.enum(["SALE_PAYMENT", "RESERVATION_DEPOSIT", "PURCHASE_PAYMENT", "EXPENSE", "SERVICE_PAYMENT", "COMMISSION_PAYMENT", "TRANSFER", "CONVERSION", "ADJUSTMENT", "REVERSAL"]),
  detail: z.string().trim().min(1),
  amount: z.union([z.string(), z.number()]),
  currency: z.enum(["ARS", "USD", "USDT"]),
  exchangeRate: z.union([z.string(), z.number()]).optional().nullable(),
})

export const cashTransferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  fromAmount: z.union([z.string(), z.number()]),
  toAmount: z.union([z.string(), z.number()]),
  exchangeRate: z.union([z.string(), z.number()]).optional().nullable(),
  detail: z.string().optional().nullable(),
})

export async function createCashAccount(params: { tenantId: string; actorUserId: string; actorRole: UserRole; input: z.infer<typeof cashAccountSchema> }) {
  const input = cashAccountSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    const account = await tx.cashAccount.create({ data: { tenantId: params.tenantId, ...input, isActive: input.isActive ?? true } })
    await createAuditLog({ tenantId: params.tenantId, actorUserId: params.actorUserId, actorRole: params.actorRole, action: "CREATE", module: "CASH", entityType: "CashAccount", entityId: account.id, detail: `Cuenta creada: ${account.name}` }, tx)
    return account
  })
}

export async function createCashMovement(params: { tenantId: string; actorUserId: string; actorRole: UserRole; input: z.infer<typeof cashMovementSchema> }) {
  const input = cashMovementSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    const account = await tx.cashAccount.findFirst({ where: { id: input.accountId, tenantId: params.tenantId, isActive: true } })
    if (!account) throw new Error("Cuenta no disponible")
    const amount = decimal(input.amount)
    const exchangeRate = optionalDecimal(input.exchangeRate)
    const movement = await tx.cashMovement.create({
      data: {
        tenantId: params.tenantId,
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
    })
    await createAuditLog({ tenantId: params.tenantId, actorUserId: params.actorUserId, actorRole: params.actorRole, action: input.direction === "INCOME" ? "CASH_IN" : "CASH_OUT", module: "CASH", entityType: "CashMovement", entityId: movement.id, detail: input.detail }, tx)
    return movement
  })
}

export async function reverseCashMovement(params: { tenantId: string; movementId: string; actorUserId: string; actorRole: UserRole }) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.cashMovement.findFirst({ where: { id: params.movementId, tenantId: params.tenantId } })
    if (!original) throw new Error("Movimiento no encontrado")
    const reversal = await tx.cashMovement.create({
      data: {
        tenantId: params.tenantId,
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
        sourceId: original.id,
      },
    })
    await createAuditLog({ tenantId: params.tenantId, actorUserId: params.actorUserId, actorRole: params.actorRole, action: "CREATE", module: "CASH", entityType: "CashMovement", entityId: reversal.id, detail: `Reversa de movimiento ${original.id}` }, tx)
    return reversal
  })
}

export async function createCashTransfer(params: { tenantId: string; actorUserId: string; actorRole: UserRole; input: z.infer<typeof cashTransferSchema> }) {
  const input = cashTransferSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    const accounts = await tx.cashAccount.findMany({ where: { id: { in: [input.fromAccountId, input.toAccountId] }, tenantId: params.tenantId, isActive: true } })
    if (accounts.length !== 2) throw new Error("Cuentas no disponibles")
    const fromAccount = accounts.find((account) => account.id === input.fromAccountId)!
    const toAccount = accounts.find((account) => account.id === input.toAccountId)!
    const fromAmount = decimal(input.fromAmount)
    const toAmount = decimal(input.toAmount)
    const exchangeRate = optionalDecimal(input.exchangeRate)
    const transfer = await tx.cashTransfer.create({
      data: {
        tenantId: params.tenantId,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        userId: params.actorUserId,
        fromAmount,
        toAmount,
        exchangeRate,
        detail: input.detail?.trim() || null,
      },
    })
    await tx.cashMovement.createMany({
      data: [
        { tenantId: params.tenantId, accountId: fromAccount.id, userId: params.actorUserId, direction: "EXPENSE", category: "TRANSFER", detail: input.detail || "Transferencia", amount: fromAmount, currency: fromAccount.currency, exchangeRate, amountUsd: normalizeAmountUsd(fromAmount, fromAccount.currency, exchangeRate), sourceType: "TRANSFER", transferId: transfer.id },
        { tenantId: params.tenantId, accountId: toAccount.id, userId: params.actorUserId, direction: "INCOME", category: "TRANSFER", detail: input.detail || "Transferencia", amount: toAmount, currency: toAccount.currency, exchangeRate, amountUsd: normalizeAmountUsd(toAmount, toAccount.currency, exchangeRate), sourceType: "TRANSFER", transferId: transfer.id },
      ],
    })
    await createAuditLog({ tenantId: params.tenantId, actorUserId: params.actorUserId, actorRole: params.actorRole, action: "CONVERSION", module: "CASH", entityType: "CashTransfer", entityId: transfer.id, detail: input.detail || "Transferencia de caja" }, tx)
    return transfer
  })
}
