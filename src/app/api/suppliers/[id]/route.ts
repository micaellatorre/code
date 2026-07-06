import { requireRoleApi } from "@/lib/auth/auth"
import { NextRequest, NextResponse } from "next/server"
import { resolveSessionTenantId } from "@/lib/tenant"
import { deleteSupplier, getSupplierDetail, supplierErrorStatus, supplierSchema, updateSupplier } from "@/lib/domain/suppliers"
import { UserRole } from "@prisma/client"

type Ctx = {
  params: Promise<{ id: string }>
}

// GET: proveedor por ID
export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const supplier = await getSupplierDetail({ tenantId, supplierId: id })
  if (!supplier) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
  }
  return NextResponse.json(supplier)
}

async function updateHandler(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const parsed = supplierSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const supplier = await updateSupplier({
      tenantId,
      supplierId: id,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      actorRealRole: auth.session.user.role as UserRole,
      input: parsed.data,
    })
    return NextResponse.json(supplier)
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : "Error actualizando proveedor"
    return NextResponse.json({ error: message }, { status: supplierErrorStatus(message) })
  }
}

// PUT/PATCH: actualiza proveedor
export const PUT = updateHandler
export const PATCH = updateHandler

// DELETE: elimina proveedor
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  try {
    const result = await deleteSupplier({
      tenantId,
      supplierId: id,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      actorRealRole: auth.session.user.role as UserRole,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : "Error eliminando proveedor"
    return NextResponse.json({ error: message }, { status: supplierErrorStatus(message) })
  }
}
