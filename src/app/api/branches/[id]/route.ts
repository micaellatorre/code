import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { branchSchema, deleteOrDeactivateBranch, updateBranch } from "@/lib/domain/branches"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "SOCIO", "VENDEDOR", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const { id } = await params
  const branch = await prisma.branch.findFirst({
    where: { id, tenantId },
    include: {
      provinceRef: true,
      provinceCoverages: { include: { province: true }, orderBy: { province: { name: "asc" } } },
      _count: { select: { products: true, sales: true, purchases: true } },
    },
  })
  if (!branch) return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 })
  return NextResponse.json({ branch })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const { id } = await params
  const parsed = branchSchema.partial().safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const branch = await updateBranch({
      tenantId,
      branchId: id,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      input: parsed.data,
    })
    return NextResponse.json({ branch })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error actualizando sucursal"
    return NextResponse.json({ error: message }, { status: message.includes("no encontrada") ? 404 : message.includes("existe") ? 409 : 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const { id } = await params
  try {
    const result = await deleteOrDeactivateBranch({
      tenantId,
      branchId: id,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error eliminando sucursal"
    return NextResponse.json({ error: message }, { status: message.includes("no encontrada") ? 404 : 500 })
  }
}
