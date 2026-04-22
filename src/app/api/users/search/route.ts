import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextRequest, NextResponse } from "next/server"

const MAX_RESULTS = 10

export async function GET(request: NextRequest) {
  const auth = await requireRoleApi(["ADMIN"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const tenantId = auth.session.user.tenantId
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant no disponible para el usuario autenticado" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""

  const users = await prisma.user.findMany({
    where: {
      tenantId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: MAX_RESULTS,
  })

  return NextResponse.json({ results: users }, { status: 200 })
}
