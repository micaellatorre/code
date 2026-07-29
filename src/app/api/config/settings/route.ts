import { NextResponse } from "next/server"
import { Prisma, type UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { createAuditLog } from "@/lib/domain/audit"
import { getEffectiveAdminTenantId } from "@/lib/config/access"
import {
  buildSettingsUpdateData,
  ensureTenantSettings,
  serializeTenantSettings,
  settingsPatchSchema,
  validateSettingsBusinessRules,
} from "@/lib/config/settings"

export async function GET() {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const [tenant, settings, logo, activeCommissionPlans] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } }),
      ensureTenantSettings(tenantId),
      prisma.tenantAsset.findUnique({
        where: { tenantId_kind: { tenantId, kind: "LOGO" } },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, updatedAt: true },
      }),
      prisma.closerCommissionPlan.count({ where: { tenantId, isActive: true } }),
    ])

    if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })

    return NextResponse.json({
      tenant: { id: tenant.id, name: tenant.name },
      settings: serializeTenantSettings(settings),
      logo: logo
        ? {
            id: logo.id,
            fileName: logo.fileName,
            mimeType: logo.mimeType,
            sizeBytes: logo.sizeBytes,
            updatedAt: logo.updatedAt.toISOString(),
            url: `/api/config/logo?v=${encodeURIComponent(String(logo.updatedAt.getTime()))}`,
          }
        : null,
      activeCommissionPlans,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar configuracion"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 500 })
  }
}

export async function PATCH(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const raw = await request.json().catch(() => null)
  const parsed = settingsPatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const result = await prisma.$transaction(async (tx) => {
      const currentTenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } })
      if (!currentTenant) throw new Error("Tenant no encontrado")
      const currentSettings = await ensureTenantSettings(tenantId, tx)
      await validateSettingsBusinessRules(tenantId, parsed.data, tx)

      const tenant = parsed.data.tenantName
        ? await tx.tenant.update({ where: { id: tenantId }, data: { name: parsed.data.tenantName }, select: { id: true, name: true } })
        : currentTenant

      const settingsData = buildSettingsUpdateData(parsed.data)
      const settings = Object.keys(settingsData).length
        ? await tx.tenantSettings.update({ where: { tenantId }, data: settingsData })
        : currentSettings

      await createAuditLog({
        tenantId,
        actorUserId: auth.session.user.id,
        actorRole: auth.session.user.activeRole as UserRole,
        action: "UPDATE",
        module: "CONFIG",
        entityType: "TenantSettings",
        entityId: settings.id,
        detail: "Configuracion del tenant actualizada",
        oldValue: {
          tenantName: currentTenant.name,
          settings: serializeTenantSettings(currentSettings),
        } as Prisma.InputJsonValue,
        newValue: {
          tenantName: tenant.name,
          settings: serializeTenantSettings(settings),
        } as Prisma.InputJsonValue,
      }, tx)

      return { tenant, settings }
    })

    return NextResponse.json({
      tenant: result.tenant,
      settings: serializeTenantSettings(result.settings),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar configuracion"
    const status =
      message.includes("ADMIN") || message.includes("Tenant no disponible")
        ? 403
        : message.includes("no encontrado")
          ? 404
          : 400
    return NextResponse.json({ error: message }, { status })
  }
}
