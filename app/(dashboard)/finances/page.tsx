'use client'

import React, { useState, useEffect, useCallback } from 'react'
import CountUp from '@/components/ui/CountUp'
import { DollarSign, TrendingUp, TrendingDown, Search, Check, CheckCircle, Plus, RefreshCw, ReceiptText, X, ChevronDown, SlidersHorizontal, GripVertical } from 'lucide-react'
import SelectWithAdd from '@/components/ui/SelectWithAdd'
import InvoiceDetailModal from '@/components/modals/InvoiceDetailModal'
import InvoicePDFModal from '@/components/modals/InvoicePDFModal'
import InvoicePostGenerateModal from '@/components/modals/InvoicePostGenerateModal'
import InvoicePaymentsModal from '@/components/modals/InvoicePaymentsModal'
import ConfirmModal from '@/components/modals/ConfirmModal'
import EstimatePDFModal, { type EstimateData } from '@/components/modals/EstimatePDFModal'
import ClientModal from '@/components/modals/ClientModal'
import { useSyncPoll } from '@/lib/useSyncPoll'
import ServiceModal, { TIME_SLOTS } from '@/components/modals/ServiceModal'
import ServiceDetailModal from '@/components/modals/ServiceDetailModal'
import ErrorBanner from '@/components/ErrorBanner'

const INV_COL_DEFS = [
  { id: 'id',      label: 'ID',       defaultOn: true  },
  { id: 'date',    label: 'Date',     defaultOn: true  },
  { id: 'type',    label: 'Type',     defaultOn: true  },
  { id: 'unit',    label: 'Unit',     defaultOn: false },
  { id: 'room',    label: 'Room',     defaultOn: false },
  { id: 'time',    label: 'Time',     defaultOn: false },
  { id: 'staff',   label: 'Staff',    defaultOn: true  },
  { id: 'price',   label: 'Price',    defaultOn: true  },
  { id: 'fee',     label: 'Add. Fee', defaultOn: true  },
  { id: 'total',   label: 'Total',    defaultOn: true  },
  { id: 'payment', label: 'Payment',  defaultOn: true  },
  { id: 'status',  label: 'Status',   defaultOn: true  },
  { id: 'notes',   label: 'Notes',    defaultOn: false },
]

const INVOICE_COLORS: Record<string, string> = {
  draft: '#9ca3af',
  sent: '#4f8ef7',
  paid: '#38d9a9',
  overdue: '#f87171',
  cancelled: '#f87171',
}

const PAYMENT_METHODS = ['cash', 'zelle', 'venmo', 'paypal', 'cashapp', 'check', 'ach', 'card', 'credit_card', 'eft']

