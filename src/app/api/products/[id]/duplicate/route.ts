// /api/products/[id]/duplicate/route.ts

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  try {
    const { id } = await params

    const productToCopy = await prisma.product.findUnique({
      where: { id },
    })

    if (!productToCopy) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    // Find the highest copy number for this model name
    const productsWithSameName = await prisma.product.findMany({
      where: {
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

    const newProduct = await prisma.product.create({
      data: {
        ...dataToCopy,
        modelName: `${productToCopy.modelName} Copia #${nextCopyNumber}`,
        imei: productToCopy.type === "PHONE" ? null : productToCopy.imei,
        senado: false,
        senadoAt: null,
        stockInitial: defaultStock,
        stock: defaultStock,
        stockAvailable: defaultStock,
      },
    })

    return NextResponse.json({ product: newProduct })
  } catch (error) {
    console.error("[PRODUCT_DUPLICATE]", error)
    return NextResponse.json({ error: "Error duplicando producto" }, { status: 500 })
  }
}
