'use client'

import { useState, useEffect, useRef } from 'react'
import { X, CheckCircle, Mail, ExternalLink } from 'lucide-react'

interface Props {
  invoice: any
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const inputCls = "w-full px-3 py-2 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors"
const labelCls = "text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5"

export default function InvoicePostGenerateModal({ invoice, open, onClose, onSuccess }: Props) {
  const [stripeLink, setStripeLink]     = useState('')
  const [squareLink, setSquareLink]     = useState('')
  const [platform, setPlatform]         = useState<'stripe' | 'square' | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent]       = useState(false)
  const [qrStripe, setQrStripe]         = useState('')
  const [qrSquare, setQrSquare]         = useState('')
  const [clientEmail, setClientEmail]   = useState('')
  const [autoSaving, setAutoSaving]     = useState(false)
  const stripeTimer = useRef<any>(null)
  const squareTimer = useRef<any>(null)

  // Carga el invoice completo con email del cliente
  useEffect(() => {
    if (!open || !invoice?.id) return
    setStripeLink(invoice.paymentLinkStripe || '')
    setSquareLink(invoice.paymentLinkSquare || '')
    setEmailSent(!!invoice.emailSentAt)

    // Fetch invoice completo para obtener el email
    fetch(`/api/invoices/${invoice.id}`)
      .then(r => r.json())
      .then(data => {
        setClientEmail(data.client?.email || '')
        if (data.paymentLinkStripe) {
          setStripeLink(data.paymentLinkStripe)
          generateQR(data.paymentLinkStripe, 'stripe')
        }
        if (data.paymentLinkSquare) {
          setSquareLink(data.paymentLinkSquare)
          generateQR(data.paymentLinkSquare, 'square')
        }
      })
      .catch(() => {})
  }, [open, invoice?.id])

