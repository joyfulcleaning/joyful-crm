'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Send } from 'lucide-react'

export type ServiceNote = {
  id: string
  body: string
  createdAt: string
  author: { id: string; name: string; role: string; avatarInitials: string | null } | null
}

// Fixed palette so a given person always gets the same avatar colour, in both
// this thread and any other service's.
const AVATAR_COLORS = ['#4f8ef7', '#38d9a9', '#f59e0b', '#a78bfa', '#f87171', '#2dd4bf', '#fb923c', '#e879f9']

function colorFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initialsFor(author: ServiceNote['author']) {
  if (!author) return '—'
  if (author.avatarInitials) return author.avatarInitials.slice(0, 2).toUpperCase()
  const parts = author.name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || author.name.slice(0, 2).toUpperCase()
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return sameDay ? time : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`
}

export default function StaffNoteThread({ serviceId }: { serviceId: string }) {
  const { data: session } = useSession()
  const currentUserId = (session?.user as { id?: string } | undefined)?.id
  const [notes, setNotes]     = useState<ServiceNote[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft]     = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/services/${serviceId}/notes`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!cancelled) setNotes(data)
      } catch {
        if (!cancelled) setError('Could not load the notes.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [serviceId])

  // Stick to the newest message whenever the thread grows.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [notes])

  async function send() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      const res = await fetch(`/api/services/${serviceId}/notes`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error()
      const created: ServiceNote = await res.json()
      setNotes(prev => [...prev, created])
      setDraft('')
    } catch {
      setError('Could not send. Try again.')
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter makes a new line — the chat convention.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div>
      <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
        Service Notes
      </label>

      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <div ref={scrollRef} className="max-h-56 overflow-y-auto px-3 py-2.5 space-y-2 bg-[var(--surface2)]/40">
          {loading ? (
            <div className="text-xs text-[var(--muted)] py-2">Loading…</div>
          ) : notes.length === 0 ? (
            <div className="text-xs text-[var(--muted)] py-2">
              No notes yet. Write the first one for the crew.
            </div>
          ) : (
            notes.map((note, i) => {
              const mine = !!note.author && note.author.id === currentUserId
              const prev = notes[i - 1]
              // Group consecutive messages from the same person: only the
              // first of a run repeats the avatar and header.
              const grouped = !!prev && prev.author?.id === note.author?.id
              const name = note.author?.name ?? 'Earlier note'

              return (
                <div key={note.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''} ${grouped ? 'mt-0.5' : 'mt-2'}`}>
                  <div className="w-7 shrink-0">
                    {!grouped && (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ background: note.author ? colorFor(note.author.name) : 'var(--border)' }}
                        title={name}
                      >
                        {initialsFor(note.author)}
                      </div>
                    )}
                  </div>

                  <div className={`max-w-[78%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!grouped && (
                      <div className={`text-[9px] text-[var(--muted)] mb-0.5 px-1 ${mine ? 'text-right' : ''}`}>
                        <span className="font-semibold">{mine ? 'You' : name}</span>
                        {' · '}{fmtTime(note.createdAt)}
                      </div>
                    )}
                    <div
                      className={`px-2.5 py-1.5 rounded-lg text-xs whitespace-pre-wrap break-words ${
                        mine
                          ? 'bg-[var(--accent)] text-white rounded-tr-sm'
                          : 'bg-[var(--surface2)] text-[var(--text)] border border-[var(--border)] rounded-tl-sm'
                      }`}
                    >
                      {note.body}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-end gap-2 border-t border-[var(--border)] px-2 py-2 bg-[var(--surface2)]">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Write a message…"
            className="flex-1 px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-none max-h-20"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim() || sending}
            className="p-1.5 rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            title="Send"
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      {error && <div className="text-[10px] text-[#f87171] mt-1">{error}</div>}
    </div>
  )
}
