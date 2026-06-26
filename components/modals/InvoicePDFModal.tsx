'use client'

import { useRef, useEffect, useState } from 'react'
import { X, Download, FileText, AlertCircle, CheckCircle, Send, Loader2, Mail } from 'lucide-react'

// ── Logos embebidos en base64 ──
const LOGO_VENMO   = 'data:image/png;base64,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'
const LOGO_CASHAPP = 'data:image/png;base64,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'
const LOGO_ZELLE   = 'data:image/png;base64,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'
const LOGO_PAYPAL  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAD3ElEQVR42u2YPW9cRRSGn3Nmdu21F8fOt4MJJAGhBAJISDQIkSJBFBEpkWip6fkFICq6CImSghYkfgEFVUSBIAIJKVIgBH/GXq/tvR9zDsWsjWmQdp1dGeQp79W988x7zvvO3Cvu7hzioRzycQR4BHgE+F8HjAd52AG3hO0lqezdE3FUQGS/DjLwHHKQoE4Y4d+K4E4yI2gAsbwi0fEo6O4EEX76dZEH91cJMfaVdBRl7mSbq1dO0wgBSwlVzZDjUND7IJac1259yvd3lqA9BbXvVTG0hFcuzvDxh+9w440LWG1ojOMCdESElUddLt+6zdqGI03HPVdR3XAitrnDTKvmzlcf8NwzpzAHVRm9i3eXtLK6TWe9wDRhtWOpxlPCDDwlmnMtOp3El9/8ACKY2XhiZlf0h4vrlNsFoa+KoAjgAh4cM0Mayt17K/ie78cQM7vT/L7cgeSIRPASyi3EEhAQBw1KvV1wrI4IYOMC3B0Pl7cBzcpZje9sgCdcIuJOCor0dviu22GxdE5FxX03G0dUYsdwz730YLkLAi4GVu9FTHTDJTsmtBI/xlk+u7uGqu4L9VFudX0J/ljuZEAM99R3seRCCkiq0FYbuXiJb3/r5Al15IBC7Jviz8UuxJCb0hzxvkEEgghW9GhcvoLPz7HRC7hLNtGoFRQRiqJkcWUbYsgl72ejS46htLXDxMmzpLdeh8qYjQnp35ORmsQdRHnU6bG2sQNBsyJFiZY1BIFmk3j1ReTta6SZY8hGwYW5qb3dO4wS0NwIoiw/6rK+3UPiBFLVNG68iT79JF5V6BMtqjMnKGuIVYkH4frCVG7MAW08hIL55UurXVKZ0KYTPWIvXaI8cRyqCnFFykQUKKvICzMFN8+3cdeBTRIHj5kMuLjagwTijrUmSSHiOyVqYKkAh2TGbKPg9rXzTDebmDkqMuqg/nubwwSxGpluMBGalG6IOVeOCU9NNLg4K7z/8jlePT5FbYkoMvChdQgFM+CDpU1EcupZaxKaEasL2lH4+uYCz7Yn9/WtE3W4yNXBH8gevPdwHY9CnQRrtfEokIQzE4Gzk40cNe75iCXCsGNgBVUSEOmtd4luTFtFNdOg1JzQZyaE6Rj6ixGGRxu2B1XBnc8/eZfVTsF0M/DRL5t8cb8gauB0u5lPLg56ULphAAUFnIX5WRbm87W1n7eotyrQmrlo+3pVxg+4e1hwh1Q7qonr55R2I6He4L3n54DUX8jBx4E+O2sccSf841PScRJysKPm4wHEDUNxqzEc8YiIoOFxFPdxAJJjZL9Xvb/XiMhhADz6eXQE+P8H/AsAF+RuW9XV+wAAAABJRU5ErkJggg=='

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('T')[0].split('-')
  return `${m}-${d}-${y}`
}

function formatDateShort(dateStr: string) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('T')[0].split('-')
  return `${m}-${d}-${y}`
}

function parseType(desc: string): string {
  if (!desc) return '—'
  return desc
    .replace(/\s*–\s*.+$/, '')
    .replace(/\s*\(\d{4}-\d{2}-\d{2}\)/, '')
    .trim() || desc
}

