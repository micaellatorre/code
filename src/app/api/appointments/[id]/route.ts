// src/app/api/appointments/[id]/route.ts
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextRequest, NextResponse } from "next/server"

type Ctx = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const adminTenantId = auth.session.user.tenantId
  if (!adminTenantId) {
    return NextResponse.json({ error: "Tenant no disponible para el usuario autenticado" }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = (await request.json().catch(() => null)) as { userId?: string | null } | null
    const userId = body?.userId?.trim()

    if (!id) {
      return NextResponse.json({ error: "Appointment ID is required" }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, name: true, email: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "Usuario destino no encontrado" }, { status: 404 })
    }

    if (targetUser.tenantId !== adminTenantId) {
      return NextResponse.json({ error: "No puedes asignar usuarios fuera de tu tenant" }, { status: 403 })
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: { userId: targetUser.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(updatedAppointment, { status: 200 })
  } catch (error: any) {
    console.error("Error updating appointment:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "Appointment ID is required" }, { status: 400 })
    }

    await prisma.appointment.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Appointment deleted successfully" }, { status: 200 })
  } catch (error: any) {
    console.error("Error deleting appointment:", error)

    // Prisma: record not found
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
