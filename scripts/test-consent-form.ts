/**
 * Regression tests for the OAuth consent form.
 *
 *   npx ts-node scripts/test-consent-form.ts
 *
 * These render the real ConsentForm component into a real DOM (jsdom) and
 * dispatch real events, then inspect the FormData the browser would actually
 * send. They deliberately do NOT touch the database or insert OAuth codes:
 * the defect being guarded against lived entirely in form serialization, so a
 * test that skips the form would not have caught it — and in fact the existing
 * connector suite, which inserts authorization codes directly, did not.
 *
 * Covers: clicking Allow, clicking Cancel, pressing Enter, the loading state,
 * duplicate submissions, and that the permission checkbox survives into the
 * submitted scope.
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://joyful-crm.vercel.app/oauth/authorize',
  pretendToBeVisual: true,
})

// React and jsdom both need these on globalThis before react-dom is loaded.
const g = globalThis as unknown as Record<string, unknown>
g.window = dom.window
g.document = dom.window.document
// Node exposes `navigator` as a getter-only property, so a plain assignment
// throws — it has to be redefined.
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
})
g.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
g.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
for (const key of [
  'HTMLElement', 'HTMLButtonElement', 'HTMLFormElement', 'HTMLInputElement',
  'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'FormData', 'getComputedStyle',
]) {
  g[key] = (dom.window as unknown as Record<string, unknown>)[key]
}
g.IS_REACT_ACT_ENVIRONMENT = true

/* eslint-disable @typescript-eslint/no-require-imports */
const React = require('react') as typeof import('react')
const { createRoot } = require('react-dom/client') as typeof import('react-dom/client')
const ConsentForm = require('../app/oauth/authorize/ConsentForm').default as typeof import('../app/oauth/authorize/ConsentForm').default
/* eslint-enable @typescript-eslint/no-require-imports */

const { act } = React as unknown as { act: (cb: () => void | Promise<void>) => Promise<void> }

// jsdom does not implement form submission, which is exactly the boundary we
// want to observe: capture what requestSubmit() would have sent.
type Submission = Record<string, string>
let submissions: Submission[] = []

dom.window.HTMLFormElement.prototype.requestSubmit = function requestSubmit(this: HTMLFormElement) {
  const data = new dom.window.FormData(this)
  const entry: Submission = {}
  data.forEach((value, key) => {
    entry[key] = String(value)
  })
  submissions.push(entry)
}

let pass = 0
let fail = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.log(`  FAIL  ${name}`)
    if (detail !== undefined) console.log(`        ${JSON.stringify(detail)}`)
  }
}

const PROPS = {
  ticket: 'signed-consent-ticket.abc123',
  clientName: 'ChatGPT',
  userName: 'Julio',
  userEmail: 'admin@example.com',
  canWrite: true,
  readScope: 'crm.read',
  writeScope: 'crm.write',
}

type Mounted = {
  approve: HTMLButtonElement
  deny: HTMLButtonElement
  checkbox: HTMLInputElement
  form: HTMLFormElement
  unmount: () => Promise<void>
}

async function mount(props: Partial<typeof PROPS> = {}): Promise<Mounted> {
  submissions = []
  const container = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  await act(() => {
    root.render(React.createElement(ConsentForm, { ...PROPS, ...props }))
  })

  const q = <T,>(sel: string) => container.querySelector(sel) as T
  return {
    approve: q<HTMLButtonElement>('[data-testid="approve"]'),
    deny: q<HTMLButtonElement>('[data-testid="deny"]'),
    checkbox: q<HTMLInputElement>('input[type="checkbox"]'),
    form: q<HTMLFormElement>('form'),
    unmount: async () => {
      await act(() => root.unmount())
      container.remove()
    },
  }
}

