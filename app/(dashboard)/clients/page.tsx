'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Building2, Home, Layers, Pencil, Trash2, Users } from 'lucide-react'
import ClientModal from '@/components/modals/ClientModal'
import ClientDetailModal from '@/components/modals/ClientDetailModal'
import ManagementModal, { PRICE_FIELDS, PRIVATE_CUSTOMER_FIELDS } from '@/components/modals/ManagementModal'
import ConfirmModal from '@/components/modals/ConfirmModal'

// ─── Clients Tab ──────────────────────────────────────────────────────────────
function ClientsTab() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('active')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  function loadClients() {
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => { setClients(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadClients() }, [])

  const filtered = clients.filter(c => {
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.address?.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ||
      (filter === 'residential' && c.type === 'residential') ||
      (filter === 'commercial' && c.type === 'commercial') ||
      (filter === 'active' && c.status === 'active') ||
      (filter === 'inactive' && c.status === 'inactive')
    return matchSearch && matchFilter
  })

  const initials = (name: string) =>
    name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Search client..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[var(--surface2)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] w-48"
            />
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-white text-sm font-semibold rounded-lg transition-all">
          <Plus size={15} />
          New Client
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All' },
          { key: 'residential', label: 'Residential' },
          { key: 'commercial', label: 'Commercial' },
          { key: 'active', label: 'Active' },
          { key: 'inactive', label: 'Inactive' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filter === f.key
                ? 'bg-[rgba(74,63,176,0.12)] border-[var(--accent)] text-[var(--accent)]'
                : 'bg-transparent border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-10 text-[var(--muted)] text-xs">Loading...</div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((c: any) => {
            const isCommercial = c.type === 'commercial'
            const avatarBg = isCommercial ? 'rgba(56,217,169,0.15)' : 'rgba(74,63,176,0.15)'
            const avatarColor = isCommercial ? '#38d9a9' : 'var(--accent)'
            const typeColor = avatarColor

            return (
              <div
                key={c.id}
                onClick={() => { setSelectedClient(c); setDetailOpen(true) }}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)] hover:translate-y-[-1px] transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: avatarBg, color: avatarColor }}>
                    {initials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)] truncate">{c.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {isCommercial ? <Building2 size={10} style={{ color: typeColor }} /> : <Home size={10} style={{ color: typeColor }} />}
                      <span className="text-[10px] font-semibold capitalize" style={{ color: typeColor }}>{c.type}</span>
                    </div>
                    {c.management && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Layers size={9} className="text-[var(--accent)]" />
                        <span className="text-[10px] text-[var(--accent)]">{c.management.name}</span>
                      </div>
                    )}
                  </div>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${c.status === 'active' ? 'bg-[#38d9a9]' : 'bg-[var(--muted)]'}`} />
                </div>

                <div className="mt-3 space-y-1">
                  {c.address && <div className="text-[10px] text-[var(--muted)] truncate">📍 {c.address}</div>}
                  {c.phone && <div className="text-[10px] text-[var(--muted)]">📞 {c.phone}</div>}
                  {c.contactName && (
                    <div className="text-[10px] text-[var(--muted)] truncate">
                      👤 {c.contactName}{c.contactPhone ? ` · ${c.contactPhone}` : ''}
                    </div>
                  )}
                  {c.frequency && <div className="text-[10px] text-[var(--muted)]">🗓 {c.frequency?.replace('_', '-')}</div>}
                  {c.priceRef && Object.keys(c.priceRef).length > 0 && (
                    <div className="text-[10px] text-[var(--muted)]">
                      💰 {Object.entries(c.priceRef)
                        .filter(([, v]) => v)
                        .slice(0, 3)
                        .map(([k, v]) => {
                          const label = PRICE_FIELDS.find(f => f.key === k)?.label ?? PRIVATE_CUSTOMER_FIELDS.find(f => f.key === k)?.label ?? k
                          return `${label}: ${isNaN(Number(v)) ? v : `$${v}`}`
                        })
                        .join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          <div
            onClick={() => setModalOpen(true)}
            className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-[var(--accent)] transition-all cursor-pointer min-h-32"
          >
            <div className="w-8 h-8 rounded-full bg-[rgba(74,63,176,0.1)] flex items-center justify-center">
              <Plus size={16} className="text-[var(--accent)]" />
            </div>
            <span className="text-xs font-semibold text-[var(--muted)]">New Client</span>
          </div>
        </div>
      )}

      {!loading && (
        <div className="text-xs text-[var(--muted)]">Showing {filtered.length} of {clients.length} clients</div>
      )}

      <ClientModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={loadClients} />
      <ClientDetailModal
        client={selectedClient}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedClient(null) }}
        onSuccess={loadClients}
      />
    </div>
  )
}

// ─── Management Tab ───────────────────────────────────────────────────────────
function ManagementTab() {
  const [managements, setManagements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  function loadManagements() {
    fetch('/api/management')
      .then(r => r.json())
      .then(data => { setManagements(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadManagements() }, [])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/management/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    setDeleting(false)
    loadManagements()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:opacity-90 text-white text-sm font-semibold rounded-lg transition-all">
          <Plus size={15} />
          New Management
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-[var(--muted)] text-xs">Loading...</div>
      ) : managements.length === 0 ? (
        <div className="text-center py-16 text-[var(--muted)]">
          <Layers size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">No management companies yet</p>
          <p className="text-xs mt-1">Create one para definir condiciones de precio</p>
        </div>
      ) : (
        <div className="space-y-3">
          {managements.map(mgmt => {
            const active = PRICE_FIELDS.filter(f =>
              mgmt.priceConditions?.[f.key]?.active && mgmt.priceConditions?.[f.key]?.value
            )
            return (
              <div key={mgmt.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--accent)] transition-all">
                {/* Header row */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[rgba(74,63,176,0.12)] flex items-center justify-center">
                      <Layers size={16} className="text-[var(--accent)]" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[var(--text)]">{mgmt.name}</div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-[var(--muted)]">
                          {active.length} condición{active.length !== 1 ? 'es' : ''} activa{active.length !== 1 ? 's' : ''}
                        </span>
                        {mgmt._count?.clients > 0 && (
                          <>
                            <span className="text-[var(--border)]">·</span>
                            <span className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
                              <Users size={9} />
                              {mgmt._count.clients} cliente{mgmt._count.clients !== 1 ? 's' : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditing(mgmt); setModalOpen(true) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(mgmt)}
                      className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[#f87171] hover:border-[rgba(248,113,113,0.4)] transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Price conditions grid */}
                {active.length > 0 && (
                  <div className="border-t border-[var(--border)] px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      {active.map(field => {
                        const cond = mgmt.priceConditions[field.key]
                        const display = field.hasFreq && cond.frequency
                          ? `${cond.frequency} $${cond.value}`
                          : `$${cond.value}`
                        return (
                          <div key={field.key}
                            className="px-2.5 py-1 bg-[rgba(74,63,176,0.08)] border border-[rgba(74,63,176,0.2)] rounded-lg flex items-center gap-1.5">
                            <span className="text-[10px] text-[var(--muted)]">{field.label}</span>
                            <span className="text-xs font-bold text-[#38d9a9]">{display}</span>
                          </div>
                        )
                      })}
                    </div>
                    {mgmt.notes && (
                      <p className="text-[10px] text-[var(--muted)] mt-2">{mgmt.notes}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ManagementModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSuccess={() => { setModalOpen(false); setEditing(null); loadManagements() }}
        management={editing}
      />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Management"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Clients linked to it will lose the management reference.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const [tab, setTab] = useState<'clients' | 'management'>('clients')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text)]">Clients</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">Client CRM</p>
        </div>
        {/* Tab switcher */}
        <div className="flex items-center bg-[var(--surface2)] border border-[var(--border)] rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab('clients')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'clients'
                ? 'bg-[var(--accent)] text-white shadow'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <Home size={12} /> Clients
          </button>
          <button
            onClick={() => setTab('management')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'management'
                ? 'bg-[var(--accent)] text-white shadow'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <Layers size={12} /> Management
          </button>
        </div>
      </div>

      {tab === 'clients' ? <ClientsTab /> : <ManagementTab />}
    </div>
  )
}