function abbreviateSize(str: string): string {
  if (!str) return str
  return str
    .replace(/\bBedrooms\b/gi, 'BR')
    .replace(/\bBedroom\b/gi, 'BR')
}

const statusConfig: Record<string, {
  label: string; bg: string; color: string; border: string
  sectionBg: string; sectionBorder: string; keyColor: string; valColor: string
  emoji: string; icon: React.ReactNode
}> = {
  draft: {
    label: 'Draft', bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb',
    sectionBg: '#fffbeb', sectionBorder: '#fde68a', keyColor: '#4b5563', valColor: '#d97706',
    emoji: '📄', icon: <FileText size={10} />,
  },
  sent: {
    label: 'Sent', bg: '#dbeafe', color: '#1e40af', border: '#93c5fd',
    sectionBg: '#eff6ff', sectionBorder: '#bfdbfe', keyColor: '#4b5563', valColor: '#1d4ed8',
    emoji: '📤', icon: <Send size={10} />,
  },
  paid: {
    label: 'Paid', bg: '#d1fae5', color: '#065f46', border: '#a7f3d0',
    sectionBg: '#f0fdf4', sectionBorder: '#86efac', keyColor: '#4b5563', valColor: '#16a34a',
    emoji: '✅', icon: <CheckCircle size={10} />,
  },
  overdue: {
    label: 'Overdue', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5',
    sectionBg: '#fff7ed', sectionBorder: '#fed7aa', keyColor: '#4b5563', valColor: '#d97706',
    emoji: '⚠️', icon: <AlertCircle size={10} />,
  },
  cancelled: {
    label: 'Cancelled', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5',
    sectionBg: '#fff1f2', sectionBorder: '#fecdd3', keyColor: '#4b5563', valColor: '#be123c',
    emoji: '❌', icon: <AlertCircle size={10} />,
  },
}

interface Props {
  invoice: any
  open: boolean
  onClose: () => void
}