  function generateQR(url: string, type: 'stripe' | 'square') {
    if (!url || url.length < 10) return
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(url)}`
    if (type === 'stripe') setQrStripe(qrUrl)
    else setQrSquare(qrUrl)
  }

  // Auto-save con debounce al cambiar los links
  function handleStripeChange(val: string) {
    setStripeLink(val)
    generateQR(val, 'stripe')
    if (!val) setQrStripe('')
    clearTimeout(stripeTimer.current)
    stripeTimer.current = setTimeout(() => autoSaveLinks(val, squareLink), 800)
  }

  function handleSquareChange(val: string) {
    setSquareLink(val)
    generateQR(val, 'square')
    if (!val) setQrSquare('')
    clearTimeout(squareTimer.current)
    squareTimer.current = setTimeout(() => autoSaveLinks(stripeLink, val), 800)
  }

  async function autoSaveLinks(stripe: string, square: string) {
    if (!invoice?.id) return
    setAutoSaving(true)
    try {
      await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentLinkStripe: stripe || null,
          paymentLinkSquare: square || null,
        })
      })
      onSuccess()
    } catch {}
    finally { setAutoSaving(false) }
  }

  async function handleSendEmail() {
    setSendingEmail(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: clientEmail }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to send email')
        return
      }
      setEmailSent(true)
      onSuccess()
    } catch {
      alert('Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  if (!open || !invoice) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_32px_100px_rgba(0,0,0,0.6)] max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2f3d] flex-shrink-0">
          <div>
            <div className="text-sm font-bold text-[#e8eaf0]">Invoice Generated ✅</div>
            <div className="text-xs text-[#6b7280] mt-0.5">{invoice.invoiceNumber} · {invoice.client?.name}</div>
          </div>
          <div className="flex items-center gap-2">
            {autoSaving && <span className="text-[10px] text-[#6b7280]">Saving...</span>}
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#252b3b] transition-all">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Payment Links */}
          <div>
            <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-3">
              💳 Payment Links <span className="text-[#6b7280] font-normal normal-case">(optional — auto-saved)</span>
            </div>

            {/* Platform selector */}
            <div className="flex gap-2 mb-4">
              {[
                { key: 'stripe', label: 'Stripe', color: '#635bff' },
                { key: 'square', label: 'Square', color: '#3e9c5f' },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => setPlatform(platform === p.key as any ? null : p.key as any)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all"
                  style={{
                    background:  platform === p.key ? `${p.color}20` : 'transparent',
                    borderColor: platform === p.key ? p.color : '#2a2f3d',
                    color:       platform === p.key ? p.color : '#6b7280',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Stripe */}
            {(platform === 'stripe' || stripeLink) && (
              <div className="mb-3 p-3 bg-[#0d0f14] border border-[#2a2f3d] rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#635bff]" />
                  <span className="text-[10px] font-bold text-[#635bff] uppercase tracking-wider">Stripe</span>
                </div>
                <div>
                  <label className={labelCls}>Payment Link</label>
                  <input
                    value={stripeLink}
                    onChange={e => handleStripeChange(e.target.value)}
                    placeholder="https://buy.stripe.com/..."
                    className={inputCls}
                  />
                </div>
                {stripeLink && (
                  <div className="flex items-start gap-4">
                    {/* QR */}
                    {qrStripe && (
                      <div className="flex flex-col items-center gap-1">
                        <img src={qrStripe} alt="QR Stripe"
                          className="w-20 h-20 rounded-lg border border-[#2a2f3d] bg-white p-1" />
                        <span className="text-[9px] text-[#6b7280]">QR Code</span>
                      </div>
                    )}
                    {/* Pay button preview */}
                    <div className="flex-1 flex flex-col gap-2">
                      <span className="text-[10px] text-[#6b7280]">Pay button preview:</span>
                      <a
                        href={stripeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                        style={{ background: '#635bff' }}
                      >
                        <ExternalLink size={12} />
                        Pay with Stripe
                      </a>
                      <span className="text-[9px] text-[#6b7280]">Both QR and button will appear on the invoice</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Square */}
            {(platform === 'square' || squareLink) && (
              <div className="mb-3 p-3 bg-[#0d0f14] border border-[#2a2f3d] rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#3e9c5f]" />
                  <span className="text-[10px] font-bold text-[#3e9c5f] uppercase tracking-wider">Square</span>
                </div>
                <div>
                  <label className={labelCls}>Payment Link</label>
                  <input
                    value={squareLink}
                    onChange={e => handleSquareChange(e.target.value)}
                    placeholder="https://squareup.com/pay/..."
                    className={inputCls}
                  />
                </div>
                {squareLink && (
                  <div className="flex items-start gap-4">
                    {qrSquare && (
                      <div className="flex flex-col items-center gap-1">
                        <img src={qrSquare} alt="QR Square"
                          className="w-20 h-20 rounded-lg border border-[#2a2f3d] bg-white p-1" />
                        <span className="text-[9px] text-[#6b7280]">QR Code</span>
                      </div>
                    )}
                    <div className="flex-1 flex flex-col gap-2">
                      <span className="text-[10px] text-[#6b7280]">Pay button preview:</span>
                      <a
                        href={squareLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                        style={{ background: '#3e9c5f' }}
                      >
                        <ExternalLink size={12} />
                        Pay with Square
                      </a>
                      <span className="text-[9px] text-[#6b7280]">Both QR and button will appear on the invoice</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-[#2a2f3d]" />

          {/* Send Email */}
          <div>
            <div className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-3">
              📧 Send Invoice by Email
            </div>
            <div className="p-3 bg-[#0d0f14] border border-[#2a2f3d] rounded-xl mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-[#e8eaf0]">{invoice.client?.name}</div>
                {invoice.emailSentAt && (
                  <span className="text-[10px] text-[#38d9a9] bg-[#38d9a920] px-2 py-0.5 rounded-full">
                    Sent ✓
                  </span>
                )}
              </div>
              <div>
                <label className="text-[10px] text-[#6b7280] block mb-1">Send to email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={e => { setClientEmail(e.target.value); setEmailSent(false) }}
                  placeholder="client@email.com"
                  className={inputCls}
                />
                {!clientEmail && (
                  <div className="text-[10px] text-[#f87171] mt-1">
                    No email registered — enter one to send
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail || !clientEmail || emailSent}
              className="w-full py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white"
            >
              {emailSent
                ? <><CheckCircle size={13} /> Email Sent!</>
                : <><Mail size={13} /> {sendingEmail ? 'Sending...' : 'Send Invoice to Client'}</>
              }
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2f3d] flex justify-end flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-[#94a3b8] hover:text-[#e8eaf0] transition-colors">
            Close
          </button>
        </div>

      </div>
    </div>
  )
}
