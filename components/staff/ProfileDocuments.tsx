'use client'

import { useState } from 'react'
import { Eye, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { localDateStr } from '@/lib/local-date'
import { fmtDate } from '@/lib/staff-profile'
import { DOC_STATUS_COLORS, STAFF_DOCUMENTS, complianceOf, fileSizeText } from '@/lib/staff-documents'

const INPUT = 'w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors'
const LABEL = 'text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5'
const TH = 'px-3 py-2.5 text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider whitespace-nowrap'
const TD = 'px-3 py-2.5 text-xs text-[#e8eaf0] whitespace-nowrap'
const ACTION = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#2a2f3d] text-[11px] font-semibold text-[#6b7280] hover:text-[#4f8ef7] hover:border-[#4f8ef7] transition-all disabled:opacity-40'

const MAX_BYTES = 25 * 1024 * 1024

export async function openDocument(docId: string) {
  // Opened before the await so pop-up blockers treat it as a click.
  const tab = window.open('', '_blank')
  const res = await fetch(`/api/staff-documents/${docId}`)
  const { url } = res.ok ? await res.json() : { url: null }
  if (url && tab) tab.location.href = url
  else { tab?.close(); throw new Error('open failed') }
}

interface Props {
  member:    any
  documents: any[]
  onChanged: () => void
}

export default function ProfileDocuments({ member, documents, onChanged }: Props) {
  const { t } = useI18n()
  const sd = t.staffDocs
  const today = localDateStr()
  const c = complianceOf(member, documents, today)
  const others = documents.filter(d => d.userId === member.id && d.docType === 'other')

  const [modal, setModal]     = useState<{ docType: string } | null>(null)
  const [form, setForm]       = useState({ title: '', issuedAt: '', expiresAt: '', note: '' })
  const [file, setFile]       = useState<File | null>(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  function openModal(docType: string) {
    setModal({ docType }); setForm({ title: '', issuedAt: '', expiresAt: '', note: '' }); setFile(null); setError('')
  }

  async function save() {
    if (!modal) return
    if (file && file.size > MAX_BYTES) { setError(sd.modal.tooLarge); return }
    setSaving(true); setError('')
    try {
      let upload: { storagePath?: string } = {}
      if (file) {
        const prep = await fetch(`/api/staff/${member.id}/documents`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prepare: true, fileName: file.name }),
        })
        if (!prep.ok) throw new Error()
        const { uploadUrl, storagePath } = await prep.json()
        const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
        if (!put.ok) throw new Error()
        upload = { storagePath }
      }
      const res = await fetch(`/api/staff/${member.id}/documents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType: modal.docType, ...form, ...upload,
          fileName: file?.name, mimeType: file?.type, sizeBytes: file?.size,
        }),
      })
      if (!res.ok) throw new Error()
      setModal(null); onChanged()
    } catch {
      setError(sd.modal.error)
    } finally {
      setSaving(false)
    }
  }

  async function remove(docId: string) {
    if (confirmId !== docId) { setConfirmId(docId); return }
    setConfirmId(null)
    const res = await fetch(`/api/staff-documents/${docId}`, { method: 'DELETE' })
    if (res.ok) onChanged()
  }

  async function view(docId: string) {
    try { await openDocument(docId) } catch { alert(sd.openError) }
  }

  const expires = modal && (modal.docType === 'other' || STAFF_DOCUMENTS.find(d => d.key === modal.docType)?.expires)

  function fileCell(doc: any) {
    if (!doc) return '—'
    if (!doc.storagePath) return <span className="text-[#6b7280]">{sd.paper}</span>
    return <span title={doc.fileName}>{doc.fileName?.slice(0, 28)} <span className="text-[#6b7280]">{fileSizeText(doc.sizeBytes)}</span></span>
  }

  function actions(doc: any, docType: string, canRenew: boolean) {
    return (
      <div className="flex items-center gap-1.5 justify-end">
        {doc?.storagePath && <button onClick={() => view(doc.id)} className={ACTION}><Eye size={11} />{sd.view}</button>}
        <button onClick={() => openModal(docType)} className={ACTION}><Upload size={11} />{doc && canRenew ? sd.renew : sd.upload}</button>
        {doc && (
          <button onClick={() => remove(doc.id)} title={sd.deleteConfirm} className={`${ACTION} ${confirmId === doc.id ? 'text-[#f87171] border-[#f87171]' : ''}`}>
            <Trash2 size={11} />{confirmId === doc.id ? '?' : ''}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-[#e8eaf0]">{sd.compliance} · {c.pct}%</div>
          <div className="text-[11px] text-[#6b7280] mt-0.5">{sd.summary(c.valid, c.expiring, c.expired, c.missing)}</div>
        </div>
        <button onClick={() => openModal('other')} className="flex items-center gap-2 px-3 py-1.5 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-colors">
          <Plus size={13} />{sd.modal.title}
        </button>
      </div>

      <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2f3d]">
              {[sd.columns.document, sd.columns.status, sd.columns.issued, sd.columns.expires, sd.columns.file, ''].map((h, i) => <th key={i} className={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {c.rows.map(r => (
              <tr key={r.key} className="border-b border-[#1e2330] last:border-0">
                <td className={TD}>
                  <div className="font-semibold">{sd.names[r.key]}</div>
                  <div className="text-[10px] text-[#6b7280]">{r.required ? sd.required : sd.optional}</div>
                </td>
                <td className={TD}>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${DOC_STATUS_COLORS[r.status]}1f`, color: DOC_STATUS_COLORS[r.status] }}>
                    {sd.statuses[r.status]}
                  </span>
                </td>
                <td className={TD}>{fmtDate(r.doc?.issuedAt)}</td>
                <td className={TD}>{r.expires ? fmtDate(r.doc?.expiresAt) : '—'}</td>
                <td className={TD}>{fileCell(r.doc)}</td>
                <td className={TD}>{actions(r.doc, r.key, r.expires)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {others.length > 0 && (
        <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden overflow-x-auto">
          <div className="px-4 py-3 border-b border-[#2a2f3d] text-sm font-bold text-[#e8eaf0]">{sd.others}</div>
          <table className="w-full">
            <tbody>
              {others.map(doc => (
                <tr key={doc.id} className="border-b border-[#1e2330] last:border-0">
                  <td className={`${TD} font-semibold`}>{doc.title}</td>
                  <td className={TD}>{fmtDate(doc.issuedAt)}</td>
                  <td className={TD}>{fmtDate(doc.expiresAt)}</td>
                  <td className={TD}>{fileCell(doc)}</td>
                  <td className={TD}>
                    <div className="flex items-center gap-1.5 justify-end">
                      {doc.storagePath && <button onClick={() => view(doc.id)} className={ACTION}><Eye size={11} />{sd.view}</button>}
                      <button onClick={() => remove(doc.id)} title={sd.deleteConfirm} className={`${ACTION} ${confirmId === doc.id ? 'text-[#f87171] border-[#f87171]' : ''}`}>
                        <Trash2 size={11} />{confirmId === doc.id ? '?' : ''}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-[0_32px_100px_rgba(0,0,0,0.6)] mx-4">
            <div className="sticky top-0 bg-[#161922] border-b border-[#2a2f3d] px-6 py-4 flex items-center justify-between z-10">
              <div className="text-sm font-bold text-[#e8eaf0]">{sd.names[modal.docType]}</div>
              <button onClick={() => setModal(null)} aria-label={t.staffRecords.cancel} className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all"><X size={16} /></button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {error && <div className="col-span-full bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">{error}</div>}
              {modal.docType === 'other' && (
                <div className="col-span-full">
                  <label className={LABEL}>{sd.modal.titleField}</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={INPUT} />
                </div>
              )}
              <div className="col-span-full">
                <label className={LABEL}>{sd.modal.file}</label>
                <input type="file" accept=".pdf,image/*,.doc,.docx" onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-[#6b7280] file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#1e2330] file:text-[#e8eaf0] file:text-xs" />
              </div>
              <div>
                <label className={LABEL}>{sd.modal.issued}</label>
                <input type="date" value={form.issuedAt} onChange={e => setForm(f => ({ ...f, issuedAt: e.target.value }))} className={INPUT} />
              </div>
              {expires && (
                <div>
                  <label className={LABEL}>{sd.modal.expires}</label>
                  <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} className={INPUT} />
                </div>
              )}
              <div className="col-span-full">
                <label className={LABEL}>{sd.modal.note}</label>
                <textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className={`${INPUT} resize-none`} />
              </div>
            </div>
            <div className="sticky bottom-0 bg-[#161922] border-t border-[#2a2f3d] px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-[#2a2f3d] text-xs font-semibold text-[#6b7280] hover:text-[#e8eaf0] transition-all">
                {t.staffRecords.cancel}
              </button>
              <button onClick={save} disabled={saving || (modal.docType === 'other' && !form.title.trim())}
                className="flex items-center gap-2 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50">
                <Save size={13} />{saving ? sd.modal.saving : sd.modal.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
