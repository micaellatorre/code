import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextRequest, NextResponse } from "next/server"

const ALLOWED_STATUSES = ["PROGRAMADA", "CONCRETADA", "CANCELADA", "NO_SE_PRESENTO"] as const

function readIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const ids = readIds(body?.ids)
    const status = body?.status

    if (!ids.length) {
      return NextResponse.json({ error: "Debe seleccionar al menos una cita" }, { status: 400 })
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Estado de cita invalido" }, { status: 400 })
    }

    const result = await prisma.appointment.updateMany({
      where: { id: { in: ids } },
      data: { status },
    })

    return NextResponse.json({ count: result.count, status }, { status: 200 })
  } catch (error) {
    console.error("Error bulk updating appointments:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const ids = readIds(body?.ids)

    if (!ids.length) {
      return NextResponse.json({ error: "Debe seleccionar al menos una cita" }, { status: 400 })
    }

    const result = await prisma.appointment.deleteMany({
      where: { id: { in: ids } },
    })

    return NextResponse.json({ count: result.count }, { status: 200 })
  } catch (error) {
    console.error("Error bulk deleting appointments:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