export default function InvoicePDFModal({ invoice, open, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const [showEmail, setShowEmail]   = useState(false)
  const [emailTo, setEmailTo]       = useState('')
  const [sending, setSending]       = useState(false)
  const [sent, setSent]             = useState(false)
  const [emailError, setEmailError] = useState('')
  const [bccEnabled, setBccEnabled] = useState(false)
  const [companyEmail, setCompanyEmail] = useState('')

  useEffect(() => {
    if (open && invoice?.client?.email) setEmailTo(invoice.client.email)
    if (open) {
      setSent(false); setShowEmail(false); setEmailError(''); setBccEnabled(false)
      fetch('/api/settings').then(r => r.json()).then(s => setCompanyEmail(s['biz.email'] || '')).catch(() => {})
    }
  }, [open, invoice?.client?.email])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const font = new FontFace('Joyful', "url('/Joyful.ttf') format('truetype')")
    font.load().then(loaded => {
      document.fonts.add(loaded)
    }).catch(err => console.error('Joyful font error:', err))
  }, [])

  async function handleSendEmail() {
    if (!emailTo) return
    setSending(true)
    setEmailError('')
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: emailTo,
          ...(bccEnabled && companyEmail ? { bcc: companyEmail } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setEmailError(data.error || 'Failed to send email.')
        return
      }
      setSent(true)
      setShowEmail(false)
    } catch {
      setEmailError('Failed to send email.')
    } finally {
      setSending(false)
    }
  }

  function handlePrint() {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html>
      <head>
        <meta charset="UTF-8"/>
        <title>${invoice?.invoiceNumber || 'Invoice'}</title>
        <style>
          @font-face {
            font-family: Joyful;
            src: url('/Joyful.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
          *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
          body{font-family:Joyful,cursive;background:#fff;}
          @page{size:A4;margin:16mm 14mm;}
        </style>
      </head>
      <body>${content.outerHTML}</body></html>`)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 600)
  }

  if (!open || !invoice) return null

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const items = [...(invoice.items || [])].sort((a: any, b: any) => {
    const da = a.service?.serviceDate || ''
    const db = b.service?.serviceDate || ''
    return da < db ? -1 : da > db ? 1 : 0
  })
  const sc = statusConfig[invoice.status] ?? statusConfig.draft

  const cellBase: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'middle' }
  const monoR: React.CSSProperties = { ...cellBase, textAlign: 'right', fontSize: 12 }

  const joyfulFont = (size: number, extraStyles?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: 'Joyful, cursive',
    fontSize: size,
    color: '#4b3fa0',
    ...extraStyles,
  })

  const logoStyle: React.CSSProperties = {
    width: 18, height: 18, objectFit: 'contain', borderRadius: 4, flexShrink: 0,
  }

  const paymentMethods = [
    {
      logo: (
        <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
          <rect width="32" height="22" rx="3" fill="#1A1F71"/>
          <rect y="6" width="32" height="5" fill="#F7B600"/>
          <rect x="3" y="14" width="8" height="2.5" rx="1" fill="white" opacity="0.6"/>
        </svg>
      ),
      label: <><span style={{ color: '#6b7280' }}>Debit / Credit Card</span> — Electronic payments include a 3% service fee</>,
    },
    {
      logo: <img src={LOGO_ZELLE} alt="Zelle" style={logoStyle} />,
      label: <><span style={{ color: '#6b7280' }}>Zelle</span> <strong style={{ color: '#111827' }}>@joyfulcleaningservices</strong></>,
    },
    {
      logo: <img src={LOGO_CASHAPP} alt="CashApp" style={logoStyle} />,
      label: <><span style={{ color: '#6b7280' }}>Cashapp</span> <strong style={{ color: '#111827' }}>$Nathashasalcedo</strong></>,
    },
    {
      logo: <img src={LOGO_VENMO} alt="Venmo" style={logoStyle} />,
      label: <><span style={{ color: '#6b7280' }}>Venmo</span> <strong style={{ color: '#111827' }}>@joyfulcleaningservices</strong></>,
    },
    {
      logo: <img src={LOGO_PAYPAL} alt="PayPal" style={logoStyle} />,
      label: <><span style={{ color: '#6b7280' }}>PayPal</span> <strong style={{ color: '#111827' }}>@joyfulcleaningnc</strong></>,
    },
    {
      logo: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect width="22" height="22" rx="4" fill="#16a34a"/>
          <rect x="3" y="7" width="16" height="8" rx="1.5" stroke="white" strokeWidth="1.5"/>
          <circle cx="11" cy="11" r="2.5" stroke="white" strokeWidth="1.5"/>
        </svg>
      ),
      label: <span style={{ color: '#6b7280' }}>Cash or Check</span>,
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />

      <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-3xl overflow-hidden shadow-[0_32px_100px_rgba(0,0,0,0.6)] flex flex-col">

        {/* ── Modal Header ── */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#2a2f3d]">
            <div className="flex items-center gap-2.5">
              <FileText size={16} color="#4f8ef7" />
              <span className="text-sm font-semibold text-[#4f8ef7]">
                Invoice Preview — {invoice.invoiceNumber}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {sent && <span className="text-[11px] text-[#38d9a9]">✓ Sent!</span>}
              <button
                onClick={() => { setShowEmail(v => !v); setEmailError(''); setSent(false) }}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  showEmail ? 'bg-[#252b3b] border-[#4f8ef7] text-[#4f8ef7]' : 'border-[#2a2f3d] text-[#94a3b8] hover:text-[#e8eaf0] hover:border-[#4f8ef7]'
                }`}
              >
                <Mail size={13} /> Send Email
              </button>
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-all">
                <Download size={13} /> Download PDF
              </button>
              <button onClick={onClose}
                className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* ── Email form panel ── */}
          {showEmail && (
            <div className="relative px-6 pt-6 pb-3 bg-[#0d0f14] border-b border-[#2a2f3d] space-y-2">
              {/* Close button — top right */}
              <button
                onClick={() => { setShowEmail(false); setEmailError('') }}
                className="absolute top-2 right-3 p-1 text-[#6b7280] hover:text-[#e8eaf0] transition-colors"
              >
                <X size={14} />
              </button>

              <div className="flex items-center gap-3">
                <Mail size={14} className="text-[#4f8ef7] flex-shrink-0" />
                <div className="flex-1">
                  <input
                    type="email"
                    value={emailTo}
                    onChange={e => { setEmailTo(e.target.value); setEmailError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
                    placeholder="client@email.com"
                    className="w-full px-3 py-1.5 bg-[#161922] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors"
                  />
                  {emailError && <p className="text-[10px] text-[#f87171] mt-1">{emailError}</p>}
                </div>
                <button
                  onClick={handleSendEmail}
                  disabled={sending || !emailTo}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#4f8ef7] hover:bg-[#3a7ee0] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-all flex-shrink-0"
                >
                  {sending ? <><Loader2 size={12} className="animate-spin" /> Sending…</> : <><Send size={12} /> Send</>}
                </button>
              </div>

              {/* BCC toggle */}
              <div className="flex items-center justify-between pl-6">
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#6b7280]">BCC company email</span>
                  {bccEnabled && companyEmail && (
                    <span className="text-[9px] text-[#4f8ef7] mt-0.5">{companyEmail}</span>
                  )}
                  {bccEnabled && !companyEmail && (
                    <span className="text-[9px] text-[#f87171] mt-0.5">No company email set in Settings</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setBccEnabled(v => !v)}
                  className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${
                    bccEnabled ? 'bg-[#4f8ef7]' : 'bg-[#2a2f3d]'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all ${
                    bccEnabled ? 'left-[18px]' : 'left-0.5'
                  }`} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── PDF Preview ── */}
        <div className="overflow-y-auto flex-1 p-5 bg-[#0d0f14]">
          <div ref={printRef} style={{
            background: '#ffffff', borderRadius: 9, padding: '36px 40px',
            color: '#1a1a2e', fontFamily: 'Joyful, cursive', fontSize: 12, lineHeight: 1.5,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)', maxWidth: 680, margin: '0 auto',
            position: 'relative',
          }}>

            {/* ══ HEADER ══ */}
            <div style={{ position: 'absolute', top: 136, right: 40, fontSize: 32, fontWeight: 800, color: 'rgba(75,63,160,0.5)', letterSpacing: '3px', textTransform: 'uppercase', lineHeight: 1 }}>
              INVOICE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <img src="/Joyful_logo_transparent.png" alt="Joyful Cleaning Services Corp."
                style={{ height: 115, width: 'auto', objectFit: 'contain' }} />
              <div>
                <div style={joyfulFont(28, { lineHeight: 1.1, marginBottom: 4, whiteSpace: 'nowrap' })}>
                  Joyful Cleaning Services Corp.
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.65 }}>
                  320 Laketree Blvd, Spring Lake NC 28390<br />
                  (919) 322-9092 · joyfulcleaningservicescorp@gmail.com<br />
                  joyfulcleaningservicesnc.com
                </div>
              </div>
            </div>

            {/* ── DIVIDER ── */}
            <div style={{ borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />

            {/* ══ BILL TO ══ */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
  <div>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Bill To</div>
    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 1 }}>{invoice.client?.name}</div>
    {invoice.client?.propertyCode && (
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Property Code: {invoice.client.propertyCode}</div>
    )}
    <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.7 }}>
      {invoice.client?.address && <>{invoice.client.address}{(invoice.client.city || invoice.client.state || invoice.client.zip) ? ', ' : ''}</>}
      {(invoice.client?.city || invoice.client?.state || invoice.client?.zip) && <>
        {[invoice.client.city, invoice.client.state, invoice.client.zip].filter(Boolean).join(', ')}<br />
      </>}
      {!invoice.client?.address && !invoice.client?.city && invoice.periodFrom && <>{formatDateShort(invoice.periodFrom)} — {formatDateShort(invoice.periodTo)}<br /></>}
      {invoice.client?.phone && <>{invoice.client.phone}<br /></>}
      {invoice.client?.email && <>{invoice.client.email}<br /></>}
    </div>
  </div>
  <div style={{ textAlign: 'right' }}>
    <div style={{ fontFamily: 'Joyful, cursive', fontSize: 19, fontWeight: 700, color: '#4f8ef7', marginBottom: 3 }}>
      Number: {invoice.invoiceNumber}
    </div>
    <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.8 }}>
      Issued: <span style={{ color: '#374151', fontWeight: 600 }}>{formatDate(invoice.issuedAt)}</span><br />
      Due: <span style={{ color: '#374151', fontWeight: 600 }}>{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</span>
    </div>
    <div style={{ marginTop: 5 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      }}>
        {sc.icon} {sc.label.toUpperCase()}
      </span>
    </div>
  </div>
</div>

            {/* ══ TABLE ══ */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
              <thead>
                <tr>
                  {[
                    { label: '#',           align: 'left',  w: 55  },
                    { label: 'Date',        align: 'left',  w: 100 },
                    { label: 'Unit · Size', align: 'left',  w: 160 },
                    { label: 'Type',        align: 'left',  w: 160 },
                    { label: 'Total',       align: 'right', w: 80  },
                  ].map(({ label, align, w }) => (
                    <th key={label} style={{
                      background: '#f9fafb', padding: '8px 10px',
                      fontSize: 10, fontWeight: 700, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      textAlign: align as React.CSSProperties['textAlign'],
                      borderBottom: '2px solid #e5e7eb', width: w,
                    }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...cellBase, textAlign: 'center', color: '#9ca3af' }}>No items</td></tr>
                ) : items.map((item: any, i: number) => {
                  const svc      = item.service
                  const num      = svc?.serviceNumber ? `#${svc.serviceNumber}` : '—'
                  const date     = svc?.serviceDate   ? formatDateShort(svc.serviceDate) : '—'
                  const type     = svc?.type          || parseType(item.description)
                  const unitSize = abbreviateSize([svc?.unit, svc?.roomSize].filter(Boolean).join(' · ') || '—')
                  return (
                    <tr key={item.id ?? i} style={{ borderBottom: i < items.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ ...cellBase, fontSize: 11, color: '#9ca3af' }}>{num}</td>
                      <td style={{ ...cellBase, fontSize: 11, color: '#374151' }}>{date}</td>
                      <td style={{ ...cellBase, fontSize: 12, fontWeight: 700, color: '#111827' }}>{unitSize}</td>
                      <td style={{ ...cellBase, fontSize: 11, fontWeight: 400, color: '#6b7280' }}>{type}</td>
                      <td style={{ ...monoR, fontWeight: 700, color: '#111827' }}>${fmt(Number(item.total))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* ══ TOTALS ══ */}
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', width: 240, marginLeft: 'auto', marginBottom: 18 }}>
              {Number(invoice.taxRate) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#4b5563', padding: '3px 0' }}>
                  <span>Tax ({invoice.taxRate}%)</span><span>${fmt(Number(invoice.taxAmount))}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: Number(invoice.taxRate) > 0 ? '2px solid #e5e7eb' : 'none', marginTop: Number(invoice.taxRate) > 0 ? 5 : 0, paddingTop: Number(invoice.taxRate) > 0 ? 8 : 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
                <span>TOTAL</span>
                <span style={{ color: '#059669', fontSize: 16 }}>${fmt(Number(invoice.total))}</span>
              </div>
            </div>

            {/* ══ PAYMENT INSTRUCTIONS ══ */}
            <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 12px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Payment Instructions
                </div>
                {(invoice.paymentLinkStripe || invoice.paymentLinkSquare) && (
                  <a href={invoice.paymentLinkStripe || invoice.paymentLinkSquare}
                     target="_blank" rel="noreferrer"
                     style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 16px', background: '#635bff', color: '#fff', textDecoration: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                    Pay Online
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {paymentMethods.map((method, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#4b5563' }}>
                      {method.logo}
                      <span>{method.label}</span>
                    </div>
                  ))}
                </div>
                {(invoice.paymentLinkStripe || invoice.paymentLinkSquare) && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(invoice.paymentLinkStripe || invoice.paymentLinkSquare)}`}
                      alt="QR Code"
                      style={{ width: 86, height: 86, borderRadius: 6, border: '1px solid #e5e7eb', padding: 3, background: '#fff' }}
                    />
                    <span style={{ fontSize: 9, color: '#9ca3af' }}>Scan to pay</span>
                  </div>
                )}
              </div>
            </div>

            {/* ══ FOOTER ══ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 14, borderTop: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.7, maxWidth: 300 }}>
                {invoice.notes
                  ? <><strong>Notes:</strong><br />{invoice.notes}</>
                  : <>Thank you for choosing Joyful Cleaning Services Corp.</>
                }
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
                <img src="/Joyful_logo_transparent.png" alt="Joyful"
                  style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
                <span style={joyfulFont(16)}>Joyful Cleaning Services Corp.</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
