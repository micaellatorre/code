import { NextResponse } from "next/server"
import { Prisma, type UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { createAuditLog } from "@/lib/domain/audit"
import { getEffectiveAdminTenantId } from "@/lib/config/access"

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function isPng(bytes: Uint8Array) {
  return bytes.byteLength >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

function logoMetadata(asset: {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  updatedAt: Date
}) {
  return {
    id: asset.id,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    updatedAt: asset.updatedAt.toISOString(),
  }
}

export async function GET() {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const asset = await prisma.tenantAsset.findUnique({
      where: { tenantId_kind: { tenantId, kind: "LOGO" } },
      select: { data: true, mimeType: true, updatedAt: true },
    })

    if (!asset) return NextResponse.json({ error: "Logo no encontrado" }, { status: 404 })

    return new NextResponse(new Uint8Array(asset.data), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
        ETag: `"tenant-logo-${asset.updatedAt.getTime()}"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer el logo"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo PNG requerido" }, { status: 400 })
    }

    const fileName = file.name.trim()
    const mimeType = file.type
    const bytes = new Uint8Array(await file.arrayBuffer())

    if (mimeType !== "image/png" || !fileName.toLowerCase().endsWith(".png") || !isPng(bytes)) {
      return NextResponse.json({ error: "El logo debe ser un PNG valido." }, { status: 400 })
    }

    if (bytes.byteLength > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "El logo no puede superar 2 MB." }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.tenantAsset.findUnique({
        where: { tenantId_kind: { tenantId, kind: "LOGO" } },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, updatedAt: true },
      })

      const asset = await tx.tenantAsset.upsert({
        where: { tenantId_kind: { tenantId, kind: "LOGO" } },
        update: {
          fileName,
          mimeType,
          sizeBytes: bytes.byteLength,
          data: bytes,
        },
        create: {
          tenantId,
          kind: "LOGO",
          fileName,
          mimeType,
          sizeBytes: bytes.byteLength,
          data: bytes,
        },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, updatedAt: true },
      })

      await createAuditLog({
        tenantId,
        actorUserId: auth.session.user.id,
        actorRole: auth.session.user.activeRole as UserRole,
        action: current ? "UPDATE" : "CREATE",
        module: "CONFIG",
        entityType: "TenantAsset",
        entityId: asset.id,
        detail: current ? "Logo del tenant reemplazado" : "Logo del tenant cargado",
        oldValue: current ? logoMetadata(current) as Prisma.InputJsonValue : undefined,
        newValue: logoMetadata(asset) as Prisma.InputJsonValue,
      }, tx)

      return asset
    })

    return NextResponse.json({ logo: logoMetadata(result), url: `/api/config/logo?v=${result.updatedAt.getTime()}` })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el logo"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 500 })
  }
}

export async function DELETE() {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    await prisma.$transaction(async (tx) => {
      const current = await tx.tenantAsset.findUnique({
        where: { tenantId_kind: { tenantId, kind: "LOGO" } },
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, updatedAt: true },
      })

      if (!current) return

      await tx.tenantAsset.delete({ where: { id: current.id } })
      await createAuditLog({
        tenantId,
        actorUserId: auth.session.user.id,
        actorRole: auth.session.user.activeRole as UserRole,
        action: "DELETE",
        module: "CONFIG",
        entityType: "TenantAsset",
        entityId: current.id,
        detail: "Logo del tenant eliminado",
        oldValue: logoMetadata(current) as Prisma.InputJsonValue,
      }, tx)
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo eliminar el logo"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 500 })
  }
}
