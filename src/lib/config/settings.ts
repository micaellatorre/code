import { Prisma, type TenantSettings } from "@prisma/client"
import { z } from "zod"
import prisma from "@/lib/prisma"

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
      message: "La comision financiera requiere un porcentaje mayor a 0.",
    })
  }
})

export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>

export function serializeTenantSettings(settings: TenantSettings) {
  return {
    id: settings.id,
    tenantId: settings.tenantId,
    servicePickupAlertDays: settings.servicePickupAlertDays,
    stockRotationHighMaxDays: settings.stockRotationHighMaxDays,
    stockRotationMediumMaxDays: settings.stockRotationMediumMaxDays,
    accessoryLowStockThreshold: settings.accessoryLowStockThreshold,
    wholesalePricesEnabled: settings.wholesalePricesEnabled,
    closerCommissionsEnabled: settings.closerCommissionsEnabled,
    financialFeeEnabled: settings.financialFeeEnabled,
    financialFeeRatePct: String(settings.financialFeeRatePct),
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
    create: { tenantId },
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

  if (medium <= high) {
    throw new Error("La rotacion media debe superar a la rotacion alta.")
  }

  if (financialFeeEnabled && financialFeeRatePct <= 0) {
    throw new Error("La comision financiera requiere un porcentaje mayor a 0.")
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
  assign("usedDeviceWarrantyDays")
  assign("warrantyPolicyText")

  if (input.financialFeeRatePct !== undefined) {
    data.financialFeeRatePct = new Prisma.Decimal(input.financialFeeRatePct)
  }

  return data
}
