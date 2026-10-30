'use client'

import { useRef, useState } from 'react'

/**
 * Consent screen for the MCP connector. The write scope is a checkbox rather
 * than a fixed part of the grant so the connector can be rolled out read-only
 * first and upgraded later by reconnecting — without that, the only way to try
 * it safely would be editing code.
 *
 * The approve/deny choice travels in a hidden `action` field that is written
 * synchronously on click, NOT in the `name`/`value` of a submit button.
 *
 * The earlier version used two submit buttons and disabled them from the
 * form's `onSubmit`. React flushes state updates for discrete events
 * synchronously, so both buttons were already `disabled` by the time the
 * browser built the form data set — and a disabled button is barred from
 * being the submitter, so `action` was never sent at all. The server read the
 * missing field as a denial and answered ChatGPT with `access_denied`, which
 * surfaced as "connection cancelled". Having "Cancel" first in tree order was
 * a second route to the same outcome, since implicit submission picks the
 * first submit button.
 *
 * Neither failure mode can recur here: there is no submit button to disable or
 * to pick, and the field carrying the decision is uncontrolled, so no re-render
 * can rewrite it between the click and serialization.
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

type ConsentAction = 'approve' | 'deny'

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
  const formRef = useRef<HTMLFormElement>(null)
  const actionRef = useRef<HTMLInputElement>(null)
  // Duplicate-submit guard kept in a ref, not in `submitting`: two clicks can
  // land in the same tick, before React has re-rendered the disabled state.
  const sentRef = useRef(false)

  function submitWith(action: ConsentAction) {
    if (sentRef.current) return
    const form = formRef.current
    const field = actionRef.current
    if (!form || !field) return

    sentRef.current = true
    // Direct DOM write so the value is in place before serialization, with no
    // dependency on React having re-rendered.
    field.value = action
    // Submit BEFORE touching state. requestSubmit() builds the form's entry
    // list synchronously (HTML form submission algorithm), so the decision is
    // captured here and no React render can land in between. Doing it the
    // other way round would make correctness depend on React's flush timing —
    // which is the assumption that broke this form in the first place.
    form.requestSubmit()
    setSubmitting(true)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0a0f1a] p-6">
      <form
        ref={formRef}
        method="POST"
        action="/api/oauth/authorize"
        onKeyDown={event => {
          // Enter must never submit by itself: with no submit button there is
          // nothing to carry a decision, so an implicit submission could only
          // send an empty `action`. Enter on a focused button is untouched —
          // that dispatches a real click, which goes through submitWith().
          if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
            event.preventDefault()
          }
        }}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121a2a]/85 p-7 shadow-2xl"
      >
        <input type="hidden" name="ticket" value={ticket} readOnly />
        <input type="hidden" name="scope" value={allowWrite ? `${readScope} ${writeScope}` : readScope} readOnly />
        {/*
          No `value` or `defaultValue` prop on purpose: give React one and it
          restores the field on every re-render, wiping the decision. With
          neither, React has nothing to sync and leaves the node alone.
        */}
        <input type="hidden" name="action" ref={actionRef} />

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
            disabled={submitting}
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
            type="button"
            data-testid="deny"
            onClick={() => submitWith('deny')}
            disabled={submitting}
            className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-[#8593a8] transition hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="approve"
            onClick={() => submitWith('approve')}
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
