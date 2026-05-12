import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextRequest, NextResponse } from "next/server"

type Ctx = {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "STOCK", "SOCIO"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
  return NextResponse.json(product)
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json()
  try {
    if (body.senado === false) body.senadoAt = null
    if (body.senado === true && !body.senadoAt) body.senadoAt = new Date()

    const product = await prisma.product.update({ where: { id }, data: body })
    return NextResponse.json(product)
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: "Error actualizando producto" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  const body = await request.json()

  try {
    const updateData: any = {}

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

    const allowed = ["modelName", "brand", "condition", "color", "status", "state", "imei", "notes", "location", "origin"] as const
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        if (["brand", "imei", "color", "notes", "location", "origin"].includes(key) && body[key] === "") {
          updateData[key] = null
        } else {
          updateData[key] = body[key]
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 })
    }

    const product = await prisma.product.update({ where: { id }, data: updateData })
    return NextResponse.json(product)
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: "Error actualizando producto" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "STOCK"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params
  try {
    await prisma.product.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: "Error eliminando producto" }, { status: 500 })
  }
}
