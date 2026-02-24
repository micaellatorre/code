// src/app/api/buyers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  try {
    const buyer = await prisma.buyer.findUnique({ where: { id } })
    if (!buyer) {
      return NextResponse.json({ error: "Buyer not found" }, { status: 404 })
    }
    return NextResponse.json({ buyer })
  } catch (error) {
    console.error("Failed to get buyer:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const data = await req.json()

  try {
    const updatedBuyer = await prisma.buyer.update({
      where: { id },
      data,
    })
    return NextResponse.json({ buyer: updatedBuyer })
  } catch (error) {
    console.error("Failed to update buyer:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params

  try {
    await prisma.buyer.delete({ where: { id } })
    return NextResponse.json({ message: "Buyer deleted successfully" })
  } catch (error) {
    console.error("Failed to delete buyer:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}