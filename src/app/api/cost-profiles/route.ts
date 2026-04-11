import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireRoleApi } from '@/lib/auth/auth'

/**
 * API para listar y crear perfiles de costo (CostProfile).
 *
 * Un CostProfile representa un conjunto de costos adicionales (funda, templado, cable, etc.)
 * que se pueden aplicar a un producto vendido para calcular la rentabilidad real.
 */
export async function GET() {
  const auth = await requireRoleApi(["ADMIN"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const profiles = await prisma.costProfile.findMany({
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(profiles)
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const body = await request.json()
  try {
    const profile = await prisma.costProfile.create({ data: body })
    return NextResponse.json(profile, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error creando perfil de costo' }, { status: 500 })
  }
}
