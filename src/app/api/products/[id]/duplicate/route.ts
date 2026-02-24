// /api/products/[id]/duplicate/route.ts

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Ctx) {
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

    const copyNumbers = productsWithSameName.map((p) => {
      const match = p.modelName.match(/Copia #(\d+)$/)
      return match ? parseInt(match[1], 10) : 0
    })
    const nextCopyNumber = Math.max(0, ...copyNumbers) + 1

    const { id: _id, createdAt: _ca, updatedAt: _ua, stock: _s, stockAvailable: _sa, ...dataToCopy } = productToCopy

    const newProduct = await prisma.product.create({
      data: {
        ...dataToCopy,
        modelName: `${productToCopy.modelName} Copia #${nextCopyNumber}`,
        stock: 0,
        stockAvailable: 0,
      },
    })

    return NextResponse.json({ product: newProduct })
  } catch (error) {
    console.error("[PRODUCT_DUPLICATE]", error)
    return NextResponse.json({ error: "Error duplicando producto" }, { status: 500 })
  }
}