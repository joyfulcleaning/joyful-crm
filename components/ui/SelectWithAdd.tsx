'use client'
import { useState } from 'react'
import { Check, X } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  options: string[]
  storageKey: string
  placeholder?: string
  className?: string
  addLabel?: string
  capitalize?: boolean
}

const UPPERCASE_OPTS: Record<string, string> = { eft: 'EFT', ach: 'ACH', credit_card: 'Credit Card' }
function cap(s: string) { return s ? (UPPERCASE_OPTS[s.toLowerCase()] ?? s.charAt(0).toUpperCase() + s.slice(1)) : s }

export default function SelectWithAdd({
  value, onChange, options, storageKey, placeholder, className, addLabel = 'option', capitalize = true,
}: Props) {
  const [custom, setCustom] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(`_sel_${storageKey}`) ?? '[]') } catch { return [] }
  })
  const [adding, setAdding] = useState(false)
  const [input, setInput] = useState('')

  const all = [...options, ...custom]

  function handleSelect(v: string) {
    if (v === '__add__') { setAdding(true); setInput(''); return }
    onChange(v)
  }

  function confirm() {
    const trimmed = input.trim()
    if (!trimmed) { setAdding(false); return }
    const updated = [...custom, trimmed]
    setCustom(updated)
    try { localStorage.setItem(`_sel_${storageKey}`, JSON.stringify(updated)) } catch {}
    onChange(trimmed)
    setAdding(false)
  }

  if (adding) {
    return (
      <div className="flex gap-1">
        <input
          autoFocus
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); confirm() }
            if (e.key === 'Escape') setAdding(false)
          }}
          placeholder={`New ${addLabel}…`}
          className={className ?? 'w-full px-3 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none'}
        />
        <button
          type="button"
          onClick={confirm}
          className="px-2.5 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 flex-shrink-0 transition-opacity"
        >
          <Check size={12} />
        </button>
        <button
          type="button"
          onClick={() => setAdding(false)}
          className="px-2.5 border border-[var(--border)] rounded-lg text-[var(--muted)] hover:text-[var(--text)] flex-shrink-0 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <select value={value} onChange={e => handleSelect(e.target.value)} className={className}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {all.map(o => (
        <option key={o} value={o}>{capitalize ? cap(o) : o}</option>
      ))}
      <option value="__add__">+ Add {addLabel}…</option>
    </select>
  )
}
