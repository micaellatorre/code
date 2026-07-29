import { NextResponse } from "next/server"
import { Prisma, type UserRole } from "@prisma/client"
import { z } from "zod"
import { requireRoleApi } from "@/lib/auth/auth"
import { getEffectiveAdminTenantId } from "@/lib/config/access"
import { createAuditLog } from "@/lib/domain/audit"
import { syncAdminBranchCoverage } from "@/lib/domain/user-branches"
import prisma from "@/lib/prisma"

const inviteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(180),
  role: z.enum(["ADMIN", "VENDEDOR", "STOCK", "SOCIO"]),
  branchId: z.string().trim().min(1),
})

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const parsed = inviteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const user = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { id: parsed.data.branchId, tenantId, isActive: true },
        select: { id: true },
      })
      if (!branch) throw new Error("Sucursal no disponible.")

      const existing = await tx.user.findUnique({ where: { email: parsed.data.email } })
      if (existing && existing.tenantId !== tenantId) {
        throw new Error("Ya existe un usuario con ese email en otro tenant.")
      }

      const now = new Date()
      const saved = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              name: parsed.data.name,
              role: parsed.data.role,
              isActive: true,
              tenantId,
              currentBranchId: branch.id,
              invitedAt: existing.joinedAt ? existing.invitedAt : now,
              invitedById: auth.session.user.id,
            },
          })
        : await tx.user.create({
            data: {
              email: parsed.data.email,
              name: parsed.data.name,
              role: parsed.data.role,
              isActive: true,
              tenantId,
              currentBranchId: branch.id,
              invitedAt: now,
              joinedAt: null,
              invitedById: auth.session.user.id,
            },
          })

      if (parsed.data.role === "ADMIN") {
        await syncAdminBranchCoverage({ tenantId, userId: saved.id }, tx)
      } else {
        await tx.userBranchCoverage.deleteMany({ where: { userId: saved.id } })
        await tx.userBranchCoverage.create({
          data: { userId: saved.id, branchId: branch.id },
        })
      }

      await createAuditLog({
        tenantId,
        actorUserId: auth.session.user.id,
        actorRole: auth.session.user.activeRole as UserRole,
        action: "CREATE",
        module: "USER",
        entityType: "UserInvitation",
        entityId: saved.id,
        detail: `Invitacion de usuario: ${saved.email}`,
        newValue: {
          id: saved.id,
          email: saved.email,
          name: saved.name,
          role: saved.role,
          currentBranchId: saved.currentBranchId,
          invitedAt: saved.invitedAt?.toISOString() ?? null,
          joinedAt: saved.joinedAt?.toISOString() ?? null,
        } as Prisma.InputJsonValue,
      }, tx)

      return saved
    })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        invitedAt: user.invitedAt ? user.invitedAt.toISOString() : null,
        joinedAt: user.joinedAt ? user.joinedAt.toISOString() : null,
      },
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar invitacion"
    const status = message.includes("otro tenant") ? 409 : message.includes("ADMIN") ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
