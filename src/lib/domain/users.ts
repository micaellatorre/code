import { Prisma, type UserRole } from "@prisma/client"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/domain/audit"
import { getUserSelectableBranches, syncAdminBranchCoverage } from "@/lib/domain/user-branches"

export const userRoleValues = ["ADMIN", "VENDEDOR", "STOCK", "SOCIO"] as const

export const userUpsertSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalido").max(180),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  isActive: z.boolean().default(true),
  role: z.enum(userRoleValues),
  tenantId: z.string().trim().min(1, "Tenant requerido"),
  currentBranchId: z.string().trim().min(1, "Sucursal requerida"),
})

export type UserFormInput = z.infer<typeof userUpsertSchema>

export type UserTenantOption = {
  tenantId: string
  tenantName: string
  adminUserId: string
  adminName: string | null
  adminEmail: string
}

export type UserBranchOption = {
  id: string
  code: string
  name: string
  tenantId: string
}

export type UserDetail = {
  id: string
  email: string
  name: string | null
  role: UserRole
  isActive: boolean
  tenantId: string | null
  tenant: { id: string; name: string } | null
  currentBranchId: string | null
  currentBranch: { id: string; code: string; name: string } | null
  branchCoverages: { branch: { id: string; code: string; name: string } }[]
  createdAt: Date
  updatedAt: Date
}

type ActorParams = {
  actorUserId: string
  actorRole: UserRole | string
  tenantId: string
}

const userDetailInclude = {
  tenant: { select: { id: true, name: true } },
  currentBranch: { select: { id: true, code: true, name: true } },
  branchCoverages: {
    include: { branch: { select: { id: true, code: true, name: true } } },
    orderBy: { branch: { name: "asc" as const } },
  },
} satisfies Prisma.UserInclude

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function getAllowedTenantIds(params: ActorParams, tx: Prisma.TransactionClient = prisma) {
  const actorBranches = await getUserSelectableBranches(
    { userId: params.actorUserId, tenantId: params.tenantId, role: params.actorRole },
    tx,
  )
  const branchIds = actorBranches.map((branch) => branch.id)

  const admins = await tx.user.findMany({
    where: {
      role: "ADMIN",
      isActive: true,
      tenantId: { not: null },
      OR: [
        { id: params.actorUserId },
        { currentBranchId: { in: branchIds } },
        { branchCoverages: { some: { branchId: { in: branchIds } } } },
      ],
    },
    select: { tenantId: true },
    distinct: ["tenantId"],
  })

  return new Set([params.tenantId, ...admins.map((admin) => admin.tenantId).filter((id): id is string => Boolean(id))])
}

async function assertUserScope(params: ActorParams & { targetTenantId: string; currentBranchId: string }, tx: Prisma.TransactionClient = prisma) {
  const allowedTenantIds = await getAllowedTenantIds(params, tx)
  if (!allowedTenantIds.has(params.targetTenantId)) {
    throw new Error("Tenant no disponible para este administrador")
  }

  const branches = await getUserSelectableBranches(
    { userId: params.actorUserId, tenantId: params.tenantId, role: params.actorRole },
    tx,
  )
  const branch = branches.find((item) => item.id === params.currentBranchId)
  if (!branch) throw new Error("Sucursal no disponible para este administrador")

  const branchRecord = await tx.branch.findFirst({
    where: { id: params.currentBranchId, tenantId: params.targetTenantId, isActive: true },
    select: { id: true },
  })
  if (!branchRecord) throw new Error("La sucursal no pertenece al tenant seleccionado")
}

async function replaceNonAdminCoverage(tx: Prisma.TransactionClient, userId: string, branchId: string) {
  await tx.userBranchCoverage.deleteMany({ where: { userId } })
  await tx.userBranchCoverage.create({
    data: { userId, branchId },
  })
}

