// src/app/api/appointments/[id]/route.ts
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextRequest, NextResponse } from "next/server"

type Ctx = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "Appointment ID is required" }, { status: 400 })
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        buyer: true,
        interests: {
          include: {
            product: true,
          },
          orderBy: {
            priority: 'asc' as const,
          },
        },
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    return NextResponse.json(appointment, { status: 200 })
  } catch (error: any) {
    console.error("Error fetching appointment:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  try {
    const { id } = await params
    const body = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Appointment ID is required" }, { status: 400 })
    }

    // Check if this is a user assignment request
    if (body.userId) {
      // User assignment logic (original functionality)
      const adminTenantId = auth.session.user.tenantId
      if (!adminTenantId) {
        return NextResponse.json({ error: "Tenant no disponible para el usuario autenticado" }, { status: 403 })
      }

      const userId = body.userId.trim()

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
    } else {
      // Appointment details update logic
      const {
        scheduledAt,
        durationMinutes,
        buyerId,
        status,
        outcome,
        noSaleReason,
        noSaleReasonOther,
        resultNotes,
        interests,
        deposits,
      } = body

      // Validate required fields
      if (!scheduledAt || !status || !outcome) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      }

      // Check if appointment exists
      const existingAppointment = await prisma.appointment.findUnique({
        where: { id },
        select: { id: true },
      })

      if (!existingAppointment) {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
      }

      const updatedAppointment = await prisma.$transaction(async (tx) => {
        const updated = await tx.appointment.update({
          where: { id },
          data: {
            scheduledAt: new Date(scheduledAt),
            durationMinutes,
            buyerId: buyerId || null,
            status,
            outcome,
            noSaleReason: outcome === 'NO_SE_CONCRETO' ? noSaleReason : null,
            noSaleReasonOther: outcome === 'NO_SE_CONCRETO' && noSaleReason === 'OTRO' ? noSaleReasonOther : null,
            resultNotes,
          },
        })

        if (interests && Array.isArray(interests)) {
          await tx.appointmentInterest.deleteMany({
            where: { appointmentId: id },
          })

          if (interests.length > 0) {
            await tx.appointmentInterest.createMany({
              data: interests.map((interest: any, index: number) => ({
                appointmentId: id,
                productId: interest.productId,
                notes: interest.notes,
                priority: interest.priority || index + 1,
              })),
            })
          }
        }

        const productIds = Array.isArray(interests) ? interests.map((interest: any) => interest.productId).filter(Boolean) : []
        const hasDeposit = Array.isArray(deposits) && deposits.some((deposit: any) => Number(deposit.amount || 0) > 0)

        if (productIds.length > 0 && (hasDeposit || status === "CANCELADA")) {
          await tx.product.updateMany({
            where: { id: { in: productIds } },
            data: hasDeposit
              ? { senado: true, senadoAt: new Date() }
              : { senado: false, senadoAt: null },
          })
        }

        return updated
      })

      return NextResponse.json(updatedAppointment, { status: 200 })
    }
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