async function click(el: HTMLElement) {
  await act(() => {
    el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

async function main() {
  console.log('\n— Structure —')
  {
    const ui = await mount()
    const submitButtons = ui.form.querySelectorAll('button[type="submit"], input[type="submit"]')
    check('form has no submit button (implicit submission cannot pick one)', submitButtons.length === 0, submitButtons.length)
    check('approve button is type=button', ui.approve.getAttribute('type') === 'button', ui.approve.getAttribute('type'))
    check('deny button is type=button', ui.deny.getAttribute('type') === 'button', ui.deny.getAttribute('type'))
    const actionField = ui.form.querySelector('input[name="action"]') as HTMLInputElement
    check('a hidden action field carries the decision', actionField?.type === 'hidden', actionField?.type)
    check('action field starts empty', actionField?.value === '', actionField?.value)
    check('form posts to the approval endpoint', ui.form.getAttribute('action') === '/api/oauth/authorize', ui.form.getAttribute('action'))
    await ui.unmount()
  }

  console.log('\n— Clicking Allow —')
  {
    const ui = await mount()
    await click(ui.approve)
    check('exactly one submission', submissions.length === 1, submissions.length)
    check('sends action=approve', submissions[0]?.action === 'approve', submissions[0])
    check('carries the signed ticket', submissions[0]?.ticket === PROPS.ticket, submissions[0]?.ticket)
    check('carries read+write scope when the box is ticked', submissions[0]?.scope === 'crm.read crm.write', submissions[0]?.scope)
    await ui.unmount()
  }

  console.log('\n— Clicking Cancel —')
  {
    const ui = await mount()
    await click(ui.deny)
    check('exactly one submission', submissions.length === 1, submissions.length)
    check('sends action=deny', submissions[0]?.action === 'deny', submissions[0])
    await ui.unmount()
  }

  console.log('\n— Allow and Cancel are distinguishable —')
  {
    const a = await mount()
    await click(a.approve)
    const approveAction = submissions[0]?.action
    await a.unmount()

    const d = await mount()
    await click(d.deny)
    const denyAction = submissions[0]?.action
    await d.unmount()

    check('Allow sends "approve"', approveAction === 'approve', approveAction)
    check('Cancel sends "deny"', denyAction === 'deny', denyAction)
    check('the two actions differ', approveAction !== denyAction, { approveAction, denyAction })
  }

  console.log('\n— Pressing Enter —')
  {
    const ui = await mount()
    await act(() => {
      ui.form.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    })
    check('Enter on the form submits nothing', submissions.length === 0, submissions)

    await act(() => {
      ui.checkbox.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    })
    check('Enter on the checkbox submits nothing', submissions.length === 0, submissions)
    check('no accidental denial was produced', !submissions.some(s => s.action === 'deny'), submissions)
    await ui.unmount()
  }

  console.log('\n— Loading state —')
  {
    const ui = await mount()
    check('approve enabled before submitting', ui.approve.disabled === false)
    check('label reflects the granted scope', ui.approve.textContent?.includes('Allow read & write') === true, ui.approve.textContent)

    await click(ui.approve)
    check('approve disabled after submitting', ui.approve.disabled === true)
    check('deny disabled after submitting', ui.deny.disabled === true)
    check('label switches to a pending message', ui.approve.textContent?.includes('Authorizing') === true, ui.approve.textContent)
    const afterRender = (ui.form.querySelector('input[name="action"]') as HTMLInputElement).value
    check('the action field still reads approve after the re-render', afterRender === 'approve', afterRender)
    await ui.unmount()
  }

  console.log('\n— Duplicate submissions —')
  {
    const ui = await mount()
    await click(ui.approve)
    await click(ui.approve)
    await click(ui.approve)
    check('three clicks produce one submission', submissions.length === 1, submissions.length)
    await ui.unmount()
  }
  {
    // Same tick, before React can re-render the disabled state — the case the
    // `disabled` attribute alone would not catch.
    const ui = await mount()
    await act(() => {
      ui.approve.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      ui.approve.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    check('two clicks in one tick produce one submission', submissions.length === 1, submissions.length)
    await ui.unmount()
  }
  {
    const ui = await mount()
    await click(ui.approve)
    await click(ui.deny)
    check('Cancel after Allow cannot overwrite the decision', submissions.length === 1 && submissions[0].action === 'approve', submissions)
    await ui.unmount()
  }

  console.log('\n— Permission controls are preserved —')
  {
    const ui = await mount()
    // click() runs the real activation behaviour (jsdom flips `checked` itself);
    // assigning `.checked` by hand would defeat React's change tracking.
    await act(() => ui.checkbox.click())
    check('unticking write updates the label', ui.approve.textContent?.includes('Allow read only') === true, ui.approve.textContent)
    await click(ui.approve)
    check('submits read-only scope', submissions[0]?.scope === 'crm.read', submissions[0]?.scope)
    check('still approves', submissions[0]?.action === 'approve', submissions[0]?.action)
    await ui.unmount()
  }
  {
    const ui = await mount({ canWrite: false })
    check('starts unticked when write was not requested', ui.checkbox.checked === false)
    await click(ui.approve)
    check('submits read-only scope', submissions[0]?.scope === 'crm.read', submissions[0]?.scope)
    await ui.unmount()
  }

  console.log(`\n${pass} passed, ${fail} failed\n`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('\nTest run crashed:', err)
  process.exit(1)
})