export async function getUserFormOptions(params: ActorParams) {
  const [branches, tenantOptions] = await prisma.$transaction(async (tx) => {
    const actorBranches = await getUserSelectableBranches(
      { userId: params.actorUserId, tenantId: params.tenantId, role: params.actorRole },
      tx,
    )
    const branchIds = actorBranches.map((branch) => branch.id)

    const admins = await tx.user.findMany({
      where: {
        role: "ADMIN",
        isActive: true,
        tenantId: { not: null },
        OR: [
          { id: params.actorUserId },
          { currentBranchId: { in: branchIds } },
          { branchCoverages: { some: { branchId: { in: branchIds } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        tenantId: true,
        tenant: { select: { id: true, name: true } },
      },
      orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }, { email: "asc" }],
    })

    const seenTenants = new Set<string>()
    const options = admins.flatMap((admin) => {
      if (!admin.tenantId || seenTenants.has(admin.tenantId)) return []
      seenTenants.add(admin.tenantId)
      return [{
        tenantId: admin.tenantId,
        tenantName: admin.tenant?.name ?? admin.tenantId,
        adminUserId: admin.id,
        adminName: admin.name,
        adminEmail: admin.email,
      }]
    })

    if (!seenTenants.has(params.tenantId)) {
      const tenant = await tx.tenant.findUnique({ where: { id: params.tenantId }, select: { id: true, name: true } })
      options.unshift({
        tenantId: params.tenantId,
        tenantName: tenant?.name ?? params.tenantId,
        adminUserId: params.actorUserId,
        adminName: null,
        adminEmail: "",
      })
    }

    return [
      actorBranches.map((branch) => ({ ...branch, tenantId: params.tenantId })),
      options,
    ]
  })

  return { branches, tenantOptions }
}

export async function getUserDetail(params: { tenantId: string; userId: string }) {
  return prisma.user.findFirst({
    where: { id: params.userId, tenantId: params.tenantId },
    include: userDetailInclude,
  }) as Promise<UserDetail | null>
}

export async function createUser(params: ActorParams & { input: UserFormInput }) {
  const input = userUpsertSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    await assertUserScope({ ...params, targetTenantId: input.tenantId, currentBranchId: input.currentBranchId }, tx)

    const user = await tx.user.create({
      data: {
        email: normalizeEmail(input.email),
        name: input.name,
        isActive: input.isActive,
        role: input.role,
        tenantId: input.tenantId,
        currentBranchId: input.currentBranchId,
      },
      include: userDetailInclude,
    })

    if (input.role === "ADMIN") {
      await syncAdminBranchCoverage({ tenantId: input.tenantId, userId: user.id }, tx)
    } else {
      await replaceNonAdminCoverage(tx, user.id, input.currentBranchId)
    }

    const userWithCoverage = await tx.user.findUniqueOrThrow({ where: { id: user.id }, include: userDetailInclude })

    await createAuditLog({
      tenantId: input.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole as UserRole,
      action: "CREATE",
      module: "USER",
      entityType: "User",
      entityId: user.id,
      detail: `Usuario creado: ${user.email}`,
      newValue: userWithCoverage,
    }, tx)

    return userWithCoverage
  })
}

export async function updateUser(params: ActorParams & { userId: string; input: UserFormInput }) {
  const input = userUpsertSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findFirst({ where: { id: params.userId, tenantId: params.tenantId }, include: userDetailInclude })
    if (!current) throw new Error("Usuario no encontrado")

    await assertUserScope({ ...params, targetTenantId: input.tenantId, currentBranchId: input.currentBranchId }, tx)

    const updated = await tx.user.update({
      where: { id: current.id },
      data: {
        email: normalizeEmail(input.email),
        name: input.name,
        isActive: input.isActive,
        role: input.role,
        tenantId: input.tenantId,
        currentBranchId: input.currentBranchId,
      },
      include: userDetailInclude,
    })

    if (input.role === "ADMIN") {
      await syncAdminBranchCoverage({ tenantId: input.tenantId, userId: updated.id }, tx)
    } else {
      await replaceNonAdminCoverage(tx, updated.id, input.currentBranchId)
    }

    const userWithCoverage = await tx.user.findUniqueOrThrow({ where: { id: updated.id }, include: userDetailInclude })

    await createAuditLog({
      tenantId: input.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole as UserRole,
      action: "UPDATE",
      module: "USER",
      entityType: "User",
      entityId: updated.id,
      detail: `Usuario actualizado: ${updated.email}`,
      oldValue: current,
      newValue: userWithCoverage,
    }, tx)

    return userWithCoverage
  })
}
