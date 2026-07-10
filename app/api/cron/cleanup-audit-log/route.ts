export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const RETENTION_DAYS = 400 // ~13 months — enough to compare against last year

async function cleanupAuditLog() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
  const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
  return { deleted: count }
}

// Vercel Cron calls GET — protected by CRON_SECRET in production
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  try {
    const result = await cleanupAuditLog()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('Cron cleanup-audit-log:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
