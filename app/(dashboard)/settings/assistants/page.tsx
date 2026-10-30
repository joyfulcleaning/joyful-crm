'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchJsonOrThrow } from '@/lib/fetchJson'

/**
 * Settings → Connected assistants.
 *
 * Lists the OAuth grants created by the consent screen at /oauth/authorize
 * (i.e. the ChatGPT connector) and lets the admin cut them off. The consent
 * screen points here, so this is the promised off-switch.
 */

type Connection = {
  id: string
  name: string
  canWrite: boolean
  scope: string
  connectedAt: string
  lastUsedAt: string | null
  accessExpiresAt: string | null
}

function when(iso: string | null): string {
  if (!iso) return 'never'
  const date = new Date(iso)
  const minutes = Math.round((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`
  return date.toLocaleDateString()
}

export default function ConnectedAssistantsPage() {
  const [connections, setConnections] = useState<Connection[] | null>(null)
  const [error, setError] = useState('')
  const [revoking, setRevoking] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchJsonOrThrow('/api/assistant/connections')
      setConnections(data.connections)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load connections')
      setConnections([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function revoke(connection: Connection) {
    if (!confirm(`Disconnect ${connection.name}? It will immediately lose access to the CRM.`)) return
    setRevoking(connection.id)
    try {
      await fetchJsonOrThrow(`/api/assistant/connections?clientId=${encodeURIComponent(connection.id)}`, {
        method: 'DELETE',
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke access')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--text)]">Connected assistants</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        External assistants you have authorized to read and change CRM data — for example the Joyful CRM
        connector in ChatGPT. Each one acts as you, and everything it changes appears in Settings → Activity
        Log marked as coming from an assistant.
      </p>

      {error && (
        <div className="mt-5 rounded-xl border border-[#f0506e]/40 bg-[#f0506e]/10 px-4 py-3 text-sm text-[#f0506e]">
          {error}
        </div>
      )}

      {connections === null && <p className="mt-6 text-sm text-[var(--muted)]">Loading…</p>}

      {connections?.length === 0 && (
        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="text-sm text-[var(--muted)]">
            No assistants are connected. Add the connector from ChatGPT pointing at{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">/api/assistant/mcp</code> and approve it
            here to create one.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {connections?.map(connection => (
          <div
            key={connection.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--text)]">{connection.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    connection.canWrite
                      ? 'bg-[#f59e0b]/15 text-[#f59e0b]'
                      : 'bg-[#38d9a9]/15 text-[#38d9a9]'
                  }`}
                >
                  {connection.canWrite ? 'Read & write' : 'Read only'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Connected {new Date(connection.connectedAt).toLocaleDateString()} · last used{' '}
                {when(connection.lastUsedAt)}
              </p>
            </div>
            <button
              onClick={() => revoke(connection)}
              disabled={revoking === connection.id}
              className="rounded-lg border border-[#f0506e]/40 px-4 py-2 text-sm font-semibold text-[#f0506e] transition hover:bg-[#f0506e]/10 disabled:opacity-50"
            >
              {revoking === connection.id ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
