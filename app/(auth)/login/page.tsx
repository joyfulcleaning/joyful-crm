import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import LoginForm from './LoginForm'

/**
 * Only same-origin paths are honoured — a `callbackUrl` pointing at another
 * host would turn the login page into an open redirect. `//evil.com` is a
 * protocol-relative URL, so a leading slash alone is not enough.
 */
function safeCallback(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard'
  return value
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const callbackUrl = safeCallback((await searchParams).callbackUrl)
  const session = await getServerSession(authOptions)
  if (session) redirect(callbackUrl)
  return <LoginForm callbackUrl={callbackUrl} />
}
