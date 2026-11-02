'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface StaffMember {
  id:           string
  name:         string
  status?:      string
  staffGroupId?: string | null
}

interface Group {
  id:        string
  name:      string
  color:     string | null
  sortOrder: number
  isActive:  boolean
}

interface Props {
  staff:    StaffMember[]
  value:    string[]
  onChange: (staffIds: string[]) => void
}

const FALLBACK_COLOR = '#4f8ef7'

function firstName(name: string) {
  return (name || '').split(' ')[0]
}

/**
 * Staffing picker: assign a whole team with one tap, then open it to drop
 * whoever is out today.
 *
 * `value` stays a flat list of user ids — the group is purely a selection
 * shortcut, so callers keep posting `staffIds` exactly as before and nothing
 * downstream needs to know groups exist.
 */
export default function StaffGroupPicker({ staff, value, onChange }: Props) {
  const [groups,   setGroups]   = useState<Group[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    fetch('/api/staff-groups')
      .then(r => r.ok ? r.json() : [])
      .then((data: Group[]) => { if (!cancelled) setGroups(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setGroups([]) })
    return () => { cancelled = true }
  }, [])

  const selected = useMemo(() => new Set(value), [value])

  // Only groups that still have people in them are worth showing, plus any
  // group an already-assigned person belongs to even if it was archived.
  const visibleGroups = useMemo(() => {
    const byGroup = new Map<string, StaffMember[]>()
    for (const m of staff) {
      if (!m.staffGroupId) continue
      const list = byGroup.get(m.staffGroupId) || []
      list.push(m)
      byGroup.set(m.staffGroupId, list)
    }
    return groups
      .filter(g => {
        const members = byGroup.get(g.id)
        if (!members || members.length === 0) return false
        return g.isActive || members.some(m => selected.has(m.id))
      })
      .map(g => ({
        ...g,
        members: (byGroup.get(g.id) || []).sort((a, b) => a.name.localeCompare(b.name)),
      }))
  }, [groups, staff, selected])

  const ungrouped = useMemo(
    () => staff
      .filter(m => !m.staffGroupId)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [staff]
  )

  function toggleOne(id: string) {
    onChange(selected.has(id) ? value.filter(v => v !== id) : [...value, id])
  }

  // Tapping the group chip assigns the team. Inactive members are left out of
  // the bulk pick — they can still be added by hand from the expanded list.
  function toggleGroup(members: StaffMember[]) {
    const assignable = members.filter(m => m.status !== 'inactive')
    const pool       = assignable.length > 0 ? assignable : members
    const allOn      = pool.every(m => selected.has(m.id))

    if (allOn) {
      const drop = new Set(pool.map(m => m.id))
      onChange(value.filter(v => !drop.has(v)))
    } else {
      const next = new Set(value)
      for (const m of pool) next.add(m.id)
      onChange(Array.from(next))
    }
  }

  return (
    <div className="space-y-2">
      {visibleGroups.map(group => {
        const color     = group.color || FALLBACK_COLOR
        const assignable = group.members.filter(m => m.status !== 'inactive')
        const pool      = assignable.length > 0 ? assignable : group.members
        const onCount   = pool.filter(m => selected.has(m.id)).length
        const allOn     = onCount === pool.length && pool.length > 0
        const partial   = onCount > 0 && !allOn
        const isOpen    = !!expanded[group.id]

        return (
          <div
            key={group.id}
            className="rounded-xl border transition-all"
            style={{
              borderColor:     onCount > 0 ? color : 'var(--border)',
              backgroundColor: onCount > 0 ? `${color}0f` : 'transparent',
            }}
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => toggleGroup(group.members)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <span
                  className="w-4 h-4 rounded-md border flex items-center justify-center shrink-0"
                  style={
                    allOn   ? { backgroundColor: color, borderColor: color }
                  : partial ? { borderColor: color, backgroundColor: `${color}33` }
                            : { borderColor: 'var(--border)' }
                  }
                >
                  {allOn   && <Check size={11} className="text-white" strokeWidth={3} />}
                  {partial && <span className="w-1.5 h-0.5 rounded-full" style={{ backgroundColor: color }} />}
                </span>
                <span
                  className="text-xs font-bold truncate"
                  style={{ color: onCount > 0 ? color : 'var(--text)' }}
                >
                  {group.name}
                </span>
                {!group.isActive && (
                  <span className="text-[9px] text-[var(--muted)] shrink-0">archived</span>
                )}
                <span
                  className="text-[10px] font-semibold font-mono shrink-0"
                  style={{ color: partial ? '#f59e0b' : 'var(--muted)' }}
                >
                  {onCount}/{pool.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setExpanded(e => ({ ...e, [group.id]: !e[group.id] }))}
                aria-expanded={isOpen}
                aria-label={isOpen ? `Hide ${group.name} members` : `Show ${group.name} members`}
                className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--text)] transition-all shrink-0"
              >
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {isOpen && (
              <div className="px-3 pb-2.5 pt-0.5 border-t border-[var(--border)] mt-0.5 space-y-1">
                <p className="text-[9px] text-[var(--muted)] pt-1.5">
                  Tap anyone to leave them off this service.
                </p>
                {group.members.map(m => {
                  const on       = selected.has(m.id)
                  const inactive = m.status === 'inactive'
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleOne(m.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--surface2)] transition-all text-left"
                    >
                      <span
                        className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                        style={on
                          ? { backgroundColor: color, borderColor: color }
                          : { borderColor: 'var(--border)' }}
                      >
                        {on && <Check size={9} className="text-white" strokeWidth={3} />}
                      </span>
                      <span
                        className={`text-xs truncate ${on ? 'font-semibold' : ''}`}
                        style={{ color: on ? 'var(--text)' : 'var(--muted)' }}
                      >
                        {m.name}
                      </span>
                      {inactive && (
                        <span className="text-[9px] text-[#f87171] shrink-0">inactive</span>
                      )}
                      {!on && (
                        <span className="text-[9px] text-[var(--muted)] ml-auto shrink-0">excluded</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {ungrouped.length > 0 && (
        <div>
          {visibleGroups.length > 0 && (
            <div className="text-[9px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1.5 mt-1">
              No group
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {ungrouped.map(m => {
              const on = selected.has(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleOne(m.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    on
                      ? 'bg-[rgba(74,63,176,0.12)] border-[var(--accent)] text-[var(--accent)]'
                      : 'bg-transparent border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {firstName(m.name)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {visibleGroups.length === 0 && ungrouped.length === 0 && (
        <p className="text-xs text-[var(--muted)]">No staff available.</p>
      )}
    </div>
  )
}
