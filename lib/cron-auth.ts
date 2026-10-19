import { NextResponse } from 'next/server'

/**
 * Shared guard for the Vercel Cron endpoints.
 *
 * Each route used to inline `auth !== \`Bearer ${process.env.CRON_SECRET}\``,
 * which has a nasty failure mode when the variable isn't set: the expected
 * value becomes the literal string "Bearer undefined". That is both
 *
 *  - broken — Vercel Cron sends no Authorization header at all unless
 *    CRON_SECRET is configured, so every scheduled run got a 401 and silently
 *    did nothing (which is how the day-before service reminders, and the
 *    auto-registered recurring expenses, never ran even once), and
 *  - open — anyone who sends that guessable value gets to trigger jobs that
 *    email clients and write expense rows.
 *
 * So: when the secret is configured, require it. When it isn't, refuse and say
 * why, loudly, instead of pretending to be protected by an undefined value.
 * Returns a response to send back, or null when the request may proceed.
 */
export function rejectUnauthorizedCron(request: Request, job: string): NextResponse | null {
  // Local development runs these by hand; there's no Vercel Cron to authorize.
  if (process.env.NODE_ENV !== 'production') return null

  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error(
      `Cron "${job}" refused: CRON_SECRET is not set on this deployment, so no ` +
      `scheduled run can be authorized. Add it in the Vercel project's ` +
      `environment variables and redeploy.`
    )
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured on this deployment', job },
      { status: 503 }
    )
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
