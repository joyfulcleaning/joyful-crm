'use client'

import { useState } from 'react'

/**
 * Consent screen for the MCP connector. The write scope is a checkbox rather
 * than a fixed part of the grant so the connector can be rolled out read-only
 * first and upgraded later by reconnecting — without that, the only way to try
 * it safely would be editing code.
 */

type Props = {
  ticket: string
  clientName: string
  userName: string
  userEmail: string
  canWrite: boolean
  readScope: string
  writeScope: string
}

const READ_ITEMS = [
  'Clients, addresses and contact details',
  'Services, schedule and staff assignments',
  'Invoices, payments and outstanding balances',
  'Expenses, payroll totals and inventory levels',
]

const WRITE_ITEMS = [
  'Book, reschedule and cancel services',
  'Create and update clients',
  'Record invoice payments and expenses',
  'Assign staff and adjust stock',
]

export default function ConsentForm({
  ticket,
  clientName,
  userName,
  userEmail,
  canWrite,
  readScope,
  writeScope,
}: Props) {
  const [allowWrite, setAllowWrite] = useState(canWrite)
  const [submitting, setSubmitting] = useState(false)

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0a0f1a] p-6">
      <form
        method="POST"
        action="/api/oauth/authorize"
        onSubmit={() => setSubmitting(true)}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121a2a]/85 p-7 shadow-2xl"
      >
        <input type="hidden" name="ticket" value={ticket} />
        <input type="hidden" name="scope" value={allowWrite ? `${readScope} ${writeScope}` : readScope} />

        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#bf90ab]">
          Connect an assistant
        </p>
        <h1 className="mt-2 text-xl font-bold text-[#eaf0fa]">
          Give {clientName} access to Joyful CRM?
        </h1>
        <p className="mt-2 text-sm text-[#8593a8]">
          Signed in as <span className="text-[#eaf0fa]">{userName}</span> ({userEmail}). The assistant will act
          as you, and every change it makes is recorded in the audit log.
        </p>

        <div className="mt-6 rounded-xl border border-white/[0.07] bg-[#0e1626] p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#8593a8]">Always allowed — read</p>
          <ul className="mt-2 space-y-1.5">
            {READ_ITEMS.map(item => (
              <li key={item} className="flex gap-2 text-sm text-[#c7d2e4]">
                <span className="text-[#7c6cf0]">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <label className="mt-4 flex cursor-pointer gap-3 rounded-xl border border-white/[0.07] bg-[#0e1626] p-4">
          <input
            type="checkbox"
            checked={allowWrite}
            onChange={e => setAllowWrite(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#7c6cf0]"
          />
          <span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#8593a8]">
              Also allow changes — write
            </span>
            <ul className="mt-2 space-y-1.5">
              {WRITE_ITEMS.map(item => (
                <li key={item} className="flex gap-2 text-sm text-[#c7d2e4]">
                  <span className="text-[#7c6cf0]">•</span>
                  {item}
                </li>
              ))}
            </ul>
            <span className="mt-2 block text-xs text-[#5d6b82]">
              Leave unchecked to start read-only. Payments, cancellations and stock adjustments still need an
              explicit confirmation on each request.
            </span>
          </span>
        </label>

        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            name="action"
            value="deny"
            disabled={submitting}
            className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-[#8593a8] transition hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            name="action"
            value="approve"
            disabled={submitting}
            className="flex-[1.4] rounded-xl bg-gradient-to-br from-[#7c6cf0] to-[#6a59e6] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#7c6cf0]/30 transition hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? 'Authorizing…' : allowWrite ? 'Allow read & write' : 'Allow read only'}
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-[#5d6b82]">
          You can revoke this at any time from{' '}
          <a href="/settings/assistants" className="underline hover:text-[#8593a8]">
            Settings → Connected assistants
          </a>
          .
        </p>
      </form>
    </main>
  )
}
