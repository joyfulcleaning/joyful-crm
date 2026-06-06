'use client'

import { useRef, useState } from 'react'
import { X, Download, FileText, Send, Loader2 } from 'lucide-react'

const LOGO_VENMO   = 'data:image/png;base64,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'
const LOGO_CASHAPP = 'data:image/png;base64,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'
const LOGO_ZELLE   = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAGmUlEQVR42r2YTYglVxXHf+fcWx/vvXr9ujsz0TFBkijRZKFEyEYYcRH8gCDZxI26iAsXAcWICAHxYyWC4jKCEN1ExW9QEoKCQsDEDxBJYoySiU4y6Ukm09P9Xr2Pqrp1joueGZOFkG7pdzYXqrj3/uqe869z7hHeoLm7iIi7+0ngDFCZmU+nU3F3RISNjQ1UFXdnOp1iZri7b29vC1ADN4nIhStrvZF9I/+HXYFxP9hLRK6OV55feXdUOzTgbDYjxoiqYmaUZXkVYrVaYebgEEMOwUGg6zpSSqSUjh+wrmuKoiCEQN/3bG1tXT25vUt7hBzyQaAI49d9VNe1ZFl+/ID/M0Z7oxgJf/3pnHOPJ8rJJdoZ3PT+glvu3KBZtdRNffyAVVWhqoQQMDOatkXc6JNTVgOefewlnnhgwcZWxvRSx/v6infddZIi7ynKNZzgeHzgOjew3tjbn+KWcFcGg22GwwGTUWBjM6BtIs8z6JXhYEjIdQ0ungFjEIWgynAzx1zwXpAAUcG7BjMlJfAsIAFC0PWomDFcOr/k3J8aFEGC49bj7owmNdMXOyQ33CKSCYuXlLNPLOmaDlNZj0hefGbK9z5+jtBHvEgEU1wS4MRsSFENsMYYVMI/Hl3wt4f/TjInLy4DyjEDFkGpxgXRBqSQ0BRx7YEePII5Io66gGbkoQDvWbFczwlqMPq2Q/qMPiQwx8UBB2nBFfMAGIYjMaPHQar1AMYiJ2w46okYE2oJFwFTHEdwXBISOgop6XYdFadnTTF4/a0TPvfYrXhylssGt4P8OxgWiAqYMF3MqUaRR77yKk//eEUxcjpfw29mNpuR54GNUxm99QxSxN0RIGSOCHSp4/qs5InvznnyR6+Qb4xJKVDJ+XXkYsiLFWHZ0ffG5taEoIq5s7+/T9ckBls5L/+h45df+DdZsYWmSCsN9VHi/fBTahRFJaCi6OUlVARxyIcBP5/xg3ufR7oSKw3BiBao6zcfP2BVVWR5JMsCWaZ0XUPTLelWHZJFRsWAH37+WV59NhGrAbE9qAlTmPP2u88fP+B4PKaqKgbDAcPxiMVyyWp/xd68ZlJV/O6bF3jqV8J4cxvvG3JV5u2SD31xm888ePpy6XOsLn6N2cGQrGW4nfP0I7v85us12xtDUt+Rq3JhN3H7J0acvvetzGazdak4JwQl9UbQSD7JmD3Z8dCnXyCPJeiSyIBF3XLdexvu+trNrFLLUVSih1dxzXxes6wTq9keo/GA2Od8/7M7yE5BLCFYgTWOnuj45AM305aJ+uL0aPeeQ8+oalwcJ9FLRAn87P4znP29U273tHag6GnTcfe3rmP7nRX9rEOjUFOvI5NU5DFDJFFtbvD4t8/x5+8krtkaktqWQabsvdpwx/1j3v2RkzSLOflAoc3J8jVU1Kc4RcqNWCjPPXaBX3x5l9FGZKUNA3WmF5fcfOeQD9x3gpd3dwldxolrR5SZHkmSh56yU0MseupXjIc+9QKxjZAlMitYzAObtysfe/AGuqEzUkU36oPy+4j/i8O7+BSkVvjJfc9Qn80prskgtYQ+0OucO+65lsVuS32mJYsBQsGlUYOIsYxpHS6Gh7/xIk/9HK6ZRFatAQWdrBiVPb/+6gWWXzqPREVUkcudBjFhFbbWU1Ff/FdHHia0uo+5EywCRmsjZK6XF+0PEoYbSGTlAbJ1uBjIy4iHBYRI2Wa0sSP2QhAnhYYEiOWXK+xApkrpDSsr1gPYNInl/hx3w2wCsiB4pJcFMTvBIApNqCksp2mMZbvCTZmHxaH3esPR8Nr22/N/mZ9ZnOkqy8zb1kQskSQwGgX++OA+zz06I9ssaKYrbvhg4afveZN0S6n7fnnTez76luNtv+3swI23lXBbQSLiTAlpyFJ7Rjrkn7+d0nZKHjJs6Zx8W84tH94CErC5ht4MsHdxFwsZ1ic2x1sgQt4aXVjSdoZmEQ2gMUBSLK24eGFOYg2ZpGaHXHNUSqJO0Qio0SvkHmgXNbO6IdeKveWURTuCmEE0SPV6RBI1I8ZE35eYOWoJMaVz5R13TMgrY1iOWNUVN55WLLXELFCmcj0iMbMzqvrfHjUL1CtG4zExGhBomOOeSKvko3IsIrEGXU+PWvX1idX6CsQJYrgJlqDZTzSywMmoipwj3NmPDth1HapK3/eEEAgYqNOaE8QxbWAglP0Y856ODjrIVtnxA+7s7FCW5dUe9WQyudrt359Osb5H1BlvTIgaMYPFck7bNGTZ4QH/A7PNWtLuWImjAAAAAElFTkSuQmCC'
const LOGO_PAYPAL  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAD3ElEQVR42u2YPW9cRRSGn3Nmdu21F8fOt4MJJAGhBAJISDQIkSJBFBEpkWip6fkFICq6CImSghYkfgEFVUSBIAIJKVIgBH/GXq/tvR9zDsWsjWmQdp1dGeQp79W988x7zvvO3Cvu7hzioRzycQR4BHgE+F8HjAd52AG3hO0lqezdE3FUQGS/DjLwHHKQoE4Y4d+K4E4yI2gAsbwi0fEo6O4EEX76dZEH91cJMfaVdBRl7mSbq1dO0wgBSwlVzZDjUND7IJac1259yvd3lqA9BbXvVTG0hFcuzvDxh+9w440LWG1ojOMCdESElUddLt+6zdqGI03HPVdR3XAitrnDTKvmzlcf8NwzpzAHVRm9i3eXtLK6TWe9wDRhtWOpxlPCDDwlmnMtOp3El9/8ACKY2XhiZlf0h4vrlNsFoa+KoAjgAh4cM0Mayt17K/ie78cQM7vT/L7cgeSIRPASyi3EEhAQBw1KvV1wrI4IYOMC3B0Pl7cBzcpZje9sgCdcIuJOCor0dviu22GxdE5FxX03G0dUYsdwz730YLkLAi4GVu9FTHTDJTsmtBI/xlk+u7uGqu4L9VFudX0J/ljuZEAM99R3seRCCkiq0FYbuXiJb3/r5Al15IBC7Jviz8UuxJCb0hzxvkEEgghW9GhcvoLPz7HRC7hLNtGoFRQRiqJkcWUbYsgl72ejS46htLXDxMmzpLdeh8qYjQnp35ORmsQdRHnU6bG2sQNBsyJFiZY1BIFmk3j1ReTta6SZY8hGwYW5qb3dO4wS0NwIoiw/6rK+3UPiBFLVNG68iT79JF5V6BMtqjMnKGuIVYkH4frCVG7MAW08hIL55UurXVKZ0KYTPWIvXaI8cRyqCnFFykQUKKvICzMFN8+3cdeBTRIHj5kMuLjagwTijrUmSSHiOyVqYKkAh2TGbKPg9rXzTDebmDkqMuqg/nubwwSxGpluMBGalG6IOVeOCU9NNLg4K7z/8jlePT5FbYkoMvChdQgFM+CDpU1EcupZaxKaEasL2lH4+uYCz7Yn9/WtE3W4yNXBH8gevPdwHY9CnQRrtfEokIQzE4Gzk40cNe75iCXCsGNgBVUSEOmtd4luTFtFNdOg1JzQZyaE6Rj6ixGGRxu2B1XBnc8/eZfVTsF0M/DRL5t8cb8gauB0u5lPLg56ULphAAUFnIX5WRbm87W1n7eotyrQmrlo+3pVxg+4e1hwh1Q7qonr55R2I6He4L3n54DUX8jBx4E+O2sccSf841PScRJysKPm4wHEDUNxqzEc8YiIoOFxFPdxAJJjZL9Xvb/XiMhhADz6eXQE+P8H/AsAF+RuW9XV+wAAAABJRU5ErkJggg=='

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr.split('T')[0] + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })
}

