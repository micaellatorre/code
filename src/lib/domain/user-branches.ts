import { Prisma, type UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/domain/audit"

export type BranchSummary = {
  id: string
  code: string
  name: string
}

type ActorBranchParams = {
  userId: string
  tenantId: string
  role: UserRole | string
}

const branchSelect = {
  id: true,
  code: true,
  name: true,
} satisfies Prisma.BranchSelect

function sameId(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left === right)
}

export function canManuallyAssignEntityBranch(role: UserRole | string) {
  return role === "ADMIN"
}

export async function syncAdminBranchCoverage(params: { tenantId: string; userId?: string }, tx: Prisma.TransactionClient = prisma) {
  const [admins, branches] = await Promise.all([
    tx.user.findMany({
      where: {
        tenantId: params.tenantId,
        role: "ADMIN",
        isActive: true,
        ...(params.userId ? { id: params.userId } : {}),
      },
      select: { id: true },
    }),
    tx.branch.findMany({ where: { tenantId: params.tenantId }, select: { id: true } }),
  ])

  const data = admins.flatMap((admin) => branches.map((branch) => ({ userId: admin.id, branchId: branch.id })))
  if (!data.length) return { admins: admins.length, branches: branches.length, created: 0 }

  const result = await tx.userBranchCoverage.createMany({ data, skipDuplicates: true })
  return { admins: admins.length, branches: branches.length, created: result.count }
}

export async function syncAdminCoverageForNewBranch(params: { tenantId: string; branchId: string }, tx: Prisma.TransactionClient = prisma) {
  const admins = await tx.user.findMany({
    where: { tenantId: params.tenantId, role: "ADMIN", isActive: true },
    select: { id: true },
  })
  if (!admins.length) return { admins: 0, created: 0 }

  const result = await tx.userBranchCoverage.createMany({
    data: admins.map((admin) => ({ userId: admin.id, branchId: params.branchId })),
    skipDuplicates: true,
  })

  return { admins: admins.length, created: result.count }
}

export async function getUserSelectableBranches(params: ActorBranchParams, tx: Prisma.TransactionClient = prisma): Promise<BranchSummary[]> {
  if (params.role === "ADMIN") {
    return tx.branch.findMany({
      where: { tenantId: params.tenantId, isActive: true },
      orderBy: [{ name: "asc" }, { code: "asc" }],
      select: branchSelect,
    })
  }

  return tx.branch.findMany({
    where: {
      tenantId: params.tenantId,
      isActive: true,
      userCoverages: { some: { userId: params.userId } },
    },
    orderBy: [{ name: "asc" }, { code: "asc" }],
    select: branchSelect,
  })
}

export async function resolveUserBranchContext(params: ActorBranchParams, tx: Prisma.TransactionClient = prisma) {
  const user = await tx.user.findFirst({
    where: { id: params.userId, tenantId: params.tenantId, isActive: true },
    select: {
      id: true,
      role: true,
      tenantId: true,
      currentBranchId: true,
      currentBranch: { select: { ...branchSelect, tenantId: true, isActive: true } },
    },
  })

  if (!user) {
    return { currentBranch: null, branches: [], error: "Usuario no disponible." }
  }

  const branches = await getUserSelectableBranches(params, tx)
  const currentIsValid =
    Boolean(user.currentBranch?.isActive) &&
    user.currentBranch?.tenantId === params.tenantId &&
    (params.role === "ADMIN" || branches.some((branch) => branch.id === user.currentBranchId))

  if (currentIsValid && user.currentBranch) {
    return {
      currentBranch: { id: user.currentBranch.id, code: user.currentBranch.code, name: user.currentBranch.name },
      branches,
      error: null,
    }
  }

  const fallback = branches[0] ?? null
  const error = fallback
    ? user.currentBranchId
      ? "La sucursal actual ya no esta disponible. Selecciona otra sucursal."
      : null
    : "No tenes una sucursal activa disponible. Contacta a un administrador."

  return { currentBranch: fallback, branches, error }
}

