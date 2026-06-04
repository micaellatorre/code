// code\src\app\api\trade-in\battery-ranges\batch\route.ts
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import { getTenantId, toInteger } from "../../_utils"

const TEMP_ID_PREFIX = "new-"

type NormalizedRange = {
  id: string
  isNew: boolean
  label: string
  minPct: number | null
  maxPct: number | null
  sortOrder: number
  isActive: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeRange(range: unknown): NormalizedRange {
  const record = isRecord(range) ? range : {}

  const id = typeof record.id === "string" ? record.id : ""
  const label =
    typeof record.label === "string" && record.label.trim()
      ? record.label.trim()
      : ""

  return {
    id,
    isNew: id.startsWith(TEMP_ID_PREFIX),
    label,
    minPct: toInteger(record.minPct),
    maxPct: toInteger(record.maxPct),
    sortOrder: toInteger(record.sortOrder) ?? 0,
    isActive: record.isActive !== false,
  }
}

function normalizeDeletedRangeIds(value: unknown) {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(value.filter((id): id is string => typeof id === "string" && id.trim().length > 0))
  )
}

function validateRanges(normalized: NormalizedRange[]) {
  if (!normalized.length) {
    return "Debe enviarse al menos un rango"
  }

  const invalid = normalized.some((range) => {
    return (
      !range.id ||
      !range.label ||
      range.minPct === null ||
      range.maxPct === null ||
      range.minPct < 0 ||
      range.maxPct > 100 ||
      range.minPct > range.maxPct
    )
  })

  if (invalid) {
    return "Rangos inválidos"
  }

  const active = normalized
    .filter((range) => range.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.minPct ?? 0) - (b.minPct ?? 0))

  if (!active.length) {
    return "Debe existir al menos un rango activo"
  }

  if (active[0].minPct !== 0) {
    return "El primer rango activo debe empezar en 0"
  }

  if (active[active.length - 1].maxPct !== 100) {
    return "El último rango activo debe terminar en 100"
  }

  for (let i = 0; i < active.length - 1; i += 1) {
    const current = active[i]
    const next = active[i + 1]

    if ((current.maxPct ?? 0) + 1 !== next.minPct) {
      return "No puede haber huecos ni solapamientos"
    }
  }

  return null
}

export async function PATCH(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const tenantId = getTenantId(auth.session)

  if (!tenantId) {
    return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const rangesInput: unknown[] = isRecord(body) && Array.isArray(body.ranges) ? body.ranges : []
  const normalized = rangesInput.map(normalizeRange)
  const deletedRangeIds = isRecord(body) ? normalizeDeletedRangeIds(body.deletedRangeIds) : []

  const validationError = validateRanges(normalized)

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const existingIds = normalized
    .filter((range) => !range.isNew)
    .map((range) => range.id)
  const deletedIdSet = new Set(deletedRangeIds)

  if (existingIds.some((id) => deletedIdSet.has(id))) {
    return NextResponse.json({ error: "Un rango no puede actualizarse y eliminarse a la vez" }, { status: 400 })
  }

  const rangeIdsToCheck = Array.from(new Set([...existingIds, ...deletedRangeIds]))

  if (rangeIdsToCheck.length) {
    const existingCount = await prisma.tradeInBatteryRange.count({
      where: {
        tenantId,
        id: {
          in: rangeIdsToCheck,
        },
      },
    })

    if (existingCount !== rangeIdsToCheck.length) {
      return NextResponse.json({ error: "Rango no encontrado" }, { status: 404 })
    }
  }

  await prisma.$transaction([
    ...(deletedRangeIds.length
      ? [
          prisma.tradeInPrice.deleteMany({
            where: {
              tenantId,
              batteryRangeId: {
                in: deletedRangeIds,
              },
            },
          }),
          prisma.tradeInBatteryRange.deleteMany({
            where: {
              tenantId,
              id: {
                in: deletedRangeIds,
              },
            },
          }),
        ]
      : []),
    ...normalized.map((range) => {
      const data = {
        label: range.label,
        minPct: range.minPct!,
        maxPct: range.maxPct!,
        sortOrder: range.sortOrder,
        isActive: range.isActive,
      }

      if (range.isNew) {
        return prisma.tradeInBatteryRange.create({
          data: {
            tenantId,
            ...data,
          },
        })
      }

      return prisma.tradeInBatteryRange.update({
        where: {
          id: range.id,
        },
        data,
      })
    }),
  ])

  return NextResponse.json({ ok: true })
}
