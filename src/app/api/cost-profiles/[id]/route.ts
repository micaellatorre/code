import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface Params {
  params: { id: string }
}

/**
 * API para obtener, actualizar o eliminar un CostProfile por ID.
 */
export async function GET(_req: Request, { params }: Params) {
  const profile = await prisma.costProfile.findUnique({ where: { id: params.id } })
  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }
  return NextResponse.json(profile)
}

export async function PUT(request: Request, { params }: Params) {
  const body = await request.json()
  try {
    const profile = await prisma.costProfile.update({ where: { id: params.id }, data: body })
    return NextResponse.json(profile)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error actualizando perfil' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.costProfile.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error eliminando perfil' }, { status: 500 })
  }
}