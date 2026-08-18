import { Prisma, type TenantSettings } from "@prisma/client"
import { z } from "zod"
import prisma from "@/lib/prisma"

const DEFAULT_FINANCIAL_FEE_RATE_PCT = new Prisma.Decimal("3.5")

export const settingsPatchSchema = z.object({
  tenantName: z.string().trim().min(1, "El nombre del negocio es obligatorio").max(140).optional(),
  servicePickupAlertDays: z.coerce.number().int().min(0).optional(),
  stockRotationHighMaxDays: z.coerce.number().int().min(0).optional(),
  stockRotationMediumMaxDays: z.coerce.number().int().min(0).optional(),
  accessoryLowStockThreshold: z.coerce.number().int().min(0).optional(),
  wholesalePricesEnabled: z.coerce.boolean().optional(),
  closerCommissionsEnabled: z.coerce.boolean().optional(),
  financialFeeEnabled: z.coerce.boolean().optional(),
  financialFeeRatePct: z.coerce.number().min(0).max(100).optional(),
  bnaInstallmentsEnabled: z.coerce.boolean().optional(),
  bnaMarkupRatePct: z.coerce.number().min(0).max(100).optional(),
  bnaDefaultInstallments: z.coerce.number().int().min(1).max(12).optional(),
  bnaCustomerRebatePct: z.coerce.number().min(0).max(100).optional(),
  bnaCustomerRebateCapArs: z.coerce.number().min(0).optional(),
  usedDeviceWarrantyDays: z.coerce.number().int().min(0).optional(),
  warrantyPolicyText: z.string().max(5000).optional(),
}).superRefine((value, ctx) => {
  const high = value.stockRotationHighMaxDays
  const medium = value.stockRotationMediumMaxDays

  if (high !== undefined && medium !== undefined && medium <= high) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["stockRotationMediumMaxDays"],
      message: "La rotacion media debe superar a la rotacion alta.",
    })
  }

  if (value.financialFeeEnabled && Number(value.financialFeeRatePct ?? 0) <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["financialFeeRatePct"],
      message: "El recargo de transferencia requiere un porcentaje mayor a 0.",
    })
  }

  if (value.bnaInstallmentsEnabled && Number(value.bnaMarkupRatePct ?? 0) <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bnaMarkupRatePct"],
      message: "Cuotas BNA requiere un recargo mayor a 0.",
    })
  }
})

export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>

export function serializeTenantSettings(settings: TenantSettings) {
  const hasFinancialFeeRate = settings.financialFeeRatePct.greaterThan(0)
  const hasLegacyEmptyFinancialFee = !settings.financialFeeEnabled && !hasFinancialFeeRate

  return {
    id: settings.id,
    tenantId: settings.tenantId,
    servicePickupAlertDays: settings.servicePickupAlertDays,
    stockRotationHighMaxDays: settings.stockRotationHighMaxDays,
    stockRotationMediumMaxDays: settings.stockRotationMediumMaxDays,
    accessoryLowStockThreshold: settings.accessoryLowStockThreshold,
    wholesalePricesEnabled: settings.wholesalePricesEnabled,
    closerCommissionsEnabled: settings.closerCommissionsEnabled,
    financialFeeEnabled: hasLegacyEmptyFinancialFee ? true : settings.financialFeeEnabled,
    financialFeeRatePct: String(hasFinancialFeeRate ? settings.financialFeeRatePct : DEFAULT_FINANCIAL_FEE_RATE_PCT),
    bnaInstallmentsEnabled: settings.bnaInstallmentsEnabled,
    bnaMarkupRatePct: String(settings.bnaMarkupRatePct),
    bnaDefaultInstallments: settings.bnaDefaultInstallments,
    bnaCustomerRebatePct: String(settings.bnaCustomerRebatePct),
    bnaCustomerRebateCapArs: String(settings.bnaCustomerRebateCapArs),
    usedDeviceWarrantyDays: settings.usedDeviceWarrantyDays,
    warrantyPolicyText: settings.warrantyPolicyText,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  }
}

export async function ensureTenantSettings(
  tenantId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.tenantSettings.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      financialFeeEnabled: true,
      financialFeeRatePct: DEFAULT_FINANCIAL_FEE_RATE_PCT,
    },
  })
}

export async function validateSettingsBusinessRules(
  tenantId: string,
  input: SettingsPatchInput,
  tx: Prisma.TransactionClient = prisma,
) {
  const current = await ensureTenantSettings(tenantId, tx)
  const high = input.stockRotationHighMaxDays ?? current.stockRotationHighMaxDays
  const medium = input.stockRotationMediumMaxDays ?? current.stockRotationMediumMaxDays
  const financialFeeEnabled = input.financialFeeEnabled ?? current.financialFeeEnabled
  const financialFeeRatePct = input.financialFeeRatePct ?? Number(current.financialFeeRatePct)
  const bnaInstallmentsEnabled = input.bnaInstallmentsEnabled ?? current.bnaInstallmentsEnabled
  const bnaMarkupRatePct = input.bnaMarkupRatePct ?? Number(current.bnaMarkupRatePct)
  const bnaDefaultInstallments = input.bnaDefaultInstallments ?? current.bnaDefaultInstallments

  if (medium <= high) {
    throw new Error("La rotacion media debe superar a la rotacion alta.")
  }

  if (financialFeeEnabled && financialFeeRatePct <= 0) {
    throw new Error("El recargo de transferencia requiere un porcentaje mayor a 0.")
  }

  if (bnaInstallmentsEnabled && bnaMarkupRatePct <= 0) {
    throw new Error("Cuotas BNA requiere un recargo mayor a 0.")
  }

  if (bnaDefaultInstallments < 1 || bnaDefaultInstallments > 12) {
    throw new Error("Las cuotas BNA por defecto deben estar entre 1 y 12.")
  }

  if (input.closerCommissionsEnabled === true) {
    const activePlans = await tx.closerCommissionPlan.count({
      where: { tenantId, isActive: true },
    })
    if (activePlans < 1) {
      throw new Error("No se pueden activar comisiones sin un plan activo.")
    }
  }
}

export function buildSettingsUpdateData(input: SettingsPatchInput): Prisma.TenantSettingsUpdateInput {
  const data: Prisma.TenantSettingsUpdateInput = {}
  const assign = <K extends keyof SettingsPatchInput>(key: K) => {
    if (input[key] !== undefined) {
      ;(data as Record<string, unknown>)[key] = input[key]
    }
  }

  assign("servicePickupAlertDays")
  assign("stockRotationHighMaxDays")
  assign("stockRotationMediumMaxDays")
  assign("accessoryLowStockThreshold")
  assign("wholesalePricesEnabled")
  assign("closerCommissionsEnabled")
  assign("financialFeeEnabled")
  assign("bnaInstallmentsEnabled")
  assign("bnaDefaultInstallments")
  assign("usedDeviceWarrantyDays")
  assign("warrantyPolicyText")

  if (input.financialFeeRatePct !== undefined) {
    data.financialFeeRatePct = new Prisma.Decimal(input.financialFeeRatePct)
  }
  if (input.bnaMarkupRatePct !== undefined) {
    data.bnaMarkupRatePct = new Prisma.Decimal(input.bnaMarkupRatePct)
  }
  if (input.bnaCustomerRebatePct !== undefined) {
    data.bnaCustomerRebatePct = new Prisma.Decimal(input.bnaCustomerRebatePct)
  }
  if (input.bnaCustomerRebateCapArs !== undefined) {
    data.bnaCustomerRebateCapArs = new Prisma.Decimal(input.bnaCustomerRebateCapArs)
  }

  return data
}
