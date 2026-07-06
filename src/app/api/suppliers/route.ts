import { NextResponse } from 'next/server'
import { requireRoleApi } from '@/lib/auth/auth'
import { resolveSessionTenantId } from '@/lib/tenant'
import { createSupplier, listSuppliers, supplierErrorStatus, supplierSchema } from '@/lib/domain/suppliers'
import { UserRole } from '@prisma/client'

// GET: lista de proveedores
export async function GET(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get("page") ?? "1")
  const pageSize = Number(searchParams.get("pageSize") ?? "50")
  const result = await listSuppliers({
    tenantId,
    q: searchParams.get("q"),
    branchId: searchParams.get("branchId"),
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 50,
  })
  return NextResponse.json(result)
}

// POST: crea un proveedor
export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const parsed = supplierSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const supplier = await createSupplier({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      actorRealRole: auth.session.user.role as UserRole,
      input: parsed.data,
    })
    return NextResponse.json(supplier, { status: 201 })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Error creando proveedor'
    return NextResponse.json({ error: message }, { status: supplierErrorStatus(message) })
  }
}
