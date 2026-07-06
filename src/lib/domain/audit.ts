import type { AuditAction, AuditModule, Prisma, UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"

type AuditInput = {
  tenantId: string
  actorUserId?: string | null
  actorRole?: UserRole | null
  action: AuditAction
  module: AuditModule
  entityType: string
  entityId?: string | null
  detail: string
  oldValue?: Prisma.InputJsonValue
  newValue?: Prisma.InputJsonValue
  metadata?: Prisma.InputJsonValue
  executedByAdminInSimulation?: boolean
  simulatedRole?: UserRole | null
}

export async function createAuditLog(input: AuditInput, tx: Prisma.TransactionClient = prisma) {
  return tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      detail: input.detail,
      oldValue: input.oldValue ?? undefined,
      newValue: input.newValue ?? undefined,
      metadata: input.metadata ?? undefined,
      executedByAdminInSimulation: input.executedByAdminInSimulation ?? false,
      simulatedRole: input.simulatedRole ?? null,
    },
  })
}