export async function setCurrentUserBranch(params: {
  actorUserId: string
  actorRole: UserRole | string
  tenantId: string
  branchId: string
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findFirst({
      where: { id: params.actorUserId, tenantId: params.tenantId, isActive: true },
      select: { id: true, currentBranchId: true, currentBranch: { select: branchSelect } },
    })
    if (!current) throw new Error("Usuario no disponible")

    const branches = await getUserSelectableBranches(
      { userId: params.actorUserId, tenantId: params.tenantId, role: params.actorRole },
      tx,
    )
    const target = branches.find((branch) => branch.id === params.branchId)
    if (!target) throw new Error("Sucursal no disponible para este usuario")

    await tx.user.update({ where: { id: current.id }, data: { currentBranchId: target.id } })

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole as UserRole,
      action: "UPDATE",
      module: "USER",
      entityType: "User",
      entityId: current.id,
      detail: `Cambio de sucursal actual: ${current.currentBranch?.name ?? "Sin sucursal"} -> ${target.name}`,
      oldValue: { currentBranchId: current.currentBranchId },
      newValue: { currentBranchId: target.id },
    }, tx)

    return target
  })
}

export async function resolveOperationBranch(params: {
  actorUserId: string
  actorRole: UserRole | string
  tenantId: string
  requestedBranchId?: string | null
  entityLabel: "producto" | "venta"
}, tx: Prisma.TransactionClient = prisma) {
  const context = await resolveUserBranchContext(
    { userId: params.actorUserId, tenantId: params.tenantId, role: params.actorRole },
    tx,
  )

  if (params.actorRole === "ADMIN") {
    const targetId = params.requestedBranchId || context.currentBranch?.id
    const target = context.branches.find((branch) => branch.id === targetId)
    if (!target) throw new Error("Sucursal no disponible")
    return target
  }

  if (!context.currentBranch) {
    throw new Error(`Selecciona una sucursal actual antes de crear un ${params.entityLabel}.`)
  }

  if (params.requestedBranchId && !sameId(params.requestedBranchId, context.currentBranch.id)) {
    throw new Error(`No tenes permisos para cambiar la sucursal de un ${params.entityLabel}.`)
  }

  return context.currentBranch
}

export async function setUserBranchCoverage(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  targetUserId: string
  currentBranchId: string | null
  coverageBranchIds: string[]
}) {
  return prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findFirst({
      where: { id: params.targetUserId, tenantId: params.tenantId },
      include: {
        branchCoverages: { select: { branchId: true } },
      },
    })
    if (!targetUser) throw new Error("Usuario no encontrado")

    const oldValue = {
      currentBranchId: targetUser.currentBranchId,
      coverageBranchIds: targetUser.branchCoverages.map((coverage) => coverage.branchId).sort(),
    }

    if (targetUser.role === "ADMIN") {
      await syncAdminBranchCoverage({ tenantId: params.tenantId, userId: targetUser.id }, tx)
      const fallback = await tx.branch.findFirst({
        where: { tenantId: params.tenantId, isActive: true },
        orderBy: [{ name: "asc" }, { code: "asc" }],
        select: { id: true },
      })
      if (!targetUser.currentBranchId && fallback) {
        await tx.user.update({ where: { id: targetUser.id }, data: { currentBranchId: fallback.id } })
      }
    } else {
      const uniqueCoverageIds = Array.from(new Set(params.coverageBranchIds))
      if (!uniqueCoverageIds.length) throw new Error("Selecciona al menos una sucursal de cobertura")

      const branches = await tx.branch.findMany({
        where: { id: { in: uniqueCoverageIds }, tenantId: params.tenantId, isActive: true },
        select: { id: true },
      })
      if (branches.length !== uniqueCoverageIds.length) throw new Error("Sucursal no disponible")
      if (!params.currentBranchId || !uniqueCoverageIds.includes(params.currentBranchId)) {
        throw new Error("La sucursal actual debe estar incluida en la cobertura")
      }

      await tx.userBranchCoverage.deleteMany({ where: { userId: targetUser.id } })
      await tx.userBranchCoverage.createMany({
        data: uniqueCoverageIds.map((branchId) => ({ userId: targetUser.id, branchId })),
        skipDuplicates: true,
      })
      await tx.user.update({ where: { id: targetUser.id }, data: { currentBranchId: params.currentBranchId } })
    }

    const nextCoverages = await tx.userBranchCoverage.findMany({
      where: { userId: targetUser.id },
      select: { branchId: true },
      orderBy: { branchId: "asc" },
    })
    const nextUser = await tx.user.findUnique({ where: { id: targetUser.id }, select: { currentBranchId: true } })

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "UPDATE",
      module: "USER",
      entityType: "User",
      entityId: targetUser.id,
      detail: `Cobertura de sucursales actualizada para ${targetUser.email}`,
      oldValue,
      newValue: {
        currentBranchId: nextUser?.currentBranchId ?? null,
        coverageBranchIds: nextCoverages.map((coverage) => coverage.branchId),
      },
    }, tx)

    return { ok: true }
  })
}
