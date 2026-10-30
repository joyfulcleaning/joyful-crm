export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/mobile-auth'
import { logAudit } from '@/lib/audit'

/**
 * Connected-assistant management for /settings/assistants — the "revoke"
 * side of the OAuth grant the consent screen creates.
 *
 * Scoped to the signed-in admin's own grants: tokens belong to the admin who
 * approved them, so one admin cannot silently cut another's connection.
 */

export async function GET(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tokens = await prisma.oAuthToken.findMany({
    where: { userId: authUser.id, revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      kind: true,
      scope: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      client: { select: { id: true, name: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // One row per connector, not per token — a live connection is an access
  // token plus its refresh token, which is an implementation detail here.
  const byClient = new Map<
    string,
    { id: string; name: string; scope: string; connectedAt: Date; lastUsedAt: Date | null; accessExpiresAt: Date | null }
  >()

  for (const token of tokens) {
    const existing = byClient.get(token.client.id)
    const lastUsed = token.lastUsedAt
    if (!existing) {
      byClient.set(token.client.id, {
        id: token.client.id,
        name: token.client.name,
        scope: token.scope,
        connectedAt: token.createdAt,
        lastUsedAt: lastUsed,
        accessExpiresAt: token.kind === 'access' ? token.expiresAt : null,
      })
      continue
    }
    if (lastUsed && (!existing.lastUsedAt || lastUsed > existing.lastUsedAt)) existing.lastUsedAt = lastUsed
    if (token.createdAt < existing.connectedAt) existing.connectedAt = token.createdAt
    if (token.kind === 'access') existing.accessExpiresAt = token.expiresAt
  }

  return NextResponse.json({
    connections: [...byClient.values()].map(c => ({
      id: c.id,
      name: c.name,
      canWrite: c.scope.split(' ').includes('crm.write'),
      scope: c.scope,
      connectedAt: c.connectedAt.toISOString(),
      lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
      accessExpiresAt: c.accessExpiresAt?.toISOString() ?? null,
    })),
  })
}

export async function DELETE(request: Request) {
  const authUser = await getAuthUser(request)
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clientDbId = new URL(request.url).searchParams.get('clientId')
  if (!clientDbId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })

  const client = await prisma.oAuthClient.findUnique({
    where: { id: clientDbId },
    select: { id: true, name: true },
  })
  if (!client) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  const revoked = await prisma.oAuthToken.updateMany({
    where: { clientId: client.id, userId: authUser.id, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  // Any unredeemed code would otherwise still be exchangeable for a new token.
  await prisma.oAuthAuthCode.updateMany({
    where: { clientId: client.id, userId: authUser.id, consumedAt: null },
    data: { consumedAt: new Date() },
  })

  await logAudit(authUser, 'delete', 'oauth_grant', client.id, {
    client: client.name,
    tokensRevoked: revoked.count,
  })

  return NextResponse.json({ revoked: true, name: client.name, tokensRevoked: revoked.count })
}
