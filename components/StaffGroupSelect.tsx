'use client'

import { useEffect, useState } from 'react'

export interface StaffGroupOption {
  id:       string
  name:     string
  color:    string | null
  isActive: boolean
}

interface Props {
  value:      string | null | undefined
  onChange:   (groupId: string | null) => void
  className?: string
}

// Shared by the create-staff and edit-staff forms so the two can't drift apart.
// Styling comes from the caller's own input class, since the staff modals use
// literal hex colors while the service modals use CSS variables.
export default function StaffGroupSelect({ value, onChange, className }: Props) {
  const [groups,  setGroups]  = useState<StaffGroupOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/staff-groups')
      .then(r => r.ok ? r.json() : [])
      .then((data: StaffGroupOption[]) => {
        if (!cancelled) setGroups(Array.isArray(data) ? data : [])
      })
      .catch(() => { if (!cancelled) setGroups([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Keep an archived group listed while it is still this person's group —
  // otherwise opening their profile would silently reassign them to "no group".
  const options = groups.filter(g => g.isActive || g.id === value)

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      className={className}
    >
      <option value="">{loading ? 'Loading groups…' : '— No group —'}</option>
      {options.map(g => (
        <option key={g.id} value={g.id}>
          {g.name}{g.isActive ? '' : ' (archived)'}
        </option>
      ))}
    </select>
  )
}
