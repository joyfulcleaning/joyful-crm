'use client'

import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
  Download, FileSpreadsheet, FileText, Briefcase,
  Users, DollarSign, Package, Building2, RotateCcw,
  CheckCircle, Layers, ClipboardList, UserCheck,
} from 'lucide-react'

// ─── Date helpers ────────────────────────────────────────────────
const TODAY = new Date()

function startOf(d: Date, unit: 'week' | 'month' | 'year'): Date {
  const r = new Date(d)
  if (unit === 'week')  { r.setDate(d.getDate() - d.getDay()); r.setHours(0,0,0,0) }
  if (unit === 'month') { r.setDate(1); r.setHours(0,0,0,0) }
  if (unit === 'year')  { r.setMonth(0,1); r.setHours(0,0,0,0) }
  return r
}
function subDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() - n); r.setHours(0,0,0,0); return r
}
function prevMonth(d: Date): { from: Date; to: Date } {
  const from = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  const to   = new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59)
  return { from, to }
}

const PRESETS: { key: string; label: string; getRange: () => { from: Date; to: Date } }[] = [
  { key: 'this_week',  label: 'This Week',    getRange: () => ({ from: startOf(TODAY, 'week'),  to: TODAY }) },
  { key: 'this_month', label: 'This Month',   getRange: () => ({ from: startOf(TODAY, 'month'), to: TODAY }) },
  { key: 'last_month', label: 'Last Month',   getRange: () => prevMonth(TODAY) },
  { key: 'last_30',    label: 'Last 30 Days', getRange: () => ({ from: subDays(TODAY, 30), to: TODAY }) },
  { key: 'last_90',    label: 'Last 90 Days', getRange: () => ({ from: subDays(TODAY, 90), to: TODAY }) },
  { key: 'this_year',  label: 'This Year',    getRange: () => ({ from: startOf(TODAY, 'year'),  to: TODAY }) },
  { key: 'all_time',   label: 'All Time',     getRange: () => ({ from: new Date('2020-01-01'), to: TODAY }) },
  { key: 'custom',     label: 'Custom',       getRange: () => ({ from: subDays(TODAY, 30), to: TODAY }) },
]

// ─── Export utilities ─────────────────────────────────────────────
function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const body = rows.map(r =>
    headers.map(h => {
      const v = r[h] ?? ''
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : v
    }).join(',')
  )
  const csv = [headers.join(','), ...body].join('\n')
  trigger(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), filename)
}

function downloadExcel(sheets: { name: string; rows: Record<string, unknown>[] }[], filename: string) {
  const wb = XLSX.utils.book_new()
  for (const { name, rows } of sheets) {
    if (!rows.length) continue
    const ws = XLSX.utils.json_to_sheet(rows)
    const cols = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 14) }))
    ws['!cols'] = cols
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
  }
  XLSX.writeFile(wb, filename)
}

