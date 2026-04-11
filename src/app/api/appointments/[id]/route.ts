// src/app/api/appointments/[id]/route.ts
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextRequest, NextResponse } from "next/server"

type Ctx = {
  params: Promise<{ id: string }>
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
