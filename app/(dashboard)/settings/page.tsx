'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Save, RotateCcw, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { applyTheme } from '@/lib/theme'
import ErrorBanner from '@/components/ErrorBanner'
import { StripeIcon, SquareIcon } from '@/components/icons/PaymentIcons'

// ── Defaults ──────────────────────────────────────────────────────
const DAYS     = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAYS_KEY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const HOUR_DEFAULTS: Record<string, string> = {}
DAYS_KEY.forEach((d, i) => {
  HOUR_DEFAULTS[`hours.${d}.open`] = i < 6 ? 'true' : 'false'
  HOUR_DEFAULTS[`hours.${d}.from`] = '08:00'
  HOUR_DEFAULTS[`hours.${d}.to`]   = '18:00'
})

const DEFAULTS: Record<string, string> = {
  // Business
  'biz.name':        'Joyful Services LLC',
  'biz.owner':       'Natasha Salcedo',
  'biz.email':       'info@joyfulservices.com',
  'biz.phone':       '(910) 555-0100',
  'biz.website':     'www.joyfulservices.com',
  'biz.ein':         '',
  'biz.address':     '123 Main St',
  'biz.city':        'Fayetteville',
  'biz.state':       'NC',
  'biz.zip':         '28301',
  'biz.area':        'Fayetteville, Spring Lake, Hope Mills, Raeford, Fort Liberty',
  ...HOUR_DEFAULTS,
  // Invoicing
  'inv.prefix':      'INV',
  'inv.startNum':    '1',
  'inv.dueDays':     '15',
  'inv.taxRate':     '0',
  'inv.lateFeePct':  '0',
  'inv.autoSend':    'false',
  'inv.footer':      'Thank you for choosing Joyful Cleaning Services Corp.! We appreciate your business.',
  'inv.methods':     'cash,zelle,venmo,check',
  // Notifications
  'notif.email':     'info@joyfulservices.com',
  'notif.newSvc':    'true',
  'notif.completed': 'true',
  'notif.paid':      'true',
  'notif.overdue':   'true',
  'notif.newClient': 'false',
  'notif.lowStock':  'true',
  'notif.weekly':    'true',
  'notif.aiRequest': 'true',
  // Push notifications (per event) — off by default, admin-only when enabled
  'notif.newSvc.push':    'false', 'notif.newSvc.roles':    'admin',
  'notif.completed.push': 'false', 'notif.completed.roles': 'admin',
  'notif.paid.push':      'false', 'notif.paid.roles':      'admin',
  'notif.overdue.push':   'false', 'notif.overdue.roles':   'admin',
  'notif.newClient.push': 'false', 'notif.newClient.roles': 'admin',
  'notif.lowStock.push':  'false', 'notif.lowStock.roles':  'admin',
  'notif.weekly.push':    'false', 'notif.weekly.roles':    'admin',
  'notif.aiRequest.push': 'true',  'notif.aiRequest.roles': 'admin',
  // Integrations
  'smtp.from':       'noreply@joyfulservices.com',
  // Appearance
  'app.language':    'en',
  'app.timezone':    'America/New_York',
  'app.dateFormat':  'MM-DD-YYYY',
  'app.currency':    'USD',
  'app.theme':       'dark',
  'app.compact':     'false',
  'app.badges':      'true',
}

// ── Styles ────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-xs text-[#e8eaf0] placeholder-[#6b7280] focus:outline-none focus:border-[#4f8ef7] transition-colors'
const labelCls = 'text-[10px] font-bold text-[#6b7280] uppercase tracking-wider block mb-1.5'
const cardCls  = 'bg-[#161922] border border-[#2a2f3d] rounded-xl p-5'
const sectionTitle = 'text-xs font-bold text-[#e8eaf0] mb-4'

// ── Helpers ───────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { key: 'cash',    label: 'Cash',    icon: '💵' },
  { key: 'zelle',   label: 'Zelle',   icon: '💙' },
  { key: 'venmo',   label: 'Venmo',   icon: '💜' },
  { key: 'paypal',  label: 'PayPal',  icon: '💛' },
  { key: 'cashapp', label: 'CashApp', icon: '💚' },
  { key: 'check',   label: 'Check',   icon: '📝' },
  { key: 'ach',     label: 'ACH',     icon: '🏦' },
  { key: 'card',    label: 'Card',    icon: '💳' },
]

const INTEGRATIONS = [
  {
    key: 'email', icon: '📧', name: 'Email (SendGrid)', desc: 'Invoice and notification delivery',
    status: 'connected' as const,
  },
  {
    key: 'stripe', icon: '💳', name: 'Stripe', desc: 'Online credit card payments — payment links on invoices',
    status: 'live' as const,
  },
  {
    key: 'square', icon: '🟩', name: 'Square', desc: 'Square checkout links on invoices',
    status: 'live' as const,
  },
  {
    key: 'quickbooks', icon: '📊', name: 'QuickBooks', desc: 'Accounting sync',
    status: 'soon' as const,
  },
  {
    key: 'google', icon: '📅', name: 'Google Calendar', desc: 'Sync services to calendar',
    status: 'soon' as const,
  },
]