export interface EstimateData {
  estimateNumber: string
  issueDate: string
  validUntil: string
  clientName: string
  clientEmail: string
  clientPhone: string
  clientAddress: string
  notes: string
  taxRate: number
  items: Array<{ description: string; qty: number; unitPrice: number; total: number }>
  subtotal: number
  tax: number
  total: number
}

interface Props {
  estimate: EstimateData | null
  open: boolean
  onClose: () => void
}

const logoStyle: React.CSSProperties = { width: 18, height: 18, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }

export default function EstimatePDFModal({ estimate, open, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState('')

  function handlePrint() {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html>
      <head>
        <meta charset="UTF-8"/>
        <title>${estimate?.estimateNumber || 'Estimate'}</title>
        <style>
          @font-face { font-family: Joyful; src: url('/Joyful.ttf') format('truetype'); }
          *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
          body{font-family:Joyful,cursive;background:#fff;}
          @page{size:A4;margin:16mm 14mm;}
        </style>
      </head>
      <body>${content.outerHTML}</body></html>`)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 600)
  }

  async function handleSendEmail() {
    if (!estimate) return
    if (!estimate.clientEmail) { setSendError('No email address provided.'); return }
    setSending(true)
    setSendError('')
    setSent(false)
    try {
      const res = await fetch('/api/estimates/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(estimate),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      setSent(true)
      setTimeout(() => setSent(false), 4000)
    } catch (e: any) {
      setSendError(e.message || 'Failed to send email.')
    } finally {
      setSending(false)
    }
  }

  if (!open || !estimate) return null

  const paymentMethods = [
    { logo: <svg width="32" height="22" viewBox="0 0 32 22" fill="none"><rect width="32" height="22" rx="3" fill="#1A1F71"/><rect y="6" width="32" height="5" fill="#F7B600"/><rect x="3" y="14" width="8" height="2.5" rx="1" fill="white" opacity="0.6"/></svg>, label: <><span style={{ color: '#6b7280' }}>Debit / Credit Card</span> — Electronic payments include a 3% service fee</> },
    { logo: <img src={LOGO_ZELLE} alt="Zelle" style={logoStyle} />, label: <><span style={{ color: '#6b7280' }}>Zelle</span> <strong style={{ color: '#111827' }}>@joyfulcleaningservices</strong></> },
    { logo: <img src={LOGO_CASHAPP} alt="CashApp" style={logoStyle} />, label: <><span style={{ color: '#6b7280' }}>Cashapp</span> <strong style={{ color: '#111827' }}>$Nathashasalcedo</strong></> },
    { logo: <img src={LOGO_VENMO} alt="Venmo" style={logoStyle} />, label: <><span style={{ color: '#6b7280' }}>Venmo</span> <strong style={{ color: '#111827' }}>@joyfulcleaningservices</strong></> },
    { logo: <img src={LOGO_PAYPAL} alt="PayPal" style={logoStyle} />, label: <><span style={{ color: '#6b7280' }}>PayPal</span> <strong style={{ color: '#111827' }}>@joyfulcleaningnc</strong></> },
    { logo: <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect width="22" height="22" rx="4" fill="#16a34a"/><rect x="3" y="7" width="16" height="8" rx="1.5" stroke="white" strokeWidth="1.5"/><circle cx="11" cy="11" r="2.5" stroke="white" strokeWidth="1.5"/></svg>, label: <span style={{ color: '#6b7280' }}>Cash or Check</span> },
  ]

  const cellBase: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'middle' }
  const monoR: React.CSSProperties = { ...cellBase, textAlign: 'right', fontSize: 12 }
  const joyfulFont = (size: number, extra?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: 'Joyful, cursive', fontSize: size, color: '#4b3fa0', ...extra,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-3xl overflow-hidden shadow-[0_32px_100px_rgba(0,0,0,0.6)] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#2a2f3d] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText size={16} color="#4f8ef7" />
            <span className="text-sm font-semibold text-[#e2e8f0]">
              Estimate Preview — {estimate.estimateNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {sendError && <span className="text-[11px] text-[#f87171]">{sendError}</span>}
            {sent && <span className="text-[11px] text-[#38d9a9]">✓ Sent!</span>}
            <button
              onClick={handleSendEmail}
              disabled={sending || !estimate.clientEmail}
              title={!estimate.clientEmail ? 'No email address' : 'Send estimate by email'}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#26BD97] hover:bg-[#1fa882] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-40"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {sending ? 'Sending…' : 'Send Email'}
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-all">
              <Download size={13} /> Download PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* PDF Preview */}
        <div className="overflow-y-auto flex-1 p-5 bg-[#0d0f14]">
          <div ref={printRef} style={{
            background: '#ffffff', borderRadius: 9, padding: '36px 40px',
            color: '#1a1a2e', fontFamily: 'Joyful, cursive', fontSize: 12, lineHeight: 1.5,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)', maxWidth: 680, margin: '0 auto',
          }}>

            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img src="/Joyful_logo_transparent.png" alt="Joyful Cleaning Services Corp."
                  style={{ height: 90, width: 'auto', objectFit: 'contain' }} />
                <div>
                  <div style={joyfulFont(28, { lineHeight: 1.1, marginBottom: 4 })}>Joyful Cleaning Services Corp.</div>
                  <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.65 }}>
                    320 Laketree Blvd, Spring Lake NC 28390<br />
                    (919) 322-9092 · joyfulcleaningservicescorp@gmail.com<br />
                    joyfulcleaningservicesnc.com
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'rgba(75,63,160,0.4)', letterSpacing: '3px', textTransform: 'uppercase', lineHeight: 1 }}>
                  ESTIMATE
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />

            {/* CLIENT + META */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Prepared For</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{estimate.clientName || '—'}</div>
                <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.7 }}>
                  {estimate.clientEmail && <>{estimate.clientEmail}<br /></>}
                  {estimate.clientPhone && <>{estimate.clientPhone}<br /></>}
                  {estimate.clientAddress && <>{estimate.clientAddress}</>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 19, fontWeight: 500, color: '#4f8ef7', marginBottom: 3 }}>
                  {estimate.estimateNumber}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.8 }}>
                  Issued: <span style={{ color: '#374151', fontWeight: 600 }}>{formatDate(estimate.issueDate)}</span><br />
                  Valid Until: <span style={{ color: '#374151', fontWeight: 600 }}>{estimate.validUntil ? formatDate(estimate.validUntil) : '—'}</span>
                </div>
              </div>
            </div>

            {/* LINE ITEMS TABLE */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
              <thead>
                <tr>
                  {[
                    { label: 'Description', align: 'left' as const,  w: 300 },
                    { label: 'Qty',         align: 'right' as const, w: 60  },
                    { label: 'Unit Price',  align: 'right' as const, w: 100 },
                    { label: 'Total',       align: 'right' as const, w: 100 },
                  ].map(({ label, align, w }) => (
                    <th key={label} style={{
                      background: '#f9fafb', padding: '8px 10px',
                      fontSize: 10, fontWeight: 700, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      textAlign: align, width: w,
                      borderBottom: '2px solid #e5e7eb',
                    }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estimate.items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={cellBase}>{item.description || '—'}</td>
                    <td style={monoR}>{item.qty}</td>
                    <td style={monoR}>${Number(item.unitPrice).toFixed(2)}</td>
                    <td style={{ ...monoR, fontWeight: 700 }}>${Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* TOTALS */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
              <div style={{ width: 220 }}>
                {estimate.taxRate > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: '#6b7280' }}>
                      <span>Subtotal</span>
                      <span>${estimate.subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: '#6b7280' }}>
                      <span>Tax ({estimate.taxRate}%)</span>
                      <span>${estimate.tax.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  borderTop: `${estimate.taxRate > 0 ? '2px' : '1px'} solid #e5e7eb`,
                  paddingTop: 8, marginTop: 4, fontSize: 16, fontWeight: 800, color: '#111827',
                }}>
                  <span>TOTAL</span>
                  <span style={{ color: '#4b3fa0' }}>${estimate.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* NOTES */}
            {estimate.notes && (
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>Notes</div>
                <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.7 }}>{estimate.notes}</div>
              </div>
            )}

            {/* PAYMENT METHODS */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
                Payment Methods Accepted
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {paymentMethods.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
                    {m.logo}
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* FOOTER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 14, marginTop: 20, borderTop: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.7, maxWidth: 300 }}>
                This estimate is valid until {estimate.validUntil ? formatDate(estimate.validUntil) : '—'}.<br />
                Thank you for choosing Joyful Cleaning Services Corp..
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
