import prisma from "@/lib/prisma"
import { ensureTenantSettings } from "@/lib/config/settings"

export type TenantBranding = {
  tenantName: string
  logoDataUrl: string | null
  usedDeviceWarrantyDays: number
  warrantyPolicyText: string
}

export async function getTenantBranding(tenantId: string): Promise<TenantBranding> {
  const [tenant, settings, logo] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    ensureTenantSettings(tenantId),
    prisma.tenantAsset.findUnique({
      where: { tenantId_kind: { tenantId, kind: "LOGO" } },
      select: { mimeType: true, data: true },
    }),
  ])

  const logoDataUrl = logo
    ? `data:${logo.mimeType};base64,${Buffer.from(logo.data).toString("base64")}`
    : null

  return {
    tenantName: tenant?.name ?? "GP Importaciones",
    logoDataUrl,
    usedDeviceWarrantyDays: settings.usedDeviceWarrantyDays,
    warrantyPolicyText: settings.warrantyPolicyText,
  }
}
