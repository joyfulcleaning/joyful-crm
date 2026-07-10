import { prisma } from './prisma'
import { AuthUser } from './mobile-auth'

type AuditAction = 'create' | 'update' | 'delete'

// Fire-and-forget: never let an audit write fail the actual operation it's
// describing. Call after the real mutation succeeds.
export async function logAudit(
  actor: AuthUser | null,
  action: AuditAction,
  entity: string,
  entityId: string | null,
  details: Record<string, any>
) {
  if (!actor) return
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action,
        entity,
        entityId,
        details: { actorName: actor.name, ...details },
      },
    })
  } catch (err) {
    console.error(`Failed to write audit log for ${entity}/${action}:`, err)
  }
}
