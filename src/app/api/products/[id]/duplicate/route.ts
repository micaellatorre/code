// /api/products/[id]/duplicate/route.ts

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { productCatalogDisplayInclude } from "@/lib/products/selects"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  try {
    const { id } = await params
    const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
    }

    const productToCopy = await prisma.product.findFirst({
      where: { id, tenantId },
    })

    if (!productToCopy) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    // Find the highest copy number for this model name
    const productsWithSameName = await prisma.product.findMany({
      where: {
        tenantId,
        modelName: {
          startsWith: `${productToCopy.modelName} Copia #`,
        },
      },
      select: { modelName: true },
    })

    const copyNumbers = productsWithSameName.map((p: { modelName: string }) => {
      const match = p.modelName.match(/Copia #(\d+)$/)
      return match ? parseInt(match[1], 10) : 0
    })
    const nextCopyNumber = Math.max(0, ...copyNumbers) + 1

    const {
      id: _id,
      createdAt: _ca,
      updatedAt: _ua,
      stockInitial: _si,
      stock: _s,
      stockAvailable: _sa,
      senado: _senado,
      senadoAt: _senadoAt,
      ...dataToCopy
    } = productToCopy

    const defaultStock = productToCopy.type === "PHONE" ? 1 : 0
    const duplicateModelName = productToCopy.catalogModelId
      ? productToCopy.modelName
      : `${productToCopy.modelName} Copia #${nextCopyNumber}`

    const newProduct = await prisma.product.create({
      data: {
        ...dataToCopy,
        modelName: duplicateModelName,
        imei: productToCopy.type === "PHONE" ? null : productToCopy.imei,
        senado: false,
        senadoAt: null,
        stockInitial: defaultStock,
        stock: defaultStock,
        stockAvailable: defaultStock,
      },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        supplier: { select: { id: true, name: true } },
        ...productCatalogDisplayInclude,
      },
    })

    return NextResponse.json({ product: newProduct })
  } catch (error) {
    console.error("[PRODUCT_DUPLICATE]", error)
    return NextResponse.json({ error: "Error duplicando producto" }, { status: 500 })
  }
}
