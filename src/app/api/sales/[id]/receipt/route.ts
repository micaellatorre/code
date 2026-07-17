import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { formatReceiptNumber } from "@/lib/sales/receipts"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

type SaleReceiptRecord = {
  id: number
  generatedAt: Date
}

function serializeReceipt(receipt: SaleReceiptRecord) {
  return {
    number: receipt.id,
    formattedNumber: formatReceiptNumber(receipt.id),
    generatedAt: receipt.generatedAt.toISOString(),
  }
}

function isPrismaUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export async function POST(_: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "SOCIO"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)

  if (!tenantId) {
    return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  }

  const { id: saleId } = await params

  try {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: {
        buyer: true,
        items: { include: { product: true } },
        receipt: true,
      },
    })

    if (!sale) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
    }

    let receipt = sale.receipt

    if (!receipt) {
      try {
        receipt = await prisma.saleReceipt.create({
          data: {
            saleId: sale.id,
            generatedById: auth.session.user.id ?? null,
          },
        })
      } catch (error) {
        if (!isPrismaUniqueConstraintError(error)) {
          throw error
        }

        receipt = await prisma.saleReceipt.findUnique({
          where: { saleId: sale.id },
        })

        if (!receipt) {
          throw error
        }
      }
    }

    return NextResponse.json({ receipt: serializeReceipt(receipt) })
  } catch (error) {
    console.error("Failed to get or create sale receipt", error)
    return NextResponse.json(
      { error: "No se pudo generar el comprobante." },
      { status: 500 },
    )
  }
}
