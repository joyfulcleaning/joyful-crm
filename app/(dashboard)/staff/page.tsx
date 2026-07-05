'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Plus, UserCheck, Mail, Phone, CheckCircle2, DollarSign,
  CalendarDays, Loader2, Search, ChevronDown, ChevronUp,
  Eye, Pencil, Trash2, X, Check,
} from 'lucide-react'
import StaffModal from '@/components/modals/StaffModal'
import StaffDetailModal from '@/components/modals/StaffDetailModal'
import ConfirmModal from '@/components/modals/ConfirmModal'
import { PAY_FREQUENCIES } from '@/components/modals/StaffModal'
import ErrorBanner from '@/components/ErrorBanner'
import { fetchJsonOrThrow } from '@/lib/fetchJson'
import { localDateStr } from '@/lib/local-date'

// ── Constants ──────────────────────────────────────────────────────────────────
const ROLE_COLORS:   Record<string, string> = { admin: '#4f8ef7', user: '#a78bfa' }
const STATUS_COLORS: Record<string, string> = { active: '#38d9a9', invited: '#f59e0b', inactive: '#6b7280' }

const PAY_METHODS = [
  { value: 'check',   label: 'Check'   },
  { value: 'zelle',   label: 'Zelle'   },
  { value: 'cash',    label: 'Cash'    },
  { value: 'venmo',   label: 'Venmo'   },
  { value: 'cashapp', label: 'CashApp' },
]