function fmt12h(t?: string | null) {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return t
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

const PAYMENT_TERMS = [
  { label: 'Due on Receipt', days: 0 },
  { label: 'Net 7',  days: 7  },
  { label: 'Net 15', days: 15 },
  { label: 'Net 30', days: 30 },
]

const BATCH_SVC_COL_DEFS = [
  { id: 'date',    label: 'Date',       defaultOn: true  },
  { id: 'time',    label: 'Time',       defaultOn: true  },
  { id: 'type',    label: 'Type',       defaultOn: true  },
  { id: 'address', label: 'Address',    defaultOn: true  },
  { id: 'unit',    label: 'Unit',       defaultOn: false },
  { id: 'room',    label: 'Room Size',  defaultOn: false },
  { id: 'key',     label: 'Key',        defaultOn: false },
  { id: 'base',    label: 'Base Price', defaultOn: false },
  { id: 'fee',     label: 'Add. Fee',   defaultOn: false },
  { id: 'total',   label: 'Total',      defaultOn: true  },
  { id: 'payment', label: 'Payment',    defaultOn: false },
  { id: 'status',  label: 'Status',     defaultOn: true  },
  { id: 'notes',   label: 'Notes',      defaultOn: false },
  { id: 'invoice', label: 'Invoice',    defaultOn: true  },
]

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('T')[0].split('-')
  return `${m}-${d}-${y}`
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

const inputCls = "w-full px-3 py-2 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors"
const labelCls = "text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5"

export default function FinancesPage() {
  const [activeTab, setActiveTab] = useState('summary')
  const [invoices, setInvoices] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [completedServices, setCompletedServices] = useState<any[]>([])
  const [pendingServices, setPendingServices] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // ── Summary: pending invoices table sort ──
  type SumSortKey = 'invoiceNumber' | 'client' | 'total' | 'balanceDue' | 'dueDate' | 'status'
  const [sumSort, setSumSort] = useState<{ key: SumSortKey; dir: 1 | -1 }>({ key: 'balanceDue', dir: -1 })
  const toggleSumSort = (key: SumSortKey) =>
    setSumSort(prev => prev.key === key ? { key, dir: (prev.dir * -1) as 1 | -1 } : { key, dir: key === 'client' || key === 'status' ? 1 : -1 })

  // ── Modals ──
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [pdfInvoice, setPdfInvoice] = useState<any>(null)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [postGenInvoice, setPostGenInvoice] = useState<any>(null)
  const [postGenOpen, setPostGenOpen] = useState(false)
  const [paymentsInvoice, setPaymentsInvoice] = useState<any>(null)
  const [paymentsOpen, setPaymentsOpen] = useState(false)

  // ── Confirm delete ──
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Invoice builder ──
  const [invMode, setInvMode] = useState<'auto' | 'manual'>('auto')
  const [invCode, setInvCode] = useState('')
  const [invNum, setInvNum] = useState('001')
  const [invYear, setInvYear] = useState(new Date().getFullYear().toString())
  const [invManualId, setInvManualId] = useState('')
  const [invPaymentTerm, setInvPaymentTerm] = useState('')
  const [invForm, setInvForm] = useState({
    clientId: '', periodFrom: '', periodTo: '',
    serviceStatus: 'all', taxRate: '0',
    paymentMethod: '', status: 'draft',
    dueDate: '', notes: '',
    issuedAt: new Date().toLocaleDateString('en-CA'),
  })
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [invVisibleCols, setInvVisibleCols] = useState<Set<string>>(() => {
    try {
      const s = typeof window !== 'undefined' && localStorage.getItem('joyful_inv_cols_visible')
      if (s) return new Set(JSON.parse(s) as string[])
    } catch {}
    return new Set(INV_COL_DEFS.filter(c => c.defaultOn).map(c => c.id))
  })
  const [invColOrder, setInvColOrder] = useState<string[]>(() => {
    try {
      const s = typeof window !== 'undefined' && localStorage.getItem('joyful_inv_cols_order')
      if (s) return JSON.parse(s) as string[]
    } catch {}
    return INV_COL_DEFS.map(c => c.id)
  })
  const [invColsOpen, setInvColsOpen] = useState(false)
  const [invDragIdx, setInvDragIdx] = useState<number | null>(null)
  const [invDropIdx, setInvDropIdx] = useState<number | null>(null)
  useEffect(() => {
    try { localStorage.setItem('joyful_inv_cols_visible', JSON.stringify([...invVisibleCols])) } catch {}
  }, [invVisibleCols])
  useEffect(() => {
    try { localStorage.setItem('joyful_inv_cols_order', JSON.stringify(invColOrder)) } catch {}
  }, [invColOrder])
  const [invSortKey, setInvSortKey] = useState<string>(() => {
    try { return (typeof window !== 'undefined' && localStorage.getItem('joyful_inv_sort_key')) || 'date' } catch { return 'date' }
  })
  const [invSortDir, setInvSortDir] = useState<'asc' | 'desc'>(() => {
    try { return ((typeof window !== 'undefined' && localStorage.getItem('joyful_inv_sort_dir')) || 'desc') as 'asc' | 'desc' } catch { return 'desc' }
  })
  useEffect(() => {
    try { localStorage.setItem('joyful_inv_sort_key', invSortKey) } catch {}
  }, [invSortKey])
  useEffect(() => {
    try { localStorage.setItem('joyful_inv_sort_dir', invSortDir) } catch {}
  }, [invSortDir])
  const [invDetailService, setInvDetailService] = useState<any>(null)
  const [invDetailOpen, setInvDetailOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [invError, setInvError] = useState('')
  const [summaryDateFrom, setSummaryDateFrom] = useState('')
  const [summaryDateTo, setSummaryDateTo]     = useState('')

  const [histFilter, setHistFilter]           = useState('all')
  const [histClientFilter, setHistClientFilter] = useState('all')
  const [histDateFrom, setHistDateFrom]         = useState('')
  const [histDateTo, setHistDateTo]             = useState('')
  const [histSearch, setHistSearch]             = useState('')
  const [histSortKey, setHistSortKey]           = useState('issuedAt')
  const [histSortDir, setHistSortDir]           = useState<'asc'|'desc'>('desc')
  const [showBalanceCol, setShowBalanceCol]     = useState(true)

  // ── Batch invoice generation ──
  const [invSubTab, setInvSubTab] = useState<'generar' | 'historial'>('generar')
  const [invBatchFrom, setInvBatchFrom] = useState('')
  const [invBatchTo, setInvBatchTo] = useState('')
  const [invBatchStatus, setInvBatchStatus] = useState('all')
  const [invBatchSearching, setInvBatchSearching] = useState(false)
  const [invBatchClients, setInvBatchClients] = useState<any[]>([])
  const [invWorked, setInvWorked] = useState<Record<string, boolean>>({})
  const [invExpanded, setInvExpanded] = useState<Set<string>>(new Set())
  const [invGeneratingFor, setInvGeneratingFor] = useState<string | null>(null)
  const [invClientForms, setInvClientForms] = useState<Record<string, any>>({})
  const [invClientSelected, setInvClientSelected] = useState<Record<string, Set<string>>>({})
  const [invClientGenerating, setInvClientGenerating] = useState<Record<string, boolean>>({})
  const [invClientErrors, setInvClientErrors] = useState<Record<string, string>>({})
  const [invClientCreatedInvoices, setInvClientCreatedInvoices] = useState<Record<string, any>>({})
  const [invClientEditing, setInvClientEditing] = useState<Record<string, boolean>>({})
  const [invClientEditForms, setInvClientEditForms] = useState<Record<string, any>>({})
  const [batchSvcVisibleCols, setBatchSvcVisibleCols] = useState<Set<string>>(() => {
    try {
      const s = typeof window !== 'undefined' && localStorage.getItem('joyful_batch_svc_cols')
      if (s) return new Set(JSON.parse(s) as string[])
    } catch {}
    return new Set(BATCH_SVC_COL_DEFS.filter(c => c.defaultOn).map(c => c.id))
  })
  const [batchColsOpen, setBatchColsOpen] = useState(false)
  useEffect(() => {
    try { localStorage.setItem('joyful_batch_svc_cols', JSON.stringify([...batchSvcVisibleCols])) } catch {}
  }, [batchSvcVisibleCols])

  // ── Expenses tab ──
  const [recurring, setRecurring] = useState<any[]>([])
  const [expCatFilter, setExpCatFilter] = useState('all')
  const [expReceiptFilter, setExpReceiptFilter] = useState('all')
  const [expSearch, setExpSearch] = useState('')
  const [expDateFrom, setExpDateFrom] = useState('')
  const [expDateTo, setExpDateTo] = useState('')

  // ── Add Expense Modal ──
  const [addExpOpen, setAddExpOpen] = useState(false)
  const [addExpForm, setAddExpForm] = useState({
    description: '', category: 'Supplies', amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash', supplier: '', receiptUrl: '', notes: '',
  })
  const [addExpSaving, setAddExpSaving] = useState(false)
  const [addExpError, setAddExpError] = useState('')

  // ── Edit Expense Modal ──
  const [editExpOpen, setEditExpOpen] = useState(false)
  const [editExpTarget, setEditExpTarget] = useState<any>(null)
  const [editExpForm, setEditExpForm] = useState({
    description: '', category: 'Supplies', amount: '',
    expenseDate: '', paymentMethod: 'cash', supplier: '', receiptUrl: '', notes: '',
  })
  const [editExpSaving, setEditExpSaving] = useState(false)

  // ── Edit Recurring Modal ──
  const [editRecOpen, setEditRecOpen] = useState(false)
  const [editRecTarget, setEditRecTarget] = useState<any>(null)
  const [editRecForm, setEditRecForm] = useState({
    name: '', category: 'Supplies', amount: '',
    frequency: 'monthly', dayOfMonth: '1',
    paymentMethod: 'cash', autoRegister: true, startDate: '', notes: '',
  })
  const [editRecSaving, setEditRecSaving] = useState(false)

  // ── Recurring sync ──
  const [syncingRecurring, setSyncingRecurring] = useState(false)
  const [syncRecurringMsg, setSyncRecurringMsg] = useState('')

  // ── Add Recurring Modal ──
  const [addRecOpen, setAddRecOpen] = useState(false)
  const [addRecForm, setAddRecForm] = useState({
    name: '', category: 'Supplies', amount: '',
    frequency: 'monthly', dayOfMonth: '1',
    paymentMethod: 'cash', autoRegister: true, startDate: new Date().toISOString().split('T')[0], notes: '',
  })
  const [addRecSaving, setAddRecSaving] = useState(false)
  const [addRecError, setAddRecError] = useState('')

  // ── Assets tab ──
  const [assets, setAssets] = useState<any[]>([])
  const [assetSearchQ, setAssetSearchQ] = useState('')
  const [assetTypeFilter, setAssetTypeFilter] = useState('all')
  const [assetStatusFilter, setAssetStatusFilter] = useState('all')
  const [addAssetOpen, setAddAssetOpen] = useState(false)
  const [addAssetForm, setAddAssetForm] = useState({
    name: '', type: 'Vehicle', purchaseDate: new Date().toISOString().split('T')[0],
    purchaseValue: '', currentValue: '', annualDepreciation: '0',
    serialNumber: '', status: 'active', notes: '',
  })
  const [addAssetSaving, setAddAssetSaving] = useState(false)
  const [addAssetError, setAddAssetError] = useState('')
  const [editAssetOpen, setEditAssetOpen] = useState(false)
  const [editAssetTarget, setEditAssetTarget] = useState<any>(null)
  const [editAssetForm, setEditAssetForm] = useState({
    name: '', type: 'Vehicle', purchaseDate: '',
    purchaseValue: '', currentValue: '', annualDepreciation: '0',
    serialNumber: '', status: 'active', notes: '',
  })
  const [editAssetSaving, setEditAssetSaving] = useState(false)

  // ── Inventory tab ──
  const [inventory, setInventory] = useState<any[]>([])
  const [invSearchQ, setInvSearchQ] = useState('')
  const [invCatFilter, setInvCatFilter] = useState('all')
  const [invLowStock, setInvLowStock] = useState(false)
  const [addProdOpen, setAddProdOpen] = useState(false)
  const [addProdForm, setAddProdForm] = useState({ sku: '', name: '', category: 'Chemicals', unitOfMeasure: 'Unit', unitCost: '', currentStock: '0', minimumStock: '0', supplier: '', notes: '' })
  const [addProdSaving, setAddProdSaving] = useState(false)
  const [addProdError, setAddProdError] = useState('')
  const [editProdOpen, setEditProdOpen] = useState(false)
  const [editProdTarget, setEditProdTarget] = useState<any>(null)
  const [editProdForm, setEditProdForm] = useState({ sku: '', name: '', category: 'Chemicals', unitOfMeasure: 'Unit', unitCost: '', currentStock: '0', minimumStock: '0', supplier: '', notes: '' })
  const [editProdSaving, setEditProdSaving] = useState(false)

  // ── Inventory movements (stock in/out with history) ──
  const [invMovements, setInvMovements] = useState<any[]>([])
  const [movModalOpen, setMovModalOpen] = useState(false)
  const [movForm, setMovForm] = useState({ productId: '', type: 'out', quantity: '', date: new Date().toLocaleDateString('en-CA'), comment: '' })
  const [movSaving, setMovSaving] = useState(false)
  const [movError, setMovError] = useState('')
  const [movHistoryOpen, setMovHistoryOpen] = useState(false)

  function openMovementModal(product?: any, type: 'out' | 'in' = 'out') {
    setMovForm({ productId: product?.id || '', type, quantity: '', date: new Date().toLocaleDateString('en-CA'), comment: '' })
    setMovError('')
    setMovModalOpen(true)
  }

  async function loadMovements() {
    try {
      const res = await fetch('/api/inventory/movements')
      const data = await res.json()
      if (res.ok && Array.isArray(data)) setInvMovements(data)
    } catch {}
  }

  async function handleSaveMovement() {
    if (!movForm.productId) { setMovError('Select a product'); return }
    if (!movForm.quantity || parseInt(movForm.quantity) <= 0) { setMovError('Enter a valid quantity'); return }
    setMovSaving(true)
    setMovError('')
    try {
      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to register movement')
      setInventory(prev => prev.map(p => p.id === data.product.id ? data.product : p))
      setMovModalOpen(false)
      loadMovements()
    } catch (err: any) {
      setMovError(err.message || 'Failed to register movement')
    } finally {
      setMovSaving(false)
    }
  }

  // ── Invoice search ──
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching2, setSearching2] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // ── Estimates tab ──
  const [estClientMode, setEstClientMode] = useState<'registered' | 'manual'>('manual')
  const [estClientId, setEstClientId] = useState('')
  const [estClientModalOpen, setEstClientModalOpen] = useState(false)
  const [estClients, setEstClients] = useState<any[]>([])
  const [estForm, setEstForm] = useState({
    estimateNumber: `EST-${new Date().getFullYear()}-001`,
    issueDate: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    clientName: '', clientEmail: '', clientPhone: '', clientAddress: '',
    notes: '', taxRate: '0',
  })
  const [estItems, setEstItems] = useState([
    { description: '', qty: 1, unitPrice: 0, total: 0 },
  ])
  const [estScheduleVisit, setEstScheduleVisit] = useState(false)
  const [estVisitDate, setEstVisitDate] = useState(new Date().toISOString().split('T')[0])
  const [estVisitTime, setEstVisitTime] = useState(TIME_SLOTS[0]?.value || '')
  const [estPDFOpen, setEstPDFOpen] = useState(false)
  const [estPDFData, setEstPDFData] = useState<EstimateData | null>(null)
  const [estimates, setEstimates] = useState<any[]>([])
  const [estSaving, setEstSaving] = useState(false)
  const [estSaveError, setEstSaveError] = useState('')
  const [estHistFilter, setEstHistFilter] = useState<'all' | 'pending' | 'converted' | 'service_created' | 'cancelled'>('all')
  const [estLinkOpen, setEstLinkOpen] = useState<string | null>(null)
  const [estLinkInvoiceId, setEstLinkInvoiceId] = useState('')
  const [estLinking, setEstLinking] = useState(false)
  const [estEditId, setEstEditId] = useState<string | null>(null)
  const [estFromEstimate, setEstFromEstimate] = useState<any | null>(null)
  const [estServiceModalOpen, setEstServiceModalOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadData = useCallback(() => {
    const endpoints: [string, string][] = [
      ['invoices', '/api/invoices'], ['expenses', '/api/expenses'], ['clients', '/api/clients'],
      ['recurring-expenses', '/api/recurring-expenses'], ['inventory', '/api/inventory'],
      ['assets', '/api/assets'], ['services', '/api/services'],
    ]
    const failed: string[] = []
    Promise.all(endpoints.map(([key, url]) =>
      fetch(url)
        .then(async res => {
          const data = await res.json()
          if (!res.ok) throw new Error()
          return data
        })
        .catch(() => { failed.push(key); return [] })
    )).then(([inv, exp, cli, rec, products, ass, svcs]) => {
      setInvoices(Array.isArray(inv) ? inv : [])
      setExpenses(Array.isArray(exp) ? exp : [])
      setClients(Array.isArray(cli) ? cli : [])
      setRecurring(Array.isArray(rec) ? rec : [])
      setInventory(Array.isArray(products) ? products : [])
      setAssets(Array.isArray(ass) ? ass : [])
      setCompletedServices(Array.isArray(svcs) ? svcs.filter((s: any) => s.status === 'completed') : [])
      setPendingServices(Array.isArray(svcs) ? svcs.filter((s: any) => s.status === 'pending') : [])
      setLoadError(failed.length > 0 ? `No se pudo cargar: ${failed.join(', ')}.` : null)
      setLoading(false)
    })
    fetch('/api/inventory/movements')
      .then(async res => { const d = await res.json(); if (res.ok && Array.isArray(d)) setInvMovements(d) })
      .catch(() => {})
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useSyncPoll(['invoices', 'expenses', 'clients', 'recurringExpenses', 'inventory', 'assets', 'services'], loadData)

  function applyAutoInvoiceNum(currentInvoices: any[]) {
    const pattern = /^JOYFUL(\d+)$/i
    let maxNum = 102  // next will be at least 103
    for (const inv of currentInvoices) {
      const m = inv.invoiceNumber?.match(pattern)
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
    }
    setInvNum(String(maxNum + 1))
  }

  useEffect(() => {
    if (invMode === 'auto') applyAutoInvoiceNum(invoices)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices])

  useEffect(() => {
    if (!invPaymentTerm) return
    const term = PAYMENT_TERMS.find(t => t.label === invPaymentTerm)
    if (!term) return
    const base = invForm.issuedAt || new Date().toLocaleDateString('en-CA')
    const date = new Date(base + 'T12:00:00Z')
    date.setUTCDate(date.getUTCDate() + term.days)
    setInvForm(f => ({ ...f, dueDate: date.toISOString().split('T')[0] }))
  }, [invPaymentTerm, invForm.issuedAt])

  useEffect(() => {
    if (!searchQ || searchQ.length < 2) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearching2(true)
      try {
        const res = await fetch(`/api/invoices/search?q=${encodeURIComponent(searchQ)}`)
        const data = await res.json()
        setSearchResults(data.invoices || [])
      } catch {}
      finally { setSearching2(false) }
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQ])

  useEffect(() => {
    if (activeTab === 'estimates') {
      estLoadClients()
      loadEstimates()
    }
  }, [activeTab])

  function loadEstimates() {
    fetch('/api/estimates').then(r => r.json()).then(data => {
      setEstimates(Array.isArray(data) ? data : [])
    }).catch(() => {})
  }

  async function handleSaveEstimate() {
    setEstSaving(true)
    setEstSaveError('')
    const data = estBuildData()
    const registeredClientId = estClientMode === 'registered' ? estClientId : null
    try {
      const url  = estEditId ? `/api/estimates/${estEditId}` : '/api/estimates'
      const method = estEditId ? 'PUT' : 'POST'
      const visitFields = !estEditId && estScheduleVisit
        ? { visitDate: estVisitDate, visitTime: estVisitTime }
        : {}
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, clientId: registeredClientId, ...visitFields }),
      })
      if (!res.ok) {
        const err = await res.json()
        setEstSaveError(err.error || 'Failed to save')
        return
      }
      const saved = await res.json()
      setEstimates(prev =>
        estEditId
          ? prev.map(e => e.id === saved.id ? saved : e)
          : [saved, ...prev]
      )
      setEstEditId(null)
      resetEstForm()
    } catch {
      setEstSaveError('Network error')
    } finally {
      setEstSaving(false)
    }
  }

  function resetEstForm() {
    const yr = new Date().getFullYear()
    const nextNum = String(estimates.length + 1).padStart(3, '0')
    setEstForm({
      estimateNumber: `EST-${yr}-${nextNum}`,
      issueDate: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      clientName: '', clientEmail: '', clientPhone: '', clientAddress: '',
      notes: '', taxRate: '0',
    })
    setEstItems([{ description: '', qty: 1, unitPrice: 0, total: 0 }])
    setEstClientId('')
    setEstClientMode('manual')
    setEstSaveError('')
    setEstScheduleVisit(false)
    setEstVisitDate(new Date().toISOString().split('T')[0])
    setEstVisitTime(TIME_SLOTS[0]?.value || '')
  }

  function loadEstimateForEdit(est: any) {
    setEstEditId(est.id)
    setEstForm({
      estimateNumber: est.estimateNumber,
      issueDate:      est.issueDate?.split('T')[0] ?? '',
      validUntil:     est.validUntil?.split('T')[0] ?? '',
      clientName:     est.clientName,
      clientEmail:    est.clientEmail  ?? '',
      clientPhone:    est.clientPhone  ?? '',
      clientAddress:  est.clientAddress ?? '',
      notes:          est.notes        ?? '',
      taxRate:        String(est.taxRate ?? 0),
    })
    setEstItems(Array.isArray(est.items) ? est.items : [{ description: '', qty: 1, unitPrice: 0, total: 0 }])
    if (est.clientId) {
      setEstClientMode('registered')
      setEstClientId(est.clientId)
    } else {
      setEstClientMode('manual')
      setEstClientId('')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDeleteEstimate(id: string) {
    if (!confirm('Delete this estimate?')) return
    await fetch(`/api/estimates/${id}`, { method: 'DELETE' })
    setEstimates(prev => prev.filter(e => e.id !== id))
  }

  async function handleLinkInvoice(estimateId: string) {
    if (!estLinkInvoiceId) return
    setEstLinking(true)
    try {
      const res = await fetch(`/api/estimates/${estimateId}/link-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: estLinkInvoiceId }),
      })
      if (res.ok) {
        const updated = await res.json()
        setEstimates(prev => prev.map(e => e.id === updated.id ? updated : e))
        setEstLinkOpen(null)
        setEstLinkInvoiceId('')
      }
    } finally {
      setEstLinking(false)
    }
  }

  async function handleUnlinkInvoice(estimateId: string) {
    const res = await fetch(`/api/estimates/${estimateId}/link-invoice`, { method: 'DELETE' })
    if (res.ok) {
      const updated = await res.json()
      setEstimates(prev => prev.map(e => e.id === updated.id ? updated : e))
    }
  }

  function openCreateServiceFromEstimate(est: any) {
    setEstFromEstimate(est)
    setEstServiceModalOpen(true)
  }

  async function handleServiceCreatedFromEstimate(serviceId?: string) {
    if (estFromEstimate && serviceId) {
      const res = await fetch(`/api/estimates/${estFromEstimate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'service_created' }),
      })
      if (res.ok) {
        const updated = await res.json()
        setEstimates(prev => prev.map(e => e.id === updated.id ? updated : e))
      }
    }
    setEstServiceModalOpen(false)
    setEstFromEstimate(null)
  }

  function previewSavedEstimate(est: any) {
    const taxRate = Number(est.taxRate) || 0
    const subtotal = Number(est.subtotal) || 0
    const tax = Number(est.tax) || 0
    const total = Number(est.total) || 0
    setEstPDFData({
      estimateNumber: est.estimateNumber,
      issueDate:      est.issueDate?.split('T')[0] ?? '',
      validUntil:     est.validUntil?.split('T')[0] ?? '',
      clientName:     est.clientName,
      clientEmail:    est.clientEmail  ?? '',
      clientPhone:    est.clientPhone  ?? '',
      clientAddress:  est.clientAddress ?? '',
      notes:          est.notes        ?? '',
      taxRate, subtotal, tax, total,
      items: Array.isArray(est.items) ? est.items : [],
    })
    setEstPDFOpen(true)
  }

  // ── Request delete ──
  function requestDeleteInvoice(inv: any) {
    setConfirmTarget(inv)
    setConfirmOpen(true)
  }

  // ── Confirm delete ──
  async function handleConfirmDelete() {
    if (!confirmTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/invoices/${confirmTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setConfirmOpen(false)
        alert(data.error || 'Failed to delete invoice')
        return
      }
      // Remove from local invoice state
      setInvoices(prev => prev.filter(i => i.id !== confirmTarget.id))
      setSearchResults(prev => prev.filter(i => i.id !== confirmTarget.id))

      // If this invoice was created in the current batch session, clean up batch state
      setInvClientCreatedInvoices(prev => {
        const clientId = Object.keys(prev).find(id => prev[id]?.id === confirmTarget.id)
        if (!clientId) return prev
        const next = { ...prev }
        delete next[clientId]
        // Un-mark as worked
        setInvWorked(w => {
          const wNext = { ...w, [clientId]: false }
          const key = `joyful-invoice-worked-${invBatchFrom}-${invBatchTo}`
          try { localStorage.setItem(key, JSON.stringify(wNext)) } catch {}
          return wNext
        })
        return next
      })

      // Refresh batch results so services show as uninvoiced again
      if (invBatchFrom && invBatchTo) {
        handleBatchSearch()
      }

      setConfirmOpen(false)
      setConfirmTarget(null)
    } catch {
      alert('Failed to delete invoice')
    } finally {
      setDeleting(false)
    }
  }

  // ── Expense handlers ──
  const EXP_CATEGORIES = ['Supplies', 'Equipment', 'Fuel', 'Payroll', 'Marketing', 'Vehicle', 'Software', 'Other']

  const filteredExpenses = expenses.filter(e => {
    if (expCatFilter !== 'all' && e.category !== expCatFilter) return false
    if (expReceiptFilter === 'yes' && !e.receiptUrl) return false
    if (expReceiptFilter === 'no' && e.receiptUrl) return false
    if (expSearch) {
      const q = expSearch.toLowerCase()
      if (!e.description?.toLowerCase().includes(q) && !e.supplier?.toLowerCase().includes(q)) return false
    }
    if (expDateFrom || expDateTo) {
      const d = new Date(e.expenseDate).toISOString().split('T')[0]
      if (expDateFrom && d < expDateFrom) return false
      if (expDateTo && d > expDateTo) return false
    }
    return true
  })

  const hasDateFilter = !!(expDateFrom || expDateTo)

  const filteredTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0)

  const filteredTopCategory = (() => {
    const totals: Record<string, number> = {}
    filteredExpenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + Number(e.amount) })
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1])
    return sorted[0]?.[0] || '—'
  })()

  const filteredWithReceipt = filteredExpenses.filter(e => e.receiptUrl).length
  const recurringTotal = recurring.reduce((s, r) => s + Number(r.amount), 0)

  // ── Inventory computed ──
  const INV_CATEGORIES = ['Chemicals', 'Equipment', 'PPE', 'Accessories']
  const INV_UNITS = ['Unit', 'Gallon', 'Box', 'Liter', 'Bag', 'Pair', 'Set', 'Pack']

  const filteredInventory = inventory.filter(p => {
    if (invCatFilter !== 'all' && p.category !== invCatFilter) return false
    if (invLowStock && p.currentStock >= p.minimumStock) return false
    if (invSearchQ) {
      const q = invSearchQ.toLowerCase()
      if (!p.name?.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q) && !p.supplier?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalProducts = inventory.length
  const lowStockCount = inventory.filter(p => p.currentStock < p.minimumStock).length
  const totalInvValue = inventory.reduce((s, p) => s + Number(p.unitCost) * p.currentStock, 0)

  // ── Assets computed ──
  const ASSET_TYPES = ['Vehicle', 'Equipment', 'Tool', 'Technology', 'Furniture', 'Other']

  const filteredAssets = assets.filter(a => {
    if (assetTypeFilter !== 'all' && a.type !== assetTypeFilter) return false
    if (assetStatusFilter !== 'all' && a.status !== assetStatusFilter) return false
    if (assetSearchQ) {
      const q = assetSearchQ.toLowerCase()
      if (!a.name?.toLowerCase().includes(q) && !a.serialNumber?.toLowerCase().includes(q) && !a.type?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalAssets         = assets.length
  const activeAssetsCount   = assets.filter(a => a.status === 'active').length
  const totalPurchaseValue  = assets.reduce((s, a) => s + Number(a.purchaseValue), 0)
  const totalCurrentValue   = assets.reduce((s, a) => s + Number(a.currentValue), 0)

  async function handleAddExpense() {
    if (!addExpForm.description || !addExpForm.amount || !addExpForm.expenseDate) {
      setAddExpError('Description, amount, and date are required.')
      return
    }
    setAddExpSaving(true)
    setAddExpError('')
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addExpForm),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setExpenses(prev => [created, ...prev])
      setAddExpOpen(false)
      setAddExpForm({
        description: '', category: 'Supplies', amount: '',
        expenseDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'cash', supplier: '', receiptUrl: '', notes: '',
      })
    } catch {
      setAddExpError('Failed to save expense.')
    } finally {
      setAddExpSaving(false)
    }
  }

  function openEditExpense(exp: any) {
    setEditExpTarget(exp)
    setEditExpForm({
      description:   exp.description || '',
      category:      exp.category || 'Supplies',
      amount:        String(exp.amount || ''),
      expenseDate:   exp.expenseDate?.split('T')[0] || '',
      paymentMethod: exp.paymentMethod || 'cash',
      supplier:      exp.supplier || '',
      receiptUrl:    exp.receiptUrl || '',
      notes:         exp.notes || '',
    })
    setEditExpOpen(true)
  }

  async function handleEditExpense() {
    if (!editExpTarget) return
    setEditExpSaving(true)
    try {
      const res = await fetch(`/api/expenses/${editExpTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editExpForm),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e))
      setEditExpOpen(false)
      setEditExpTarget(null)
    } catch {
      alert('Failed to update expense.')
    } finally {
      setEditExpSaving(false)
    }
  }

  async function handleDeleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    if (res.ok) setExpenses(prev => prev.filter(e => e.id !== id))
  }

  async function handleAddRecurring() {
    if (!addRecForm.name || !addRecForm.amount || !addRecForm.startDate) {
      setAddRecError('Name, amount, and start date are required.')
      return
    }
    setAddRecSaving(true)
    setAddRecError('')
    try {
      const res = await fetch('/api/recurring-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addRecForm),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      setRecurring(prev => [created, ...prev])
      setAddRecOpen(false)
      setAddRecForm({
        name: '', category: 'Supplies', amount: '',
        frequency: 'monthly', dayOfMonth: '1',
        paymentMethod: 'cash', autoRegister: true,
        startDate: new Date().toISOString().split('T')[0], notes: '',
      })
    } catch {
      setAddRecError('Failed to save recurring expense.')
    } finally {
      setAddRecSaving(false)
    }
  }

  async function syncRecurringExpenses() {
    setSyncingRecurring(true)
    try {
      const res = await fetch('/api/cron/register-recurring-expenses', { method: 'POST' })
      const data = await res.json()
      if (data.registered > 0) {
        const [exp] = await Promise.all([
          fetch('/api/expenses').then(r => r.json()).catch(() => []),
        ])
        setExpenses(Array.isArray(exp) ? exp : [])
      }
      setSyncRecurringMsg(data.registered > 0 ? `${data.registered} expense(s) registered` : 'All up to date')
      setTimeout(() => setSyncRecurringMsg(''), 4000)
    } catch {
      setSyncRecurringMsg('Sync failed')
      setTimeout(() => setSyncRecurringMsg(''), 3000)
    } finally {
      setSyncingRecurring(false)
    }
  }

  async function toggleAutoRegister(rec: any) {
    const res = await fetch(`/api/recurring-expenses/${rec.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoRegister: !rec.autoRegister }),
    })
    if (res.ok) {
      const updated = await res.json()
      setRecurring(prev => prev.map(r => r.id === updated.id ? updated : r))
    }
  }

  function openEditRecurring(rec: any) {
    setEditRecTarget(rec)
    setEditRecForm({
      name:          rec.name || '',
      category:      rec.category || 'Supplies',
      amount:        String(rec.amount || ''),
      frequency:     rec.frequency || 'monthly',
      dayOfMonth:    rec.dayOfMonth ? String(rec.dayOfMonth) : '1',
      paymentMethod: rec.paymentMethod || 'cash',
      autoRegister:  rec.autoRegister !== false,
      startDate:     rec.startDate?.split('T')[0] || '',
      notes:         rec.notes || '',
    })
    setEditRecOpen(true)
  }

  async function handleEditRecurring() {
    if (!editRecTarget) return
    setEditRecSaving(true)
    try {
      const res = await fetch(`/api/recurring-expenses/${editRecTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRecForm),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setRecurring(prev => prev.map(r => r.id === updated.id ? updated : r))
      setEditRecOpen(false)
      setEditRecTarget(null)
    } catch {
      alert('Failed to update recurring expense.')
    } finally {
      setEditRecSaving(false)
    }
  }

  async function handleDeactivateRecurring(id: string) {
    if (!confirm('Deactivate this recurring expense?')) return
    const res = await fetch(`/api/recurring-expenses/${id}`, { method: 'DELETE' })
    if (res.ok) setRecurring(prev => prev.filter(r => r.id !== id))
  }

  // ── Inventory handlers ──
  async function handleAddProduct() {
    if (!addProdForm.name || !addProdForm.unitCost) {
      setAddProdError('Name and unit cost are required.')
      return
    }
    setAddProdSaving(true)
    setAddProdError('')
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addProdForm),
      })
      const data = await res.json()
      if (!res.ok) { setAddProdError(data.error || 'Failed to save product.'); return }
      setInventory(prev => [data, ...prev])
      setAddProdOpen(false)
      setAddProdForm({ sku: '', name: '', category: 'Chemicals', unitOfMeasure: 'Unit', unitCost: '', currentStock: '0', minimumStock: '0', supplier: '', notes: '' })
    } catch {
      setAddProdError('Failed to save product.')
    } finally {
      setAddProdSaving(false)
    }
  }

  function openEditProduct(prod: any) {
    setEditProdTarget(prod)
    setEditProdForm({
      sku:          prod.sku || '',
      name:         prod.name || '',
      category:     prod.category || 'Chemicals',
      unitOfMeasure: prod.unitOfMeasure || 'Unit',
      unitCost:     String(prod.unitCost || ''),
      currentStock: String(prod.currentStock ?? 0),
      minimumStock: String(prod.minimumStock ?? 0),
      supplier:     prod.supplier || '',
      notes:        prod.notes || '',
    })
    setEditProdOpen(true)
  }

  async function handleEditProduct() {
    if (!editProdTarget) return
    setEditProdSaving(true)
    try {
      const res = await fetch(`/api/inventory/${editProdTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProdForm),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setInventory(prev => prev.map(p => p.id === updated.id ? updated : p))
      setEditProdOpen(false)
      setEditProdTarget(null)
    } catch {
      alert('Failed to update product.')
    } finally {
      setEditProdSaving(false)
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('Delete this product from inventory?')) return
    const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
    if (res.ok) setInventory(prev => prev.filter(p => p.id !== id))
  }

  // ── Asset handlers ──
  async function handleAddAsset() {
    if (!addAssetForm.name || !addAssetForm.purchaseValue || !addAssetForm.purchaseDate) {
      setAddAssetError('Name, purchase date and purchase value are required.')
      return
    }
    setAddAssetSaving(true)
    setAddAssetError('')
    try {
      const payload = {
        ...addAssetForm,
        currentValue: addAssetForm.currentValue || addAssetForm.purchaseValue,
      }
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setAddAssetError(data.error || 'Failed to save asset.'); return }
      setAssets(prev => [data, ...prev])
      setAddAssetOpen(false)
      setAddAssetForm({
        name: '', type: 'Vehicle', purchaseDate: new Date().toISOString().split('T')[0],
        purchaseValue: '', currentValue: '', annualDepreciation: '0',
        serialNumber: '', status: 'active', notes: '',
      })
    } catch {
      setAddAssetError('Failed to save asset.')
    } finally {
      setAddAssetSaving(false)
    }
  }

  function openEditAsset(asset: any) {
    setEditAssetTarget(asset)
    setEditAssetForm({
      name:               asset.name || '',
      type:               asset.type || 'Vehicle',
      purchaseDate:       asset.purchaseDate?.split('T')[0] || '',
      purchaseValue:      String(asset.purchaseValue || ''),
      currentValue:       String(asset.currentValue || ''),
      annualDepreciation: String(asset.annualDepreciation || '0'),
      serialNumber:       asset.serialNumber || '',
      status:             asset.status || 'active',
      notes:              asset.notes || '',
    })
    setEditAssetOpen(true)
  }

  async function handleEditAsset() {
    if (!editAssetTarget) return
    setEditAssetSaving(true)
    try {
      const res = await fetch(`/api/assets/${editAssetTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editAssetForm),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setAssets(prev => prev.map(a => a.id === updated.id ? updated : a))
      setEditAssetOpen(false)
      setEditAssetTarget(null)
    } catch {
      alert('Failed to update asset.')
    } finally {
      setEditAssetSaving(false)
    }
  }

  async function handleDeleteAsset(id: string) {
    if (!confirm('Delete this asset?')) return
    const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' })
    if (res.ok) setAssets(prev => prev.filter(a => a.id !== id))
  }

  const invoiceNumber = invMode === 'auto'
    ? `JOYFUL${invNum}`
    : invManualId || 'INV-0001'

  function setInv(field: string, value: any) {
    setInvForm(f => ({ ...f, [field]: value }))
  }

  async function handleSearch() {
    if (!invForm.clientId) { setInvError('Please select a client.'); return }
    setInvError('')
    setSearching(true)
    try {
      const all = await fetch('/api/services').then(r => r.json())
      let filtered = all.filter((s: any) => s.clientId === invForm.clientId)
      if (invForm.periodFrom) filtered = filtered.filter((s: any) => s.serviceDate >= invForm.periodFrom)
      if (invForm.periodTo)   filtered = filtered.filter((s: any) => s.serviceDate <= invForm.periodTo + 'T23:59:59')
      if (invForm.serviceStatus !== 'all') filtered = filtered.filter((s: any) => s.status === invForm.serviceStatus)
      setResults(filtered)
      setSelected(new Set(filtered.filter((s: any) => !s.invoicedAt).map((s: any) => s.id)))
      setSearched(true)
    } catch (e) {
      setInvError('Failed to search services.')
    } finally {
      setSearching(false)
    }
  }

  function toggleSelect(id: string, isInvoiced: boolean) {
    if (isInvoiced) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(val: boolean) {
    if (val) setSelected(new Set(results.filter(s => !s.invoicedAt).map(s => s.id)))
    else setSelected(new Set())
  }

  const selectedServices = results.filter(s => selected.has(s.id))
  const subtotal       = selectedServices.reduce((sum, s) => sum + Number(s.basePrice || 0), 0)
  const additionalFees = selectedServices.reduce((sum, s) => sum + Number(s.additionalFee || 0), 0)
  const taxAmount      = (subtotal + additionalFees) * (parseFloat(invForm.taxRate) / 100)
  const total          = subtotal + additionalFees + taxAmount

  function toggleInvCol(id: string) {
    setInvVisibleCols(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function onInvDragStart(idx: number) { setInvDragIdx(idx) }
  function onInvDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setInvDropIdx(idx) }
  function onInvDrop(idx: number) {
    if (invDragIdx === null || invDragIdx === idx) { setInvDragIdx(null); setInvDropIdx(null); return }
    setInvColOrder(prev => { const n = [...prev]; const [m] = n.splice(invDragIdx, 1); n.splice(idx, 0, m); return n })
    setInvDragIdx(null); setInvDropIdx(null)
  }
  function onInvDragEnd() { setInvDragIdx(null); setInvDropIdx(null) }
  function getInvColTdClass(colId: string) {
    const base = 'px-3 py-2.5 text-xs'
    switch (colId) {
      case 'id':      return `${base} font-mono`
      case 'date':    return `${base} text-[#9ca3af]`
      case 'type':    return `${base} text-[#e8eaf0]`
      case 'unit':    return `${base} text-[#9ca3af]`
      case 'room':    return `${base} text-[#9ca3af]`
      case 'time':    return `${base} text-[#9ca3af]`
      case 'staff':   return `${base} text-[#9ca3af]`
      case 'price':   return `${base} text-[#9ca3af] font-mono`
      case 'fee':     return `${base} text-[#f59e0b] font-mono`
      case 'total':   return `${base} font-bold text-[#38d9a9] font-mono`
      case 'payment': return `${base} text-[#6b7280] capitalize`
      case 'status':  return base
      case 'notes':   return `${base} text-[#9ca3af] max-w-[140px] truncate`
      default:        return `${base} text-[#9ca3af]`
    }
  }
  function getInvCellContent(colId: string, s: any, isInvoiced: boolean): React.ReactNode {
    switch (colId) {
      case 'id':      return <>{`#${s.serviceNumber}`}{isInvoiced && <span className="ml-1 text-[9px] text-[#f59e0b]">invoiced</span>}</>
      case 'date':    return s.serviceDate ? formatDate(s.serviceDate) : '—'
      case 'type':    return s.type
      case 'unit':    return s.unit || '—'
      case 'room':    return s.roomSize || '—'
      case 'time':    return fmt12h(s.serviceTime)
      case 'staff':   return s.staff?.length > 0 ? s.staff.map((st: any) => st.user?.name?.split(' ')[0]).join(', ') : '—'
      case 'price':   return `$${Number(s.basePrice).toFixed(2)}`
      case 'fee':     return Number(s.additionalFee) > 0 ? `+$${Number(s.additionalFee).toFixed(2)}` : '—'
      case 'total':   return `$${Number(s.total).toFixed(2)}`
      case 'payment': return s.paymentMethod || '—'
      case 'status':  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: s.status === 'completed' ? 'rgba(56,217,169,0.1)' : 'rgba(245,158,11,0.1)', color: s.status === 'completed' ? '#38d9a9' : '#f59e0b' }}>{s.status?.replace('_', ' ')}</span>
      case 'notes':   return s.notes || '—'
      default:        return null
    }
  }
  function handleInvSort(colId: string) {
    if (invSortKey === colId) setInvSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setInvSortKey(colId); setInvSortDir('asc') }
  }
  function getInvSortVal(s: any, key: string): string | number {
    switch (key) {
      case 'id':      return Number(s.serviceNumber) || 0
      case 'date':    return s.serviceDate || ''
      case 'type':    return s.type || ''
      case 'unit':    return s.unit || ''
      case 'room':    return s.roomSize || ''
      case 'time':    return s.serviceTime || ''
      case 'staff':   return s.staff?.map((st: any) => st.user?.name?.split(' ')[0]).join(', ') || ''
      case 'price':   return Number(s.basePrice) || 0
      case 'fee':     return Number(s.additionalFee) || 0
      case 'total':   return Number(s.total) || 0
      case 'payment': return s.paymentMethod || ''
      case 'status':  return s.status || ''
      case 'notes':   return s.notes || ''
      default:        return ''
    }
  }
  const sortedResults = [...results].sort((a, b) => {
    const av = getInvSortVal(a, invSortKey)
    const bv = getInvSortVal(b, invSortKey)
    const dir = invSortDir === 'asc' ? 1 : -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })
  const invOrderedCols = invColOrder.map(id => INV_COL_DEFS.find(c => c.id === id)!).filter(Boolean)
  const invVisibleOrderedCols = invOrderedCols.filter(c => invVisibleCols.has(c.id))

  const previewInvoice = {
    invoiceNumber,
    client:        clients.find(c => c.id === invForm.clientId),
    periodFrom:    invForm.periodFrom,
    periodTo:      invForm.periodTo,
    issuedAt:      new Date().toISOString(),
    dueDate:       invForm.dueDate,
    paymentMethod: invForm.paymentMethod,
    status:        invForm.status,
    notes:         invForm.notes,
    subtotal, additionalFees,
    taxRate:   parseFloat(invForm.taxRate) || 0,
    taxAmount, total,
    items: selectedServices.map(s => ({
      id:          s.id,
      description: `${s.type} - ${s.client?.name} (${s.serviceDate ? formatDate(s.serviceDate) : ''})`,
      quantity:    1,
      unitPrice:   Number(s.total),
      total:       Number(s.total),
      serviceId:   s.id,
      service: {
        serviceNumber: s.serviceNumber,
        serviceDate:   s.serviceDate,
        type:          s.type,
        unit:          s.unit     || null,
        roomSize:      s.roomSize || null,
        additionalFee: s.additionalFee || 0,
      }
    }))
  }

  async function handleGenerate() {
    if (selectedServices.length === 0) { setInvError('Select at least one service.'); return }
    setGenerating(true)
    setInvError('')
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber,
          invoiceMode:   invMode,
          clientId:      invForm.clientId,
          issuedAt:      invForm.issuedAt || new Date().toLocaleDateString('en-CA'),
          periodFrom:    invForm.periodFrom || new Date().toLocaleDateString('en-CA'),
          periodTo:      invForm.periodTo   || new Date().toLocaleDateString('en-CA'),
          subtotal, additionalFees,
          taxRate:       parseFloat(invForm.taxRate) || 0,
          taxAmount, total,
          paymentMethod: invForm.paymentMethod,
          status:        invForm.status,
          dueDate:       invForm.dueDate,
          notes:         invForm.notes,
          items: selectedServices.map(s => ({
            description: `${s.type} - ${s.client?.name} (${s.serviceDate ? formatDate(s.serviceDate) : ''})`,
            quantity:    1,
            unitPrice:   Number(s.total),
            total:       Number(s.total),
            serviceId:   s.id,
          }))
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to generate invoice.')
      }
      const created = await res.json()
      loadData()
      setSearched(false)
      setResults([])
      setSelected(new Set())
      setPostGenInvoice(created)
      setPostGenOpen(true)
    } catch (e: any) {
      setInvError(e?.message || 'Failed to generate invoice.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Batch invoice generation functions ──
  async function handleBatchSearch() {
    if (!invBatchFrom || !invBatchTo) return
    setInvBatchSearching(true)
    setInvExpanded(new Set())
    setInvGeneratingFor(null)
    setInvClientForms({})
    setInvClientSelected({})
    setInvClientGenerating({})
    setInvClientErrors({})
    try {
      const params = new URLSearchParams({ from: invBatchFrom, to: invBatchTo })
      if (invBatchStatus !== 'all') params.set('status', invBatchStatus)
      const res = await fetch(`/api/invoices/clients-by-period?${params}`)
      const data = await res.json()
      setInvBatchClients(Array.isArray(data) ? data : [])
      const key = `joyful-invoice-worked-${invBatchFrom}-${invBatchTo}`
      try { setInvWorked(JSON.parse(localStorage.getItem(key) || '{}')) } catch { setInvWorked({}) }
    } catch {} finally { setInvBatchSearching(false) }
  }

  function toggleWorked(clientId: string) {
    setInvWorked(prev => {
      const next = { ...prev, [clientId]: !prev[clientId] }
      const key = `joyful-invoice-worked-${invBatchFrom}-${invBatchTo}`
      try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function toggleBatchExpand(clientId: string) {
    setInvExpanded(prev => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  function openClientGenerateForm(clientId: string, client: any, services: any[]) {
    const uninvoiced = services.filter((s: any) => !s.invoicedAt)
    const termsDays = client.paymentTermsDays != null ? client.paymentTermsDays : null
    const today = new Date().toLocaleDateString('en-CA')
    let dueDate = ''
    if (termsDays != null) {
      const d = new Date(today + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() + termsDays)
      dueDate = d.toISOString().split('T')[0]
    }
    setInvClientForms(prev => ({
      ...prev,
      [clientId]: {
        invMode: 'auto' as 'auto' | 'manual',
        invManualId: '',
        issuedAt: today,
        paymentTermsDays: termsDays != null ? String(termsDays) : '',
        dueDate,
        taxRate: client.defaultTaxRate != null ? String(client.defaultTaxRate) : '',
        paymentMethod: client.defaultPaymentMethod || '',
        status: 'draft',
        notes: '',
      }
    }))
    setInvClientSelected(prev => ({
      ...prev,
      [clientId]: new Set(uninvoiced.map((s: any) => s.id))
    }))
    setInvGeneratingFor(clientId)
  }

  function setClientFormField(clientId: string, field: string, value: any) {
    setInvClientForms(prev => ({ ...prev, [clientId]: { ...prev[clientId], [field]: value } }))
    if (field === 'paymentTermsDays' || field === 'issuedAt') {
      setInvClientForms(prev => {
        const f = prev[clientId]
        const days = field === 'paymentTermsDays' ? Number(value) : Number(f?.paymentTermsDays)
        const baseDate = field === 'issuedAt' ? value : (f?.issuedAt || new Date().toLocaleDateString('en-CA'))
        if (!isNaN(days) && baseDate) {
          const d = new Date(baseDate + 'T12:00:00Z')
          d.setUTCDate(d.getUTCDate() + days)
          return { ...prev, [clientId]: { ...prev[clientId], [field]: value, dueDate: d.toISOString().split('T')[0] } }
        }
        return prev
      })
    }
  }

  function toggleClientService(clientId: string, serviceId: string) {
    setInvClientSelected(prev => {
      const current = new Set(prev[clientId] || [])
      if (current.has(serviceId)) current.delete(serviceId)
      else current.add(serviceId)
      return { ...prev, [clientId]: current }
    })
  }

  async function handleClientGenerate(clientId: string, services: any[]) {
    const form = invClientForms[clientId]
    const selectedIds = invClientSelected[clientId] || new Set<string>()
    const selectedSvcs = services.filter((s: any) => selectedIds.has(s.id))
    if (selectedSvcs.length === 0) {
      setInvClientErrors(prev => ({ ...prev, [clientId]: 'Selecciona al menos un servicio.' }))
      return
    }
    setInvClientErrors(prev => ({ ...prev, [clientId]: '' }))
    setInvClientGenerating(prev => ({ ...prev, [clientId]: true }))
    const sub = selectedSvcs.reduce((sum: number, s: any) => sum + Number(s.basePrice || 0), 0)
    const fees = selectedSvcs.reduce((sum: number, s: any) => sum + Number(s.additionalFee || 0), 0)
    const rate = parseFloat(form.taxRate) || 0
    const tax = (sub + fees) * (rate / 100)
    const tot = sub + fees + tax
    const invNumForClient = form.invMode === 'auto' ? `JOYFUL${invNum}` : (form.invManualId || 'INV-0001')
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: invNumForClient,
          invoiceMode: form.invMode,
          clientId,
          issuedAt: form.issuedAt || new Date().toLocaleDateString('en-CA'),
          periodFrom: invBatchFrom,
          periodTo: invBatchTo,
          subtotal: sub, additionalFees: fees,
          taxRate: rate, taxAmount: tax, total: tot,
          paymentMethod: form.paymentMethod,
          status: form.status,
          dueDate: form.dueDate || null,
          notes: form.notes,
          items: selectedSvcs.map((s: any) => ({
            description: `${s.type} - ${s.client?.name || ''} (${s.serviceDate ? formatDate(s.serviceDate) : ''})`,
            quantity: 1,
            unitPrice: Number(s.total),
            total: Number(s.total),
            serviceId: s.id,
          }))
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to generate invoice.')
      }
      const created = await res.json()
      setInvGeneratingFor(null)
      setInvClientCreatedInvoices(prev => ({ ...prev, [clientId]: created }))
      toggleWorked(clientId)
      loadData()
      applyAutoInvoiceNum([...invoices, created])
      await handleBatchSearch()
    } catch (e: any) {
      setInvClientErrors(prev => ({ ...prev, [clientId]: e?.message || 'Failed to generate invoice.' }))
    } finally {
      setInvClientGenerating(prev => ({ ...prev, [clientId]: false }))
    }
  }

  async function handleClientEditSave(clientId: string) {
    const inv = invClientCreatedInvoices[clientId]
    const form = invClientEditForms[clientId]
    if (!inv || !form) return
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: form.status, notes: form.notes, dueDate: form.dueDate || null })
      })
      if (!res.ok) throw new Error('Failed to update')
      const updated = await res.json()
      setInvClientCreatedInvoices(prev => ({ ...prev, [clientId]: updated }))
      setInvClientEditing(prev => ({ ...prev, [clientId]: false }))
      loadData()
    } catch (e: any) {
      setInvClientErrors(prev => ({ ...prev, [clientId]: e?.message || 'Failed to update invoice.' }))
    }
  }

  async function handleClientQuickGenerate(clientId: string, client: any, services: any[]) {
    const selectedIds = invClientSelected[clientId] || new Set<string>()
    const selectedSvcs = services.filter((s: any) => selectedIds.has(s.id))
    if (selectedSvcs.length === 0) {
      setInvClientErrors(prev => ({ ...prev, [clientId]: 'Select at least one service.' }))
      return
    }
    setInvClientErrors(prev => ({ ...prev, [clientId]: '' }))
    setInvClientGenerating(prev => ({ ...prev, [clientId]: true }))
    const sub  = selectedSvcs.reduce((sum: number, s: any) => sum + Number(s.basePrice || 0), 0)
    const fees = selectedSvcs.reduce((sum: number, s: any) => sum + Number(s.additionalFee || 0), 0)
    const rate = client.defaultTaxRate != null ? Number(client.defaultTaxRate) : 0
    const tax  = (sub + fees) * (rate / 100)
    const tot  = sub + fees + tax
    const today = new Date().toLocaleDateString('en-CA')
    const termsDays = client.paymentTermsDays != null ? Number(client.paymentTermsDays) : null
    let dueDate = ''
    if (termsDays != null) {
      const d = new Date(today + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() + termsDays)
      dueDate = d.toISOString().split('T')[0]
    }
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: `JOYFUL${invNum}`,
          invoiceMode: 'auto',
          clientId,
          issuedAt: today,
          periodFrom: invBatchFrom,
          periodTo: invBatchTo,
          subtotal: sub, additionalFees: fees,
          taxRate: rate, taxAmount: tax, total: tot,
          paymentMethod: client.defaultPaymentMethod || null,
          status: 'draft',
          dueDate: dueDate || null,
          notes: '',
          items: selectedSvcs.map((s: any) => ({
            description: `${s.type} - ${client.name} (${s.serviceDate ? formatDate(s.serviceDate) : ''})`,
            quantity: 1,
            unitPrice: Number(s.total),
            total: Number(s.total),
            serviceId: s.id,
          }))
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to generate invoice.')
      }
      const created = await res.json()
      setInvClientCreatedInvoices(prev => ({ ...prev, [clientId]: created }))
      toggleWorked(clientId)
      loadData()
      applyAutoInvoiceNum([...invoices, created])
      await handleBatchSearch()
    } catch (e: any) {
      setInvClientErrors(prev => ({ ...prev, [clientId]: e?.message || 'Failed to generate invoice.' }))
    } finally {
      setInvClientGenerating(prev => ({ ...prev, [clientId]: false }))
    }
  }

  const _today = new Date().toISOString().split('T')[0]
  const isOverdue = (i: { status: string; dueDate?: string | null | Date }) =>
    i.status === 'overdue' || (i.status === 'sent' && !!i.dueDate && String(i.dueDate).split('T')[0] < _today)

  // Summary-tab filtered slices (respect summaryDateFrom / summaryDateTo)
  const sumCompletedSvcs = completedServices.filter(s => {
    const d = (s.serviceDate ?? '').split('T')[0]
    if (summaryDateFrom && d < summaryDateFrom) return false
    if (summaryDateTo   && d > summaryDateTo)   return false
    return true
  })
  const sumPendingSvcs = pendingServices.filter(s => {
    const d = (s.serviceDate ?? '').split('T')[0]
    if (summaryDateFrom && d < summaryDateFrom) return false
    if (summaryDateTo   && d > summaryDateTo)   return false
    return true
  })
  const sumInvoices = invoices.filter(i => {
    const d = (i.issuedAt ?? '').split('T')[0]
    if (summaryDateFrom && d < summaryDateFrom) return false
    if (summaryDateTo   && d > summaryDateTo)   return false
    return true
  })
  const sumExpenses = expenses.filter(e => {
    const d = (e.expenseDate ?? '').split('T')[0]
    if (summaryDateFrom && d < summaryDateFrom) return false
    if (summaryDateTo   && d > summaryDateTo)   return false
    return true
  })

  const completedTotal = sumCompletedSvcs.reduce((s, sv) => s + Number(sv.total || 0), 0)
  const totalInvoiced  = sumInvoices.reduce((s, i) => s + Number(i.total || 0), 0)
  const pendingToPay   = sumInvoices.filter(i => i.status === 'sent' || i.status === 'draft' || i.status === 'overdue').reduce((s, i) => s + Math.max(0, Number(i.total || 0) - Number(i.amountPaid || 0)), 0)
  const totalExpenses  = sumExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const netIncome               = totalInvoiced - pendingToPay - totalExpenses
  const notInvoicedCompleted    = sumCompletedSvcs.filter(s => !s.invoicedAt).reduce((sum, s) => sum + Number(s.total || 0), 0)
  const notInvoicedPending      = sumPendingSvcs.filter(s => !s.invoicedAt).reduce((sum, s) => sum + Number(s.total || 0), 0)
  const serviceVsInvoiceDiff    = completedTotal - totalInvoiced
  const totalCollected          = sumInvoices.reduce((s, i) => s + Number(i.amountPaid || 0), 0)
  const completedNet            = completedTotal - totalExpenses

  const sentBalance    = sumInvoices.filter(i => i.status === 'sent' && !isOverdue(i)).reduce((s, i) => s + Math.max(0, Number(i.total || 0) - Number(i.amountPaid || 0)), 0)
  const overdueBalance = sumInvoices.filter(i => isOverdue(i)).reduce((s, i) => s + Math.max(0, Number(i.total || 0) - Number(i.amountPaid || 0)), 0)

  const filteredInvoices = invoices.filter(i => {
    if (histFilter === 'pending'  && i.status !== 'sent' && i.status !== 'draft') return false
    if (histFilter === 'overdue'  && !isOverdue(i)) return false
    if (histFilter !== 'all' && histFilter !== 'pending' && histFilter !== 'overdue' && i.status !== histFilter) return false
    if (histClientFilter !== 'all' && i.clientId !== histClientFilter) return false
    if (histDateFrom && i.issuedAt?.split('T')[0] < histDateFrom) return false
    if (histDateTo   && i.issuedAt?.split('T')[0] > histDateTo)   return false
    if (histSearch) {
      const q = histSearch.toLowerCase()
      const issuedFmt = i.issuedAt ? formatDate(i.issuedAt).toLowerCase() : ''
      const paidFmt   = i.paidAt   ? formatDate(i.paidAt).toLowerCase()   : ''
      const matches =
        i.invoiceNumber?.toLowerCase().includes(q) ||
        i.client?.name?.toLowerCase().includes(q)  ||
        i.status?.toLowerCase().includes(q)        ||
        issuedFmt.includes(q)                      ||
        paidFmt.includes(q)                        ||
        String(i.total).includes(q)
      if (!matches) return false
    }
    return true
  }).sort((a, b) => {
    let av: any, bv: any
    if (histSortKey === 'invoiceNumber') { av = a.invoiceNumber; bv = b.invoiceNumber }
    else if (histSortKey === 'client')   { av = a.client?.name ?? ''; bv = b.client?.name ?? '' }
    else if (histSortKey === 'total')    { av = Number(a.total || 0); bv = Number(b.total || 0) }
    else if (histSortKey === 'paid')     { av = Number(a.amountPaid || 0); bv = Number(b.amountPaid || 0) }
    else if (histSortKey === 'balance')  { av = Math.max(0, Number(a.total||0) - Number(a.amountPaid||0)); bv = Math.max(0, Number(b.total||0) - Number(b.amountPaid||0)) }
    else if (histSortKey === 'status')   { av = a.status; bv = b.status }
    else if (histSortKey === 'paidAt')   { av = a.paidAt ?? ''; bv = b.paidAt ?? '' }
    else                                 { av = a.issuedAt ?? ''; bv = b.issuedAt ?? '' }
    if (av < bv) return histSortDir === 'asc' ? -1 : 1
    if (av > bv) return histSortDir === 'asc' ? 1 : -1
    return 0
  })
  const histTotal      = filteredInvoices.reduce((s, i) => s + Number(i.total       || 0), 0)
  const histPaid       = filteredInvoices.reduce((s, i) => s + Number(i.amountPaid  || 0), 0)
  const histBalance    = histTotal - histPaid
  const histPending    = filteredInvoices.filter(i => (i.status === 'sent' || i.status === 'draft') && !isOverdue(i)).reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.amountPaid || 0)), 0)
  const histOverdue    = filteredInvoices.filter(i => isOverdue(i)).reduce((s, i) => s + Math.max(0, Number(i.total) - Number(i.amountPaid || 0)), 0)
  const histHasFilter  = histFilter !== 'all' || histClientFilter !== 'all' || !!histDateFrom || !!histDateTo || !!histSearch

  const tabs = [
    { key: 'summary',   label: '📊 Summary'   },
    { key: 'invoices',  label: '🧾 Invoices'  },
    { key: 'estimates', label: '📋 Estimates' },
    { key: 'expenses',  label: '📦 Expenses'  },
    { key: 'inventory', label: '🗂 Inventory' },
    { key: 'assets',    label: '🏢 Assets'    },
  ]

  // ── Estimate helpers ──
  function estUpdateItem(idx: number, field: string, val: string | number) {
    setEstItems(prev => {
      const next = prev.map((item, i) => {
        if (i !== idx) return item
        const updated = { ...item, [field]: val }
        if (field === 'qty' || field === 'unitPrice') {
          updated.total = Number(updated.qty) * Number(updated.unitPrice)
        }
        return updated
      })
      return next
    })
  }

  function estAddItem() {
    setEstItems(prev => [...prev, { description: '', qty: 1, unitPrice: 0, total: 0 }])
  }

  function estRemoveItem(idx: number) {
    setEstItems(prev => prev.filter((_, i) => i !== idx))
  }

  function estLoadClients() {
    fetch('/api/clients').then(r => r.json()).then(data => {
      setEstClients(Array.isArray(data) ? data.filter((c: any) => c.status !== 'inactive') : [])
    }).catch(() => {})
  }

  function estBuildData(): EstimateData {
    const taxRate = Number(estForm.taxRate) || 0
    const subtotal = estItems.reduce((s, it) => s + Number(it.total), 0)
    const tax = subtotal * taxRate / 100
    const total = subtotal + tax
    let clientName = estForm.clientName
    let clientEmail = estForm.clientEmail
    let clientPhone = estForm.clientPhone
    let clientAddress = estForm.clientAddress
    if (estClientMode === 'registered' && estClientId) {
      const c = estClients.find(c => c.id === estClientId)
      if (c) {
        clientName = c.name
        clientEmail = c.email || ''
        clientPhone = c.phone || ''
        clientAddress = [c.address, c.city, c.state].filter(Boolean).join(', ')
      }
    }
    return {
      estimateNumber: estForm.estimateNumber,
      issueDate: estForm.issueDate,
      validUntil: estForm.validUntil,
      clientName, clientEmail, clientPhone, clientAddress,
      notes: estForm.notes,
      taxRate,
      items: estItems.map(it => ({ ...it, qty: Number(it.qty), unitPrice: Number(it.unitPrice), total: Number(it.total) })),
      subtotal, tax, total,
    }
  }

  function handlePreviewEstimate() {
    setEstPDFData(estBuildData())
    setEstPDFOpen(true)
  }

  return (
    <div className="space-y-4">
      {loadError && <ErrorBanner message={loadError} onRetry={loadData} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#e8eaf0]">Finances</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">Financial management & reporting</p>
        </div>
      </div>

      <div className="flex border-b border-[#2a2f3d] overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.key ? 'border-[#4f8ef7] text-[#4f8ef7]' : 'border-transparent text-[#6b7280] hover:text-[#e8eaf0]'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Summary Tab ── */}
      {activeTab === 'summary' && (
        <div className="space-y-4">

          {/* Date range filter */}
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider shrink-0">Period</span>
            <input
              type="date"
              value={summaryDateFrom}
              onChange={e => setSummaryDateFrom(e.target.value)}
              className="bg-[#0d0f14] border border-[#2a2f3d] rounded-lg px-2.5 py-1.5 text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors"
            />
            <span className="text-[#4b5563] text-xs font-bold">—</span>
            <input
              type="date"
              value={summaryDateTo}
              onChange={e => setSummaryDateTo(e.target.value)}
              className="bg-[#0d0f14] border border-[#2a2f3d] rounded-lg px-2.5 py-1.5 text-xs text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors"
            />
            {(summaryDateFrom || summaryDateTo) && (
              <button
                onClick={() => { setSummaryDateFrom(''); setSummaryDateTo('') }}
                className="flex items-center gap-1 text-[10px] text-[#6b7280] hover:text-[#e8eaf0] transition-colors ml-1"
              >
                <X size={11} /> Clear
              </button>
            )}
            {(summaryDateFrom || summaryDateTo) && (
              <span className="text-[10px] text-[#4f8ef7] ml-1">
                {summaryDateFrom && summaryDateTo
                  ? `${formatDate(summaryDateFrom)} – ${formatDate(summaryDateTo)}`
                  : summaryDateFrom
                    ? `From ${formatDate(summaryDateFrom)}`
                    : `Until ${formatDate(summaryDateTo)}`}
              </span>
            )}
          </div>

          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Completed Services', value: completedTotal, icon: CheckCircle,  color: '#26BD97', border: 'border-t-[#26BD97]',
                sub: [{ k: 'Invoiced', v: fmt(completedTotal - notInvoicedCompleted), sep: '+' }, { k: 'Not yet', v: fmt(notInvoicedCompleted), sep: '' }] },
              { label: 'Total Invoiced',     value: totalInvoiced,  icon: DollarSign,   color: '#4f8ef7', border: 'border-t-[#4f8ef7]',
                sub: [{ k: 'Collected', v: fmt(totalCollected), sep: '+' }, { k: 'Pending', v: fmt(pendingToPay), sep: '' }] },
              { label: 'Pending to Pay',     value: pendingToPay,   icon: TrendingUp,   color: '#f59e0b', border: 'border-t-[#f59e0b]',
                sub: [{ k: 'Sent', v: fmt(sentBalance), sep: '+' }, { k: 'Overdue', v: fmt(overdueBalance), sep: '' }] },
              { label: 'Expenses',           value: totalExpenses,  icon: TrendingDown, color: '#f87171', border: 'border-t-[#f87171]',
                sub: [{ k: `${sumExpenses.length} items`, v: '', sep: '·' }, { k: 'Recurring/mo', v: fmt(recurringTotal), sep: '' }] },
              { label: 'Net Income',         value: netIncome,      icon: TrendingUp,   color: '#a78bfa', border: 'border-t-[#a78bfa]',
                sub: [{ k: 'Collected', v: fmt(totalCollected), sep: '−' }, { k: 'Expenses', v: fmt(totalExpenses), sep: '' }] },
            ].map(card => (
              <div key={card.label} className={`bg-[#161922] border border-[#2a2f3d] border-t-2 ${card.border} rounded-xl p-4 relative overflow-hidden`}>
                <card.icon size={20} className="absolute right-3 top-3 opacity-20" style={{ color: card.color }} />
                <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{card.label}</div>
                <div className="text-2xl font-bold mt-2" style={{ color: card.color, fontFamily: 'var(--font-display)' }}>
                  <CountUp value={card.value} format={fmt} />
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#6b7280] flex-wrap">
                  {card.sub.map(s => (
                    <React.Fragment key={s.k}>
                      <span>{s.k}{s.v ? ': ' : ''}<span className="text-[#e8eaf0] font-semibold">{s.v}</span></span>
                      {s.sep && <span className="text-[#4b5563] font-bold">{s.sep}</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ── 4 nuevas tarjetas ── */}
          <div className="grid grid-cols-4 gap-3">
            {/* Card: Not Invoiced */}
            <div className="bg-[#161922] border border-[#2a2f3d] border-t-2 border-t-[#fb923c] rounded-xl p-4 relative overflow-hidden">
              <ReceiptText size={20} className="absolute right-3 top-3 opacity-20" style={{ color: '#fb923c' }} />
              <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Not Invoiced</div>
              <div className="text-2xl font-bold mt-2" style={{ color: '#fb923c', fontFamily: 'var(--font-display)' }}>
                <CountUp value={notInvoicedCompleted + notInvoicedPending} format={fmt} />
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#6b7280]">
                <span>Completed: <span className="text-[#e8eaf0] font-semibold">{fmt(notInvoicedCompleted)}</span></span>
                <span className="text-[#4b5563] font-bold">+</span>
                <span>Pending: <span className="text-[#e8eaf0] font-semibold">{fmt(notInvoicedPending)}</span></span>
              </div>
            </div>

            {/* Card: Completed vs Invoiced */}
            <div className="bg-[#161922] border border-[#2a2f3d] border-t-2 border-t-[#818cf8] rounded-xl p-4 relative overflow-hidden">
              <TrendingUp size={20} className="absolute right-3 top-3 opacity-20" style={{ color: '#818cf8' }} />
              <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Completed vs Invoiced</div>
              <div className="text-2xl font-bold mt-2" style={{ color: serviceVsInvoiceDiff >= 0 ? '#38d9a9' : '#f87171', fontFamily: 'var(--font-display)' }}>
                {serviceVsInvoiceDiff >= 0 ? '+' : ''}<CountUp value={serviceVsInvoiceDiff} format={fmt} />
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#6b7280]">
                <span>Completed: <span className="text-[#e8eaf0] font-semibold">{fmt(completedTotal)}</span></span>
                <span className="text-[#4b5563] font-bold">−</span>
                <span>Invoiced: <span className="text-[#e8eaf0] font-semibold">{fmt(totalInvoiced)}</span></span>
              </div>
            </div>

            {/* Card: Total Collected */}
            <div className="bg-[#161922] border border-[#2a2f3d] border-t-2 border-t-[#38d9a9] rounded-xl p-4 relative overflow-hidden">
              <DollarSign size={20} className="absolute right-3 top-3 opacity-20" style={{ color: '#38d9a9' }} />
              <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Total Collected</div>
              <div className="text-2xl font-bold mt-2" style={{ color: '#38d9a9', fontFamily: 'var(--font-display)' }}>
                <CountUp value={totalCollected} format={fmt} />
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#6b7280]">
                <span>Invoiced: <span className="text-[#e8eaf0] font-semibold">{fmt(totalInvoiced)}</span></span>
                <span className="text-[#4b5563] font-bold">−</span>
                <span>Pending: <span className="text-[#e8eaf0] font-semibold">{fmt(pendingToPay)}</span></span>
              </div>
            </div>

            {/* Card: Service Net */}
            <div className="bg-[#161922] border border-[#2a2f3d] border-t-2 border-t-[#2dd4bf] rounded-xl p-4 relative overflow-hidden">
              <TrendingUp size={20} className="absolute right-3 top-3 opacity-20" style={{ color: '#2dd4bf' }} />
              <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Service Net</div>
              <div className="text-2xl font-bold mt-2" style={{ color: completedNet >= 0 ? '#2dd4bf' : '#f87171', fontFamily: 'var(--font-display)' }}>
                {completedNet >= 0 ? '+' : ''}<CountUp value={completedNet} format={fmt} />
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#6b7280]">
                <span>Completed: <span className="text-[#e8eaf0] font-semibold">{fmt(completedTotal)}</span></span>
                <span className="text-[#4b5563] font-bold">−</span>
                <span>Expenses: <span className="text-[#e8eaf0] font-semibold">{fmt(totalExpenses)}</span></span>
              </div>
            </div>
          </div>

          {(() => {
            // Every unpaid status counts as pending here (draft, sent,
            // overdue, ...) — anything except paid/cancelled.
            const STATUS_RANK: Record<string, number> = { overdue: 0, sent: 1, partial: 2, draft: 3 }
            const pendingInvoices = invoices
              .filter((inv: any) => inv.status !== 'paid' && inv.status !== 'cancelled')
              .sort((a: any, b: any) => {
                const { key, dir } = sumSort
                let base = 0
                if (key === 'invoiceNumber')    base = String(a.invoiceNumber ?? '').localeCompare(String(b.invoiceNumber ?? ''))
                else if (key === 'client')      base = (a.client?.name ?? '').localeCompare(b.client?.name ?? '')
                else if (key === 'total')       base = Number(a.total) - Number(b.total)
                else if (key === 'balanceDue')  base = Number(a.balanceDue ?? a.total) - Number(b.balanceDue ?? b.total)
                else if (key === 'dueDate')     base = String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999'))
                else if (key === 'status')      base = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9)
                return base * dir
              })
            const HEADERS: { label: string; key?: SumSortKey }[] = [
              { label: 'Invoice #',   key: 'invoiceNumber' },
              { label: 'Client',      key: 'client' },
              { label: 'Total',       key: 'total' },
              { label: 'Balance Due', key: 'balanceDue' },
              { label: 'Due Date',    key: 'dueDate' },
              { label: 'Status',      key: 'status' },
              { label: '' },
            ]
            return (
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2f3d] flex items-center justify-between">
              <div className="text-xs font-bold text-[#e8eaf0] flex items-center gap-2">
                Pending Invoices
                {pendingInvoices.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[rgba(245,158,11,0.15)] text-[#f59e0b]">{pendingInvoices.length}</span>
                )}
              </div>
              <button onClick={() => setActiveTab('invoices')} className="text-[10px] text-[#4f8ef7] hover:underline">View all</button>
            </div>
            {pendingInvoices.length === 0 ? (
              <div className="text-center py-8 text-[#6b7280] text-xs">No pending invoices — everything is paid. 🎉</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-[#1e2330]">
                    {HEADERS.map(h => (
                      <th key={h.label} className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-4 py-2.5">
                        {h.key ? (
                          <button
                            onClick={() => toggleSumSort(h.key!)}
                            className={`flex items-center gap-1 uppercase tracking-wider hover:text-[#e8eaf0] transition-colors ${sumSort.key === h.key ? 'text-[#4f8ef7]' : ''}`}
                          >
                            {h.label}
                            <span className="text-[8px]">{sumSort.key === h.key ? (sumSort.dir === 1 ? '▲' : '▼') : '↕'}</span>
                          </button>
                        ) : h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pendingInvoices.slice(0, 8).map((inv: any) => {
                    const color      = INVOICE_COLORS[inv.status] || '#6b7280'
                    const balanceDue = Number(inv.balanceDue ?? inv.total)
                    const overdue    = inv.dueDate && inv.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10)
                    return (
                      <tr key={inv.id} className="border-t border-[#2a2f3d]/50 hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 text-xs text-[#4f8ef7] font-mono">{inv.invoiceNumber}</td>
                        <td className="px-4 py-2.5 text-xs text-[#e8eaf0]">{inv.client?.name}</td>
                        <td className="px-4 py-2.5 text-xs font-bold text-[#38d9a9] font-mono">{fmt(Number(inv.total))}</td>
                        <td className="px-4 py-2.5 text-xs font-bold font-mono" style={{ color: balanceDue <= 0 ? '#38d9a9' : '#f87171' }}>
                          {fmt(balanceDue)}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono" style={{ color: overdue ? '#f87171' : '#9ca3af' }}>
                          {inv.dueDate ? inv.dueDate.slice(0, 10) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                            style={{ backgroundColor: `${color}20`, color }}>{inv.status}</span>
                        </td>
                        <td className="px-4 py-2.5 flex gap-2">
                          <button onClick={() => { setPdfInvoice(inv); setPdfOpen(true) }}
                            className="text-[10px] text-[#9ca3af] hover:text-[#e8eaf0]">👁</button>
                          <button onClick={() => { setPaymentsInvoice(inv); setPaymentsOpen(true) }}
                            className="text-[10px] text-[#38d9a9] hover:underline">💰</button>
                          <button onClick={() => requestDeleteInvoice(inv)}
                            className="text-[10px] text-[#f87171] hover:text-[#ef4444]">🗑</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
            )
          })()}
        </div>
      )}

      {/* ── Invoices Tab ── */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">

          {/* Sub-tabs */}
          <div className="flex gap-2 border-b border-[#2a2f3d] pb-0">
            {[{v:'generar' as const, l:'⚡ Generate Invoices'}, {v:'historial' as const, l:'📋 History'}].map(t => (
              <button key={t.v} onClick={() => setInvSubTab(t.v)}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px ${
                  invSubTab === t.v
                    ? 'border-[#4f8ef7] text-[#4f8ef7]'
                    : 'border-transparent text-[#6b7280] hover:text-[#e8eaf0]'
                }`}>{t.l}</button>
            ))}
          </div>

          {/* ── GENERAR sub-tab ── */}
          {invSubTab === 'generar' && (
            <div className="space-y-4">

              {/* Search bar */}
              <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4">
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className={labelCls}>From</label>
                    <input type="date" value={invBatchFrom} onChange={e => setInvBatchFrom(e.target.value)} className={inputCls + ' w-36'} />
                  </div>
                  <div>
                    <label className={labelCls}>To</label>
                    <input type="date" value={invBatchTo} onChange={e => setInvBatchTo(e.target.value)} className={inputCls + ' w-36'} />
                  </div>
                  <div>
                    <label className={labelCls}>Service Status</label>
                    <select value={invBatchStatus} onChange={e => setInvBatchStatus(e.target.value)} className={inputCls + ' w-36'}>
                      <option value="all">All</option>
                      <option value="completed">Completed</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                    </select>
                  </div>
                  <button
                    onClick={handleBatchSearch}
                    disabled={!invBatchFrom || !invBatchTo || invBatchSearching}
                    className="flex items-center gap-2 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                  >
                    <Search size={13} />
                    {invBatchSearching ? 'Searching...' : 'Search Clients'}
                  </button>
                  {invBatchClients.length > 0 && (
                    <span className="text-[10px] text-[#6b7280] ml-auto">
                      {invBatchClients.length} client{invBatchClients.length !== 1 ? 's' : ''} · {invBatchClients.reduce((s, c) => s + c.uninvoicedCount, 0)} uninvoiced
                    </span>
                  )}
                  {/* Column picker — global for all client service tables */}
                  <div className="relative ml-auto">
                    <button
                      onClick={() => setBatchColsOpen(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold text-[#6b7280] hover:text-[#e8eaf0] border border-[#2a2f3d] hover:border-[#4f8ef7] rounded-lg transition-all"
                    >
                      ⚙ Columns
                    </button>
                    {batchColsOpen && (
                      <div className="absolute right-0 top-9 z-50 bg-[#1e2330] border border-[#2a2f3d] rounded-xl shadow-2xl p-3 space-y-1 min-w-[150px]">
                        <div className="text-[9px] font-bold text-[#6b7280] uppercase tracking-wider mb-2">Visible Columns</div>
                        {BATCH_SVC_COL_DEFS.map(col => (
                          <label key={col.id} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded px-1 py-0.5">
                            <input
                              type="checkbox"
                              checked={batchSvcVisibleCols.has(col.id)}
                              onChange={() => setBatchSvcVisibleCols(prev => {
                                const next = new Set(prev)
                                if (next.has(col.id)) next.delete(col.id)
                                else next.add(col.id)
                                return next
                              })}
                              className="accent-[#4f8ef7]"
                            />
                            <span className="text-[10px] text-[#9ca3af]">{col.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Empty state */}
              {!invBatchSearching && invBatchClients.length === 0 && invBatchFrom && (
                <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl flex flex-col items-center justify-center py-20 text-center">
                  <div className="text-5xl opacity-20 mb-4">🧾</div>
                  <div className="text-sm text-[#6b7280]">No clients found with services in that range.</div>
                </div>
              )}
              {!invBatchSearching && invBatchClients.length === 0 && !invBatchFrom && (
                <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl flex flex-col items-center justify-center py-20 text-center">
                  <div className="text-5xl opacity-20 mb-4">📅</div>
                  <div className="text-sm text-[#6b7280]">Select a date range and click Search Clients</div>
                </div>
              )}

              {/* Client cards */}
              {invBatchClients.map(({ client, services, totalCount, uninvoicedCount }) => {
                // A client counts as "worked" if someone manually flagged it, or if every
                // service in this range already got invoiced through any channel — including
                // the mobile app's on-the-spot invoicing flow, not just this batch screen.
                const isWorked    = !!invWorked[client.id] || (totalCount > 0 && uninvoicedCount === 0)
                const isExpanded  = invExpanded.has(client.id)
                const isGenOpen   = invGeneratingFor === client.id
                const cForm       = invClientForms[client.id]
                const cSelected   = invClientSelected[client.id] || new Set<string>()
                const cGenerating = !!invClientGenerating[client.id]
                const cError      = invClientErrors[client.id] || ''
                const createdInv  = invClientCreatedInvoices[client.id]
                const isEditing   = !!invClientEditing[client.id]
                const cEditForm   = invClientEditForms[client.id]

                const cSub   = services.filter((s: any) => cSelected.has(s.id)).reduce((sum: number, s: any) => sum + Number(s.basePrice || 0), 0)
                const cFees  = services.filter((s: any) => cSelected.has(s.id)).reduce((sum: number, s: any) => sum + Number(s.additionalFee || 0), 0)
                const cRate  = cForm
                  ? (parseFloat(cForm.taxRate) || 0)
                  : (client.defaultTaxRate != null ? Number(client.defaultTaxRate) : 0)
                const cTax   = (cSub + cFees) * (cRate / 100)
                const cTotal = cSub + cFees + cTax

                const invNumForClient = cForm?.invMode === 'auto' ? `JOYFUL${invNum}` : (cForm?.invManualId || 'INV-0001')

                return (
                  <div key={client.id} className={`border rounded-xl overflow-hidden transition-all ${isWorked ? 'border-[rgba(56,217,169,0.4)] bg-[rgba(56,217,169,0.03)]' : 'border-[#2a2f3d] bg-[#161922]'}`}>
                    {/* Card header */}
                    <div className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isWorked && <span className="text-[#38d9a9] text-xs">✓</span>}
                          <span className="text-sm font-bold text-[#e8eaf0] truncate">{client.name}</span>
                          <span className="text-[10px] text-[#6b7280] flex-shrink-0">
                            {totalCount} service{totalCount !== 1 ? 's' : ''}
                            {uninvoicedCount > 0 && <> · <span className="text-[#f59e0b]">{uninvoicedCount} uninvoiced</span></>}
                            {uninvoicedCount === 0 && totalCount > 0 && <> · <span className="text-[#38d9a9]">all invoiced</span></>}
                          </span>
                        </div>
                        {(client.defaultPaymentMethod || client.paymentTermsDays != null) && (
                          <div className="flex items-center gap-2 mt-0.5">
                            {client.paymentTermsDays != null && (
                              <span className="text-[9px] text-[#6b7280]">
                                {PAYMENT_TERMS.find(t => t.days === client.paymentTermsDays)?.label ?? `Net ${client.paymentTermsDays}`}
                              </span>
                            )}
                            {client.defaultPaymentMethod && (
                              <span className="text-[9px] text-[#6b7280] capitalize">{client.defaultPaymentMethod.replace('_', ' ')}</span>
                            )}
                            {client.defaultTaxRate != null && Number(client.defaultTaxRate) > 0 && (
                              <span className="text-[9px] text-[#6b7280]">Tax {client.defaultTaxRate}%</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleWorked(client.id)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                            isWorked
                              ? 'bg-[rgba(56,217,169,0.12)] border-[#38d9a9] text-[#38d9a9]'
                              : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:border-[#38d9a9] hover:text-[#38d9a9]'
                          }`}
                        >
                          {isWorked ? '✓ Worked' : 'Mark as Worked'}
                        </button>
                        <button
                          onClick={() => {
                            if (!invExpanded.has(client.id) && !invClientSelected[client.id]) {
                              setInvClientSelected(prev => ({
                                ...prev,
                                [client.id]: new Set(services.filter((s: any) => !s.invoicedAt && s.status !== 'cancelled').map((s: any) => s.id))
                              }))
                            }
                            toggleBatchExpand(client.id)
                          }}
                          className="px-3 py-1 rounded-lg text-[10px] font-semibold border border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0] transition-all flex items-center gap-1"
                        >
                          {isExpanded ? '▲ Hide' : '▼ View Services'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded: service table */}
                    {isExpanded && (
                      <div className="border-t border-[#2a2f3d]">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-[#1e2330]">
                                <th className="px-3 py-2 w-8" />
                                <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">#</th>
                                {batchSvcVisibleCols.has('date')    && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Date</th>}
                                {batchSvcVisibleCols.has('time')    && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Time</th>}
                                {batchSvcVisibleCols.has('type')    && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Type</th>}
                                {batchSvcVisibleCols.has('address') && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Address</th>}
                                {batchSvcVisibleCols.has('unit')    && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Unit</th>}
                                {batchSvcVisibleCols.has('room')    && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Room Size</th>}
                                {batchSvcVisibleCols.has('key')     && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Key</th>}
                                {batchSvcVisibleCols.has('base')    && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Base Price</th>}
                                {batchSvcVisibleCols.has('fee')     && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Add. Fee</th>}
                                {batchSvcVisibleCols.has('total')   && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Total</th>}
                                {batchSvcVisibleCols.has('payment') && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Payment</th>}
                                {batchSvcVisibleCols.has('status')  && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Status</th>}
                                {batchSvcVisibleCols.has('notes')   && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Notes</th>}
                                {batchSvcVisibleCols.has('invoice') && <th className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2 whitespace-nowrap">Invoice</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {services.map((s: any) => {
                                const invoiced   = !!s.invoicedAt
                                const cancelled  = s.status === 'cancelled'
                                const checked    = cSelected.has(s.id)
                                const invNum_svc = s.invoiceItems?.[0]?.invoice?.invoiceNumber ?? null
                                return (
                                  <tr key={s.id} className={`border-t border-[#2a2f3d]/50 ${invoiced || cancelled ? 'opacity-60' : ''}`}>
                                    <td className="px-3 py-2">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={invoiced || cancelled}
                                        title={cancelled ? 'Cancelled services cannot be invoiced' : undefined}
                                        onChange={() => toggleClientService(client.id, s.id)}
                                        className="accent-[#4f8ef7] disabled:opacity-30"
                                      />
                                    </td>
                                    <td className="px-3 py-2 text-[10px] font-mono">
                                      <button
                                        onClick={() => { setInvDetailService(s); setInvDetailOpen(true) }}
                                        className="text-[#4f8ef7] hover:text-[#7aaefb] hover:underline transition-colors"
                                      >
                                        #{s.serviceNumber}
                                      </button>
                                    </td>
                                    {batchSvcVisibleCols.has('date')    && <td className="px-3 py-2 text-[10px] text-[#9ca3af] whitespace-nowrap">{formatDate(s.serviceDate)}</td>}
                                    {batchSvcVisibleCols.has('time')    && <td className="px-3 py-2 text-[10px] text-[#9ca3af] whitespace-nowrap">{fmt12h(s.serviceTime)}</td>}
                                    {batchSvcVisibleCols.has('type')    && <td className="px-3 py-2 text-[10px] text-[#e8eaf0]">{s.type}</td>}
                                    {batchSvcVisibleCols.has('address') && <td className="px-3 py-2 text-[10px] text-[#9ca3af]">{s.address || '—'}</td>}
                                    {batchSvcVisibleCols.has('unit')    && <td className="px-3 py-2 text-[10px] text-[#9ca3af]">{s.unit || '—'}</td>}
                                    {batchSvcVisibleCols.has('room')    && <td className="px-3 py-2 text-[10px] text-[#9ca3af]">{s.roomSize || '—'}</td>}
                                    {batchSvcVisibleCols.has('key')     && <td className="px-3 py-2 text-[10px] text-[#9ca3af] font-mono">{s.numericKey || '—'}</td>}
                                    {batchSvcVisibleCols.has('base')    && <td className="px-3 py-2 text-[10px] text-[#9ca3af] font-mono whitespace-nowrap">${Number(s.basePrice).toFixed(2)}</td>}
                                    {batchSvcVisibleCols.has('fee')     && <td className="px-3 py-2 text-[10px] text-[#f59e0b] font-mono whitespace-nowrap">{Number(s.additionalFee) > 0 ? `+$${Number(s.additionalFee).toFixed(2)}` : '—'}</td>}
                                    {batchSvcVisibleCols.has('total')   && <td className="px-3 py-2 text-[10px] font-bold text-[#38d9a9] font-mono whitespace-nowrap">${Number(s.total).toFixed(2)}</td>}
                                    {batchSvcVisibleCols.has('payment') && <td className="px-3 py-2 text-[10px] text-[#9ca3af] capitalize">{s.paymentMethod ? s.paymentMethod.replace('_', ' ') : '—'}</td>}
                                    {batchSvcVisibleCols.has('status')  && (
                                      <td className="px-3 py-2">
                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full capitalize"
                                          style={{ backgroundColor: s.status === 'completed' ? 'rgba(56,217,169,0.12)' : s.status === 'pending' ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)',
                                            color: s.status === 'completed' ? '#38d9a9' : s.status === 'pending' ? '#f59e0b' : '#9ca3af' }}>
                                          {s.status}
                                        </span>
                                      </td>
                                    )}
                                    {batchSvcVisibleCols.has('notes')   && <td className="px-3 py-2 text-[10px] text-[#9ca3af] max-w-[160px] truncate">{s.internalNotes || s.completionNotes || '—'}</td>}
                                    {batchSvcVisibleCols.has('invoice') && (
                                      <td className="px-3 py-2 text-[10px]">
                                        {invNum_svc
                                          ? <span className="text-[#4f8ef7] font-mono font-semibold">{invNum_svc}</span>
                                          : <span className="text-[#6b7280]">—</span>
                                        }
                                      </td>
                                    )}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Inline form fields — only when Preview is open */}
                        {isGenOpen && cForm && (
                          <div className="border-t border-[#2a2f3d] bg-[#0d0f14] p-4 space-y-4">
                            <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Invoice Details · {client.name}</div>
                            {cError && (
                              <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-2">{cError}</div>
                            )}
                            {/* Invoice # */}
                            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-3 space-y-2">
                              <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Invoice #</span>
                              {cForm.invMode === 'manual' ? (
                                <input value={cForm.invManualId} onChange={e => setClientFormField(client.id, 'invManualId', e.target.value)} placeholder="e.g. INV-2026-TC-008" className="w-full text-center py-1.5 px-3 bg-[#0d0f14] rounded-lg border-2 border-[#4f8ef7] text-sm font-bold text-[#4f8ef7] focus:outline-none font-mono" />
                              ) : (
                                <div className="text-center py-1.5 px-3 bg-[#0d0f14] rounded-lg border border-[#2a2f3d]">
                                  <span className="text-sm font-bold text-[#4f8ef7] font-mono">{invNumForClient}</span>
                                </div>
                              )}
                              <div className="flex gap-2">
                                {[{v:'auto', l:'⚡ Auto'}, {v:'manual', l:'✏️ Manual'}].map(m => (
                                  <button key={m.v} onClick={() => { setClientFormField(client.id, 'invMode', m.v); if (m.v === 'auto') applyAutoInvoiceNum(invoices) }}
                                    className={`flex-1 py-1 rounded-lg text-[10px] font-semibold border transition-all ${cForm.invMode === m.v ? 'bg-[rgba(79,142,247,0.12)] border-[#4f8ef7] text-[#4f8ef7]' : 'bg-transparent border-[#2a2f3d] text-[#6b7280]'}`}>{m.l}</button>
                                ))}
                              </div>
                              {cForm.invMode === 'auto' && (
                                <div><label className={labelCls}>No.</label><input value={invNum} onChange={e => setInvNum(e.target.value)} type="number" className={inputCls + ' text-center font-mono font-bold'} /></div>
                              )}
                            </div>
                            {/* Dates + Terms */}
                            <div className="grid grid-cols-2 gap-3">
                              <div><label className={labelCls}>Issue Date</label><input type="date" value={cForm.issuedAt} onChange={e => setClientFormField(client.id, 'issuedAt', e.target.value)} className={inputCls} /></div>
                              <div>
                                <label className={labelCls}>Payment Terms</label>
                                <select value={cForm.paymentTermsDays} onChange={e => setClientFormField(client.id, 'paymentTermsDays', e.target.value)} className={inputCls}>
                                  <option value="">— None —</option>
                                  {PAYMENT_TERMS.map(t => <option key={t.days} value={t.days}>{t.label}</option>)}
                                </select>
                              </div>
                              <div><label className={labelCls}>Due Date</label><input type="date" value={cForm.dueDate} onChange={e => setClientFormField(client.id, 'dueDate', e.target.value)} className={inputCls} /></div>
                              <div><label className={labelCls}>Tax (%)</label><input type="number" value={cForm.taxRate} onChange={e => setClientFormField(client.id, 'taxRate', e.target.value)} placeholder="0" className={inputCls} /></div>
                              <div><label className={labelCls}>Payment Method</label><SelectWithAdd value={cForm.paymentMethod} onChange={v => setClientFormField(client.id, 'paymentMethod', v)} options={PAYMENT_METHODS} storageKey="paymentMethod" placeholder="— Select —" addLabel="payment method" className={inputCls} /></div>
                              <div>
                                <label className={labelCls}>Invoice Status</label>
                                <select value={cForm.status} onChange={e => setClientFormField(client.id, 'status', e.target.value)} className={inputCls}>
                                  <option value="draft">Draft</option>
                                  <option value="sent">Sent</option>
                                  <option value="paid">Paid</option>
                                  <option value="overdue">Overdue</option>
                                </select>
                              </div>
                            </div>
                            <div><label className={labelCls}>Notes</label><textarea value={cForm.notes} onChange={e => setClientFormField(client.id, 'notes', e.target.value)} rows={2} placeholder="Notes..." className={inputCls + ' resize-none'} /></div>
                          </div>
                        )}

                        {/* Persistent summary + action bar */}
                        <div className="px-4 py-3 border-t border-[#2a2f3d] flex items-center gap-3 flex-wrap">
                          {/* Totals */}
                          <div className="flex items-center gap-3 text-center">
                            <div><div className="text-base font-bold text-[#e8eaf0]">{cSelected.size}</div><div className="text-[9px] text-[#6b7280]">Selected</div></div>
                            <div className="w-px h-5 bg-[#2a2f3d]" />
                            <div><div className="text-base font-bold text-[#e8eaf0]">${cSub.toFixed(2)}</div><div className="text-[9px] text-[#6b7280]">Subtotal</div></div>
                            <div className="w-px h-5 bg-[#2a2f3d]" />
                            <div><div className="text-base font-bold text-[#f59e0b]">+${cFees.toFixed(2)}</div><div className="text-[9px] text-[#6b7280]">Add. Fees</div></div>
                            {cRate > 0 && <><div className="w-px h-5 bg-[#2a2f3d]" /><div><div className="text-base font-bold text-[#9ca3af]">${cTax.toFixed(2)}</div><div className="text-[9px] text-[#6b7280]">Tax ({cRate}%)</div></div></>}
                            <div className="w-px h-5 bg-[#2a2f3d]" />
                            <div><div className="text-lg font-bold text-[#38d9a9]">${cTotal.toFixed(2)}</div><div className="text-[9px] text-[#6b7280]">TOTAL</div></div>
                          </div>

                          {/* Post-gen invoice actions */}
                          {!isGenOpen && createdInv && !isEditing && (
                            <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-[#2a2f3d]">
                              <span className="text-[9px] text-[#6b7280] font-mono mr-1">{createdInv.invoiceNumber}</span>
                              <button onClick={() => { setPdfInvoice(createdInv); setPdfOpen(true) }} className="px-2 py-1 rounded text-[10px] border border-[#2a2f3d] text-[#9ca3af] hover:text-[#e8eaf0] hover:border-[#4f8ef7] transition-all">👁 View</button>
                              <button onClick={() => { setInvClientEditForms(prev => ({ ...prev, [client.id]: { status: createdInv.status, notes: createdInv.notes || '', dueDate: createdInv.dueDate ? String(createdInv.dueDate).split('T')[0] : '' } })); setInvClientEditing(prev => ({ ...prev, [client.id]: true })) }} className="px-2 py-1 rounded text-[10px] border border-[#2a2f3d] text-[#4f8ef7] hover:border-[#4f8ef7] transition-all">✏️ Edit</button>
                              <button onClick={() => requestDeleteInvoice(createdInv)} className="px-2 py-1 rounded text-[10px] border border-[#2a2f3d] text-[#f87171] hover:border-[#f87171] transition-all">🗑 Delete</button>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="ml-auto flex gap-2">
                            {cError && !isGenOpen && <span className="text-[10px] text-[#f87171]">{cError}</span>}
                            {!isGenOpen ? (
                              <>
                                <button
                                  onClick={() => openClientGenerateForm(client.id, client, services)}
                                  disabled={cSelected.size === 0}
                                  className="flex items-center gap-1.5 px-3 py-2 border border-[#2a2f3d] text-[#9ca3af] hover:text-[#e8eaf0] hover:border-[#4f8ef7] text-xs font-semibold rounded-lg transition-all disabled:opacity-40"
                                >
                                  👁 Preview
                                </button>
                                <button
                                  onClick={() => handleClientQuickGenerate(client.id, client, services)}
                                  disabled={cGenerating || cSelected.size === 0}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-[#38d9a9] hover:bg-[#2bc090] text-[#0d0f14] text-xs font-bold rounded-lg transition-all disabled:opacity-40"
                                >
                                  <Check size={13} />
                                  {cGenerating ? 'Generating...' : 'Generate Invoice'}
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setInvGeneratingFor(null)} className="px-3 py-2 border border-[#2a2f3d] text-[#6b7280] text-xs font-semibold rounded-lg hover:text-[#e8eaf0]">
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleClientGenerate(client.id, services)}
                                  disabled={cGenerating || cSelected.size === 0}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-[#38d9a9] hover:bg-[#2bc090] text-[#0d0f14] text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                                >
                                  <Check size={13} />
                                  {cGenerating ? 'Generating...' : 'Generate Invoice'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Inline edit form for generated invoice */}
                        {!isGenOpen && createdInv && isEditing && cEditForm && (
                          <div className="border-t border-[#2a2f3d] bg-[#0d0f14] p-3 space-y-3">
                            <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">Edit Invoice · {createdInv.invoiceNumber}</div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className={labelCls}>Status</label>
                                <select value={cEditForm.status} onChange={e => setInvClientEditForms(prev => ({ ...prev, [client.id]: { ...prev[client.id], status: e.target.value } }))} className={inputCls}>
                                  <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
                                </select>
                              </div>
                              <div><label className={labelCls}>Due Date</label><input type="date" value={cEditForm.dueDate} onChange={e => setInvClientEditForms(prev => ({ ...prev, [client.id]: { ...prev[client.id], dueDate: e.target.value } }))} className={inputCls} /></div>
                              <div><label className={labelCls}>Notes</label><input value={cEditForm.notes} onChange={e => setInvClientEditForms(prev => ({ ...prev, [client.id]: { ...prev[client.id], notes: e.target.value } }))} placeholder="Notes..." className={inputCls} /></div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setInvClientEditing(prev => ({ ...prev, [client.id]: false }))} className="px-3 py-1.5 border border-[#2a2f3d] text-[#6b7280] text-xs rounded-lg hover:text-[#e8eaf0]">Cancel</button>
                              <button onClick={() => handleClientEditSave(client.id)} className="px-3 py-1.5 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg">Save</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── HISTORIAL sub-tab ── */}
          {invSubTab === 'historial' && (
            <div className="space-y-4">

              {/* Invoice search bar */}
              <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-3">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" />
                  <input
                    value={searchQ}
                    onChange={e => { setSearchQ(e.target.value); setShowSearch(true) }}
                    onFocus={() => setShowSearch(true)}
                    placeholder="Search invoice # or client name..."
                    className="w-full pl-8 pr-7 py-2 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors"
                  />
                  {searching2 && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#6b7280]">...</div>}
                  {!searching2 && searchQ && (
                    <button type="button" onClick={() => { setSearchQ(''); setShowSearch(false) }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#e8eaf0] transition-colors">
                      <X size={12} />
                    </button>
                  )}
                </div>
                {showSearch && searchQ.length >= 2 && (
                  <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                    {searchResults.length === 0 && !searching2 ? (
                      <div className="text-center py-4 text-[#6b7280] text-xs">No results for "{searchQ}"</div>
                    ) : searchResults.map((inv: any) => {
                      const color = INVOICE_COLORS[inv.status] || '#6b7280'
                      const balanceDue = Number(inv.balanceDue ?? inv.total)
                      return (
                        <div key={inv.id} className="flex items-center justify-between p-2.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg hover:border-[#4f8ef7] transition-all">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#4f8ef7] font-mono">{inv.invoiceNumber}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${color}20`, color }}>{inv.status}</span>
                            </div>
                            <div className="text-[10px] text-[#6b7280] mt-0.5">{inv.client?.name} · {formatDate(inv.issuedAt)}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs font-bold font-mono text-[#38d9a9]">{fmt(Number(inv.total))}</div>
                              {balanceDue > 0 && balanceDue < Number(inv.total) && (
                                <div className="text-[10px] font-mono text-[#f87171]">Due: {fmt(balanceDue)}</div>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <button onClick={() => { setPdfInvoice(inv); setPdfOpen(true); setShowSearch(false) }} className="text-[10px] text-[#9ca3af] hover:text-[#e8eaf0] px-1.5 py-1 rounded bg-[#1e2330]">👁</button>
                              <button onClick={() => { setPaymentsInvoice(inv); setPaymentsOpen(true); setShowSearch(false) }} className="text-[10px] text-[#38d9a9] hover:text-[#2bc090] px-1.5 py-1 rounded bg-[#1e2330]">💰</button>
                              <button onClick={() => { requestDeleteInvoice(inv); setShowSearch(false) }} className="text-[10px] text-[#f87171] hover:text-[#ef4444] px-1.5 py-1 rounded bg-[#1e2330]">🗑</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Invoice History */}
              <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#2a2f3d] flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs font-bold text-[#e8eaf0]">📋 Invoice History</div>
                  <div className="flex gap-2 flex-wrap">
                    {[{key:'all',label:'All'},{key:'paid',label:'Paid'},{key:'pending',label:'Pending'},{key:'overdue',label:'Overdue'}].map(f => (
                      <button key={f.key} onClick={() => setHistFilter(f.key)}
                        className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-all ${histFilter === f.key ? 'bg-[rgba(79,142,247,0.12)] border-[#4f8ef7] text-[#4f8ef7]' : 'bg-transparent border-[#2a2f3d] text-[#6b7280]'}`}>{f.label}</button>
                    ))}
                  </div>
                </div>
                <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center gap-3 flex-wrap bg-[var(--surface)]">
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b7280]" />
                    <input type="text" value={histSearch} onChange={e => setHistSearch(e.target.value)} placeholder="Search invoices..."
                      className="pl-7 pr-6 py-1.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-[10px] text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors w-44" />
                    {histSearch && (
                      <button type="button" onClick={() => setHistSearch('')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#e8eaf0] transition-colors">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  <select value={histClientFilter} onChange={e => setHistClientFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-[10px] text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors">
                    <option value="all">All clients</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <div className="flex items-center gap-1.5">
                    <input type="date" value={histDateFrom} onChange={e => setHistDateFrom(e.target.value)}
                      className="px-2 py-1.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-[10px] text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
                    <span className="text-[#6b7280] text-[10px]">—</span>
                    <input type="date" value={histDateTo} onChange={e => setHistDateTo(e.target.value)}
                      className="px-2 py-1.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-[10px] text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors" />
                  </div>
                  {histHasFilter && (
                    <button onClick={() => { setHistFilter('all'); setHistClientFilter('all'); setHistDateFrom(''); setHistDateTo(''); setHistSearch('') }}
                      className="flex items-center gap-1 px-2 py-1.5 bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-[10px] font-semibold rounded-lg hover:bg-[rgba(248,113,113,0.2)] transition-all">
                      <X size={10} /> Clear
                    </button>
                  )}
                  <button onClick={() => setShowBalanceCol(v => !v)}
                    className={`flex items-center gap-1 px-2 py-1.5 border rounded-lg text-[10px] font-semibold transition-all ${showBalanceCol ? 'bg-[rgba(79,142,247,0.1)] border-[rgba(79,142,247,0.25)] text-[#4f8ef7]' : 'border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'}`}>
                    Balance
                  </button>
                  <span className="ml-auto text-[10px] text-[#6b7280]">{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}</span>
                </div>
                {filteredInvoices.length > 0 && (
                  <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-5 flex-wrap bg-[var(--surface2)]">
                    <div className="flex items-center gap-1.5"><span className="text-[10px] text-[#6b7280]">Total invoiced:</span><span className="text-[11px] font-bold text-[#e8eaf0] font-mono">{fmt(histTotal)}</span></div>
                    <div className="w-px h-4 bg-[#2a2f3d]" />
                    <div className="flex items-center gap-1.5"><span className="text-[10px] text-[#6b7280]">Collected:</span><span className="text-[11px] font-bold text-[#38d9a9] font-mono">{fmt(histPaid)}</span></div>
                    <div className="w-px h-4 bg-[#2a2f3d]" />
                    <div className="flex items-center gap-1.5"><span className="text-[10px] text-[#6b7280]">Balance due:</span><span className="text-[11px] font-bold font-mono" style={{ color: histBalance > 0 ? '#f87171' : '#38d9a9' }}>{fmt(histBalance)}</span></div>
                    <div className="w-px h-4 bg-[#2a2f3d]" />
                    <div className="flex items-center gap-1.5"><span className="text-[10px] text-[#6b7280]">Pending to pay:</span><span className="text-[11px] font-bold font-mono" style={{ color: histPending > 0 ? '#f59e0b' : '#6b7280' }}>{fmt(histPending)}</span></div>
                    <div className="w-px h-4 bg-[#2a2f3d]" />
                    <div className="flex items-center gap-1.5"><span className="text-[10px] text-[#6b7280]">Overdue balance:</span><span className="text-[11px] font-bold font-mono" style={{ color: histOverdue > 0 ? '#f87171' : '#6b7280' }}>{fmt(histOverdue)}</span></div>
                  </div>
                )}
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#1e2330] border-b border-[#2a2f3d]">
                      {[
                        { label: 'Invoice #', key: 'invoiceNumber' },
                        { label: 'Client',    key: 'client' },
                        { label: 'Period',    key: null },
                        { label: 'Total',     key: 'total' },
                        { label: 'Paid',      key: 'paid' },
                        ...(showBalanceCol ? [{ label: 'Balance', key: 'balance' }] : []),
                        { label: 'Status',    key: 'status' },
                        { label: 'Issued',    key: 'issuedAt' },
                        { label: 'Paid On',   key: 'paidAt' },
                        { label: '',          key: null },
                      ].map(({ label, key }) => (
                        <th key={label}
                          onClick={key ? () => { if (histSortKey === key) setHistSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setHistSortKey(key); setHistSortDir('asc') } } : undefined}
                          className={`text-left text-[10px] font-bold uppercase tracking-wider px-4 py-2.5 select-none ${key ? 'cursor-pointer hover:text-[#e8eaf0] transition-colors' : ''} ${histSortKey === key ? 'text-[#4f8ef7]' : 'text-[#6b7280]'}`}>
                          {label}{key && histSortKey === key ? (histSortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length === 0 ? (
                      <tr><td colSpan={showBalanceCol ? 10 : 9} className="text-center py-8 text-[#6b7280] text-xs">No invoices yet.</td></tr>
                    ) : filteredInvoices.map((inv: any) => {
                      const color = INVOICE_COLORS[inv.status] || '#6b7280'
                      const amountPaid = Number(inv.amountPaid || 0)
                      const balanceDue = Math.max(0, Number(inv.total || 0) - amountPaid)
                      return (
                        <tr key={inv.id} className="border-t border-[#2a2f3d]/50 hover:bg-white/[0.02]">
                          <td className="px-4 py-2.5 text-xs text-[#4f8ef7] font-mono">{inv.invoiceNumber}</td>
                          <td className="px-4 py-2.5 text-xs text-[#e8eaf0]">{inv.client?.name}</td>
                          <td className="px-4 py-2.5 text-xs text-[#6b7280]">{formatDate(inv.periodFrom)} — {formatDate(inv.periodTo)}</td>
                          <td className="px-4 py-2.5 text-xs font-bold text-[#e8eaf0] font-mono">{fmt(Number(inv.total))}</td>
                          <td className="px-4 py-2.5 text-xs font-bold text-[#38d9a9] font-mono">{fmt(amountPaid)}</td>
                          {showBalanceCol && (
                            <td className="px-4 py-2.5 text-xs font-bold font-mono" style={{ color: balanceDue <= 0 ? '#38d9a9' : '#f87171' }}>{fmt(balanceDue)}</td>
                          )}
                          <td className="px-4 py-2.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: `${color}20`, color }}>{inv.status}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-[#6b7280]">{formatDate(inv.issuedAt)}</td>
                          <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: inv.paidAt ? '#38d9a9' : '#6b7280' }}>{formatDate(inv.paidAt)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1.5">
                              <button onClick={() => { setPdfInvoice(inv); setPdfOpen(true) }} className="text-[10px] text-[#9ca3af] hover:text-[#e8eaf0] px-1.5 py-1 rounded bg-[#1e2330]" title="Preview">👁</button>
                              <button onClick={() => { setPaymentsInvoice(inv); setPaymentsOpen(true) }} className="text-[10px] text-[#38d9a9] hover:text-[#2bc090] px-1.5 py-1 rounded bg-[#1e2330]" title="Payments">💰</button>
                              <button onClick={() => { setSelectedInvoice(inv); setDetailOpen(true) }} className="text-[10px] text-[#4f8ef7] hover:underline px-1.5 py-1 rounded bg-[#1e2330]" title="Edit">✏️</button>
                              <button onClick={() => requestDeleteInvoice(inv)} className="text-[10px] text-[#f87171] hover:text-[#ef4444] px-1.5 py-1 rounded bg-[#1e2330] hover:bg-[rgba(248,113,113,0.1)]" title="Delete">🗑</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Expenses Tab ── */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">

          {/* Date Range Filter */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider whitespace-nowrap">Date Range</span>
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <input
                type="date"
                value={expDateFrom}
                onChange={e => setExpDateFrom(e.target.value)}
                className="px-2.5 py-1.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-[10px] text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors"
              />
              <span className="text-[#6b7280] text-xs">—</span>
              <input
                type="date"
                value={expDateTo}
                onChange={e => setExpDateTo(e.target.value)}
                className="px-2.5 py-1.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-[10px] text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7] transition-colors"
              />
              {hasDateFilter && (
                <button
                  onClick={() => { setExpDateFrom(''); setExpDateTo('') }}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-[10px] font-semibold rounded-lg hover:bg-[rgba(248,113,113,0.2)] transition-all">
                  <X size={10} /> Clear
                </button>
              )}
            </div>
            {hasDateFilter && (
              <span className="text-[10px] text-[#4f8ef7] font-semibold">
                {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''} in range
              </span>
            )}
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                label: hasDateFilter ? 'Period Expenses' : 'Total Expenses',
                value: fmt(filteredTotal),
                icon: TrendingDown, color: '#f87171', border: 'border-t-[#f87171]', filtered: true,
              },
              {
                label: 'Top Category',
                value: filteredTopCategory,
                icon: ChevronDown, color: '#f59e0b', border: 'border-t-[#f59e0b]', filtered: true,
              },
              {
                label: 'Recurring Total',
                value: fmt(recurringTotal),
                icon: RefreshCw, color: '#9ca3af', border: 'border-t-[#9ca3af]', filtered: false,
              },
              {
                label: 'With Receipt',
                value: `${filteredWithReceipt} / ${filteredExpenses.length}`,
                icon: ReceiptText, color: '#38d9a9', border: 'border-t-[#38d9a9]', filtered: true,
              },
            ].map(card => (
              <div key={card.label} className={`bg-[#161922] border border-[#2a2f3d] border-t-2 ${card.border} rounded-xl p-4 relative overflow-hidden`}>
                <card.icon size={20} className="absolute right-3 top-3 opacity-20" style={{ color: card.color }} />
                <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{card.label}</div>
                <div className="text-xl font-bold mt-2 font-mono" style={{ color: card.color }}>{card.value}</div>
                {hasDateFilter && card.filtered && (
                  <div className="text-[9px] text-[#6b7280] mt-1">
                    {expDateFrom && expDateTo
                      ? `${expDateFrom} → ${expDateTo}`
                      : expDateFrom ? `From ${expDateFrom}` : `Until ${expDateTo}`}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Recurring Expenses */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2f3d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw size={13} className="text-[#4f8ef7]" />
                <span className="text-xs font-bold text-[#e8eaf0]">Recurring Expenses</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-[#1e2330] border border-[#2a2f3d] rounded text-[#6b7280]">{recurring.length}</span>
              </div>
              <div className="flex items-center gap-2">
                {syncRecurringMsg && (
                  <span className="text-[10px] text-[#38d9a9] font-semibold">{syncRecurringMsg}</span>
                )}
                <button
                  onClick={syncRecurringExpenses}
                  disabled={syncingRecurring}
                  title="Register all pending recurring expenses"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(56,217,169,0.1)] border border-[#38d9a9] text-[#38d9a9] text-[10px] font-semibold rounded-lg hover:bg-[rgba(56,217,169,0.18)] transition-all disabled:opacity-50"
                >
                  <RefreshCw size={11} className={syncingRecurring ? 'animate-spin' : ''} />
                  {syncingRecurring ? 'Syncing…' : 'Sync Now'}
                </button>
                <button onClick={() => setAddRecOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(79,142,247,0.12)] border border-[#4f8ef7] text-[#4f8ef7] text-[10px] font-semibold rounded-lg hover:bg-[rgba(79,142,247,0.2)] transition-all">
                  <Plus size={11} /> Add Recurring
                </button>
              </div>
            </div>
            {recurring.length === 0 ? (
              <div className="text-center py-8 text-[#6b7280] text-xs">No recurring expenses configured.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-[#1e2330]">
                    {['Name', 'Category', 'Amount', 'Frequency', 'Payment', 'Next Due', 'Auto', ''].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recurring.map((rec: any) => (
                    <tr key={rec.id} className="border-t border-[#2a2f3d]/50 hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-xs text-[#e8eaf0] font-semibold">{rec.name}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(79,142,247,0.1)] text-[#4f8ef7]">{rec.category}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-bold text-[#f87171] font-mono">{fmt(Number(rec.amount))}</td>
                      <td className="px-4 py-2.5 text-xs text-[#9ca3af] capitalize">{rec.frequency}</td>
                      <td className="px-4 py-2.5 text-xs text-[#6b7280] capitalize">{rec.paymentMethod ? rec.paymentMethod.replace(/_/g, ' ') : '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-[#9ca3af]">{rec.nextDueAt ? formatDate(rec.nextDueAt) : '—'}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => toggleAutoRegister(rec)}
                          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${rec.autoRegister ? 'bg-[#38d9a9]' : 'bg-[#2a2f3d]'}`}>
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${rec.autoRegister ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => openEditRecurring(rec)}
                            className="text-[10px] text-[#4f8ef7] hover:text-[#3a7ee0] px-1.5 py-1 rounded bg-[#1e2330]">✏️</button>
                          <button onClick={() => handleDeactivateRecurring(rec.id)}
                            className="text-[10px] text-[#f87171] hover:text-[#ef4444] px-1.5 py-1 rounded bg-[#1e2330]">🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* One-time Expenses Log */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2f3d] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#e8eaf0]">Expense Log</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-[#1e2330] border border-[#2a2f3d] rounded text-[#6b7280]">{filteredExpenses.length}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b7280]" />
                  <input value={expSearch} onChange={e => setExpSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-7 pr-6 py-1.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-[10px] text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] w-36 transition-colors" />
                  {expSearch && (
                    <button type="button" onClick={() => setExpSearch('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#e8eaf0] transition-colors">
                      <X size={11} />
                    </button>
                  )}
                </div>
                {/* Category filter */}
                <select value={expCatFilter} onChange={e => setExpCatFilter(e.target.value)}
                  className="px-2 py-1.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-[10px] text-[#9ca3af] focus:outline-none focus:border-[#4f8ef7] transition-colors">
                  <option value="all">All Categories</option>
                  {EXP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {/* Receipt filter */}
                <select value={expReceiptFilter} onChange={e => setExpReceiptFilter(e.target.value)}
                  className="px-2 py-1.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-[10px] text-[#9ca3af] focus:outline-none focus:border-[#4f8ef7] transition-colors">
                  <option value="all">All Receipts</option>
                  <option value="yes">With Receipt</option>
                  <option value="no">No Receipt</option>
                </select>
                <button onClick={() => setAddExpOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f87171] hover:bg-[#ef4444] text-white text-[10px] font-semibold rounded-lg transition-all">
                  <Plus size={11} /> Add Expense
                </button>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#1e2330]">
                  {['#', 'Date', 'Description', 'Category', 'Provider', 'Payment', 'Amount', 'Receipt', ''].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-[#6b7280] text-xs">No expenses found.</td></tr>
                ) : filteredExpenses.map((exp: any) => (
                  <tr key={exp.id} className="border-t border-[#2a2f3d]/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-[10px] text-[#6b7280] font-mono">#{exp.expenseNumber}</td>
                    <td className="px-4 py-2.5 text-xs text-[#9ca3af]">{formatDate(exp.expenseDate)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#e8eaf0] max-w-[180px] truncate">{exp.description}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(79,142,247,0.1)] text-[#4f8ef7]">{exp.category || '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#6b7280]">{exp.supplier || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-[#6b7280] capitalize">{exp.paymentMethod ? exp.paymentMethod.replace(/_/g, ' ') : '—'}</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-[#f87171] font-mono">-{fmt(Number(exp.amount))}</td>
                    <td className="px-4 py-2.5">
                      {exp.receiptUrl
                        ? <a href={exp.receiptUrl} target="_blank" rel="noreferrer"
                            className="text-[10px] text-[#38d9a9] hover:underline flex items-center gap-1">
                            <ReceiptText size={11} /> View
                          </a>
                        : <span className="text-[10px] text-[#6b7280]">—</span>
                      }
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => openEditExpense(exp)}
                          className="text-[10px] text-[#4f8ef7] hover:text-[#3a7ee0] px-1.5 py-1 rounded bg-[#1e2330]">✏️</button>
                        <button onClick={() => handleDeleteExpense(exp.id)}
                          className="text-[10px] text-[#f87171] hover:text-[#ef4444] px-1.5 py-1 rounded bg-[#1e2330]">🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Add Expense Modal ── */}
          {addExpOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2f3d]">
                  <div className="text-sm font-bold text-[#e8eaf0]">Add Expense</div>
                  <button onClick={() => { setAddExpOpen(false); setAddExpError('') }}
                    className="text-[#6b7280] hover:text-[#e8eaf0] transition-colors"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-3">
                  {addExpError && (
                    <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-2.5">{addExpError}</div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Date <span className="text-[#f87171]">*</span></label>
                      <input type="date" value={addExpForm.expenseDate} onChange={e => setAddExpForm(f => ({ ...f, expenseDate: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Amount <span className="text-[#f87171]">*</span></label>
                      <input type="number" step="0.01" value={addExpForm.amount} onChange={e => setAddExpForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Description <span className="text-[#f87171]">*</span></label>
                    <input value={addExpForm.description} onChange={e => setAddExpForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Office supplies" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Category</label>
                      <select value={addExpForm.category} onChange={e => setAddExpForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                        {EXP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Payment Method</label>
                      <SelectWithAdd value={addExpForm.paymentMethod} onChange={v => setAddExpForm(f => ({ ...f, paymentMethod: v }))} options={PAYMENT_METHODS} storageKey="paymentMethod" addLabel="payment method" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Provider / Supplier</label>
                    <input value={addExpForm.supplier} onChange={e => setAddExpForm(f => ({ ...f, supplier: e.target.value }))} placeholder="e.g. Home Depot" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Receipt URL</label>
                    <input value={addExpForm.receiptUrl} onChange={e => setAddExpForm(f => ({ ...f, receiptUrl: e.target.value }))} placeholder="https://..." className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea value={addExpForm.notes} onChange={e => setAddExpForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls + ' resize-none'} />
                  </div>
                </div>
                <div className="flex gap-3 px-5 pb-5">
                  <button onClick={() => { setAddExpOpen(false); setAddExpError('') }}
                    className="flex-1 py-2 bg-[#1e2330] border border-[#2a2f3d] text-[#9ca3af] text-xs font-semibold rounded-lg hover:text-[#e8eaf0] transition-all">Cancel</button>
                  <button onClick={handleAddExpense} disabled={addExpSaving}
                    className="flex-1 py-2 bg-[#f87171] hover:bg-[#ef4444] text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50">
                    {addExpSaving ? 'Saving...' : 'Save Expense'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Edit Expense Modal ── */}
          {editExpOpen && editExpTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2f3d]">
                  <div className="text-sm font-bold text-[#e8eaf0]">Edit Expense #{editExpTarget.expenseNumber}</div>
                  <button onClick={() => setEditExpOpen(false)} className="text-[#6b7280] hover:text-[#e8eaf0] transition-colors"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Date</label>
                      <input type="date" value={editExpForm.expenseDate} onChange={e => setEditExpForm(f => ({ ...f, expenseDate: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Amount</label>
                      <input type="number" step="0.01" value={editExpForm.amount} onChange={e => setEditExpForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <input value={editExpForm.description} onChange={e => setEditExpForm(f => ({ ...f, description: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Category</label>
                      <select value={editExpForm.category} onChange={e => setEditExpForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                        {EXP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Payment Method</label>
                      <SelectWithAdd value={editExpForm.paymentMethod} onChange={v => setEditExpForm(f => ({ ...f, paymentMethod: v }))} options={PAYMENT_METHODS} storageKey="paymentMethod" addLabel="payment method" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Provider / Supplier</label>
                    <input value={editExpForm.supplier} onChange={e => setEditExpForm(f => ({ ...f, supplier: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Receipt URL</label>
                    <input value={editExpForm.receiptUrl} onChange={e => setEditExpForm(f => ({ ...f, receiptUrl: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea value={editExpForm.notes} onChange={e => setEditExpForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls + ' resize-none'} />
                  </div>
                </div>
                <div className="flex gap-3 px-5 pb-5">
                  <button onClick={() => setEditExpOpen(false)}
                    className="flex-1 py-2 bg-[#1e2330] border border-[#2a2f3d] text-[#9ca3af] text-xs font-semibold rounded-lg hover:text-[#e8eaf0] transition-all">Cancel</button>
                  <button onClick={handleEditExpense} disabled={editExpSaving}
                    className="flex-1 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50">
                    {editExpSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Edit Recurring Modal ── */}
          {editRecOpen && editRecTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2f3d]">
                  <div className="text-sm font-bold text-[#e8eaf0]">Edit Recurring Expense</div>
                  <button onClick={() => setEditRecOpen(false)} className="text-[#6b7280] hover:text-[#e8eaf0] transition-colors"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <label className={labelCls}>Name</label>
                    <input value={editRecForm.name} onChange={e => setEditRecForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Category</label>
                      <select value={editRecForm.category} onChange={e => setEditRecForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                        {EXP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Amount</label>
                      <input type="number" step="0.01" value={editRecForm.amount} onChange={e => setEditRecForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Frequency</label>
                      <select value={editRecForm.frequency} onChange={e => setEditRecForm(f => ({ ...f, frequency: e.target.value }))} className={inputCls}>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annual">Annual</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Day of Month</label>
                      <input type="number" min="1" max="31" value={editRecForm.dayOfMonth} onChange={e => setEditRecForm(f => ({ ...f, dayOfMonth: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Payment Method</label>
                      <SelectWithAdd value={editRecForm.paymentMethod} onChange={v => setEditRecForm(f => ({ ...f, paymentMethod: v }))} options={PAYMENT_METHODS} storageKey="paymentMethod" addLabel="payment method" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Start Date</label>
                      <input type="date" value={editRecForm.startDate} onChange={e => setEditRecForm(f => ({ ...f, startDate: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg">
                    <span className="text-xs text-[#e8eaf0]">Auto-register expenses</span>
                    <button onClick={() => setEditRecForm(f => ({ ...f, autoRegister: !f.autoRegister }))}
                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${editRecForm.autoRegister ? 'bg-[#38d9a9]' : 'bg-[#2a2f3d]'}`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${editRecForm.autoRegister ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea value={editRecForm.notes} onChange={e => setEditRecForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls + ' resize-none'} />
                  </div>
                </div>
                <div className="flex gap-3 px-5 pb-5">
                  <button onClick={() => setEditRecOpen(false)}
                    className="flex-1 py-2 bg-[#1e2330] border border-[#2a2f3d] text-[#9ca3af] text-xs font-semibold rounded-lg hover:text-[#e8eaf0] transition-all">Cancel</button>
                  <button onClick={handleEditRecurring} disabled={editRecSaving}
                    className="flex-1 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50">
                    {editRecSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Add Recurring Modal ── */}
          {addRecOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2f3d]">
                  <div className="text-sm font-bold text-[#e8eaf0]">Add Recurring Expense</div>
                  <button onClick={() => { setAddRecOpen(false); setAddRecError('') }}
                    className="text-[#6b7280] hover:text-[#e8eaf0] transition-colors"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-3">
                  {addRecError && (
                    <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-2.5">{addRecError}</div>
                  )}
                  <div>
                    <label className={labelCls}>Name <span className="text-[#f87171]">*</span></label>
                    <input value={addRecForm.name} onChange={e => setAddRecForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Software subscription" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Category</label>
                      <select value={addRecForm.category} onChange={e => setAddRecForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                        {EXP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Amount <span className="text-[#f87171]">*</span></label>
                      <input type="number" step="0.01" value={addRecForm.amount} onChange={e => setAddRecForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Frequency</label>
                      <select value={addRecForm.frequency} onChange={e => setAddRecForm(f => ({ ...f, frequency: e.target.value }))} className={inputCls}>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="annual">Annual</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Day of Month</label>
                      <input type="number" min="1" max="31" value={addRecForm.dayOfMonth} onChange={e => setAddRecForm(f => ({ ...f, dayOfMonth: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Payment Method</label>
                      <SelectWithAdd value={addRecForm.paymentMethod} onChange={v => setAddRecForm(f => ({ ...f, paymentMethod: v }))} options={PAYMENT_METHODS} storageKey="paymentMethod" addLabel="payment method" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Start Date <span className="text-[#f87171]">*</span></label>
                      <input type="date" value={addRecForm.startDate} onChange={e => setAddRecForm(f => ({ ...f, startDate: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg">
                    <span className="text-xs text-[#e8eaf0]">Auto-register expenses</span>
                    <button onClick={() => setAddRecForm(f => ({ ...f, autoRegister: !f.autoRegister }))}
                      className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${addRecForm.autoRegister ? 'bg-[#38d9a9]' : 'bg-[#2a2f3d]'}`}>
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${addRecForm.autoRegister ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea value={addRecForm.notes} onChange={e => setAddRecForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={inputCls + ' resize-none'} />
                  </div>
                </div>
                <div className="flex gap-3 px-5 pb-5">
                  <button onClick={() => { setAddRecOpen(false); setAddRecError('') }}
                    className="flex-1 py-2 bg-[#1e2330] border border-[#2a2f3d] text-[#9ca3af] text-xs font-semibold rounded-lg hover:text-[#e8eaf0] transition-all">Cancel</button>
                  <button onClick={handleAddRecurring} disabled={addRecSaving}
                    className="flex-1 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50">
                    {addRecSaving ? 'Saving...' : 'Save Recurring'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Products',   value: String(totalProducts),        color: '#4f8ef7', border: 'border-t-[#4f8ef7]' },
              { label: 'Low Stock',        value: String(lowStockCount),         color: '#f87171', border: 'border-t-[#f87171]' },
              { label: 'Inventory Value',  value: fmt(totalInvValue),            color: '#38d9a9', border: 'border-t-[#38d9a9]' },
              { label: 'Categories',       value: String(INV_CATEGORIES.length), color: '#f59e0b', border: 'border-t-[#f59e0b]' },
            ].map(card => (
              <div key={card.label} className={`bg-[#161922] border border-[#2a2f3d] border-t-2 ${card.border} rounded-xl p-4 relative overflow-hidden`}>
                <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{card.label}</div>
                <div className="text-2xl font-bold mt-2" style={{ color: card.color, fontFamily: 'var(--font-display)' }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Filters + Add button */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search size={13} className="text-[#6b7280] shrink-0" />
              <input
                type="text" placeholder="Search by name, SKU, supplier…"
                value={invSearchQ} onChange={e => setInvSearchQ(e.target.value)}
                className="bg-transparent text-xs text-[#e8eaf0] placeholder-[#6b7280] outline-none flex-1"
              />
              {invSearchQ && (
                <button type="button" onClick={() => setInvSearchQ('')}
                  className="text-[#6b7280] hover:text-[#e8eaf0] transition-colors shrink-0">
                  <X size={12} />
                </button>
              )}
            </div>
            <select value={invCatFilter} onChange={e => setInvCatFilter(e.target.value)}
              className="bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] px-2 py-1.5 outline-none">
              <option value="all">All Categories</option>
              {INV_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => setInvLowStock(v => !v)}
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full border transition-colors ${
                invLowStock
                  ? 'bg-[rgba(248,113,113,0.15)] border-[#f87171] text-[#f87171]'
                  : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'
              }`}>
              ⚠ Low Stock {lowStockCount > 0 && `(${lowStockCount})`}
            </button>
            <button onClick={() => openMovementModal()}
              className="ml-auto flex items-center gap-1.5 bg-[#f59e0b] hover:bg-[#d97706] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors">
              ↓↑ Stock In/Out
            </button>
            <button onClick={() => setMovHistoryOpen(v => !v)}
              className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                movHistoryOpen
                  ? 'bg-[rgba(79,142,247,0.15)] border-[#4f8ef7] text-[#4f8ef7]'
                  : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'
              }`}>
              🕘 History {invMovements.length > 0 && `(${invMovements.length})`}
            </button>
            <button onClick={() => setAddProdOpen(true)}
              className="flex items-center gap-1.5 bg-[#4f8ef7] hover:bg-[#3a7de8] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors">
              <Plus size={12} /> Add Product
            </button>
          </div>

          {/* Table */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1e2330]">
                  {['SKU', 'Product', 'Category', 'Unit', 'Stock', 'Min.', 'Unit Cost', 'Total Value', 'Supplier', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-[#6b7280] text-xs">
                      {inventory.length === 0 ? 'No products yet. Add your first product.' : 'No products match the filters.'}
                    </td>
                  </tr>
                ) : filteredInventory.map(prod => {
                  const isLow = prod.currentStock < prod.minimumStock
                  const totalVal = Number(prod.unitCost) * prod.currentStock
                  const catEmoji: Record<string, string> = { Chemicals: '🧴', Equipment: '🧰', PPE: '🧤', Accessories: '🧹' }
                  return (
                    <tr key={prod.id} className="border-t border-[#2a2f3d]/50 hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-mono text-[#4f8ef7]">{prod.sku}</td>
                      <td className="px-3 py-2.5 font-semibold text-[#e8eaf0]">{prod.name}</td>
                      <td className="px-3 py-2.5 text-[#9ca3af]">{catEmoji[prod.category] || '📦'} {prod.category}</td>
                      <td className="px-3 py-2.5 text-[#9ca3af]">{prod.unitOfMeasure}</td>
                      <td className="px-3 py-2.5 font-bold" style={{ color: isLow ? '#f87171' : '#38d9a9' }}>{prod.currentStock}</td>
                      <td className="px-3 py-2.5 text-[#6b7280]">{prod.minimumStock}</td>
                      <td className="px-3 py-2.5 font-mono text-[#e8eaf0]">{fmt(Number(prod.unitCost))}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-[#38d9a9]">{fmt(totalVal)}</td>
                      <td className="px-3 py-2.5 text-[#9ca3af]">{prod.supplier || '—'}</td>
                      <td className="px-3 py-2.5">
                        {isLow ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(248,113,113,0.15)] text-[#f87171]">⚠ Low Stock</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(56,217,169,0.15)] text-[#38d9a9]">✓ Normal</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 flex items-center gap-2">
                        <button onClick={() => openMovementModal(prod, 'out')}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[rgba(245,158,11,0.15)] text-[#f59e0b] hover:bg-[rgba(245,158,11,0.25)] transition-colors"
                          title="Register usage (stock out)">
                          − Use
                        </button>
                        <button onClick={() => openEditProduct(prod)} className="text-[#9ca3af] hover:text-[#e8eaf0] transition-colors" title="Edit">✏️</button>
                        {isLow && (
                          <button onClick={() => openEditProduct(prod)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[rgba(79,142,247,0.15)] text-[#4f8ef7] hover:bg-[rgba(79,142,247,0.25)] transition-colors">
                            Reorder
                          </button>
                        )}
                        <button onClick={() => handleDeleteProduct(prod.id)} className="text-[#f87171] hover:text-[#ef4444] transition-colors" title="Delete">🗑</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Movement History */}
          {movHistoryOpen && (
            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2f3d] flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#e8eaf0]">🕘 Stock Movement History</h3>
                <span className="text-[10px] text-[#6b7280]">{invMovements.length} movements</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#1e2330]">
                    {['Date', 'Product', 'Type', 'Qty', 'Comment', 'By'].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invMovements.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-[#6b7280] text-xs">No movements registered yet.</td></tr>
                  ) : invMovements.map(m => (
                    <tr key={m.id} className="border-t border-[#2a2f3d]/50 hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-[#9ca3af] whitespace-nowrap">{formatDate(m.date)}</td>
                      <td className="px-3 py-2 font-semibold text-[#e8eaf0]">{m.productName} <span className="text-[#6b7280] font-mono font-normal">({m.sku})</span></td>
                      <td className="px-3 py-2">
                        {m.type === 'out' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(245,158,11,0.15)] text-[#f59e0b]">↓ Out</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(56,217,169,0.15)] text-[#38d9a9]">↑ In</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-bold font-mono" style={{ color: m.type === 'out' ? '#f59e0b' : '#38d9a9' }}>
                        {m.type === 'out' ? '−' : '+'}{m.quantity} <span className="font-normal text-[#6b7280]">{m.unitOfMeasure}</span>
                      </td>
                      <td className="px-3 py-2 text-[#9ca3af]">{m.comment || '—'}</td>
                      <td className="px-3 py-2 text-[#6b7280]">{m.createdBy || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Stock Movement Modal */}
          {movModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setMovModalOpen(false)}>
              <div className="bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#e8eaf0]">{movForm.type === 'out' ? '↓ Register Usage' : '↑ Register Restock'}</h3>
                  <button onClick={() => setMovModalOpen(false)} className="text-[#6b7280] hover:text-[#e8eaf0]"><X size={16} /></button>
                </div>
                {movError && <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">{movError}</div>}
                <div className="flex gap-2">
                  {([['out', '↓ Out (use)'], ['in', '↑ In (restock)']] as const).map(([t, label]) => (
                    <button key={t} onClick={() => setMovForm(f => ({ ...f, type: t }))}
                      className={`flex-1 text-[11px] font-bold px-3 py-2 rounded-lg border transition-colors ${
                        movForm.type === t
                          ? t === 'out'
                            ? 'bg-[rgba(245,158,11,0.15)] border-[#f59e0b] text-[#f59e0b]'
                            : 'bg-[rgba(56,217,169,0.15)] border-[#38d9a9] text-[#38d9a9]'
                          : 'bg-transparent border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className={labelCls}>Product *</label>
                  <select className={inputCls} value={movForm.productId} onChange={e => setMovForm(f => ({ ...f, productId: e.target.value }))}>
                    <option value="">— Select product —</option>
                    {inventory.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.currentStock} {p.unitOfMeasure} available)</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Quantity *</label>
                    <input type="number" min="1" className={inputCls} value={movForm.quantity}
                      onChange={e => setMovForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelCls}>Date</label>
                    <input type="date" className={inputCls} value={movForm.date}
                      onChange={e => setMovForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Comment</label>
                  <input className={inputCls} value={movForm.comment}
                    onChange={e => setMovForm(f => ({ ...f, comment: e.target.value }))}
                    placeholder={movForm.type === 'out' ? 'e.g. Used at Franklin Cleaning job' : 'e.g. Walmart purchase'} />
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setMovModalOpen(false)}
                    className="flex-1 text-xs font-bold text-[#9ca3af] border border-[#2a2f3d] rounded-lg py-2.5 hover:text-[#e8eaf0] transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSaveMovement} disabled={movSaving}
                    className={`flex-1 text-xs font-bold text-white rounded-lg py-2.5 transition-colors disabled:opacity-50 ${
                      movForm.type === 'out' ? 'bg-[#f59e0b] hover:bg-[#d97706]' : 'bg-[#38d9a9] hover:bg-[#2bc394]'
                    }`}>
                    {movSaving ? 'Saving…' : movForm.type === 'out' ? 'Deduct from stock' : 'Add to stock'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Product Modal */}
          {addProdOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAddProdOpen(false)}>
              <div className="bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#e8eaf0]">Add Product</h3>
                  <button onClick={() => setAddProdOpen(false)} className="text-[#6b7280] hover:text-[#e8eaf0]"><X size={16} /></button>
                </div>
                {addProdError && <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">{addProdError}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>SKU <span className="text-[#4f8ef7]">(auto if blank)</span></label>
                    <input className={inputCls} value={addProdForm.sku} onChange={e => setAddProdForm(f => ({ ...f, sku: e.target.value }))} placeholder="e.g. CHM-001" />
                  </div>
                  <div>
                    <label className={labelCls}>Name *</label>
                    <input className={inputCls} value={addProdForm.name} onChange={e => setAddProdForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. All-purpose cleaner" />
                  </div>
                  <div>
                    <label className={labelCls}>Category</label>
                    <select className={inputCls} value={addProdForm.category} onChange={e => setAddProdForm(f => ({ ...f, category: e.target.value }))}>
                      {INV_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Unit of Measure</label>
                    <select className={inputCls} value={addProdForm.unitOfMeasure} onChange={e => setAddProdForm(f => ({ ...f, unitOfMeasure: e.target.value }))}>
                      {INV_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Unit Cost ($) *</label>
                    <input type="number" min="0" step="0.01" className={inputCls} value={addProdForm.unitCost} onChange={e => setAddProdForm(f => ({ ...f, unitCost: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={labelCls}>Current Stock</label>
                    <input type="number" min="0" className={inputCls} value={addProdForm.currentStock} onChange={e => setAddProdForm(f => ({ ...f, currentStock: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Minimum Stock</label>
                    <input type="number" min="0" className={inputCls} value={addProdForm.minimumStock} onChange={e => setAddProdForm(f => ({ ...f, minimumStock: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Supplier</label>
                    <input className={inputCls} value={addProdForm.supplier} onChange={e => setAddProdForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Optional" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea rows={2} className={inputCls} value={addProdForm.notes} onChange={e => setAddProdForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setAddProdOpen(false)} className="flex-1 py-2 text-xs border border-[#2a2f3d] rounded-lg text-[#6b7280] hover:text-[#e8eaf0] transition-colors">Cancel</button>
                  <button onClick={handleAddProduct} disabled={addProdSaving}
                    className="flex-1 py-2 text-xs font-bold bg-[#4f8ef7] hover:bg-[#3a7de8] disabled:opacity-50 text-white rounded-lg transition-colors">
                    {addProdSaving ? 'Saving…' : 'Add Product'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Product Modal */}
          {editProdOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditProdOpen(false)}>
              <div className="bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#e8eaf0]">Edit Product</h3>
                  <button onClick={() => setEditProdOpen(false)} className="text-[#6b7280] hover:text-[#e8eaf0]"><X size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>SKU</label>
                    <input className={inputCls} value={editProdForm.sku} onChange={e => setEditProdForm(f => ({ ...f, sku: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Name *</label>
                    <input className={inputCls} value={editProdForm.name} onChange={e => setEditProdForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Category</label>
                    <select className={inputCls} value={editProdForm.category} onChange={e => setEditProdForm(f => ({ ...f, category: e.target.value }))}>
                      {INV_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Unit of Measure</label>
                    <select className={inputCls} value={editProdForm.unitOfMeasure} onChange={e => setEditProdForm(f => ({ ...f, unitOfMeasure: e.target.value }))}>
                      {INV_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Unit Cost ($) *</label>
                    <input type="number" min="0" step="0.01" className={inputCls} value={editProdForm.unitCost} onChange={e => setEditProdForm(f => ({ ...f, unitCost: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Current Stock</label>
                    <input type="number" min="0" className={inputCls} value={editProdForm.currentStock} onChange={e => setEditProdForm(f => ({ ...f, currentStock: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Minimum Stock</label>
                    <input type="number" min="0" className={inputCls} value={editProdForm.minimumStock} onChange={e => setEditProdForm(f => ({ ...f, minimumStock: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Supplier</label>
                    <input className={inputCls} value={editProdForm.supplier} onChange={e => setEditProdForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Optional" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea rows={2} className={inputCls} value={editProdForm.notes} onChange={e => setEditProdForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditProdOpen(false)} className="flex-1 py-2 text-xs border border-[#2a2f3d] rounded-lg text-[#6b7280] hover:text-[#e8eaf0] transition-colors">Cancel</button>
                  <button onClick={handleEditProduct} disabled={editProdSaving}
                    className="flex-1 py-2 text-xs font-bold bg-[#4f8ef7] hover:bg-[#3a7de8] disabled:opacity-50 text-white rounded-lg transition-colors">
                    {editProdSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'assets' && (
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Assets',    value: String(totalAssets),        color: '#4f8ef7', border: 'border-t-[#4f8ef7]' },
              { label: 'Active',          value: String(activeAssetsCount),  color: '#38d9a9', border: 'border-t-[#38d9a9]' },
              { label: 'Purchase Value',  value: fmt(totalPurchaseValue),    color: '#f59e0b', border: 'border-t-[#f59e0b]' },
              { label: 'Current Value',   value: fmt(totalCurrentValue),     color: '#a78bfa', border: 'border-t-[#a78bfa]' },
            ].map(card => (
              <div key={card.label} className={`bg-[#161922] border border-[#2a2f3d] border-t-2 ${card.border} rounded-xl p-4`}>
                <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{card.label}</div>
                <div className="text-2xl font-bold mt-2" style={{ color: card.color, fontFamily: 'var(--font-display)' }}>{card.value}</div>
                {card.label === 'Current Value' && totalPurchaseValue > 0 && (
                  <div className="text-[10px] text-[#6b7280] mt-1">
                    {((totalCurrentValue / totalPurchaseValue) * 100).toFixed(0)}% of original
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Filters + Add button */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <Search size={13} className="text-[#6b7280] shrink-0" />
              <input
                type="text" placeholder="Search assets…"
                value={assetSearchQ} onChange={e => setAssetSearchQ(e.target.value)}
                className="bg-transparent text-xs text-[#e8eaf0] placeholder-[#6b7280] outline-none flex-1"
              />
              {assetSearchQ && (
                <button type="button" onClick={() => setAssetSearchQ('')}
                  className="text-[#6b7280] hover:text-[#e8eaf0] transition-colors shrink-0">
                  <X size={12} />
                </button>
              )}
            </div>
            <select value={assetTypeFilter} onChange={e => setAssetTypeFilter(e.target.value)}
              className="bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] px-2 py-1.5 outline-none">
              <option value="all">All Types</option>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={assetStatusFilter} onChange={e => setAssetStatusFilter(e.target.value)}
              className="bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] px-2 py-1.5 outline-none">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
            <button onClick={() => setAddAssetOpen(true)}
              className="ml-auto flex items-center gap-1.5 bg-[#4f8ef7] hover:bg-[#3a7de8] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors">
              <Plus size={12} /> Add Asset
            </button>
          </div>

          {/* Table */}
          <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1e2330]">
                  {['Asset', 'Type', 'Serial #', 'Purchase Date', 'Purchase Value', 'Current Value', 'Annual Depr.', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-[#6b7280] text-xs">
                      {assets.length === 0 ? 'No assets yet. Add your first asset.' : 'No assets match the filters.'}
                    </td>
                  </tr>
                ) : filteredAssets.map(asset => {
                  const typeEmoji: Record<string, string> = { Vehicle: '🚐', Equipment: '🧰', Tool: '🔧', Technology: '💻', Furniture: '🪑', Other: '📦' }
                  const statusColor: Record<string, string> = { active: '#38d9a9', maintenance: '#f59e0b', retired: '#6b7280' }
                  const statusLabel: Record<string, string> = { active: '✓ Active', maintenance: '⚙ Maintenance', retired: '✗ Retired' }
                  const depreciation = Number(asset.purchaseValue) > 0
                    ? ((1 - Number(asset.currentValue) / Number(asset.purchaseValue)) * 100).toFixed(0)
                    : '0'
                  return (
                    <tr key={asset.id} className="border-t border-[#2a2f3d]/50 hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-semibold text-[#e8eaf0]">{asset.name}</td>
                      <td className="px-3 py-2.5 text-[#9ca3af]">{typeEmoji[asset.type] || '📦'} {asset.type}</td>
                      <td className="px-3 py-2.5 font-mono text-[#6b7280]">{asset.serialNumber || '—'}</td>
                      <td className="px-3 py-2.5 text-[#9ca3af]">{formatDate(asset.purchaseDate)}</td>
                      <td className="px-3 py-2.5 font-mono text-[#e8eaf0]">{fmt(Number(asset.purchaseValue))}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-[#38d9a9]">{fmt(Number(asset.currentValue))}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-[#9ca3af]">{Number(asset.annualDepreciation)}%/yr</span>
                        <span className="ml-1 text-[#6b7280]">({depreciation}% total)</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${statusColor[asset.status] || '#6b7280'}20`,
                            color: statusColor[asset.status] || '#6b7280',
                          }}>
                          {statusLabel[asset.status] || asset.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 flex items-center gap-2">
                        <button onClick={() => openEditAsset(asset)} className="text-[#9ca3af] hover:text-[#e8eaf0] transition-colors" title="Edit">✏️</button>
                        <button onClick={() => handleDeleteAsset(asset.id)} className="text-[#f87171] hover:text-[#ef4444] transition-colors" title="Delete">🗑</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Add Asset Modal */}
          {addAssetOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setAddAssetOpen(false)}>
              <div className="bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#e8eaf0]">Add Asset</h3>
                  <button onClick={() => setAddAssetOpen(false)} className="text-[#6b7280] hover:text-[#e8eaf0]"><X size={16} /></button>
                </div>
                {addAssetError && <div className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-xs rounded-lg p-3">{addAssetError}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Asset Name *</label>
                    <input className={inputCls} value={addAssetForm.name} onChange={e => setAddAssetForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cleaning Van #1" />
                  </div>
                  <div>
                    <label className={labelCls}>Type</label>
                    <select className={inputCls} value={addAssetForm.type} onChange={e => setAddAssetForm(f => ({ ...f, type: e.target.value }))}>
                      {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select className={inputCls} value={addAssetForm.status} onChange={e => setAddAssetForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="active">Active</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="retired">Retired</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Purchase Date *</label>
                    <input type="date" className={inputCls} value={addAssetForm.purchaseDate} onChange={e => setAddAssetForm(f => ({ ...f, purchaseDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Serial Number</label>
                    <input className={inputCls} value={addAssetForm.serialNumber} onChange={e => setAddAssetForm(f => ({ ...f, serialNumber: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div>
                    <label className={labelCls}>Purchase Value ($) *</label>
                    <input type="number" min="0" step="0.01" className={inputCls} value={addAssetForm.purchaseValue} onChange={e => setAddAssetForm(f => ({ ...f, purchaseValue: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={labelCls}>Current Value ($)</label>
                    <input type="number" min="0" step="0.01" className={inputCls} value={addAssetForm.currentValue} onChange={e => setAddAssetForm(f => ({ ...f, currentValue: e.target.value }))} placeholder="Defaults to purchase value" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Annual Depreciation (%)</label>
                    <input type="number" min="0" max="100" step="0.1" className={inputCls} value={addAssetForm.annualDepreciation} onChange={e => setAddAssetForm(f => ({ ...f, annualDepreciation: e.target.value }))} placeholder="e.g. 20" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea rows={2} className={inputCls} value={addAssetForm.notes} onChange={e => setAddAssetForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setAddAssetOpen(false)} className="flex-1 py-2 text-xs border border-[#2a2f3d] rounded-lg text-[#6b7280] hover:text-[#e8eaf0] transition-colors">Cancel</button>
                  <button onClick={handleAddAsset} disabled={addAssetSaving}
                    className="flex-1 py-2 text-xs font-bold bg-[#4f8ef7] hover:bg-[#3a7de8] disabled:opacity-50 text-white rounded-lg transition-colors">
                    {addAssetSaving ? 'Saving…' : 'Add Asset'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Asset Modal */}
          {editAssetOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditAssetOpen(false)}>
              <div className="bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#e8eaf0]">Edit Asset</h3>
                  <button onClick={() => setEditAssetOpen(false)} className="text-[#6b7280] hover:text-[#e8eaf0]"><X size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Asset Name *</label>
                    <input className={inputCls} value={editAssetForm.name} onChange={e => setEditAssetForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Type</label>
                    <select className={inputCls} value={editAssetForm.type} onChange={e => setEditAssetForm(f => ({ ...f, type: e.target.value }))}>
                      {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select className={inputCls} value={editAssetForm.status} onChange={e => setEditAssetForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="active">Active</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="retired">Retired</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Purchase Date *</label>
                    <input type="date" className={inputCls} value={editAssetForm.purchaseDate} onChange={e => setEditAssetForm(f => ({ ...f, purchaseDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Serial Number</label>
                    <input className={inputCls} value={editAssetForm.serialNumber} onChange={e => setEditAssetForm(f => ({ ...f, serialNumber: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div>
                    <label className={labelCls}>Purchase Value ($) *</label>
                    <input type="number" min="0" step="0.01" className={inputCls} value={editAssetForm.purchaseValue} onChange={e => setEditAssetForm(f => ({ ...f, purchaseValue: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Current Value ($)</label>
                    <input type="number" min="0" step="0.01" className={inputCls} value={editAssetForm.currentValue} onChange={e => setEditAssetForm(f => ({ ...f, currentValue: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Annual Depreciation (%)</label>
                    <input type="number" min="0" max="100" step="0.1" className={inputCls} value={editAssetForm.annualDepreciation} onChange={e => setEditAssetForm(f => ({ ...f, annualDepreciation: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea rows={2} className={inputCls} value={editAssetForm.notes} onChange={e => setEditAssetForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setEditAssetOpen(false)} className="flex-1 py-2 text-xs border border-[#2a2f3d] rounded-lg text-[#6b7280] hover:text-[#e8eaf0] transition-colors">Cancel</button>
                  <button onClick={handleEditAsset} disabled={editAssetSaving}
                    className="flex-1 py-2 text-xs font-bold bg-[#4f8ef7] hover:bg-[#3a7de8] disabled:opacity-50 text-white rounded-lg transition-colors">
                    {editAssetSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Estimates Tab ── */}
      {activeTab === 'estimates' && (() => {
        const estSubtotal = estItems.reduce((s, it) => s + Number(it.total), 0)
        const estTaxRate = Number(estForm.taxRate) || 0
        const estTax = estSubtotal * estTaxRate / 100
        const estTotal = estSubtotal + estTax
        const filteredEstimates = estHistFilter === 'all' ? estimates : estimates.filter(e => e.status === estHistFilter)
        const STATUS_COLORS: Record<string, string> = {
          pending:         'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30',
          converted:       'bg-[#26BD97]/10 text-[#26BD97] border-[#26BD97]/30',
          service_created: 'bg-[#a78bfa]/10 text-[#a78bfa] border-[#a78bfa]/30',
          cancelled:       'bg-[#f87171]/10 text-[#f87171] border-[#f87171]/30',
        }
        return (
          <div className="space-y-6">
            {/* ── Form header ── */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#e8eaf0]">
                  {estEditId ? '✏️ Edit Estimate' : 'New Estimate'}
                </h2>
                <p className="text-xs text-[#6b7280] mt-0.5">Fill in the fields, save to history or preview the PDF</p>
              </div>
              <div className="flex items-center gap-2">
                {estEditId && (
                  <button onClick={() => { setEstEditId(null); resetEstForm() }}
                    className="px-3 py-2 text-xs border border-[#2a2f3d] rounded-lg text-[#6b7280] hover:text-[#e8eaf0] transition-colors">
                    Cancel Edit
                  </button>
                )}
                <button onClick={handlePreviewEstimate}
                  className="px-4 py-2 border border-[#4b3fa0] text-[#4b3fa0] hover:bg-[#4b3fa0]/10 text-xs font-semibold rounded-lg transition-colors">
                  Preview PDF
                </button>
                <button onClick={handleSaveEstimate} disabled={estSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#4b3fa0] hover:bg-[#3a2f90] disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors">
                  {estSaving ? 'Saving…' : estEditId ? 'Update Estimate' : 'Save Estimate'}
                </button>
              </div>
            </div>
            {estSaveError && <div className="text-xs text-[#f87171] bg-[#f87171]/10 border border-[#f87171]/30 rounded-lg px-3 py-2">{estSaveError}</div>}

            <div className="grid grid-cols-2 gap-4">
              {/* Left column */}
              <div className="space-y-4">
                {/* Client section */}
                <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-[#6b7280] uppercase tracking-wider">Client</div>
                  <div className="flex gap-2">
                    <button onClick={() => setEstClientMode('manual')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${estClientMode === 'manual' ? 'bg-[#4b3fa0] border-[#4b3fa0] text-white' : 'border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'}`}>
                      Manual Entry
                    </button>
                    <button onClick={() => { setEstClientMode('registered'); estLoadClients() }}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${estClientMode === 'registered' ? 'bg-[#4b3fa0] border-[#4b3fa0] text-white' : 'border-[#2a2f3d] text-[#6b7280] hover:text-[#e8eaf0]'}`}>
                      Registered Client
                    </button>
                  </div>
                  {estClientMode === 'registered' ? (
                    <div>
                      <label className={labelCls}>Select Client</label>
                      <select className={inputCls} value={estClientId}
                        onChange={e => {
                          if (e.target.value === '__add_client__') { setEstClientModalOpen(true); return }
                          setEstClientId(e.target.value)
                        }}>
                        <option value="">— Select client —</option>
                        {estClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        <option value="__add_client__">+ New Client…</option>
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className={labelCls}>Full Name *</label>
                        <input className={inputCls} value={estForm.clientName} onChange={e => setEstForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Client name" />
                      </div>
                      <div>
                        <label className={labelCls}>Email</label>
                        <input type="email" className={inputCls} value={estForm.clientEmail} onChange={e => setEstForm(f => ({ ...f, clientEmail: e.target.value }))} placeholder="client@email.com" />
                      </div>
                      <div>
                        <label className={labelCls}>Phone</label>
                        <input className={inputCls} value={estForm.clientPhone} onChange={e => setEstForm(f => ({ ...f, clientPhone: e.target.value }))} placeholder="(xxx) xxx-xxxx" />
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>Address</label>
                        <input className={inputCls} value={estForm.clientAddress} onChange={e => setEstForm(f => ({ ...f, clientAddress: e.target.value }))} placeholder="123 Main St, City, State" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Estimate details */}
                <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-[#6b7280] uppercase tracking-wider">Estimate Details</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Estimate Number</label>
                      <input className={inputCls} value={estForm.estimateNumber} onChange={e => setEstForm(f => ({ ...f, estimateNumber: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelCls}>Tax Rate (%)</label>
                      <input type="number" min="0" max="100" step="0.1" className={inputCls} value={estForm.taxRate} onChange={e => setEstForm(f => ({ ...f, taxRate: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelCls}>Issue Date</label>
                      <input type="date" className={inputCls} value={estForm.issueDate} onChange={e => setEstForm(f => ({ ...f, issueDate: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelCls}>Valid Until</label>
                      <input type="date" className={inputCls} value={estForm.validUntil} onChange={e => setEstForm(f => ({ ...f, validUntil: e.target.value }))} />
                    </div>
                  </div>
                  {!estEditId && (
                    <div className="pt-1 border-t border-[#2a2f3d]">
                      <label className="flex items-center gap-2 text-xs font-semibold text-[#9ca3af] cursor-pointer pt-2">
                        <input type="checkbox" checked={estScheduleVisit} onChange={e => setEstScheduleVisit(e.target.checked)} className="w-3.5 h-3.5" />
                        Schedule a visit to this property
                      </label>
                      {estScheduleVisit && (
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <label className={labelCls}>Visit Date</label>
                            <input type="date" className={inputCls} value={estVisitDate} onChange={e => setEstVisitDate(e.target.value)} />
                          </div>
                          <div>
                            <label className={labelCls}>Visit Time</label>
                            <select className={inputCls} value={estVisitTime} onChange={e => setEstVisitTime(e.target.value)}>
                              <option value="">— Select time —</option>
                              {TIME_SLOTS.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Notes</label>
                    <textarea rows={3} className={inputCls} value={estForm.notes} onChange={e => setEstForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes for the client…" />
                  </div>
                </div>
              </div>

              {/* Right column – line items */}
              <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#6b7280] uppercase tracking-wider">Line Items</div>
                  <button onClick={estAddItem}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-[#4f8ef7]/10 hover:bg-[#4f8ef7]/20 text-[#4f8ef7] rounded-lg transition-colors">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_60px_90px_80px_24px] gap-2 text-[10px] font-bold text-[#6b7280] uppercase tracking-wider px-1">
                    <span>Description</span><span className="text-center">Qty</span><span className="text-right">Unit Price</span><span className="text-right">Total</span><span></span>
                  </div>
                  {estItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_60px_90px_80px_24px] gap-2 items-center">
                      <input className={inputCls} value={item.description}
                        onChange={e => estUpdateItem(idx, 'description', e.target.value)}
                        placeholder="Service description" />
                      <input type="number" min="0" step="1" className={inputCls + ' text-center px-1'} value={item.qty}
                        onChange={e => estUpdateItem(idx, 'qty', e.target.value)} />
                      <input type="number" min="0" step="0.01" className={inputCls + ' text-right px-1'} value={item.unitPrice}
                        onChange={e => estUpdateItem(idx, 'unitPrice', e.target.value)} />
                      <div className="text-xs text-right text-[#e8eaf0] font-mono">${Number(item.total).toFixed(2)}</div>
                      <button onClick={() => estRemoveItem(idx)} disabled={estItems.length === 1}
                        className="text-[#6b7280] hover:text-[#f87171] disabled:opacity-30 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#2a2f3d] pt-3 space-y-1">
                  {estTaxRate > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-[#6b7280]">
                        <span>Subtotal</span>
                        <span className="font-mono">${estSubtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-[#6b7280]">
                        <span>Tax ({estTaxRate}%)</span>
                        <span className="font-mono">${estTax.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm font-bold text-[#e8eaf0]">
                    <span>TOTAL</span>
                    <span className="font-mono text-[#26BD97]">${estTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Estimate History ── */}
            <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2f3d]">
                <div className="text-xs font-bold text-[#e8eaf0]">Estimate History</div>
                <div className="flex gap-1">
                  {([
                    { key: 'all',             label: 'All'             },
                    { key: 'pending',         label: 'Pending'         },
                    { key: 'service_created', label: 'Service Created' },
                    { key: 'converted',       label: 'Converted'       },
                    { key: 'cancelled',       label: 'Cancelled'       },
                  ] as const).map(f => (
                    <button key={f.key} onClick={() => setEstHistFilter(f.key)}
                      className={`px-3 py-1 text-[10px] font-semibold rounded-md transition-colors whitespace-nowrap ${estHistFilter === f.key ? 'bg-[#4b3fa0] text-white' : 'text-[#6b7280] hover:text-[#e8eaf0]'}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredEstimates.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#6b7280]">No estimates found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max text-xs">
                    <thead>
                      <tr className="border-b border-[#2a2f3d] text-[10px] text-[#6b7280] uppercase tracking-wider">
                        <th className="text-left px-4 py-2.5 font-semibold">Estimate #</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Client</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Issue Date</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Valid Until</th>
                        <th className="text-right px-4 py-2.5 font-semibold">Total</th>
                        <th className="text-center px-4 py-2.5 font-semibold">Status</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Action</th>
                        <th className="text-center px-4 py-2.5 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEstimates.map(est => (
                        <tr key={est.id} className="border-b border-[#1e2330] hover:bg-[#1a1f2e] transition-colors">
                          <td className="px-4 py-3 font-mono text-[#4f8ef7] font-semibold whitespace-nowrap">{est.estimateNumber}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-[#e8eaf0] font-medium">{est.clientName}</div>
                            {est.clientEmail && <div className="text-[#6b7280] text-[10px]">{est.clientEmail}</div>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-[#9ca3af]">
                            {est.issueDate ? new Date(est.issueDate.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-[#9ca3af]">
                            {est.validUntil ? new Date(est.validUntil.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-mono font-semibold text-[#e8eaf0]">
                            ${Number(est.total).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${STATUS_COLORS[est.status] ?? STATUS_COLORS.pending}`}>
                              {est.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {est.status === 'service_created' ? (
                              <span className="text-[10px] font-semibold text-[#a78bfa]">✓ Service Created</span>
                            ) : est.status === 'converted' && est.invoice ? (
                              <span className="text-[#26BD97] font-mono font-semibold text-[10px]">{est.invoice.invoiceNumber}</span>
                            ) : (
                              <button onClick={() => openCreateServiceFromEstimate(est)}
                                className="text-[10px] px-2.5 py-1 bg-[#a78bfa]/10 hover:bg-[#a78bfa]/20 text-[#a78bfa] border border-[#a78bfa]/30 rounded-lg font-semibold transition-colors">
                                + Create Service
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => previewSavedEstimate(est)} title="Preview PDF"
                                className="text-[#6b7280] hover:text-[#4f8ef7] transition-colors text-[10px] font-medium">
                                PDF
                              </button>
                              <span className="text-[#2a2f3d]">·</span>
                              <button onClick={() => loadEstimateForEdit(est)} title="Edit"
                                className="text-[#6b7280] hover:text-[#f59e0b] transition-colors text-[10px] font-medium">
                                Edit
                              </button>
                              <span className="text-[#2a2f3d]">·</span>
                              <button onClick={() => handleDeleteEstimate(est.id)} title="Delete"
                                className="text-[#6b7280] hover:text-[#f87171] transition-colors text-[10px] font-medium">
                                Del
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Modals ── */}
      <InvoiceDetailModal
        invoice={selectedInvoice}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedInvoice(null) }}
        onSuccess={loadData}
      />
      <InvoicePDFModal
        invoice={pdfInvoice}
        open={pdfOpen}
        onClose={() => { setPdfOpen(false); setPdfInvoice(null) }}
      />
      <InvoicePostGenerateModal
        invoice={postGenInvoice}
        open={postGenOpen}
        onClose={() => { setPostGenOpen(false); setPostGenInvoice(null) }}
        onSuccess={loadData}
      />
      <InvoicePaymentsModal
        invoice={paymentsInvoice}
        open={paymentsOpen}
        onClose={() => { setPaymentsOpen(false); setPaymentsInvoice(null) }}
        onSuccess={(updatedInvoice) => {
          setInvoices(prev => prev.map(i => i.id === updatedInvoice.id ? updatedInvoice : i))
          setPaymentsInvoice(updatedInvoice)
        }}
      />
      <ConfirmModal
        open={confirmOpen}
        title={`Delete Invoice ${confirmTarget?.invoiceNumber}`}
        message={`This will permanently delete the invoice and unlink all its services so they can be re-invoiced.\n\nThis action cannot be undone.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete Invoice'}
        onConfirm={handleConfirmDelete}
        onCancel={() => { setConfirmOpen(false); setConfirmTarget(null) }}
      />
      <EstimatePDFModal
        estimate={estPDFData}
        open={estPDFOpen}
        onClose={() => { setEstPDFOpen(false); setEstPDFData(null) }}
      />
      <ClientModal
        open={estClientModalOpen}
        onClose={() => setEstClientModalOpen(false)}
        onSuccess={(newId?: string) => {
          setEstClientModalOpen(false)
          estLoadClients()
          if (newId) { setEstClientId(newId); setEstClientMode('registered') }
        }}
      />
      <ServiceModal
        open={estServiceModalOpen}
        onClose={() => { setEstServiceModalOpen(false); setEstFromEstimate(null) }}
        onSuccess={handleServiceCreatedFromEstimate}
        initialClientId={estFromEstimate?.clientId || undefined}
        initialClientName={estFromEstimate?.clientId ? undefined : (estFromEstimate?.clientName || undefined)}
        initialClientPhone={estFromEstimate?.clientId ? undefined : (estFromEstimate?.clientPhone || undefined)}
        initialBasePrice={estFromEstimate ? String(Number(estFromEstimate.total).toFixed(2)) : undefined}
        initialNotes={estFromEstimate?.notes || undefined}
        initialAddress={estFromEstimate?.clientAddress || undefined}
      />
      <ServiceDetailModal
        service={invDetailService}
        open={invDetailOpen}
        onClose={() => { setInvDetailOpen(false); setInvDetailService(null) }}
        onSuccess={() => {}}
      />
    </div>
  )
}
