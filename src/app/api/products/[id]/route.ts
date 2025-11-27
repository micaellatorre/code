import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface Params {
  params: { id: string }
}

/**
 * API para obtener, actualizar o eliminar un producto por ID.
 */
export async function GET(_req: Request, { params }: Params) {
  const product = await prisma.product.findUnique({ where: { id: params.id } })
  if (!product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }
  return NextResponse.json(product)
}

export async function PUT(request: Request, { params }: Params) {
  const body = await request.json()
  try {
    const product = await prisma.product.update({ where: { id: params.id }, data: body })
    return NextResponse.json(product)
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: 'Error actualizando producto' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const body = await request.json()
  try {
    const updateData: any = {}
    if (Object.prototype.hasOwnProperty.call(body, 'stock')) {
      const stock = Number(body.stock)
      if (!Number.isInteger(stock) || stock < 0) {
        return NextResponse.json({ error: 'Valor de stock inválido' }, { status: 400 })
      }
      updateData.stock = stock
    }
    if (Object.prototype.hasOwnProperty.call(body, 'stockAvailable')) {
      const stockAvailable = Number(body.stockAvailable)
      if (!Number.isInteger(stockAvailable) || stockAvailable < 0) {
        return NextResponse.json({ error: 'Valor de stock disponible inválido' }, { status: 400 })
      }
      updateData.stockAvailable = stockAvailable
    }
    if (Object.prototype.hasOwnProperty.call(body, 'stockInitial')) {
      const stockInitial = Number(body.stockInitial)
      if (!Number.isInteger(stockInitial) || stockInitial < 0) {
        return NextResponse.json({ error: 'Valor de stock inicial inválido' }, { status: 400 })
      }
      updateData.stockInitial = stockInitial
    }
    // Handle decimal fields with proper validation
    if (Object.prototype.hasOwnProperty.call(body, 'costPrice')) {
      const costPrice = parseFloat(body.costPrice)
      if (!Number.isFinite(costPrice) || costPrice < 0) {
        return NextResponse.json({ error: 'Valor de costo inválido' }, { status: 400 })
      }
      updateData.costPrice = costPrice
    }
    if (Object.prototype.hasOwnProperty.call(body, 'salePrice')) {
      const salePrice = parseFloat(body.salePrice)
      if (!Number.isFinite(salePrice) || salePrice < 0) {
        return NextResponse.json({ error: 'Valor de precio de venta inválido' }, { status: 400 })
      }
      updateData.salePrice = salePrice
    }
    if (Object.prototype.hasOwnProperty.call(body, 'shippingCost')) {
      if (body.shippingCost === null || body.shippingCost === '') {
        updateData.shippingCost = null
      } else {
        const shippingCost = parseFloat(body.shippingCost)
        if (!Number.isFinite(shippingCost) || shippingCost < 0) {
          return NextResponse.json({ error: 'Valor de costo de envío inválido' }, { status: 400 })
        }
        updateData.shippingCost = shippingCost
      }
    }
    
    // Handle integer fields
    if (Object.prototype.hasOwnProperty.call(body, 'capacityGB')) {
      if (body.capacityGB === null || body.capacityGB === '') {
        updateData.capacityGB = null
      } else {
        const capacityGB = Number(body.capacityGB)
        if (!Number.isInteger(capacityGB) || capacityGB < 0) {
          return NextResponse.json({ error: 'Valor de capacidad inválido' }, { status: 400 })
        }
        updateData.capacityGB = capacityGB
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'batteryPct')) {
      if (body.batteryPct === null || body.batteryPct === '') {
        updateData.batteryPct = null
      } else {
        const batteryPct = Number(body.batteryPct)
        if (!Number.isInteger(batteryPct) || batteryPct < 0 || batteryPct > 100) {
          return NextResponse.json({ error: 'Valor de batería inválido (debe ser entre 0 y 100)' }, { status: 400 })
        }
        updateData.batteryPct = batteryPct
      }
    }
    
    // Permit other partial updates if needed
    const allowed = ['modelName', 'brand', 'condition', 'color', 'status', 'state', 'imei', 'notes']
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        // Handle empty strings as null for nullable fields
        if (['brand', 'imei', 'color', 'notes'].includes(key) && body[key] === '') {
          updateData[key] = null
        } else {
          updateData[key] = body[key]
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    const product = await prisma.product.update({ where: { id: params.id }, data: updateData })
    return NextResponse.json(product)
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: 'Error actualizando producto' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.product.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: 'Error eliminando producto' }, { status: 500 })
  }
}