function fmt(dateStr: string) {
  const [y, m, d] = dateStr.split('T')[0].split('-')
  return `${m}-${d}-${y}`
}
function fmtFull(dateStr: string) {
  const [y, m, d] = dateStr.split('T')[0].split('-')
  return `${m}-${d}-${y}`
}
function fmtDay(dateStr: string) {
  const [y, m, d] = dateStr.split('T')[0].split('-')
  return `${m}-${d}-${y}`
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface CalcRow {
  userId:          string
  name:            string
  scheduleType:    string
  hourlyRate:      number | null
  payRates:        Record<string, number> | null
  workedDays:      string[]
  workedDaysCount: number
  count1BR:        number
  count2BR:        number
  count3BR:        number
  countExtra:      number
  baseAmount:      number
}

interface RowEdits {
  adjustment: string
  adjustType: 'days' | 'money'
  method:     string
  notes:      string
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function StaffPage() {
  const [staff, setStaff]           = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [activeTab, setActiveTab]   = useState('team')
  const [modalOpen, setModalOpen]   = useState(false)
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // ── Payroll tab state ────────────────────────────────────────────────────────
  const [payrollRecords, setPayrollRecords] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyTab, setHistoryTab]         = useState<'batches' | 'employee'>('batches')
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())
  const [expandedEmpRows, setExpandedEmpRows] = useState<Set<string>>(new Set())
  const [reportStaffId, setReportStaffId]   = useState('')
  const [reportFrom, setReportFrom]         = useState('')
  const [reportTo, setReportTo]             = useState('')

  // Date range
  const today = localDateStr()
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); const day = d.getDay()
    const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return localDateStr(mon)
  })
  const [toDate, setToDate] = useState(today)

  // Calculation state
  const [calcRows, setCalcRows]       = useState<CalcRow[]>([])
  const [calcLoading, setCalcLoading] = useState(false)
  const [calculated, setCalculated]   = useState(false)

  // Per-row edits
  const [rowEdits, setRowEdits] = useState<Record<string, RowEdits>>({})

  // Unchecked days per userId (daily employees): days excluded from pay
  const [uncheckedDays, setUncheckedDays] = useState<Record<string, Set<string>>>({})

  // Paying state
  const [payingIds, setPayingIds]         = useState<Set<string>>(new Set())
  const [paidThisBatch, setPaidThisBatch] = useState<Set<string>>(new Set())

  // Payroll record edit / delete
  const [payEditOpen,   setPayEditOpen]   = useState(false)
  const [payEditRecord, setPayEditRecord] = useState<any>(null)
  const [payEditForm,   setPayEditForm]   = useState({ payDate: '', paymentMethod: '', netPay: '', note: '' })
  const [payEditSaving, setPayEditSaving] = useState(false)
  const [payDelTarget,  setPayDelTarget]  = useState<any>(null)
  const [payDelOpen,    setPayDelOpen]    = useState(false)
  const [payDeleting,   setPayDeleting]   = useState(false)

  // Batch delete
  const [batchDelTarget, setBatchDelTarget] = useState<any>(null)
  const [batchDelOpen,   setBatchDelOpen]   = useState(false)
  const [batchDeleting,  setBatchDeleting]  = useState(false)

  // ── Loaders ──────────────────────────────────────────────────────────────────
  function loadStaff() {
    fetchJsonOrThrow('/api/staff')
      .then(d => {
        setStaff(d)
        setLoadError(null)
        setLoading(false)
        setSelectedMember((prev: any) => prev ? (d.find((s: any) => s.id === prev.id) ?? prev) : null)
      })
      .catch((err) => { setLoadError(err.message || 'No se pudo cargar el staff.'); setLoading(false) })
  }

  function loadHistory() {
    setHistoryLoading(true)
    fetchJsonOrThrow('/api/payroll')
      .then(d => { setPayrollRecords(d); setHistoryError(null); setHistoryLoading(false) })
      .catch((err) => { setHistoryError(err.message || 'No se pudo cargar el historial de payroll.'); setHistoryLoading(false) })
  }

  useEffect(() => { loadStaff() }, [])
  useEffect(() => { if (activeTab === 'payroll') loadHistory() }, [activeTab])

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const initials = (name: string) =>
    name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  function setEdit(userId: string, field: keyof RowEdits, value: string) {
    setRowEdits(e => ({ ...e, [userId]: { ...e[userId], [field]: value } }))
  }

  function toggleDay(userId: string, dateStr: string) {
    setUncheckedDays(prev => {
      const next = new Map(Object.entries(prev))
      const cur  = new Set(next.get(userId) || [])
      cur.has(dateStr) ? cur.delete(dateStr) : cur.add(dateStr)
      next.set(userId, cur)
      return Object.fromEntries(next)
    })
  }

  function getActiveDays(row: CalcRow): string[] {
    const unc = uncheckedDays[row.userId] || new Set<string>()
    return row.workedDays.filter(d => !unc.has(d))
  }

  // ── Net amount ───────────────────────────────────────────────────────────────
  function netAmount(row: CalcRow): number {
    const edit    = rowEdits[row.userId]
    const adj     = parseFloat(edit?.adjustment || '0') || 0
    const freq    = row.scheduleType
    const adjType = edit?.adjustType || 'days'

    if (freq === 'daily') {
      const activeDays = getActiveDays(row).length
      const rate       = row.hourlyRate || 0
      if (adjType === 'days') return parseFloat(((activeDays + adj) * rate).toFixed(2))
      return parseFloat((activeDays * rate + adj).toFixed(2))
    }
    return parseFloat((row.baseAmount + adj).toFixed(2))
  }

  const totalPayout = useMemo(
    () => calcRows.filter(r => !paidThisBatch.has(r.userId)).reduce((s, r) => s + netAmount(r), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calcRows, rowEdits, paidThisBatch, uncheckedDays]
  )

  // ── Calculate ────────────────────────────────────────────────────────────────
  async function calculate() {
    setCalcLoading(true)
    setCalculated(false)
    setPaidThisBatch(new Set())
    try {
      const res  = await fetch(`/api/payroll/calculate?from=${fromDate}&to=${toDate}`)
      const rows: CalcRow[] = await res.json()
      setCalcRows(rows)

      const edits: Record<string, RowEdits>     = {}
      const unc:   Record<string, Set<string>>  = {}
      rows.forEach(r => {
        edits[r.userId] = { adjustment: '0', adjustType: 'days', method: 'check', notes: '' }
        unc[r.userId]   = new Set()
      })
      setRowEdits(edits)
      setUncheckedDays(unc)
      setCalculated(true)
    } finally {
      setCalcLoading(false)
    }
  }

  // ── Pay one employee ─────────────────────────────────────────────────────────
  async function payOne(row: CalcRow) {
    const freq   = row.scheduleType
    const edit   = rowEdits[row.userId] || { adjustment: '0', adjustType: 'days', method: 'check', notes: '' }
    const amount = netAmount(row)

    const body: any = {
      userId:        row.userId,
      periodFrom:    fromDate,
      periodTo:      toDate,
      payDate:       toDate,
      paymentMethod: edit.method,
      notes:         edit.notes?.trim() || '',
    }

    if (freq === 'daily') {
      const activeDaysList = getActiveDays(row)
      const adj            = parseFloat(edit.adjustment || '0') || 0
      const adjType        = edit.adjustType || 'days'
      body.daysWorked      = adjType === 'days' ? activeDaysList.length + adj : activeDaysList.length
      body.workedDates     = activeDaysList
    } else if (freq === 'per_service') {
      body.count1BR   = row.count1BR
      body.count2BR   = row.count2BR
      body.count3BR   = row.count3BR
      body.countExtra = row.countExtra
    } else {
      body.daysWorked = null
    }

    if (freq !== 'per_service') body.overrideAmount = amount

    setPayingIds(p => new Set(p).add(row.userId))
    try {
      const res = await fetch('/api/payroll', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (res.ok) { setPaidThisBatch(p => new Set(p).add(row.userId)); loadHistory() }
    } finally {
      setPayingIds(p => { const n = new Set(p); n.delete(row.userId); return n })
    }
  }

  async function payAll() {
    const unpaid = calcRows.filter(r => !paidThisBatch.has(r.userId))
    for (const row of unpaid) await payOne(row)
  }

  // ── History grouped by batch ─────────────────────────────────────────────────
  const historyBatches = useMemo(() => {
    const map = new Map<string, { key: string; payDate: string; periodFrom: string; periodTo: string; records: any[]; total: number }>()
    for (const r of payrollRecords) {
      const pd  = r.payDate?.split('T')[0]    || ''
      const pf  = r.periodFrom?.split('T')[0] || ''
      const pt  = r.periodTo?.split('T')[0]   || ''
      const key = `${pd}|${pf}|${pt}`
      if (!map.has(key)) map.set(key, { key, payDate: pd, periodFrom: pf, periodTo: pt, records: [], total: 0 })
      const batch = map.get(key)!
      batch.records.push(r)
      batch.total += Number(r.netPay) || 0
    }
    return Array.from(map.values()).sort((a, b) => b.payDate.localeCompare(a.payDate))
  }, [payrollRecords])

  // ── Employee report ──────────────────────────────────────────────────────────
  const reportResults = useMemo(() => {
    if (!reportStaffId) return []
    return payrollRecords
      .filter(r => {
        if (r.userId !== reportStaffId) return false
        const pd = r.payDate?.split('T')[0] || ''
        if (reportFrom && pd < reportFrom) return false
        if (reportTo   && pd > reportTo)   return false
        return true
      })
      .sort((a, b) => (b.payDate || '').localeCompare(a.payDate || ''))
  }, [payrollRecords, reportStaffId, reportFrom, reportTo])

  function toggleEmpRow(key: string) {
    setExpandedEmpRows(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function toggleBatch(key: string) {
    setExpandedBatches(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  // ── Payroll record handlers ──────────────────────────────────────────────────
  function openPayEdit(r: any) {
    const notes = r.analysisNotes || ''
    const sep   = notes.indexOf(' · ')
    const note  = sep >= 0 ? notes.slice(sep + 3) : ''
    setPayEditRecord(r)
    setPayEditForm({ payDate: r.payDate?.split('T')[0] || '', paymentMethod: r.paymentMethod || 'check', netPay: String(Number(r.netPay).toFixed(2)), note })
    setPayEditOpen(true)
  }

  async function savePayEdit() {
    if (!payEditRecord) return
    setPayEditSaving(true)
    try {
      const notes     = payEditRecord.analysisNotes || ''
      const sep       = notes.indexOf(' · ')
      const breakdown = sep >= 0 ? notes.slice(0, sep) : notes
      const newNotes  = [breakdown, payEditForm.note.trim()].filter(Boolean).join(' · ')
      const res = await fetch(`/api/payroll/${payEditRecord.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ payDate: payEditForm.payDate, paymentMethod: payEditForm.paymentMethod, netPay: parseFloat(payEditForm.netPay) || 0, analysisNotes: newNotes }),
      })
      if (res.ok) { setPayEditOpen(false); loadHistory() }
    } finally {
      setPayEditSaving(false)
    }
  }

  async function confirmBatchDelete() {
    if (!batchDelTarget) return
    setBatchDeleting(true)
    try {
      await Promise.all(batchDelTarget.records.map((r: any) => fetch(`/api/payroll/${r.id}`, { method: 'DELETE' })))
      const ids = new Set(batchDelTarget.records.map((r: any) => r.id))
      setPayrollRecords(prev => prev.filter((r: any) => !ids.has(r.id)))
      setBatchDelOpen(false); setBatchDelTarget(null)
    } finally { setBatchDeleting(false) }
  }

  async function confirmPayDelete() {
    if (!payDelTarget) return
    setPayDeleting(true)
    try {
      const res = await fetch(`/api/payroll/${payDelTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        setPayrollRecords(prev => prev.filter((r: any) => r.id !== payDelTarget.id))
        setPayDelOpen(false); setPayDelTarget(null)
      }
    } finally { setPayDeleting(false) }
  }

  // ── History detail panel (reusable) ─────────────────────────────────────────
  function PayrollDetail({ r }: { r: any }) {
    const base   = Number(r.basePay) || 0
    const net    = Number(r.netPay)  || 0
    const adj    = parseFloat((net - base).toFixed(2))
    const notes  = r.analysisNotes || ''
    const sep    = notes.indexOf(' · ')
    const bkd    = sep >= 0 ? notes.slice(0, sep) : notes
    const note   = sep >= 0 ? notes.slice(sep + 3) : ''

    // Dates stored as "dates:YYYY-MM-DD,YYYY-MM-DD,..."
    const hasDates  = bkd.startsWith('dates:')
    const datesList = hasDates ? bkd.replace('dates:', '').split(',').filter(Boolean) : []

    // Service breakdown stored as "1BR×N($P) + 2BR×N($P) + 3BR×N($P) + Extra×N($P)"
    const svcChips = (!hasDates && r.paymentType === 'per_job')
      ? bkd.split(' + ').map((p: string) => {
          const m = p.match(/^(\w+)×(\d+)\(\$(\d+(?:\.\d+)?)\)$/)
          return m ? { type: m[1], count: parseInt(m[2]), rate: m[3] } : null
        }).filter((s: any) => s !== null && s.count > 0)
      : []

    const typeLabel =
      r.paymentType === 'per_job'   ? 'Per Service' :
      r.paymentType === 'fixed_day' ? 'Fixed'       : 'Daily'

    const svcColors: Record<string, string> = {
      '1BR': 'bg-[rgba(79,142,247,0.1)] border-[rgba(79,142,247,0.3)] text-[#4f8ef7]',
      '2BR': 'bg-[rgba(167,139,250,0.1)] border-[rgba(167,139,250,0.3)] text-[#a78bfa]',
      '3BR': 'bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.3)] text-[#f59e0b]',
      'Extra': 'bg-[rgba(56,217,169,0.1)] border-[rgba(56,217,169,0.3)] text-[#38d9a9]',
    }

    return (
      <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden text-xs">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-[#2a2f3d] flex items-center justify-between bg-[rgba(56,217,169,0.04)]">
          <span className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider">Payment Detail</span>
          <span className="text-sm font-bold text-[#38d9a9]">${net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>

        <div className="divide-y divide-[#1e2330]">
          {/* Pay type + Method */}
          <div className="px-4 py-2.5 grid grid-cols-2 gap-x-6">
            <div>
              <div className="text-[9px] text-[#6b7280] uppercase font-bold mb-1">Pay Type</div>
              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                r.paymentType === 'per_job'   ? 'bg-[rgba(167,139,250,0.15)] text-[#a78bfa]' :
                r.paymentType === 'fixed_day' ? 'bg-[rgba(79,142,247,0.15)] text-[#4f8ef7]'  :
                                                'bg-[rgba(167,139,250,0.15)] text-[#a78bfa]'
              }`}>{typeLabel}</span>
            </div>
            <div>
              <div className="text-[9px] text-[#6b7280] uppercase font-bold mb-1">Method</div>
              <div className="text-xs font-semibold text-[#e8eaf0] capitalize">{r.paymentMethod}</div>
            </div>
          </div>

          {/* Days worked — count + date chips */}
          {r.daysWorked != null && (
            <div className="px-4 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[#6b7280]">Days worked</span>
                <span className="font-semibold text-[#a78bfa]">{r.daysWorked} {r.daysWorked === 1 ? 'day' : 'days'}</span>
              </div>
              {datesList.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {datesList.map((d: string) => (
                    <span key={d} className="px-2 py-1 rounded-md bg-[rgba(167,139,250,0.08)] border border-[rgba(167,139,250,0.25)] text-[9px] font-medium text-[#a78bfa]">
                      {fmtDay(d)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Services — count + type chips */}
          {r.servicesCount != null && r.paymentType === 'per_job' && (
            <div className="px-4 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[#6b7280]">Services completed</span>
                <span className="font-semibold text-[#a78bfa]">{r.servicesCount} services</span>
              </div>
              {svcChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {svcChips.map((s: any) => (
                    <div key={s.type} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${svcColors[s.type] || svcColors['Extra']}`}>
                      <span className="text-[9px] font-bold uppercase">{s.type}</span>
                      <span className="text-sm font-bold leading-none">{s.count}</span>
                      <span className="text-[9px] opacity-70 border-l border-current pl-2">${s.rate}/ea</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Base pay */}
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] text-[#6b7280]">Base pay</span>
            <span className="font-semibold text-[#e8eaf0]">${base.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          {/* Adjustment */}
          {adj !== 0 && (
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-[10px] text-[#6b7280]">Adjustment</span>
              <span className={`font-semibold ${adj > 0 ? 'text-[#38d9a9]' : 'text-[#f87171]'}`}>
                {adj > 0 ? '+' : ''}${adj.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Net pay */}
          <div className="px-4 py-2.5 flex items-center justify-between bg-[rgba(56,217,169,0.04)]">
            <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Net Pay</span>
            <span className="text-sm font-bold text-[#38d9a9]">${net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          {/* Status */}
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] text-[#6b7280]">Status</span>
            <span className={`font-semibold capitalize ${r.status === 'paid' ? 'text-[#38d9a9]' : 'text-[#f59e0b]'}`}>{r.status}</span>
          </div>

          {/* Raw breakdown fallback for old records */}
          {bkd && !hasDates && svcChips.length === 0 && (
            <div className="px-4 py-2.5">
              <div className="text-[9px] text-[#6b7280] uppercase font-bold mb-1.5">Breakdown</div>
              <div className="text-[10px] text-[#c4c9d8] leading-relaxed">{bkd}</div>
            </div>
          )}

          {/* User note */}
          {note && (
            <div className="px-4 py-2.5">
              <div className="text-[9px] text-[#6b7280] uppercase font-bold mb-1">Note</div>
              <div className="text-[10px] text-[#4f8ef7] leading-relaxed">{note}</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#e8eaf0]">Staff</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">Team & Payroll management</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus size={15} />New Staff Member
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2a2f3d]">
        {[{ key: 'team', label: '👥 Team' }, { key: 'payroll', label: '💰 Payroll' }].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === tab.key ? 'border-[#4f8ef7] text-[#4f8ef7]' : 'border-transparent text-[#6b7280] hover:text-[#e8eaf0]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Team Tab ─────────────────────────────────────────────────────────── */}
      {activeTab === 'team' && (
        <div className="grid grid-cols-4 gap-3">
          {loadError && <div className="col-span-4"><ErrorBanner message={loadError} onRetry={loadStaff} /></div>}
          {loading ? (
            <div className="col-span-4 text-center py-10 text-[#6b7280] text-xs">Loading...</div>
          ) : (
            <>
              {staff.map((member: any) => {
                const roleColor   = ROLE_COLORS[member.role]    || '#6b7280'
                const statusColor = STATUS_COLORS[member.status] || '#6b7280'
                const freqLabel   = PAY_FREQUENCIES.find(f => f.value === member.scheduleType)?.label
                return (
                  <div
                    key={member.id}
                    onClick={() => { setSelectedMember(member); setDetailOpen(true) }}
                    className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4 text-center hover:border-[#4f8ef7] hover:translate-y-[-1px] transition-all cursor-pointer"
                  >
                    <div className="relative inline-block mb-3">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold mx-auto"
                        style={{ background: 'linear-gradient(135deg,rgba(79,142,247,0.3),rgba(79,142,247,0.1))', color: '#4f8ef7' }}
                      >
                        {initials(member.name)}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#161922]" style={{ background: statusColor }} />
                    </div>
                    <div className="text-sm font-semibold text-[#e8eaf0]">{member.name}</div>
                    <div className="text-[10px] font-bold mt-1 capitalize" style={{ color: roleColor }}>● {member.role}</div>
                    <div className="mt-3 pt-3 border-t border-[#2a2f3d] space-y-1">
                      {member.email && (
                        <div className="flex items-center gap-1.5 text-[10px] text-[#6b7280]">
                          <Mail size={9} /><span className="truncate">{member.email}</span>
                        </div>
                      )}
                      {member.phone && (
                        <div className="flex items-center gap-1.5 text-[10px] text-[#6b7280]">
                          <Phone size={9} /><span>{member.phone}</span>
                        </div>
                      )}
                      {member.hourlyRate && (
                        <div className="flex items-center gap-1.5 text-[10px] text-[#38d9a9]">
                          <DollarSign size={9} />
                          <span>${Number(member.hourlyRate).toLocaleString()} / {freqLabel || member.scheduleType}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[10px]" style={{ color: statusColor }}>
                        <UserCheck size={9} /><span className="capitalize">{member.status}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div
                onClick={() => setModalOpen(true)}
                className="bg-[#161922] border border-dashed border-[#2a2f3d] rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-[#4f8ef7] transition-all cursor-pointer min-h-40"
              >
                <div className="w-8 h-8 rounded-full bg-[rgba(79,142,247,0.1)] flex items-center justify-center">
                  <Plus size={16} className="text-[#4f8ef7]" />
                </div>
                <span className="text-xs font-semibold text-[#6b7280]">Add Member</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Payroll Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {historyError && <ErrorBanner message={historyError} onRetry={loadHistory} />}

          {/* ── Date range + Calculate ───────────────────────────────────────── */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-5">
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">
                  <CalendarDays size={9} className="inline mr-1" />From
                </label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">
                  <CalendarDays size={9} className="inline mr-1" />To
                </label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: 'This week', fn: () => {
                    const d = new Date(); const day = d.getDay()
                    const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
                    const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
                    setFromDate(localDateStr(mon)); setToDate(localDateStr(fri))
                  }},
                  { label: 'Last week', fn: () => {
                    const d = new Date(); const day = d.getDay()
                    const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1) - 7)
                    const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
                    setFromDate(localDateStr(mon)); setToDate(localDateStr(fri))
                  }},
                  { label: 'This month', fn: () => {
                    const d = new Date()
                    setFromDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`); setToDate(today)
                  }},
                ].map(p => (
                  <button key={p.label} onClick={p.fn}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0] hover:border-[#4f8ef7] transition-all">
                    {p.label}
                  </button>
                ))}
              </div>

              <button onClick={calculate} disabled={calcLoading || !fromDate || !toDate}
                className="flex items-center gap-2 px-5 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all ml-auto">
                {calcLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                {calcLoading ? 'Calculating…' : 'Calculate Payroll'}
              </button>
            </div>
          </div>

          {/* ── Results ──────────────────────────────────────────────────────── */}
          {calculated && (
            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#2a2f3d] flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-sm font-bold text-[#e8eaf0] flex items-center gap-2">
                    <DollarSign size={14} className="text-[#38d9a9]" />
                    Payroll — {fmt(fromDate)} to {fmt(toDate)}
                  </div>
                  <div className="text-[10px] text-[#6b7280] mt-0.5">{calcRows.length} employees</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs font-bold text-[#38d9a9]">
                    Total: ${totalPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <button onClick={payAll} disabled={payingIds.size > 0 || paidThisBatch.size === calcRows.length}
                    className="flex items-center gap-2 px-4 py-2 bg-[#38d9a9] hover:bg-[#2bc99a] disabled:opacity-40 text-[#0a0d14] text-xs font-bold rounded-lg transition-all">
                    <DollarSign size={12} />Pay All
                  </button>
                </div>
              </div>

              <div className="divide-y divide-[#2a2f3d]">
                {calcRows.map(row => {
                  const isPaid   = paidThisBatch.has(row.userId)
                  const isPaying = payingIds.has(row.userId)
                  const edit     = rowEdits[row.userId] || { adjustment: '0', adjustType: 'days', method: 'check', notes: '' }
                  const freq     = row.scheduleType
                  const isDaily  = freq === 'daily'
                  const isPerSvc = freq === 'per_service'
                  const isFixed  = !isDaily && !isPerSvc
                  const net      = netAmount(row)
                  const rates    = row.payRates || {} as any
                  const activeDays = isDaily ? getActiveDays(row) : []
                  const unc        = uncheckedDays[row.userId] || new Set<string>()

                  return (
                    <div key={row.userId} className={`transition-colors ${isPaid ? 'bg-[rgba(56,217,169,0.03)]' : ''}`}>

                      {/* ── Employee row ── */}
                      <div className="px-5 pt-4 pb-2 grid grid-cols-[200px_1fr_auto] gap-6 items-start">

                        {/* Col 1: Identity */}
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: 'rgba(79,142,247,0.2)', color: '#4f8ef7' }}>
                            {initials(row.name)}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-[#e8eaf0]">{row.name}</div>
                            <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              isPerSvc ? 'bg-[rgba(167,139,250,0.15)] text-[#a78bfa]' :
                              isDaily  ? 'bg-[rgba(167,139,250,0.15)] text-[#a78bfa]'  :
                              'bg-[rgba(79,142,247,0.15)] text-[#4f8ef7]'
                            }`}>
                              {PAY_FREQUENCIES.find(f => f.value === freq)?.label || freq}
                            </span>
                          </div>
                        </div>

                        {/* Col 2: Breakdown */}
                        <div className="space-y-2.5">

                          {/* ── DAILY: interactive day checkboxes ── */}
                          {isDaily && (
                            <>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-[#6b7280]">
                                  {activeDays.length} of {row.workedDays.length} days · ${row.hourlyRate?.toLocaleString()}/day
                                </span>
                                {activeDays.length !== row.workedDays.length && (
                                  <span className="text-[9px] text-[#a78bfa] font-medium">
                                    ({row.workedDays.length - activeDays.length} excluded)
                                  </span>
                                )}
                              </div>

                              {row.workedDays.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {row.workedDays.map(d => {
                                    const checked = !unc.has(d)
                                    return (
                                      <button
                                        key={d}
                                        disabled={isPaid}
                                        onClick={() => toggleDay(row.userId, d)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-medium transition-all disabled:cursor-not-allowed ${
                                          checked
                                            ? 'bg-[rgba(167,139,250,0.08)] border-[rgba(167,139,250,0.3)] text-[#a78bfa] hover:bg-[rgba(167,139,250,0.15)]'
                                            : 'bg-[rgba(248,113,113,0.06)] border-[rgba(248,113,113,0.2)] text-[#f87171] opacity-60 line-through hover:opacity-80'
                                        }`}
                                      >
                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                                          checked ? 'bg-[#a78bfa] border-[#a78bfa]' : 'border-[#3a4155] bg-transparent'
                                        }`}>
                                          {checked && <Check size={9} className="text-white" strokeWidth={3} />}
                                        </div>
                                        {fmtDay(d)}
                                      </button>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div className="text-[10px] text-[#4b5568] italic">No service days found in this period</div>
                              )}

                              {/* Adjustment for daily */}
                              <div className="flex items-center gap-2 pt-0.5">
                                <span className="text-[10px] text-[#6b7280]">Adjustment:</span>
                                <div className="flex rounded-lg overflow-hidden border border-[#2a2f3d]">
                                  {(['days', 'money'] as const).map(t => (
                                    <button key={t} disabled={isPaid}
                                      onClick={() => setEdit(row.userId, 'adjustType', t)}
                                      className={`px-2 py-1 text-[10px] font-bold transition-colors disabled:opacity-40 ${
                                        edit.adjustType === t ? 'bg-[#4f8ef7] text-white' : 'bg-[#1e2330] text-[#6b7280] hover:text-[#e8eaf0]'
                                      }`}>
                                      {t === 'days' ? 'Days' : '$'}
                                    </button>
                                  ))}
                                </div>
                                <input type="number" step={edit.adjustType === 'money' ? '1' : '0.5'} min="-9999" max="9999"
                                  value={edit.adjustment} disabled={isPaid}
                                  onChange={e => setEdit(row.userId, 'adjustment', e.target.value)}
                                  className="w-20 px-2 py-1 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] text-center focus:outline-none focus:border-[#4f8ef7] disabled:opacity-40 transition-colors"
                                />
                                <span className="text-[10px] text-[#6b7280]">
                                  {edit.adjustType === 'days' ? 'extra days' : 'dollars'}
                                </span>
                              </div>
                            </>
                          )}

                          {/* ── PER SERVICE: room counts ── */}
                          {isPerSvc && (
                            <>
                              <div className="text-[10px] text-[#6b7280]">Services in period</div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {[
                                  { key: 'count1BR',   label: '1BR',  rate: rates.per1BR,   color: '#4f8ef7' },
                                  { key: 'count2BR',   label: '2BR',  rate: rates.per2BR,   color: '#a78bfa' },
                                  { key: 'count3BR',   label: '3BR',  rate: rates.per3BR,   color: '#f59e0b' },
                                  { key: 'countExtra', label: '+Fee', rate: rates.extraFee, color: '#38d9a9' },
                                ].map(({ key, label, rate, color }) => (
                                  <div key={key} className="flex items-center gap-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg px-3 py-2">
                                    <div>
                                      <div className="text-[9px] font-bold uppercase" style={{ color }}>{label}</div>
                                      <div className="text-sm font-bold text-[#e8eaf0]">{(row as any)[key]}</div>
                                    </div>
                                    {rate ? <div className="text-[9px] text-[#6b7280] border-l border-[#2a2f3d] pl-2">${Number(rate).toLocaleString()}/ea</div> : null}
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 pt-0.5">
                                <span className="text-[10px] text-[#6b7280]">Adjustment ($):</span>
                                <input type="number" step="1" min="-9999" value={edit.adjustment} disabled={isPaid}
                                  onChange={e => setEdit(row.userId, 'adjustment', e.target.value)}
                                  className="w-20 px-2 py-1 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] text-center focus:outline-none focus:border-[#4f8ef7] disabled:opacity-40 transition-colors"
                                  placeholder="0" />
                              </div>
                            </>
                          )}

                          {/* ── FIXED ── */}
                          {isFixed && (
                            <>
                              <div className="text-[10px] text-[#6b7280]">
                                Fixed pay · {PAY_FREQUENCIES.find(f => f.value === freq)?.label}
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-sm font-bold text-[#e8eaf0]">
                                  ${row.hourlyRate?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-[#6b7280]">Adjustment ($):</span>
                                  <input type="number" step="1" min="-9999" value={edit.adjustment} disabled={isPaid}
                                    onChange={e => setEdit(row.userId, 'adjustment', e.target.value)}
                                    className="w-20 px-2 py-1 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] text-center focus:outline-none focus:border-[#4f8ef7] disabled:opacity-40 transition-colors"
                                    placeholder="0" />
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Col 3: Amount + Method + Pay */}
                        <div className="flex flex-col items-end gap-2 pt-0.5">
                          {/* Amount */}
                          <div className="text-right">
                            <div className={`text-lg font-bold ${isPaid ? 'text-[#38d9a9]' : 'text-[#e8eaf0]'}`}>
                              ${net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {isDaily && activeDays.length > 0 && (
                              <div className="text-[9px] text-[#6b7280]">
                                {activeDays.length} days × ${row.hourlyRate}
                                {parseFloat(edit.adjustment || '0') !== 0 && (
                                  <span className="text-[#a78bfa] ml-1">
                                    {parseFloat(edit.adjustment) > 0 ? '+' : ''}{edit.adjustment}
                                    {edit.adjustType === 'days' ? ' day' : '$'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Method */}
                          <select value={edit.method} disabled={isPaid}
                            onChange={e => setEdit(row.userId, 'method', e.target.value)}
                            className="px-2 py-1.5 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] disabled:opacity-40 transition-colors">
                            {PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>

                          {/* Pay button */}
                          {isPaid ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(56,217,169,0.1)] text-[#38d9a9] text-xs font-semibold whitespace-nowrap">
                              <CheckCircle2 size={12} />Paid
                            </div>
                          ) : (
                            <button onClick={() => payOne(row)} disabled={isPaying}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4f8ef7] hover:bg-[#3a7ee0] disabled:opacity-50 text-white text-xs font-semibold transition-all whitespace-nowrap">
                              {isPaying ? <Loader2 size={12} className="animate-spin" /> : <DollarSign size={12} />}
                              {isPaying ? 'Paying…' : 'Pay'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="px-5 pb-3.5">
                        <input type="text" value={edit.notes} disabled={isPaid}
                          onChange={e => setEdit(row.userId, 'notes', e.target.value)}
                          placeholder="Notes (optional)…"
                          className="w-full px-3 py-1.5 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#4b5568] focus:outline-none focus:border-[#4f8ef7] disabled:opacity-40 transition-colors" />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-[#2a2f3d] flex justify-between items-center">
                <div className="text-[10px] text-[#6b7280]">{fmt(fromDate)} – {fmt(toDate)}</div>
                <div className="text-sm font-bold text-[#38d9a9]">
                  Total: ${totalPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}

          {/* ── History Panel ─────────────────────────────────────────────────── */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
            {/* Sub-tabs */}
            <div className="flex items-end border-b border-[#2a2f3d] px-5 pt-3.5">
              {([
                { key: 'batches',  label: 'Payroll History' },
                { key: 'employee', label: 'Employee Report'  },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setHistoryTab(t.key)}
                  className={`pb-3 mr-6 text-xs font-semibold border-b-2 transition-all ${
                    historyTab === t.key ? 'border-[#4f8ef7] text-[#4f8ef7]' : 'border-transparent text-[#6b7280] hover:text-[#e8eaf0]'
                  }`}>
                  {t.label}
                </button>
              ))}
              <div className="ml-auto pb-3 text-[10px] text-[#6b7280]">
                {historyTab === 'batches'
                  ? `${historyBatches.length} batches · ${payrollRecords.length} records`
                  : reportResults.length > 0 ? `${reportResults.length} payments` : ''}
              </div>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-[#6b7280] text-xs">
                <Loader2 size={14} className="animate-spin" />Loading…
              </div>

            ) : historyTab === 'batches' ? (
              /* ════════ Batch History ════════ */
              payrollRecords.length === 0 ? (
                <div className="text-center py-10 text-[#6b7280] text-xs">No payroll records yet.</div>
              ) : (
                <div className="divide-y divide-[#2a2f3d]">
                  {historyBatches.map(batch => {
                    const batchOpen = expandedBatches.has(batch.key)
                    return (
                      <div key={batch.key}>
                        {/* Batch header */}
                        <div className="flex items-center hover:bg-[#1a1f2e] transition-colors group">
                          <button onClick={() => toggleBatch(batch.key)}
                            className="flex-1 px-5 py-3.5 flex items-center gap-4 text-left">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: 'rgba(56,217,169,0.12)' }}>
                              <DollarSign size={14} className="text-[#38d9a9]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[#e8eaf0]">
                                  {batch.payDate ? fmtFull(batch.payDate) : '—'}
                                </span>
                                <span className="text-[10px] text-[#6b7280]">
                                  Period: {batch.periodFrom ? fmt(batch.periodFrom) : '—'} – {batch.periodTo ? fmt(batch.periodTo) : '—'}
                                </span>
                              </div>
                              <div className="text-[10px] text-[#6b7280] mt-0.5">
                                {batch.records.length} {batch.records.length === 1 ? 'employee' : 'employees'}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-sm font-bold text-[#38d9a9]">
                                ${batch.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                              {batchOpen ? <ChevronUp size={14} className="text-[#6b7280]" /> : <ChevronDown size={14} className="text-[#6b7280]" />}
                            </div>
                          </button>
                          <button onClick={() => { setBatchDelTarget(batch); setBatchDelOpen(true) }} title="Delete entire batch"
                            className="mr-3 p-1.5 rounded text-[#6b7280] hover:text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Expanded employees */}
                        {batchOpen && (
                          <div className="bg-[#0d0f14] border-t border-[#2a2f3d] divide-y divide-[#1e2330]">
                            {batch.records.map((r: any) => {
                              const rowKey = `${batch.key}::${r.id}`
                              const rowOpen = expandedEmpRows.has(rowKey)
                              return (
                                <div key={r.id}>
                                  <div className="pl-14 pr-5 py-3 flex items-center gap-3 hover:bg-[#161922] transition-colors">
                                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                      style={{ background: 'rgba(79,142,247,0.2)', color: '#4f8ef7' }}>
                                      {initials(r.staff?.name || '')}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-semibold text-[#e8eaf0]">{r.staff?.name}</div>
                                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                          r.paymentType === 'per_job'   ? 'bg-[rgba(167,139,250,0.15)] text-[#a78bfa]' :
                                          r.paymentType === 'fixed_day' ? 'bg-[rgba(79,142,247,0.15)] text-[#4f8ef7]'  :
                                          'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]'
                                        }`}>
                                          {r.paymentType === 'per_job' ? 'Per Svc' : r.paymentType === 'fixed_day' ? 'Fixed' : 'Daily'}
                                        </span>
                                        <span className="text-[10px] text-[#6b7280] capitalize">{r.paymentMethod}</span>
                                        {r.daysWorked    != null && <span className="text-[10px] text-[#a78bfa]">{r.daysWorked} days</span>}
                                        {r.servicesCount != null && r.paymentType === 'per_job' && <span className="text-[10px] text-[#a78bfa]">{r.servicesCount} services</span>}
                                      </div>
                                    </div>
                                    <span className="text-sm font-bold text-[#38d9a9] flex-shrink-0">
                                      ${Number(r.netPay).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                      <button onClick={() => toggleEmpRow(rowKey)} title="View detail"
                                        className="p-1 rounded text-[#6b7280] hover:text-[#4f8ef7] hover:bg-[rgba(79,142,247,0.1)] transition-all">
                                        <Eye size={13} />
                                      </button>
                                      <button onClick={() => openPayEdit(r)} title="Edit"
                                        className="p-1 rounded text-[#6b7280] hover:text-[#f59e0b] hover:bg-[rgba(245,158,11,0.1)] transition-all">
                                        <Pencil size={13} />
                                      </button>
                                      <button onClick={() => { setPayDelTarget(r); setPayDelOpen(true) }} title="Delete"
                                        className="p-1 rounded text-[#6b7280] hover:text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-all">
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Detail panel */}
                                  {rowOpen && (
                                    <div className="pl-14 pr-5 pb-3">
                                      <div className="ml-10">
                                        <PayrollDetail r={r} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                            {/* Batch footer */}
                            <div className="pl-14 pr-5 py-2.5 flex justify-between items-center">
                              <span className="text-[10px] text-[#6b7280]">
                                Batch total · {batch.records.length} {batch.records.length === 1 ? 'employee' : 'employees'}
                              </span>
                              <span className="text-sm font-bold text-[#38d9a9]">
                                ${batch.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )

            ) : (
              /* ════════ Employee Report ════════ */
              <div className="p-5 space-y-4">
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex-1 min-w-52">
                    <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">Employee</label>
                    <select value={reportStaffId} onChange={e => setReportStaffId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors">
                      <option value="">— Select employee —</option>
                      {staff.filter((s: any) => s.role === 'user').map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">From</label>
                    <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)}
                      className="px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">To</label>
                    <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)}
                      className="px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
                  </div>
                  {(reportFrom || reportTo) && (
                    <button onClick={() => { setReportFrom(''); setReportTo('') }}
                      className="px-3 py-2 text-[10px] text-[#6b7280] hover:text-[#e8eaf0] transition-colors">
                      Clear dates
                    </button>
                  )}
                </div>

                {!reportStaffId ? (
                  <div className="text-center py-10 text-[#6b7280] text-xs">Select an employee to view their payment history.</div>
                ) : reportResults.length === 0 ? (
                  <div className="text-center py-10 text-[#6b7280] text-xs">
                    No payments found{reportFrom || reportTo ? ' in the selected date range' : ''}.
                  </div>
                ) : (() => {
                  const totalPaid     = reportResults.reduce((s: number, r: any) => s + (Number(r.netPay) || 0), 0)
                  const totalDays     = reportResults.reduce((s: number, r: any) => s + (r.daysWorked  || 0), 0)
                  const totalServices = reportResults.reduce((s: number, r: any) => s + (r.servicesCount || 0), 0)
                  const selectedStaff = staff.find((s: any) => s.id === reportStaffId)
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
                          style={{ background: 'rgba(79,142,247,0.2)', color: '#4f8ef7' }}>
                          {initials(selectedStaff?.name || '')}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[#e8eaf0]">{selectedStaff?.name}</div>
                          <div className="text-[10px] text-[#6b7280]">
                            {reportResults.length} payments · {reportFrom || reportTo ? `${reportFrom || '…'} to ${reportTo || '…'}` : 'all time'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: 'Total Paid',  value: `$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: '#38d9a9' },
                          { label: 'Payments',    value: reportResults.length,  color: '#4f8ef7' },
                          { label: 'Days Worked', value: totalDays     || '—',  color: '#f59e0b' },
                          { label: 'Services',    value: totalServices || '—',  color: '#a78bfa' },
                        ].map(card => (
                          <div key={card.label} className="bg-[#1e2330] border border-[#2a2f3d] rounded-xl p-3 text-center">
                            <div className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-1.5">{card.label}</div>
                            <div className="text-lg font-bold" style={{ color: card.color }}>{card.value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-[#0d0f14] border border-[#2a2f3d] rounded-xl overflow-hidden divide-y divide-[#1e2330]">
                        {reportResults.map((r: any) => {
                          const rowOpen = expandedEmpRows.has(r.id)
                          return (
                            <div key={r.id}>
                              <div className="px-4 py-3 flex items-center gap-3 hover:bg-[#161922] transition-colors">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-[#e8eaf0]">
                                      {r.payDate ? fmtFull(r.payDate.split('T')[0]) : '—'}
                                    </span>
                                    <span className="text-[10px] text-[#6b7280]">
                                      {r.periodFrom ? fmt(r.periodFrom.split('T')[0]) : '—'} – {r.periodTo ? fmt(r.periodTo.split('T')[0]) : '—'}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-[#6b7280] mt-0.5 flex items-center gap-2">
                                    <span className="capitalize">{r.paymentMethod}</span>
                                    {r.daysWorked    != null && <span>· {r.daysWorked} days</span>}
                                    {r.servicesCount != null && r.paymentType === 'per_job' && <span>· {r.servicesCount} services</span>}
                                  </div>
                                </div>
                                <span className="text-sm font-bold text-[#38d9a9] flex-shrink-0">
                                  ${Number(r.netPay).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  <button onClick={() => toggleEmpRow(r.id)} title="View detail"
                                    className="p-1 rounded text-[#6b7280] hover:text-[#4f8ef7] hover:bg-[rgba(79,142,247,0.1)] transition-all">
                                    <Eye size={13} />
                                  </button>
                                  <button onClick={() => openPayEdit(r)} title="Edit"
                                    className="p-1 rounded text-[#6b7280] hover:text-[#f59e0b] hover:bg-[rgba(245,158,11,0.1)] transition-all">
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => { setPayDelTarget(r); setPayDelOpen(true) }} title="Delete"
                                    className="p-1 rounded text-[#6b7280] hover:text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-all">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                              {rowOpen && (
                                <div className="px-4 pb-3">
                                  <PayrollDetail r={r} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                        <div className="px-4 py-2.5 flex justify-between items-center border-t border-[#2a2f3d]">
                          <span className="text-[10px] text-[#6b7280]">{reportResults.length} payments total</span>
                          <span className="text-sm font-bold text-[#38d9a9]">
                            ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <StaffModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={loadStaff} />
      <StaffDetailModal
        member={selectedMember} open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedMember(null) }}
        onSuccess={loadStaff}
      />

      {/* Payroll Edit Modal */}
      {payEditOpen && payEditRecord && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/75" onClick={() => setPayEditOpen(false)} />
          <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-sm p-6 shadow-[0_32px_100px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between mb-5">
              <div className="text-sm font-bold text-[#e8eaf0]">Edit Payroll Record</div>
              <button onClick={() => setPayEditOpen(false)}
                className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all">
                <X size={14} />
              </button>
            </div>
            <div className="text-[10px] text-[#6b7280] mb-4">{payEditRecord.staff?.name}</div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">Pay Date</label>
                <input type="date" value={payEditForm.payDate}
                  onChange={e => setPayEditForm(f => ({ ...f, payDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">Payment Method</label>
                <select value={payEditForm.paymentMethod}
                  onChange={e => setPayEditForm(f => ({ ...f, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors">
                  {PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">Amount ($)</label>
                <input type="number" step="0.01" min="0" value={payEditForm.netPay}
                  onChange={e => setPayEditForm(f => ({ ...f, netPay: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5">Note</label>
                <input type="text" value={payEditForm.note} placeholder="Optional note…"
                  onChange={e => setPayEditForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#1e2330] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setPayEditOpen(false)}
                className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#2a2f3d] text-[#9ca3af] hover:text-[#e8eaf0] hover:border-[#4f8ef7] transition-all">
                Cancel
              </button>
              <button onClick={savePayEdit} disabled={payEditSaving}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-[#4f8ef7] hover:bg-[#3a7ee0] disabled:opacity-50 transition-all">
                {payEditSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={payDelOpen}
        title="Delete Payroll Record"
        message={`Delete payment of $${Number(payDelTarget?.netPay || 0).toFixed(2)} for ${payDelTarget?.staff?.name}?\n\nThis will also remove the linked expense. This cannot be undone.`}
        confirmLabel={payDeleting ? 'Deleting…' : 'Delete'}
        onConfirm={confirmPayDelete}
        onCancel={() => { setPayDelOpen(false); setPayDelTarget(null) }}
      />
      <ConfirmModal
        open={batchDelOpen}
        title="Delete Entire Payroll Batch"
        message={`Delete all ${batchDelTarget?.records?.length || 0} records in this batch?\n\nPay date: ${batchDelTarget?.payDate ? fmtFull(batchDelTarget.payDate) : '—'}\nTotal: $${(batchDelTarget?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\nThis will also remove linked expenses. This cannot be undone.`}
        confirmLabel={batchDeleting ? 'Deleting…' : 'Delete Batch'}
        onConfirm={confirmBatchDelete}
        onCancel={() => { setBatchDelOpen(false); setBatchDelTarget(null) }}
      />
    </div>
  )
}
