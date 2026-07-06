import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { ARGENTINA_PROVINCES } from "@/lib/domain/argentina/provinces"

export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "SOCIO", "VENDEDOR", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const provinces = await prisma.province.findMany({ orderBy: { name: "asc" } })
  return NextResponse.json({ provinces: provinces.length ? provinces : [...ARGENTINA_PROVINCES].sort((a, b) => a.name.localeCompare(b.name, "es")) })
}
