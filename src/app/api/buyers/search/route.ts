import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { serializeBuyer } from "@/lib/buyers"

async function getDefaultTenantId() {
  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) return undefined

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId } })
  return tenant?.id ?? tenantId
}

export async function GET(req: Request) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim()
  const type = searchParams.get("type")

  if (!q || q.length < 3) {
    return NextResponse.json({ results: [] })
  }

  try {
    const tenantId = auth.session.user.tenantId ?? (await getDefaultTenantId())
    // TODO: cuando todos los usuarios tengan tenantId obligatorio, remover el fallback y exigir tenantId.
    const results = await prisma.buyer.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(type === "MINORISTA" || type === "MAYORISTA" ? { type } : {}),
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { surname: { contains: q, mode: "insensitive" } },
          { businessName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { instagram: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { cuit: { contains: q, mode: "insensitive" } },
          { dni: { contains: q, mode: "insensitive" } },
          { province: { contains: q, mode: "insensitive" } },
          { provinceRef: { name: { contains: q, mode: "insensitive" } } },
          { city: { contains: q, mode: "insensitive" } },
          { postalCode: { contains: q, mode: "insensitive" } },
          { addressStreet: { contains: q, mode: "insensitive" } },
          { addressNumber: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { provinceRef: true, registeredBranch: { select: { id: true, code: true, name: true } } },
    })

    return NextResponse.json({ results: results.map(serializeBuyer) })
  } catch (error) {
    console.error("Buyer search failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