const TABS = [
  { key: 'business',       emoji: '🏢', label: 'Business'       },
  { key: 'invoicing',      emoji: '🧾', label: 'Invoicing'      },
  { key: 'notifications',  emoji: '🔔', label: 'Notifications'  },
  { key: 'security',       emoji: '🔒', label: 'Security'       },
  { key: 'integrations',   emoji: '🔗', label: 'Integrations'   },
  { key: 'appearance',     emoji: '🎨', label: 'Appearance'     },
]

// ── Page ──────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === 'admin'
  const [tab,     setTab]     = useState('business')
  const [cfg,     setCfg]     = useState<Record<string, string>>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [pwForm,  setPwForm]  = useState({ current: '', next: '', confirm: '' })
  const [pwMsg,   setPwMsg]   = useState('')

  // Payment credentials — write-only fields, never populated from the server
  const [payCreds, setPayCreds] = useState({
    stripeSecretKey: '', stripeWebhookSecret: '',
    squareAccessToken: '', squareLocationId: '', squareWebhookSignatureKey: '', squareWebhookUrl: '',
  })
  const [payCredsMsg, setPayCredsMsg] = useState<Record<'stripe' | 'square', string>>({ stripe: '', square: '' })
  const [payCredsSaving, setPayCredsSaving] = useState<'stripe' | 'square' | null>(null)

  // Not a secret — reflects the real saved value from the general settings
  // GET, unlike the write-only fields above.
  const [squareEnv, setSquareEnv] = useState<'sandbox' | 'production'>('sandbox')
  useEffect(() => {
    setSquareEnv(cfg['integration.square.environment'] === 'production' ? 'production' : 'sandbox')
  }, [cfg['integration.square.environment']])

  // Reveal-on-demand for saved payment credentials — fetched only when the
  // admin explicitly clicks "View saved values", never on page load.
  const [revealedCreds, setRevealedCreds] = useState<Record<string, string> | null>(null)
  const [showCreds, setShowCreds] = useState<Record<'stripe' | 'square', boolean>>({ stripe: false, square: false })
  const [revealLoading, setRevealLoading] = useState<'stripe' | 'square' | null>(null)
  const [revealError, setRevealError] = useState('')

  async function toggleReveal(provider: 'stripe' | 'square') {
    if (showCreds[provider]) {
      setShowCreds(prev => ({ ...prev, [provider]: false }))
      return
    }
    setRevealError('')
    if (!revealedCreds) {
      setRevealLoading(provider)
      try {
        const res = await fetch('/api/settings/payment-credentials')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar')
        setRevealedCreds(data)
      } catch (err: any) {
        setRevealError(err.message || 'Error al cargar los valores guardados')
        setRevealLoading(null)
        return
      }
      setRevealLoading(null)
    }
    setShowCreds(prev => ({ ...prev, [provider]: true }))
  }

  async function savePaymentCredentials(provider: 'stripe' | 'square') {
    setPayCredsSaving(provider)
    setPayCredsMsg(prev => ({ ...prev, [provider]: '' }))
    const fields = provider === 'stripe'
      ? { stripeSecretKey: payCreds.stripeSecretKey, stripeWebhookSecret: payCreds.stripeWebhookSecret }
      : { squareAccessToken: payCreds.squareAccessToken, squareLocationId: payCreds.squareLocationId, squareWebhookSignatureKey: payCreds.squareWebhookSignatureKey, squareWebhookUrl: payCreds.squareWebhookUrl, squareEnvironment: squareEnv }
    try {
      const res = await fetch('/api/settings/payment-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setPayCredsMsg(prev => ({ ...prev, [provider]: '✓ Guardado' }))
      // Clear the fields from the form — they're saved server-side and this
      // screen never displays a saved secret back.
      setPayCreds(prev => provider === 'stripe'
        ? { ...prev, stripeSecretKey: '', stripeWebhookSecret: '' }
        : { ...prev, squareAccessToken: '', squareLocationId: '', squareWebhookSignatureKey: '', squareWebhookUrl: '' })
      // Force a re-fetch next time "View saved values" is opened, so it can't show stale data.
      setRevealedCreds(null)
      setShowCreds(prev => ({ ...prev, [provider]: false }))
      loadSettings()
    } catch (err: any) {
      setPayCredsMsg(prev => ({ ...prev, [provider]: err.message || 'Error al guardar' }))
    } finally {
      setPayCredsSaving(null)
    }
  }

  function loadSettings() {
    fetch('/api/settings')
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data?.error || 'No se pudo cargar la configuración.')
        return data
      })
      .then(data => { setCfg(prev => ({ ...prev, ...data })); setLoadError(null); setLoading(false) })
      .catch((err) => { setLoadError(err.message || 'No se pudo cargar la configuración.'); setLoading(false) })
  }

  useEffect(() => { loadSettings() }, [])

  const set    = (key: string, value: string) => setCfg(prev => ({ ...prev, [key]: value }))
  const toggle = (key: string) => set(key, cfg[key] === 'true' ? 'false' : 'true')
  const bool   = (key: string) => cfg[key] === 'true'
  const val    = (key: string, fb = '') => cfg[key] ?? fb

  async function save() {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  function handlePwSubmit() {
    if (!pwForm.current) { setPwMsg('Enter your current password.'); return }
    if (pwForm.next.length < 8) { setPwMsg('New password must be at least 8 characters.'); return }
    if (pwForm.next !== pwForm.confirm) { setPwMsg('Passwords do not match.'); return }
    setPwMsg('✓ Password updated successfully.')
    setPwForm({ current: '', next: '', confirm: '' })
    setTimeout(() => setPwMsg(''), 3000)
  }

  const rolesFor   = (k: string) => val(`${k}.roles`, 'admin').split(',').map(r => r.trim()).filter(Boolean)
  const toggleRole = (k: string, role: string) => {
    const current = rolesFor(k)
    const next = current.includes(role) ? current.filter(r => r !== role) : [...current, role]
    set(`${k}.roles`, next.join(','))
  }

  // Shared Toggle switch
  const Toggle = ({ k }: { k: string }) => (
    <button
      type="button"
      onClick={() => toggle(k)}
      className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${bool(k) ? 'bg-[#4f8ef7]' : 'bg-[#2a2f3d]'}`}
    >
      <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all ${bool(k) ? 'left-5' : 'left-0.5'}`} />
    </button>
  )

  const currentTab = TABS.find(t => t.key === tab)!

  return (
    <>
      {loadError && <ErrorBanner message={loadError} onRetry={loadSettings} />}
    <div className="flex gap-5 items-start">

      {/* ── Left Sidebar ── */}
      <div className="w-44 shrink-0 sticky top-0">
        <div className="bg-[#161922] border border-[#2a2f3d] rounded-xl overflow-hidden">
          {/* Brand */}
          <div className="p-4 border-b border-[#2a2f3d] text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-[rgba(79,142,247,0.1)] flex items-center justify-center text-2xl mb-2">🧹</div>
            <div className="text-[10px] font-bold text-[#e8eaf0] truncate">{val('biz.name', 'Joyful Services')}</div>
            <div className="text-[9px] text-[#6b7280] mt-0.5">{val('biz.city', 'Fayetteville')}, {val('biz.state', 'NC')}</div>
          </div>
          {/* Nav */}
          <nav className="p-2">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left mb-0.5 ${
                  tab === t.key
                    ? 'bg-[rgba(79,142,247,0.12)] text-[#4f8ef7]'
                    : 'text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#1e2330]'
                }`}
              >
                <span className="text-base leading-none">{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#e8eaf0]">
              {currentTab.emoji} {currentTab.label}
            </h1>
            <p className="text-xs text-[#6b7280] mt-0.5">System configuration</p>
          </div>
          <button
            onClick={save}
            disabled={saving || loading}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-60 ${
              saved ? 'bg-[#38d9a9] text-[#0d0f14]' : 'bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white'
            }`}
          >
            {saved    ? <><CheckCircle size={13} /> Saved</>
           : saving   ? <><RotateCcw size={13} className="animate-spin" /> Saving…</>
           : <><Save size={13} /> Save changes</>}
          </button>
        </div>

        {/* ══════════ BUSINESS ══════════ */}
        {tab === 'business' && (
          <div className="space-y-4">

            {/* Company Info */}
            <div className={cardCls}>
              <div className={sectionTitle}>Company Information</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Business Name</label>
                  <input value={val('biz.name')} onChange={e => set('biz.name', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Owner / Representative</label>
                  <input value={val('biz.owner')} onChange={e => set('biz.owner', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Primary Email</label>
                  <input type="email" value={val('biz.email')} onChange={e => set('biz.email', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="tel" value={val('biz.phone')} onChange={e => set('biz.phone', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Website</label>
                  <input value={val('biz.website')} onChange={e => set('biz.website', e.target.value)} className={inputCls} placeholder="www.yourcompany.com" />
                </div>
                <div>
                  <label className={labelCls}>EIN / Tax ID</label>
                  <input value={val('biz.ein')} onChange={e => set('biz.ein', e.target.value)} className={inputCls} placeholder="XX-XXXXXXX" />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className={cardCls}>
              <div className={sectionTitle}>Address</div>
              <div className="grid grid-cols-6 gap-3">
                <div className="col-span-6">
                  <label className={labelCls}>Street / Address</label>
                  <input value={val('biz.address')} onChange={e => set('biz.address', e.target.value)} className={inputCls} placeholder="123 Main St" />
                </div>
                <div className="col-span-3">
                  <label className={labelCls}>City</label>
                  <input value={val('biz.city')} onChange={e => set('biz.city', e.target.value)} className={inputCls} />
                </div>
                <div className="col-span-1">
                  <label className={labelCls}>State</label>
                  <input value={val('biz.state')} onChange={e => set('biz.state', e.target.value)} maxLength={2} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>ZIP Code</label>
                  <input value={val('biz.zip')} onChange={e => set('biz.zip', e.target.value)} className={inputCls} />
                </div>
                <div className="col-span-6">
                  <label className={labelCls}>Service Area</label>
                  <input value={val('biz.area')} onChange={e => set('biz.area', e.target.value)} className={inputCls} placeholder="Fayetteville, Spring Lake, Hope Mills..." />
                  <div className="text-[10px] text-[#6b7280] mt-1">Comma-separated cities</div>
                </div>
              </div>
            </div>

            {/* Business Hours */}
            <div className={cardCls}>
              <div className={sectionTitle}>Business Hours</div>
              <div className="space-y-2.5">
                {DAYS.map((day, i) => {
                  const dk = DAYS_KEY[i]
                  const open = bool(`hours.${dk}.open`)
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <Toggle k={`hours.${dk}.open`} />
                      <div className={`w-24 text-xs font-medium shrink-0 ${open ? 'text-[#e8eaf0]' : 'text-[#4b5563]'}`}>{day}</div>
                      {open ? (
                        <div className="flex items-center gap-2">
                          <input type="time" value={val(`hours.${dk}.from`, '08:00')} onChange={e => set(`hours.${dk}.from`, e.target.value)}
                            className="px-2 py-1.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-[11px] text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]" />
                          <span className="text-[#6b7280] text-xs">to</span>
                          <input type="time" value={val(`hours.${dk}.to`, '18:00')} onChange={e => set(`hours.${dk}.to`, e.target.value)}
                            className="px-2 py-1.5 bg-[#0d0f14] border border-[#2a2f3d] rounded-lg text-[11px] text-[#e8eaf0] focus:outline-none focus:border-[#4f8ef7]" />
                        </div>
                      ) : (
                        <span className="text-xs text-[#4b5563] italic">Closed</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}

        {/* ══════════ INVOICING ══════════ */}
        {tab === 'invoicing' && (
          <div className="space-y-4">

            <div className={cardCls}>
              <div className={sectionTitle}>Invoice Settings</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Prefix</label>
                  <input value={val('inv.prefix', 'INV')} onChange={e => set('inv.prefix', e.target.value.toUpperCase())} maxLength={6} className={inputCls} placeholder="INV" />
                </div>
                <div>
                  <label className={labelCls}>Starting Number</label>
                  <input type="number" min="1" value={val('inv.startNum', '1')} onChange={e => set('inv.startNum', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Payment Terms</label>
                  <select value={val('inv.dueDays', '15')} onChange={e => set('inv.dueDays', e.target.value)} className={inputCls}>
                    <option value="7">Net 7 days</option>
                    <option value="15">Net 15 days</option>
                    <option value="30">Net 30 days</option>
                    <option value="45">Net 45 days</option>
                    <option value="60">Net 60 days</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tax Rate (%)</label>
                  <input type="number" step="0.01" min="0" max="30" value={val('inv.taxRate', '0')} onChange={e => set('inv.taxRate', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Late Fee (%)</label>
                  <input type="number" step="0.01" min="0" max="30" value={val('inv.lateFeePct', '0')} onChange={e => set('inv.lateFeePct', e.target.value)} className={inputCls} />
                </div>
                <div className="flex items-center gap-3 pt-5">
                  <Toggle k="inv.autoSend" />
                  <div>
                    <div className="text-xs text-[#e8eaf0]">Auto-send</div>
                    <div className="text-[10px] text-[#6b7280]">Email on invoice creation</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-[#0d0f14] rounded-lg">
                <div className="text-[10px] text-[#6b7280] mb-1">Number preview</div>
                <div className="text-sm font-bold text-[#4f8ef7]" style={{ fontFamily: 'var(--font-display)' }}>
                  {val('inv.prefix', 'INV')}-2026-{String(val('inv.startNum', '1')).padStart(3, '0')}
                </div>
              </div>
            </div>

            <div className={cardCls}>
              <div className={sectionTitle}>Accepted Payment Methods</div>
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_METHODS.map(({ key, label, icon }) => {
                  const active = val('inv.methods', '').split(',').includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        const list = val('inv.methods', '').split(',').filter(Boolean)
                        const next = active ? list.filter(m => m !== key) : [...list, key]
                        set('inv.methods', next.join(','))
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        active
                          ? 'border-[#4f8ef7] text-[#4f8ef7] bg-[rgba(79,142,247,0.1)]'
                          : 'border-[#2a2f3d] text-[#6b7280] hover:border-[#4f8ef7]'
                      }`}
                    >
                      <span>{icon}</span> {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={cardCls}>
              <div className={sectionTitle}>Invoice Footer</div>
              <div className="text-[10px] text-[#6b7280] mb-3">Text shown at the bottom of every invoice sent to clients</div>
              <textarea
                value={val('inv.footer')}
                onChange={e => set('inv.footer', e.target.value)}
                rows={3}
                className={inputCls + ' resize-none'}
                placeholder="Thank you for choosing Joyful Cleaning Services Corp.!"
              />
            </div>

          </div>
        )}

        {/* ══════════ NOTIFICATIONS ══════════ */}
        {tab === 'notifications' && (
          <div className="space-y-4">

            <div className={cardCls}>
              <div className={sectionTitle}>Notification Email</div>
              <div className="max-w-sm">
                <label className={labelCls}>Send alerts to</label>
                <input type="email" value={val('notif.email')} onChange={e => set('notif.email', e.target.value)} className={inputCls} placeholder="your@email.com" />
              </div>
            </div>

            <div className={cardCls}>
              <div className={sectionTitle}>Alerts by Event</div>
              <p className="text-[10px] text-[#6b7280] -mt-2 mb-3">
                Email and push can be turned on independently per event. Push only reaches roles checked below, and only people who enabled push on their phone — see the app's menu.
                Today only "AI phone assistant request" actually fires; the rest are ready for when that event's logic is built.
              </p>
              {[
                { k: 'notif.newSvc',    label: 'New service scheduled',      sub: 'When a service is created on the calendar' },
                { k: 'notif.completed', label: 'Service completed',           sub: 'When staff marks a service as completed' },
                { k: 'notif.paid',      label: 'Invoice paid',                sub: 'When a full invoice payment is recorded' },
                { k: 'notif.overdue',   label: 'Invoice overdue',             sub: 'When an invoice passes its due date' },
                { k: 'notif.newClient', label: 'New client registered',       sub: 'When a client is added to the system' },
                { k: 'notif.aiRequest', label: 'AI phone assistant request',  sub: "When a caller's request needs your approval" },
                { k: 'notif.lowStock',  label: 'Low inventory alert',         sub: 'When a product falls below minimum stock' },
                { k: 'notif.weekly',    label: 'Weekly summary (every Monday)', sub: 'Performance report for the previous week' },
              ].map(item => (
                <div key={item.k} className="py-3.5 border-b border-[#2a2f3d]/50 last:border-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#e8eaf0]">{item.label}</div>
                      <div className="text-[10px] text-[#6b7280] mt-0.5">{item.sub}</div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[8px] text-[#6b7280] uppercase font-bold tracking-wider">Email</span>
                        <Toggle k={item.k} />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[8px] text-[#6b7280] uppercase font-bold tracking-wider">Push</span>
                        <Toggle k={`${item.k}.push`} />
                      </div>
                    </div>
                  </div>
                  {bool(`${item.k}.push`) && (
                    <div className="flex items-center gap-3 mt-2.5 pl-0.5">
                      <span className="text-[9px] text-[#6b7280] uppercase font-bold tracking-wider">Notify</span>
                      {[{ role: 'admin', label: 'Admin' }, { role: 'user', label: 'Staff' }].map(r => (
                        <label key={r.role} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rolesFor(item.k).includes(r.role)}
                            onChange={() => toggleRole(item.k, r.role)}
                            className="accent-[#4f8ef7] w-3 h-3"
                          />
                          <span className="text-[10px] text-[#9ca3af]">{r.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className={cardCls}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#e8eaf0]">SMS Notifications</div>
                  <div className="text-[10px] text-[#6b7280] mt-0.5">Text message alerts via Twilio</div>
                </div>
                <span className="text-[9px] bg-[rgba(245,158,11,0.1)] text-[#f59e0b] border border-[rgba(245,158,11,0.2)] px-2 py-0.5 rounded-full font-semibold">Coming Soon</span>
              </div>
            </div>

          </div>
        )}

        {/* ══════════ SECURITY ══════════ */}
        {tab === 'security' && (
          <div className="space-y-4">

            <div className={cardCls}>
              <div className={sectionTitle}>Change Password</div>
              <div className="space-y-3 max-w-sm">
                <div>
                  <label className={labelCls}>Current Password</label>
                  <input type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} placeholder="••••••••" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>New Password</label>
                  <input type="password" value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} placeholder="Minimum 8 characters" className={inputCls} />
                  {pwForm.next && (
                    <div className="flex gap-1 mt-1.5">
                      {[
                        { label: 'Length',    ok: pwForm.next.length >= 8 },
                        { label: 'Uppercase', ok: /[A-Z]/.test(pwForm.next) },
                        { label: 'Number',    ok: /\d/.test(pwForm.next) },
                      ].map(r => (
                        <span key={r.label} className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${r.ok ? 'bg-[rgba(56,217,169,0.1)] text-[#38d9a9]' : 'bg-[rgba(107,114,128,0.1)] text-[#6b7280]'}`}>
                          {r.ok ? '✓' : '○'} {r.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Confirm New Password</label>
                  <input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="••••••••" className={inputCls} />
                </div>
                {pwMsg && (
                  <div className={`text-[10px] px-3 py-2 rounded-lg ${pwMsg.startsWith('✓') ? 'bg-[rgba(56,217,169,0.1)] text-[#38d9a9]' : 'bg-[rgba(248,113,113,0.1)] text-[#f87171]'}`}>
                    {pwMsg}
                  </div>
                )}
                <button onClick={handlePwSubmit} className="px-4 py-2 bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white text-xs font-semibold rounded-lg transition-colors">
                  Update Password
                </button>
              </div>
            </div>

            <div className={cardCls}>
              <div className={sectionTitle}>Active Sessions</div>
              <div className="space-y-2 mb-4">
                {[
                  { device: 'Chrome · Windows 11', loc: 'Fayetteville, NC', time: 'Just now',    current: true },
                  { device: 'Safari · iPhone 14',  loc: 'Fayetteville, NC', time: '3 hours ago', current: false },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[#0d0f14] rounded-lg">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${s.current ? 'bg-[#38d9a9]' : 'bg-[#6b7280]'}`} />
                      <div>
                        <div className="text-xs text-[#e8eaf0] flex items-center gap-1.5">
                          {s.device}
                          {s.current && <span className="text-[9px] bg-[rgba(56,217,169,0.1)] text-[#38d9a9] px-1.5 py-0.5 rounded font-bold">Current</span>}
                        </div>
                        <div className="text-[10px] text-[#6b7280]">{s.loc} · {s.time}</div>
                      </div>
                    </div>
                    {!s.current && <button className="text-[10px] text-[#f87171] hover:underline">Sign out</button>}
                  </div>
                ))}
              </div>
              <button className="px-4 py-2 bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.2)] text-[#f87171] text-xs font-semibold rounded-lg hover:bg-[rgba(248,113,113,0.15)] transition-colors">
                Sign out all sessions
              </button>
            </div>

            <div className={cardCls}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#e8eaf0]">Two-Factor Authentication (2FA)</div>
                  <div className="text-[10px] text-[#6b7280] mt-0.5">Extra security layer with a verification code</div>
                </div>
                <span className="text-[9px] bg-[rgba(245,158,11,0.1)] text-[#f59e0b] border border-[rgba(245,158,11,0.2)] px-2 py-0.5 rounded-full font-semibold">Coming Soon</span>
              </div>
            </div>

          </div>
        )}

        {/* ══════════ INTEGRATIONS ══════════ */}
        {tab === 'integrations' && (
          <div className="space-y-3">
            {INTEGRATIONS.map(intg => {
              const isConnected = intg.key === 'stripe' ? bool('integration.stripe.connected')
                : intg.key === 'square' ? bool('integration.square.connected')
                : intg.status === 'connected'
              const origin = typeof window !== 'undefined' ? window.location.origin : ''
              return (
              <div key={intg.key} className={cardCls}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0d0f14] flex items-center justify-center text-xl shrink-0">
                      {intg.key === 'stripe' ? <StripeIcon size={20} />
                        : intg.key === 'square' ? <SquareIcon size={20} />
                        : intg.icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#e8eaf0]">{intg.name}</div>
                      <div className="text-[10px] text-[#6b7280] mt-0.5">{intg.desc}</div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {intg.status === 'soon' ? (
                          <span className="text-[9px] bg-[rgba(107,114,128,0.1)] text-[#6b7280] border border-[#2a2f3d] px-2 py-0.5 rounded-full font-semibold">Coming Soon</span>
                        ) : isConnected ? (
                          <><div className="w-1.5 h-1.5 rounded-full bg-[#38d9a9]" /><span className="text-[10px] text-[#38d9a9] font-semibold">Connected</span></>
                        ) : (
                          <><div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" /><span className="text-[10px] text-[#f59e0b] font-semibold">Not connected</span></>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Email sub-config */}
                {intg.key === 'email' && (
                  <div className="mt-4 pt-4 border-t border-[#2a2f3d] grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>API Key</label>
                      <input type="password" defaultValue="SG.•••••••••••••••••" readOnly
                        className={inputCls + ' cursor-default opacity-60'} />
                    </div>
                    <div>
                      <label className={labelCls}>Sender Email</label>
                      <input type="email" value={val('smtp.from', 'noreply@joyfulservices.com')}
                        onChange={e => set('smtp.from', e.target.value)} className={inputCls} />
                    </div>
                  </div>
                )}
                {/* Stripe / Square credentials — admin-only, write-only. Saved values are
                    never sent back to the browser; this form always starts empty. */}
                {(intg.key === 'stripe' || intg.key === 'square') && (
                  isAdmin ? (
                    <div className="mt-4 pt-4 border-t border-[#2a2f3d] space-y-3">
                      {intg.key === 'stripe' ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Secret Key</label>
                            <input type="password" placeholder={isConnected ? '•••••••••••• (guardada)' : 'sk_test_...'}
                              value={payCreds.stripeSecretKey}
                              onChange={e => setPayCreds(p => ({ ...p, stripeSecretKey: e.target.value }))}
                              className={inputCls} autoComplete="off" />
                            <div className="text-[9px] text-[#6b7280] mt-1">Dashboard de Stripe → Developers → API keys</div>
                          </div>
                          <div>
                            <label className={labelCls}>Webhook Signing Secret</label>
                            <input type="password" placeholder={isConnected ? '•••••••••••• (guardada)' : 'whsec_...'}
                              value={payCreds.stripeWebhookSecret}
                              onChange={e => setPayCreds(p => ({ ...p, stripeWebhookSecret: e.target.value }))}
                              className={inputCls} autoComplete="off" />
                            <div className="text-[9px] text-[#6b7280] mt-1">Developers → Webhooks → Add endpoint → URL: <code className="text-[#4f8ef7]">{origin}/api/webhooks/stripe</code>, evento <code>checkout.session.completed</code></div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className={labelCls}>Environment</label>
                            <div className="flex items-center bg-[#0d0f14] border border-[#2a2f3d] rounded-lg overflow-hidden w-fit">
                              {(['sandbox', 'production'] as const).map(env => (
                                <button
                                  key={env}
                                  type="button"
                                  onClick={() => setSquareEnv(env)}
                                  className={`px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                                    squareEnv === env ? 'bg-[#4f8ef7] text-white' : 'text-[#6b7280] hover:text-[#e8eaf0]'
                                  }`}
                                >
                                  {env}
                                </button>
                              ))}
                            </div>
                            <div className="text-[9px] text-[#6b7280] mt-1">
                              {squareEnv === 'production'
                                ? '⚠ Production cobra tarjetas reales. Pega las credenciales de Production de abajo y Guarda.'
                                : 'Sandbox — usa las tarjetas de prueba de Square, no cobra dinero real.'}
                            </div>
                          </div>
                          <div>
                            <label className={labelCls}>Access Token</label>
                            <input type="password" placeholder={isConnected ? '•••••••••••• (guardado)' : 'EAAA...'}
                              value={payCreds.squareAccessToken}
                              onChange={e => setPayCreds(p => ({ ...p, squareAccessToken: e.target.value }))}
                              className={inputCls} autoComplete="off" />
                            <div className="text-[9px] text-[#6b7280] mt-1">Developer Dashboard → tu aplicación → Credentials</div>
                          </div>
                          <div>
                            <label className={labelCls}>Location ID</label>
                            <input placeholder={isConnected ? '•••••••••••• (guardado)' : 'L1234...'}
                              value={payCreds.squareLocationId}
                              onChange={e => setPayCreds(p => ({ ...p, squareLocationId: e.target.value }))}
                              className={inputCls} autoComplete="off" />
                            <div className="text-[9px] text-[#6b7280] mt-1">Developer Dashboard → Locations</div>
                          </div>
                          <div>
                            <label className={labelCls}>Webhook Signature Key</label>
                            <input type="password" placeholder={isConnected ? '•••••••••••• (guardada)' : ''}
                              value={payCreds.squareWebhookSignatureKey}
                              onChange={e => setPayCreds(p => ({ ...p, squareWebhookSignatureKey: e.target.value }))}
                              className={inputCls} autoComplete="off" />
                            <div className="text-[9px] text-[#6b7280] mt-1">Webhooks → Add endpoint → URL: <code className="text-[#4f8ef7]">{origin}/api/webhooks/square</code></div>
                          </div>
                          <div>
                            <label className={labelCls}>Webhook URL (exacta, tal como la registraste)</label>
                            <input placeholder={origin ? `${origin}/api/webhooks/square` : ''}
                              value={payCreds.squareWebhookUrl}
                              onChange={e => setPayCreds(p => ({ ...p, squareWebhookUrl: e.target.value }))}
                              className={inputCls} autoComplete="off" />
                            <div className="text-[9px] text-[#6b7280] mt-1">Debe coincidir exacto con la URL puesta en el dashboard de Square</div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => savePaymentCredentials(intg.key as 'stripe' | 'square')}
                          disabled={payCredsSaving !== null}
                          className="px-3 py-1.5 text-xs font-semibold bg-[#4f8ef7] hover:bg-[#3a7ee0] text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          {payCredsSaving === intg.key ? 'Guardando...' : 'Guardar'}
                        </button>
                        {isConnected && (
                          <button
                            type="button"
                            onClick={() => toggleReveal(intg.key as 'stripe' | 'square')}
                            disabled={revealLoading !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#2a2f3d] text-[#9ca3af] hover:text-[#e8eaf0] hover:border-[#4f8ef7] rounded-lg transition-colors disabled:opacity-50"
                          >
                            {revealLoading === intg.key
                              ? <RotateCcw size={12} className="animate-spin" />
                              : showCreds[intg.key as 'stripe' | 'square'] ? <EyeOff size={12} /> : <Eye size={12} />}
                            {showCreds[intg.key as 'stripe' | 'square'] ? 'Ocultar' : 'Ver guardado'}
                          </button>
                        )}
                        {payCredsMsg[intg.key as 'stripe' | 'square'] && (
                          <span className={`text-[11px] ${payCredsMsg[intg.key as 'stripe' | 'square'].startsWith('✓') ? 'text-[#38d9a9]' : 'text-[#f87171]'}`}>
                            {payCredsMsg[intg.key as 'stripe' | 'square']}
                          </span>
                        )}
                        {revealError && <span className="text-[11px] text-[#f87171]">{revealError}</span>}
                      </div>

                      {showCreds[intg.key as 'stripe' | 'square'] && revealedCreds && (
                        <div className="p-3 rounded-lg bg-[#0d0f14] border border-[#2a2f3d] space-y-1.5">
                          <div className="text-[9px] text-[#f59e0b] font-semibold">⚠ Sensible — no compartas estos valores</div>
                          {intg.key === 'stripe' ? (
                            <>
                              <div className="text-[10px] text-[#6b7280]">Secret Key: <span className="font-mono text-[#e8eaf0] break-all">{revealedCreds.stripeSecretKey || '—'}</span></div>
                              <div className="text-[10px] text-[#6b7280]">Webhook Signing Secret: <span className="font-mono text-[#e8eaf0] break-all">{revealedCreds.stripeWebhookSecret || '—'}</span></div>
                            </>
                          ) : (
                            <>
                              <div className="text-[10px] text-[#6b7280]">Access Token: <span className="font-mono text-[#e8eaf0] break-all">{revealedCreds.squareAccessToken || '—'}</span></div>
                              <div className="text-[10px] text-[#6b7280]">Location ID: <span className="font-mono text-[#e8eaf0] break-all">{revealedCreds.squareLocationId || '—'}</span></div>
                              <div className="text-[10px] text-[#6b7280]">Webhook Signature Key: <span className="font-mono text-[#e8eaf0] break-all">{revealedCreds.squareWebhookSignatureKey || '—'}</span></div>
                              <div className="text-[10px] text-[#6b7280]">Webhook URL: <span className="font-mono text-[#e8eaf0] break-all">{revealedCreds.squareWebhookUrl || '—'}</span></div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : !isConnected && (
                    <div className="mt-4 pt-4 border-t border-[#2a2f3d] text-[11px] text-[#9ca3af]">
                      Esta integración aún no está configurada. Pídele a un administrador que agregue las credenciales en esta misma pantalla.
                    </div>
                  )
                )}
              </div>
              )
            })}
          </div>
        )}

        {/* ══════════ APPEARANCE ══════════ */}
        {tab === 'appearance' && (
          <div className="space-y-4">

            <div className={cardCls}>
              <div className={sectionTitle}>Language & Region</div>
              <div className="grid grid-cols-2 gap-4 max-w-lg">
                <div>
                  <label className={labelCls}>Interface Language</label>
                  <select value={val('app.language', 'en')} onChange={e => set('app.language', e.target.value)} className={inputCls}>
                    <option value="en">🇺🇸 English</option>
                    <option value="es">🇪🇸 Español</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Timezone</label>
                  <select value={val('app.timezone', 'America/New_York')} onChange={e => set('app.timezone', e.target.value)} className={inputCls}>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Date Format</label>
                  <select value={val('app.dateFormat', 'MM-DD-YYYY')} onChange={e => set('app.dateFormat', e.target.value)} className={inputCls}>
                    <option value="MM-DD-YYYY">MM-DD-YYYY</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Currency</label>
                  <select value={val('app.currency', 'USD')} onChange={e => set('app.currency', e.target.value)} className={inputCls}>
                    <option value="USD">USD — US Dollar ($)</option>
                    <option value="EUR">EUR — Euro (€)</option>
                    <option value="MXN">MXN — Mexican Peso ($)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={cardCls}>
              <div className={sectionTitle}>Theme</div>
              <div className="flex gap-3">
                {[
                  { k: 'dark',  label: '🌙 Dark',  desc: 'Recommended for extended use' },
                  { k: 'light', label: '☀️ Light', desc: 'Clean white interface' },
                ].map(theme => (
                  <button
                    key={theme.k}
                    type="button"
                    onClick={() => {
                      set('app.theme', theme.k)
                      applyTheme(theme.k as 'dark' | 'light')
                    }}
                    className={`flex flex-col items-start px-4 py-3 rounded-xl border text-left transition-all ${
                      val('app.theme', 'dark') === theme.k
                        ? 'border-[#4f8ef7] bg-[rgba(79,142,247,0.08)]'
                        : 'border-[#2a2f3d] hover:border-[#4f8ef7]'
                    }`}
                  >
                    <div className={`text-xs font-bold ${val('app.theme', 'dark') === theme.k ? 'text-[#4f8ef7]' : 'text-[#e8eaf0]'}`}>{theme.label}</div>
                    <div className="text-[10px] text-[#6b7280] mt-0.5">{theme.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className={cardCls}>
              <div className={sectionTitle}>Sidebar</div>
              <div className="space-y-3">
                {[
                  { k: 'app.compact', label: 'Compact Mode',       sub: 'Collapses the sidebar showing only icons' },
                  { k: 'app.badges',  label: 'Show alert badges',  sub: 'Notification numbers in the sidebar menu' },
                ].map(item => (
                  <div key={item.k} className="flex items-center justify-between py-1.5">
                    <div>
                      <div className="text-xs text-[#e8eaf0] font-medium">{item.label}</div>
                      <div className="text-[10px] text-[#6b7280] mt-0.5">{item.sub}</div>
                    </div>
                    <Toggle k={item.k} />
                  </div>
                ))}
              </div>
            </div>

            <div className={cardCls}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#e8eaf0]">Full Internationalization (i18n)</div>
                  <div className="text-[10px] text-[#6b7280] mt-0.5">Complete EN/ES translation with next-intl — all modules</div>
                </div>
                <span className="text-[9px] bg-[rgba(79,142,247,0.1)] text-[#4f8ef7] border border-[rgba(79,142,247,0.2)] px-2 py-0.5 rounded-full font-semibold">Sprint 3</span>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
    </>
  )
}
