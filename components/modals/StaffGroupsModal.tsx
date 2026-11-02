'use client'

import { useEffect, useState } from 'react'
import { X, Plus, Trash2, Check, ChevronDown, Users } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface Group {
  id:        string
  name:      string
  color:     string | null
  sortOrder: number
  isActive:  boolean
}

interface Props {
  open:      boolean
  onClose:   () => void
  staff:     any[]
  onSuccess: () => void
}

// Kept to the app's existing accent hues so a group pill never clashes with
// the rest of the UI.
const PALETTE = ['#4f8ef7', '#38d9a9', '#a78bfa', '#f59e0b', '#f87171', '#22d3ee']

const INPUT = 'w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors'

export default function StaffGroupsModal({ open, onClose, staff, onSuccess }: Props) {
  const { t } = useI18n()
  const g = t.staffPage.groups

  const [groups,   setGroups]   = useState<Group[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState<string | null>(null)
  const [openRow,  setOpenRow]  = useState<string | null>(null)
  const [newName,  setNewName]  = useState('')
  // Pending edits per group, so typing a name doesn't fire a request per key.
  const [drafts,   setDrafts]   = useState<Record<string, { name: string; color: string | null; memberIds: string[] }>>({})

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/staff-groups')
      if (!res.ok) throw new Error()
      setGroups(await res.json())
    } catch {
      setError(g.loadError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (open) { load(); setOpenRow(null); setNewName('') } }, [open])

  function draftFor(group: Group) {
    return drafts[group.id] ?? {
      name:      group.name,
      color:     group.color,
      memberIds: staff.filter(m => m.staffGroupId === group.id).map(m => m.id),
    }
  }

  function setDraft(group: Group, patch: Partial<{ name: string; color: string | null; memberIds: string[] }>) {
    setDrafts(d => ({ ...d, [group.id]: { ...draftFor(group), ...patch } }))
  }

  async function createGroup() {
    const name = newName.trim()
    if (!name) return
    setBusy('new'); setError('')
    try {
      const res = await fetch('/api/staff-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: PALETTE[groups.length % PALETTE.length] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || g.saveError)
      setNewName('')
      await load()
      onSuccess()
    } catch (err: any) {
      setError(err.message || g.saveError)
    } finally {
      setBusy(null)
    }
  }

  async function saveGroup(group: Group) {
    const draft = draftFor(group)
    setBusy(group.id); setError('')
    try {
      const res = await fetch(`/api/staff-groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: draft.name, color: draft.color, memberIds: draft.memberIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || g.saveError)
      setDrafts(d => { const next = { ...d }; delete next[group.id]; return next })
      await load()
      onSuccess()
    } catch (err: any) {
      setError(err.message || g.saveError)
    } finally {
      setBusy(null)
    }
  }

  async function toggleArchived(group: Group) {
    setBusy(group.id); setError('')
    try {
      const res = await fetch(`/api/staff-groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !group.isActive }),
      })
      if (!res.ok) throw new Error()
      await load()
      onSuccess()
    } catch {
      setError(g.saveError)
    } finally {
      setBusy(null)
    }
  }

  async function deleteGroup(group: Group) {
    const count = staff.filter(m => m.staffGroupId === group.id).length
    if (!confirm(g.deleteConfirm(group.name, count))) return
    setBusy(group.id); setError('')
    try {
      const res = await fetch(`/api/staff-groups/${group.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await load()
      onSuccess()
    } catch {
      setError(g.saveError)
    } finally {
      setBusy(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4">
        <div className="sticky top-0 bg-[#161922] border-b border-[#2a2f3d] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-sm font-bold text-[#e8eaf0]">{g.title}</div>
            <div className="text-[10px] text-[#6b7280] mt-0.5">{g.subtitle}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Create */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createGroup() }}
              placeholder={g.namePlaceholder}
              className={INPUT}
            />
            <button
              onClick={createGroup}
              disabled={!newName.trim() || busy === 'new'}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50 shrink-0"
            >
              <Plus size={13} />{g.newGroup}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-[#6b7280] text-xs">{t.staffPage.loading}</div>
          ) : groups.length === 0 ? (
            <p className="text-center py-8 text-[#6b7280] text-xs">{g.empty}</p>
          ) : (
            <div className="space-y-2">
              {groups.map(group => {
                const draft     = draftFor(group)
                const color     = draft.color || '#4f8ef7'
                const isOpen    = openRow === group.id
                const memberCnt = staff.filter(m => m.staffGroupId === group.id).length
                const dirty     = !!drafts[group.id]

                return (
                  <div key={group.id} className="border border-[#2a2f3d] rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-[#1e2330]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-xs font-bold text-[#e8eaf0] truncate">{group.name}</span>
                      {!group.isActive && <span className="text-[9px] text-[#6b7280] shrink-0">{g.archived}</span>}
                      <span className="text-[10px] text-[#6b7280] ml-auto shrink-0">{g.memberCount(memberCnt)}</span>
                      <button
                        onClick={() => setOpenRow(isOpen ? null : group.id)}
                        aria-expanded={isOpen}
                        className="p-1 rounded-md text-[#6b7280] hover:text-[#e8eaf0] transition-all shrink-0"
                      >
                        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="p-3 space-y-3">
                        <input
                          type="text"
                          value={draft.name}
                          onChange={e => setDraft(group, { name: e.target.value })}
                          className={INPUT}
                        />

                        <div className="flex items-center gap-2">
                          {PALETTE.map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setDraft(group, { color: c })}
                              aria-label={c}
                              className="w-6 h-6 rounded-lg border-2 transition-all"
                              style={{ background: `${c}33`, borderColor: draft.color === c ? c : 'transparent' }}
                            >
                              {draft.color === c && <Check size={12} style={{ color: c }} className="mx-auto" strokeWidth={3} />}
                            </button>
                          ))}
                        </div>

                        <div>
                          <div className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">
                            <Users size={9} className="inline mr-1" />{g.membersLabel}
                          </div>
                          <div className="space-y-1 max-h-52 overflow-y-auto">
                            {staff.map((m: any) => {
                              const on       = draft.memberIds.includes(m.id)
                              const elsewhere = m.staffGroupId && m.staffGroupId !== group.id
                                ? groups.find(x => x.id === m.staffGroupId)?.name
                                : null
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setDraft(group, {
                                    memberIds: on
                                      ? draft.memberIds.filter(id => id !== m.id)
                                      : [...draft.memberIds, m.id],
                                  })}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#1e2330] transition-all text-left"
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                                    style={on ? { background: color, borderColor: color } : { borderColor: '#2a2f3d' }}
                                  >
                                    {on && <Check size={9} className="text-white" strokeWidth={3} />}
                                  </span>
                                  <span className={`text-xs truncate ${on ? 'text-[#e8eaf0] font-semibold' : 'text-[#6b7280]'}`}>
                                    {m.name}
                                  </span>
                                  {!on && elsewhere && (
                                    <span className="text-[9px] text-[#6b7280] ml-auto shrink-0">{elsewhere}</span>
                                  )}
                                  {on && elsewhere && (
                                    <span className="text-[9px] text-[#f59e0b] ml-auto shrink-0">{g.movesFrom(elsewhere)}</span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleArchived(group)}
                              disabled={busy === group.id}
                              className="px-2.5 py-1.5 rounded-lg border border-[#2a2f3d] text-[10px] font-semibold text-[#6b7280] hover:text-[#e8eaf0] transition-all disabled:opacity-50"
                            >
                              {group.isActive ? g.archive : g.unarchive}
                            </button>
                            <button
                              onClick={() => deleteGroup(group)}
                              disabled={busy === group.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[rgba(248,113,113,0.25)] text-[10px] font-semibold text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-all disabled:opacity-50"
                            >
                              <Trash2 size={11} />{g.delete}
                            </button>
                          </div>
                          <button
                            onClick={() => saveGroup(group)}
                            disabled={busy === group.id || !dirty || !draft.name.trim()}
                            className="px-3 py-1.5 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-[10px] font-semibold rounded-lg transition-all disabled:opacity-50"
                          >
                            {busy === group.id ? g.saving : g.save}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
