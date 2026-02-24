// src/app/api/cost-profiles/[id]/route.ts
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

type Ctx = {
  params: Promise<{ id: string }>
}

/**
 * API para obtener, actualizar o eliminar un CostProfile por ID.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params

  const profile = await prisma.costProfile.findUnique({ where: { id } })
  if (!profile) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 })
  }
  return NextResponse.json(profile)
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await request.json()

  try {
    const profile = await prisma.costProfile.update({ where: { id }, data: body })
    return NextResponse.json(profile)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error actualizando perfil" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params

  try {
    await prisma.costProfile.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error eliminando perfil" }, { status: 500 })
  }
}