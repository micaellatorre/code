import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { createAuditLog } from "@/lib/domain/audit"
import { canManuallyAssignEntityBranch } from "@/lib/domain/user-branches"
import { resolveSessionTenantId } from "@/lib/tenant"
import { buildProductCatalogUpdate, buildWholesalePriceUpdate } from "@/lib/config/productCatalogLinks"

type Ctx = {
  params: Promise<{ id: string }>
}

async function resolveProductSupplierId(tenantId: string, value: unknown) {
  const supplierId = typeof value === "string" ? value.trim() : ""
  if (!supplierId) return null

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId },
    select: { id: true },
  })
  if (!supplier) throw new Error("Proveedor no disponible")
  return supplier.id
}

function serializeProduct(product: any, canSeeFinancials: boolean) {
  return {
    ...product,
    costPrice: canSeeFinancials && product.costPrice != null ? String(product.costPrice) : null,
    salePrice: product.salePrice != null ? String(product.salePrice) : null,
    wholesalePrice: canSeeFinancials && product.wholesalePrice != null ? String(product.wholesalePrice) : null,
    shippingCost: canSeeFinancials && product.shippingCost != null ? String(product.shippingCost) : null,
  }
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "STOCK", "SOCIO"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  const product = await prisma.product.findFirst({
    where: { id, ...(tenantId ? { tenantId } : {}) },
    include: { branch: { select: { id: true, code: true, name: true } }, supplier: { select: { id: true, name: true } } },
  })
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
  const canSeeFinancials = auth.session.user.activeRole === "ADMIN" || auth.session.user.activeRole === "SOCIO"
  return NextResponse.json(serializeProduct(product, canSeeFinancials))
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
    const body = await request.json()
    delete body.tenantId
    delete body.tenant
  try {
    const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
    if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
    const current = await prisma.product.findFirst({ where: { id, tenantId }, include: { branch: { select: { id: true, name: true } } } })
    if (!current) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })

    if (body.senado === false) body.senadoAt = null
    if (body.senado === true && !body.senadoAt) body.senadoAt = new Date()
    if (Object.prototype.hasOwnProperty.call(body, "branchId")) {
      if (!canManuallyAssignEntityBranch(auth.session.user.activeRole)) {
        return NextResponse.json({ error: "No tenes permisos para cambiar la sucursal de un producto." }, { status: 403 })
      }
      const nextBranchId = body.branchId == null || String(body.branchId).trim() === "" ? null : String(body.branchId)
      if (nextBranchId) {
        const branch = await prisma.branch.findFirst({ where: { id: nextBranchId, tenantId, isActive: true }, select: { id: true } })
        if (!branch) return NextResponse.json({ error: "Sucursal no disponible" }, { status: 400 })
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "supplierId")) {
      body.supplierId = await resolveProductSupplierId(tenantId, body.supplierId)
    }
    const catalogUpdate = await buildProductCatalogUpdate(tenantId, body, body.type ?? current.type)
    const wholesaleUpdate = await buildWholesalePriceUpdate({
      tenantId,
      actorRole: auth.session.user.activeRole,
      input: body,
    })

    const product = await prisma.product.update({ where: { id }, data: { ...body, ...catalogUpdate, ...wholesaleUpdate }, include: { branch: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } } })
    if (Object.prototype.hasOwnProperty.call(body, "branchId") && current.branchId !== product.branchId) {
      await createAuditLog({
        tenantId,
        actorUserId: auth.session.user.id,
        actorRole: auth.session.user.activeRole as UserRole,
        action: "BRANCH_TRANSFER",
        module: "PRODUCT",
        entityType: "Product",
        entityId: product.id,
        detail: `Traslado de producto de ${current.branch?.name ?? "Sin sucursal"} a ${product.branch?.name ?? "Sin sucursal"}`,
        oldValue: { branchId: current.branchId, branchName: current.branch?.name ?? null },
        newValue: { branchId: product.branchId, branchName: product.branch?.name ?? null },
      })
    }
    const canSeeFinancials = auth.session.user.activeRole === "ADMIN" || auth.session.user.activeRole === "SOCIO"
    return NextResponse.json(serializeProduct(product, canSeeFinancials))
  } catch (err: any) {
    console.error(err)
    const message = err instanceof Error ? err.message : "Error actualizando producto"
    return NextResponse.json({ error: message }, { status: message.includes("Proveedor") ? 400 : 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json()
  delete body.tenantId
  delete body.tenant

  try {
    const updateData: any = {}
    const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
    if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
    const current = await prisma.product.findFirst({ where: { id, tenantId }, include: { branch: { select: { id: true, name: true } } } })
    if (!current) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })

    if (Object.prototype.hasOwnProperty.call(body, "stock")) {
      const stock = Number(body.stock)
      if (!Number.isInteger(stock) || stock < 0) {
        return NextResponse.json({ error: "Valor de stock inválido" }, { status: 400 })
      }
      updateData.stock = stock
    }

    if (Object.prototype.hasOwnProperty.call(body, "stockAvailable")) {
      const stockAvailable = Number(body.stockAvailable)
      if (!Number.isInteger(stockAvailable) || stockAvailable < 0) {
        return NextResponse.json({ error: "Valor de stock disponible inválido" }, { status: 400 })
      }
      updateData.stockAvailable = stockAvailable
    }

    if (Object.prototype.hasOwnProperty.call(body, "stockInitial")) {
      const stockInitial = Number(body.stockInitial)
      if (!Number.isInteger(stockInitial) || stockInitial < 0) {
        return NextResponse.json({ error: "Valor de stock inicial inválido" }, { status: 400 })
      }
      updateData.stockInitial = stockInitial
    }

    if (Object.prototype.hasOwnProperty.call(body, "senado")) {
      updateData.senado = Boolean(body.senado)
      updateData.senadoAt = updateData.senado ? new Date() : null
    }

    if (Object.prototype.hasOwnProperty.call(body, "senadoAt")) {
      if (body.senadoAt === null || body.senadoAt === "") {
        updateData.senadoAt = null
      } else {
        const senadoAt = new Date(body.senadoAt)
        if (Number.isNaN(senadoAt.getTime())) {
          return NextResponse.json({ error: "Fecha de seña inválida" }, { status: 400 })
        }
        updateData.senadoAt = senadoAt
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "costPrice")) {
      const costPrice = body.costPrice === "" || body.costPrice == null ? null : String(body.costPrice)
      if (costPrice !== null) {
        const n = Number(costPrice)
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: "Valor de costo inválido" }, { status: 400 })
        }
        updateData.costPrice = costPrice
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "salePrice")) {
      const salePrice = body.salePrice === "" || body.salePrice == null ? null : String(body.salePrice)
      if (salePrice !== null) {
        const n = Number(salePrice)
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: "Valor de precio de venta inválido" }, { status: 400 })
        }
        updateData.salePrice = salePrice
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "shippingCost")) {
      if (body.shippingCost === null || body.shippingCost === "") {
        updateData.shippingCost = null
      } else {
        const shippingCost = String(body.shippingCost)
        const n = Number(shippingCost)
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: "Valor de costo de envío inválido" }, { status: 400 })
        }
        updateData.shippingCost = shippingCost
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "capacityGB")) {
      if (body.capacityGB === null || body.capacityGB === "") {
        updateData.capacityGB = null
      } else {
        const capacityGB = Number(body.capacityGB)
        if (!Number.isInteger(capacityGB) || capacityGB < 0) {
          return NextResponse.json({ error: "Valor de capacidad inválido" }, { status: 400 })
        }
        updateData.capacityGB = capacityGB
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "batteryPct")) {
      if (body.batteryPct === null || body.batteryPct === "") {
        updateData.batteryPct = null
      } else {
        const batteryPct = Number(body.batteryPct)
        if (!Number.isInteger(batteryPct) || batteryPct < 0 || batteryPct > 100) {
          return NextResponse.json({ error: "Valor de batería inválido (debe ser entre 0 y 100)" }, { status: 400 })
        }
        updateData.batteryPct = batteryPct
      }
    }

    const allowed = ["modelName", "brand", "condition", "color", "status", "state", "imei", "notes", "location", "origin", "catalogModelId", "catalogCapacityId", "catalogColorId"] as const
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        if (["brand", "imei", "color", "notes", "location", "origin"].includes(key) && body[key] === "") {
          updateData[key] = null
        } else {
          updateData[key] = body[key]
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "branchId")) {
      if (!canManuallyAssignEntityBranch(auth.session.user.activeRole)) {
        return NextResponse.json({ error: "No tenes permisos para cambiar la sucursal de un producto." }, { status: 403 })
      }
      const branchId = body.branchId == null || String(body.branchId).trim() === "" ? null : String(body.branchId)
      if (!branchId) {
        updateData.branchId = null
      } else {
        const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId, isActive: true }, select: { id: true } })
        if (!branch) return NextResponse.json({ error: "Sucursal no disponible" }, { status: 400 })
        updateData.branchId = branch.id
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, "supplierId")) {
      updateData.supplierId = await resolveProductSupplierId(tenantId, body.supplierId)
    }
    Object.assign(updateData, await buildProductCatalogUpdate(tenantId, body, body.type ?? current.type))
    Object.assign(updateData, await buildWholesalePriceUpdate({
      tenantId,
      actorRole: auth.session.user.activeRole,
      input: body,
    }))

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 })
    }

    const product = await prisma.product.update({ where: { id }, data: updateData, include: { branch: { select: { id: true, code: true, name: true } }, supplier: { select: { id: true, name: true } } } })
    if (Object.prototype.hasOwnProperty.call(updateData, "branchId") && current.branchId !== product.branchId) {
      await createAuditLog({
        tenantId,
        actorUserId: auth.session.user.id,
        actorRole: auth.session.user.activeRole as UserRole,
        action: "BRANCH_TRANSFER",
        module: "PRODUCT",
        entityType: "Product",
        entityId: product.id,
        detail: `Traslado de producto de ${current.branch?.name ?? "Sin sucursal"} a ${product.branch?.name ?? "Sin sucursal"}`,
        oldValue: { branchId: current.branchId, branchName: current.branch?.name ?? null },
        newValue: { branchId: product.branchId, branchName: product.branch?.name ?? null },
      })
    }
    const canSeeFinancials = auth.session.user.activeRole === "ADMIN" || auth.session.user.activeRole === "SOCIO"
    return NextResponse.json(serializeProduct(product, canSeeFinancials))
  } catch (err: any) {
    console.error(err)
    const message = err instanceof Error ? err.message : "Error actualizando producto"
    return NextResponse.json({ error: message }, { status: message.includes("Proveedor") ? 400 : 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  try {
    const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
    if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            saleItems: true,
            PurchaseItem: true,
            appointmentInterests: true,
            reservationItems: true,
            serviceOrders: true,
          },
        },
      },
    })
    if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })

    const hasHistory =
      product._count.saleItems +
      product._count.PurchaseItem +
      product._count.appointmentInterests +
      product._count.reservationItems +
      product._count.serviceOrders > 0

    if (hasHistory) {
      const updated = await prisma.product.update({
        where: { id },
        data: { status: "DISCONTINUED", state: product.state === "VENDIDO" ? product.state : "FUERA_DE_STOCK", stockAvailable: 0 },
      })
      return NextResponse.json({ success: true, mode: "discontinued", product: updated })
    }

    await prisma.product.delete({ where: { id } })
    return NextResponse.json({ success: true, mode: "deleted" })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: "Error eliminando producto" }, { status: 500 })
  }
}