function downloadPDF(title: string, headers: string[], rows: (string | number)[][], subtitle = '') {
  const trs = rows.map(r =>
    `<tr>${r.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`
  ).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #4f8ef7; padding-bottom: 12px; }
  .logo { font-size: 18px; font-weight: 700; color: #4f8ef7; }
  .logo span { color: #38d9a9; }
  .meta { text-align: right; color: #555; font-size: 10px; }
  h2 { font-size: 14px; color: #333; margin-bottom: 4px; }
  .sub { font-size: 10px; color: #777; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead tr { background: #4f8ef7; color: white; }
  thead th { padding: 6px 8px; text-align: left; font-weight: 600; }
  tbody tr:nth-child(even) { background: #f5f8ff; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #e8eaf0; }
  .footer { margin-top: 16px; text-align: center; font-size: 9px; color: #aaa; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo">Joyful <span>Cleaning</span> Services</div>
  <div class="meta">
    <div>Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    <div>${title}</div>
  </div>
</div>
<h2>${title}</h2>
${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
<table>
  <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${trs}</tbody>
</table>
<div class="footer">Joyful Cleaning Services Corp. — Confidential — ${new Date().getFullYear()}</div>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank', 'width=900,height=700')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function trigger(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function fmtDate(v: unknown) {
  if (!v) return ''
  try { return new Date(v as string).toLocaleDateString('en-US') } catch { return String(v) }
}
function fmtAmt(v: unknown) {
  if (v === null || v === undefined) return '$0.00'
  return '$' + Number(v).toFixed(2)
}

// ─── Data shapers ─────────────────────────────────────────────────
function shapeServices(rows: any[]) {
  return rows.map(s => ({
    'Service #':      s.serviceNumber ?? '',
    'Date':           fmtDate(s.serviceDate),
    'Client':         s.client?.name ?? '',
    'Address':        s.address ?? '',
    'Type':           s.type,
    'Status':         s.status,
    'Staff':          (s.staff ?? []).map((x: any) => x.user?.name ?? x.name).join(', '),
    'Base Price':     fmtAmt(s.basePrice),
    'Additional Fee': fmtAmt(s.additionalFee),
    'Total':          fmtAmt(s.total),
    'Payment Method': s.paymentMethod ?? '',
  }))
}

// Clients — enriched with management company name
function shapeClients(rows: any[], managements: any[]) {
  const mgmtMap = Object.fromEntries(managements.map(m => [m.id, m.name]))
  return rows.map(c => ({
    'Name':           c.name,
    'Type':           c.type,
    'Management Co':  c.managementId ? (mgmtMap[c.managementId] ?? '') : '',
    'City':           c.city ?? '',
    'State':          c.state ?? '',
    'Frequency':      c.frequency ?? '',
    'Status':         c.status,
    'Phone':          c.phone ?? '',
    'Email':          c.email ?? '',
    'Notes':          c.notes ?? '',
  }))
}

// Billing: primary = invoices
function shapeInvoices(rows: any[]) {
  return rows.map(i => ({
    'Invoice #':      i.invoiceNumber,
    'Client':         i.client?.name ?? '',
    'Period From':    fmtDate(i.periodFrom),
    'Period To':      fmtDate(i.periodTo),
    'Subtotal':       fmtAmt(i.subtotal),
    'Total':          fmtAmt(i.total),
    'Amount Paid':    fmtAmt(i.amountPaid),
    'Balance Due':    fmtAmt(i.balanceDue),
    'Status':         i.status,
    'Payment Method': i.paymentMethod ?? '',
    'Issued':         fmtDate(i.issuedAt),
    'Paid':           fmtDate(i.paidAt),
  }))
}

// Billing: secondary = invoice payments
function shapeInvoicePayments(rows: any[]) {
  return rows.map(p => ({
    'Invoice #':   p.invoice?.invoiceNumber ?? '',
    'Client':      p.invoice?.client?.name ?? '',
    'Amount':      fmtAmt(p.amount),
    'Method':      p.method,
    'Platform':    p.platform,
    'Reference':   p.reference ?? '',
    'Paid At':     fmtDate(p.paidAt),
    'Recorded By': p.createdBy?.name ?? '',
    'Notes':       p.notes ?? '',
  }))
}

// Expenses: primary = actual expenses (with recurring flag)
function shapeExpenses(rows: any[]) {
  return rows.map(e => ({
    'Expense #':      e.expenseNumber ?? '',
    'Date':           fmtDate(e.expenseDate),
    'Description':    e.description,
    'Category':       e.category,
    'Amount':         fmtAmt(e.amount),
    'Payment Method': e.paymentMethod ?? '',
    'Supplier':       e.supplier ?? '',
    'Recurring':      e.recurringId ? 'Yes' : 'No',
    'Notes':          e.notes ?? '',
  }))
}

// Expenses: secondary = recurring schedules
function shapeRecurring(rows: any[]) {
  return rows.map(r => ({
    'Name':            r.name,
    'Category':        r.category,
    'Amount':          fmtAmt(r.amount),
    'Frequency':       r.frequency,
    'Day of Month':    r.dayOfMonth ?? '',
    'Payment Method':  r.paymentMethod ?? '',
    'Auto Register':   r.autoRegister ? 'Yes' : 'No',
    'Active':          r.isActive ? 'Yes' : 'No',
    'Start Date':      fmtDate(r.startDate),
    'Next Due':        fmtDate(r.nextDueAt),
    'Last Registered': fmtDate(r.lastRegisteredAt),
    'Notes':           r.notes ?? '',
  }))
}

function shapeInventory(rows: any[]) {
  return rows.map(p => ({
    'SKU':           p.sku,
    'Name':          p.name,
    'Category':      p.category,
    'Unit':          p.unitOfMeasure,
    'Unit Cost':     fmtAmt(p.unitCost),
    'Current Stock': p.currentStock,
    'Min Stock':     p.minimumStock,
    'Total Value':   fmtAmt(Number(p.unitCost) * p.currentStock),
    'Status':        p.currentStock < p.minimumStock ? 'Low Stock' : 'OK',
    'Supplier':      p.supplier ?? '',
  }))
}

function shapeAssets(rows: any[]) {
  return rows.map(a => ({
    'Name':                a.name,
    'Type':                a.type,
    'Purchase Date':       fmtDate(a.purchaseDate),
    'Purchase Value':      fmtAmt(a.purchaseValue),
    'Current Value':       fmtAmt(a.currentValue),
    'Annual Depreciation': `${a.annualDepreciation}%`,
    'Serial #':            a.serialNumber ?? '',
    'Status':              a.status,
    'Notes':               a.notes ?? '',
  }))
}

function shapeEstimates(rows: any[]) {
  return rows.map(e => ({
    'Estimate #':  e.estimateNumber,
    'Issue Date':  fmtDate(e.issueDate),
    'Valid Until': fmtDate(e.validUntil),
    'Client':      e.clientName ?? e.client?.name ?? '',
    'Email':       e.clientEmail ?? '',
    'Phone':       e.clientPhone ?? '',
    'Address':     e.clientAddress ?? '',
    'Subtotal':    fmtAmt(e.subtotal),
    'Tax':         fmtAmt(e.tax),
    'Total':       fmtAmt(e.total),
    'Status':      e.status,
    'Invoice #':   e.invoice?.invoiceNumber ?? '',
    'Email Sent':  fmtDate(e.emailSentAt),
    'Notes':       e.notes ?? '',
  }))
}

// HR: primary = staff profiles
function shapeStaff(rows: any[]) {
  return rows.map(u => ({
    'Name':               u.name,
    'Email':              u.email,
    'Role':               u.role,
    'Status':             u.status,
    'Phone':              u.phone ?? '',
    'Hire Date':          fmtDate(u.hireDate),
    'Schedule Type':      u.scheduleType ?? '',
    'Hourly Rate':        u.hourlyRate ? fmtAmt(u.hourlyRate) : '',
    'Tax ID Type':        u.taxIdType ?? '',
    'Immigration Status': u.immigrationStatus ?? '',
    'Work Permit':        u.workPermit === true ? 'Yes' : u.workPermit === false ? 'No' : '',
    'Permit Expiry':      fmtDate(u.workPermitExpiry),
    'Emergency Contact':  u.emergencyContactName ?? '',
    'Emergency Phone':    u.emergencyContactPhone ?? '',
  }))
}

// HR: secondary = payroll records
function shapePayroll(rows: any[]) {
  return rows.map(p => ({
    'Payroll #':      p.payrollNumber ?? '',
    'Staff':          p.staff?.name ?? '',
    'Period From':    fmtDate(p.periodFrom),
    'Period To':      fmtDate(p.periodTo),
    'Payment Type':   p.paymentType,
    'Days Worked':    p.daysWorked ?? '',
    'Services Count': p.servicesCount ?? '',
    'Rate':           fmtAmt(p.rate),
    'Base Pay':       fmtAmt(p.basePay),
    'Bonus':          fmtAmt(p.bonus),
    'Deductions':     fmtAmt(p.deductions),
    'Net Pay':        fmtAmt(p.netPay),
    'Payment Method': p.paymentMethod ?? '',
    'Status':         p.status,
    'Pay Date':       fmtDate(p.payDate),
    'Notes':          p.analysisNotes ?? '',
  }))
}

// ─── Data keys (all fetched endpoints) ───────────────────────────
type DataKey =
  | 'services' | 'clients' | 'invoices' | 'expenses' | 'inventory' | 'assets'
  | 'estimates' | 'staff' | 'payroll' | 'invoice_payments' | 'recurring_expenses' | 'management'

// ─── Report definitions (8 unified cards) ────────────────────────
type ReportId = 'services' | 'clients' | 'billing' | 'expenses' | 'inventory' | 'assets' | 'estimates' | 'hr'

type ReportDef = {
  id: ReportId
  icon: any
  color: string
  label: string
  desc: string
  primary: { key: DataKey; dateField: string | null }
  secondary?: { key: DataKey; dateField: string | null; label: string }
}

const REPORTS: ReportDef[] = [
  {
    id: 'services', icon: Briefcase, color: '#4f8ef7',
    label: 'Services', desc: 'Services with client, staff, type and amounts',
    primary: { key: 'services', dateField: 'serviceDate' },
  },
  {
    id: 'clients', icon: Users, color: '#38d9a9',
    label: 'Clients', desc: 'Full directory including management companies',
    primary: { key: 'clients', dateField: null },
  },
  {
    id: 'billing', icon: FileText, color: '#a78bfa',
    label: 'Billing', desc: 'Invoices + payment transactions · Excel exports 2 sheets',
    primary:   { key: 'invoices',          dateField: 'issuedAt' },
    secondary: { key: 'invoice_payments',  dateField: 'paidAt',  label: 'Payments' },
  },
  {
    id: 'expenses', icon: DollarSign, color: '#f87171',
    label: 'Expenses', desc: 'One-time and recurring expenses · Excel exports 2 sheets',
    primary:   { key: 'expenses',           dateField: 'expenseDate' },
    secondary: { key: 'recurring_expenses', dateField: null,         label: 'Recurring' },
  },
  {
    id: 'inventory', icon: Package, color: '#f59e0b',
    label: 'Inventory', desc: 'Current stock, costs and reorder alerts',
    primary: { key: 'inventory', dateField: null },
  },
  {
    id: 'assets', icon: Building2, color: '#fb923c',
    label: 'Assets', desc: 'Company assets with depreciation',
    primary: { key: 'assets', dateField: null },
  },
  {
    id: 'estimates', icon: ClipboardList, color: '#10b981',
    label: 'Estimates', desc: 'All quotes with status and converted invoices',
    primary: { key: 'estimates', dateField: 'issueDate' },
  },
  {
    id: 'hr', icon: UserCheck, color: '#6366f1',
    label: 'Human Resources', desc: 'Staff profiles + payroll history · Excel exports 2 sheets',
    primary:   { key: 'staff',   dateField: null },
    secondary: { key: 'payroll', dateField: 'periodFrom', label: 'Payroll' },
  },
]

type RawData = Record<DataKey, any[]>

// ─── Component ────────────────────────────────────────────────────
export default function ExportPage() {
  const [preset, setPreset]         = useState('last_90')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [raw, setRaw] = useState<RawData>({
    services: [], clients: [], invoices: [], expenses: [], inventory: [], assets: [],
    estimates: [], staff: [], payroll: [], invoice_payments: [], recurring_expenses: [], management: [],
  })
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
  const [done,      setDone]      = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/services').then(r => r.json()).catch(() => []),
      fetch('/api/clients').then(r => r.json()).catch(() => []),
      fetch('/api/invoices').then(r => r.json()).catch(() => []),
      fetch('/api/expenses').then(r => r.json()).catch(() => []),
      fetch('/api/inventory').then(r => r.json()).catch(() => []),
      fetch('/api/assets').then(r => r.json()).catch(() => []),
      fetch('/api/estimates').then(r => r.json()).catch(() => []),
      fetch('/api/staff').then(r => r.json()).catch(() => []),
      fetch('/api/payroll').then(r => r.json()).catch(() => []),
      fetch('/api/invoice-payments').then(r => r.json()).catch(() => []),
      fetch('/api/recurring-expenses').then(r => r.json()).catch(() => []),
      fetch('/api/management').then(r => r.json()).catch(() => []),
    ]).then(([
      services, clients, invoices, expenses, inventory, assets,
      estimates, staff, payroll, invoice_payments, recurring_expenses, management,
    ]) => {
      setRaw({ services, clients, invoices, expenses, inventory, assets, estimates, staff, payroll, invoice_payments, recurring_expenses, management })
      setLoading(false)
    })
  }, [])

  const getRange = useCallback((): { from: Date; to: Date } => {
    if (preset === 'custom' && customFrom && customTo) {
      return { from: new Date(customFrom), to: new Date(customTo + 'T23:59:59') }
    }
    return PRESETS.find(p => p.key === preset)!.getRange()
  }, [preset, customFrom, customTo])

  function filterByDate(rows: any[], field: string | null): any[] {
    if (!field) return rows
    const { from, to } = getRange()
    return rows.filter(r => {
      const d = new Date(r[field])
      return d >= from && d <= to
    })
  }

  function getPrimaryRows(report: ReportDef): Record<string, unknown>[] {
    const data = filterByDate(raw[report.primary.key], report.primary.dateField)
    if (report.id === 'services')  return shapeServices(data)
    if (report.id === 'clients')   return shapeClients(data, raw.management)
    if (report.id === 'billing')   return shapeInvoices(data)
    if (report.id === 'expenses')  return shapeExpenses(data)
    if (report.id === 'inventory') return shapeInventory(data)
    if (report.id === 'assets')    return shapeAssets(data)
    if (report.id === 'estimates') return shapeEstimates(data)
    if (report.id === 'hr')        return shapeStaff(data)
    return []
  }

  function getSecondaryRows(report: ReportDef): Record<string, unknown>[] {
    if (!report.secondary) return []
    const data = filterByDate(raw[report.secondary.key], report.secondary.dateField)
    if (report.id === 'billing')  return shapeInvoicePayments(data)
    if (report.id === 'expenses') return shapeRecurring(data)
    if (report.id === 'hr')       return shapePayroll(data)
    return []
  }

  const stamp = () => new Date().toISOString().slice(0, 10)
  const rangeLabel = () => {
    if (preset === 'custom' && customFrom && customTo) return `${customFrom} to ${customTo}`
    return PRESETS.find(p => p.key === preset)?.label ?? ''
  }

  async function doExport(report: ReportDef, format: 'csv' | 'excel' | 'pdf') {
    const key = `${report.id}-${format}`
    setExporting(key)
    await new Promise(r => setTimeout(r, 300))

    try {
      const rows = getPrimaryRows(report)
      const name = `${report.label.replace(/ /g, '_')}_${stamp()}`
      const sub  = `Period: ${rangeLabel()} — ${rows.length} records`

      if (!rows.length) { alert('No data found for the selected range.'); return }

      if (format === 'csv') {
        downloadCSV(rows, `${name}.csv`)
      } else if (format === 'excel') {
        const sheets: { name: string; rows: Record<string, unknown>[] }[] = [{ name: report.label, rows }]
        if (report.secondary) {
          const secRows = getSecondaryRows(report)
          if (secRows.length) sheets.push({ name: report.secondary.label, rows: secRows })
        }
        downloadExcel(sheets, `${name}.xlsx`)
      } else {
        downloadPDF(report.label, Object.keys(rows[0]), rows.map(r => Object.values(r) as (string | number)[]), sub)
      }

      setDone(prev => [...prev.filter(k => k !== key), key])
      setTimeout(() => setDone(prev => prev.filter(k => k !== key)), 3000)
    } finally {
      setExporting(null)
    }
  }

  // Total sheets in Export All = primary sheets + secondary sheets
  const totalSheets = REPORTS.reduce((n, r) => n + 1 + (r.secondary ? 1 : 0), 0)

  async function exportAll() {
    setExporting('all')
    await new Promise(r => setTimeout(r, 300))
    try {
      const sheets: { name: string; rows: Record<string, unknown>[] }[] = []
      for (const report of REPORTS) {
        sheets.push({ name: report.label, rows: getPrimaryRows(report) })
        if (report.secondary) {
          const secRows = getSecondaryRows(report)
          if (secRows.length) sheets.push({ name: report.secondary.label, rows: secRows })
        }
      }
      downloadExcel(sheets, `Joyful_Export_Complete_${stamp()}.xlsx`)
      setDone(prev => [...prev, 'all'])
      setTimeout(() => setDone(prev => prev.filter(k => k !== 'all')), 3000)
    } finally {
      setExporting(null)
    }
  }

  const counts = Object.fromEntries(
    REPORTS.map(r => [r.id, filterByDate(raw[r.primary.key], r.primary.dateField).length])
  ) as Record<ReportId, number>

  const btnCls = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
      active
        ? 'bg-[rgba(79,142,247,0.12)] border-[#4f8ef7] text-[#4f8ef7]'
        : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:border-[#4f8ef7] hover:text-[#4f8ef7]'
    }`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#e8eaf0]">Export Center</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">Download reports as CSV, Excel or PDF</p>
        </div>
        {loading && (
          <div className="text-xs text-[#6b7280] flex items-center gap-1.5">
            <RotateCcw size={12} className="animate-spin" /> Loading data…
          </div>
        )}
      </div>

      {/* Date Range */}
      <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
        <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-3">Date Range</div>
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => setPreset(p.key)} className={btnCls(preset === p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex gap-3 mt-3">
            <div>
              <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1">From</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="px-3 py-1.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1">To</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="px-3 py-1.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]" />
            </div>
          </div>
        )}
      </div>

      {/* Summary bar */}
      {!loading && (
        <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl px-5 py-3 flex items-center gap-6">
          <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider shrink-0">In this period</div>
          <div className="flex gap-5 flex-wrap">
            {REPORTS.map(r => (
              <div key={r.id} className="flex items-center gap-1.5">
                <span className="text-lg font-bold" style={{ color: r.color, fontFamily: 'var(--font-display)' }}>
                  {counts[r.id]}
                </span>
                <span className="text-[10px] text-[#6b7280]">{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report Cards */}
      <div className="grid grid-cols-4 gap-3">
        {REPORTS.map(report => {
          const Icon   = report.icon
          const count  = counts[report.id]
          const isExp  = (f: string) => exporting === `${report.id}-${f}`
          const isDone = (f: string) => done.includes(`${report.id}-${f}`)

          return (
            <div key={report.id}
              className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4 hover:border-[#2e3650] transition-colors">

              {/* Title row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: report.color + '18' }}>
                    <Icon size={16} style={{ color: report.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#e8eaf0] leading-tight">{report.label}</div>
                    <div className="text-[10px] text-[#6b7280] mt-0.5 leading-snug">{report.desc}</div>
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ml-1.5"
                  style={{ background: report.color + '18', color: report.color }}>
                  {loading ? '…' : count}
                </div>
              </div>

              {/* Secondary badge */}
              {report.secondary && (
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border"
                    style={{ borderColor: report.color + '40', color: report.color, background: report.color + '0f' }}>
                    + {report.secondary.label}
                  </span>
                  <span className="text-[9px] text-[#6b7280]">in Excel</span>
                </div>
              )}

              {/* Format buttons */}
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { fmt: 'csv'   as const, label: 'CSV',   Icon: FileText        },
                  { fmt: 'excel' as const, label: 'Excel', Icon: FileSpreadsheet  },
                  { fmt: 'pdf'   as const, label: 'PDF',   Icon: Download         },
                ].map(({ fmt, label, Icon: FmtIcon }) => (
                  <button
                    key={fmt}
                    onClick={() => doExport(report, fmt)}
                    disabled={!!exporting || loading}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-lg border text-[10px] font-semibold transition-all
                      ${isDone(fmt)
                        ? 'border-[#38d9a9] text-[#38d9a9] bg-[rgba(56,217,169,0.08)]'
                        : isExp(fmt)
                          ? 'border-[#2a2f3d] text-[#6b7280] opacity-70 cursor-wait'
                          : 'border-[#2a2f3d] text-[#6b7280] hover:border-[#4f8ef7] hover:text-[#4f8ef7]'
                      } disabled:opacity-40`}
                  >
                    {isDone(fmt)
                      ? <><CheckCircle size={10} /> Done</>
                      : isExp(fmt)
                        ? <><RotateCcw size={10} className="animate-spin" /> …</>
                        : <><FmtIcon size={10} /> {label}</>
                    }
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bulk Export */}
      <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(79,142,247,0.1)] flex items-center justify-center">
            <Layers size={18} className="text-[#4f8ef7]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#e8eaf0]">Export All</div>
            <div className="text-[10px] text-[#6b7280] mt-0.5">
              One Excel file with {totalSheets} sheets — all reports for the selected period
            </div>
          </div>
        </div>
        <button
          onClick={exportAll}
          disabled={!!exporting || loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all
            ${done.includes('all')
              ? 'bg-[rgba(56,217,169,0.12)] border border-[#38d9a9] text-[#38d9a9]'
              : 'bg-[#4f8ef7] hover:bg-[#3d7de0] text-white'
            } disabled:opacity-50`}
        >
          {done.includes('all')
            ? <><CheckCircle size={13} /> Downloaded</>
            : exporting === 'all'
              ? <><RotateCcw size={13} className="animate-spin" /> Generating…</>
              : <><FileSpreadsheet size={13} /> Download .xlsx</>
          }
        </button>
      </div>

      {/* Tips */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: '📄', title: 'CSV',           body: 'Compatible with any software. Opens directly in Excel, Google Sheets, or Numbers.' },
          { icon: '📊', title: 'Excel (.xlsx)',  body: 'Unified reports export 2 sheets in the same file — primary data + sub-report.' },
          { icon: '🖨️', title: 'PDF',            body: 'Opens the print dialog. Save as PDF or print directly.' },
        ].map(tip => (
          <div key={tip.title} className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-3 flex items-start gap-3">
            <span className="text-xl">{tip.icon}</span>
            <div>
              <div className="text-xs font-bold text-[#e8eaf0] mb-0.5">{tip.title}</div>
              <div className="text-[10px] text-[#6b7280] leading-relaxed">{tip.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
