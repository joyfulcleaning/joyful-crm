import * as read from './assistant-read'
import * as write from './assistant-write'
import { PERIOD_VALUES, type ToolResult, fail } from './assistant-common'
import { SCOPE_WRITE } from './oauth'
import type { AuthUser } from './mobile-auth'

/**
 * The tool catalog advertised over MCP at /api/assistant/mcp.
 *
 * Descriptions here are prompt surface — they are the only thing telling the
 * model when to reach for each tool, so they state *when to use it* rather
 * than restating the name. Where a mistake would be expensive (dates,
 * ambiguous clients, money) they say so explicitly.
 *
 * `annotations.readOnlyHint` matters operationally: ChatGPT skips its approval
 * prompt for read-only tools and keeps it for everything else, which is
 * exactly the behavior we want while driving.
 */

type JsonSchema = {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
}

type ToolDef = {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  readOnly: boolean
  destructive?: boolean
  run: (args: Record<string, unknown>, ctx: write.WriteContext) => Promise<ToolResult>
}

const PERIOD_PROP = {
  type: 'string',
  enum: PERIOD_VALUES,
  description: 'Relative range, resolved on the server in America/New_York. The work week runs Saturday to Friday. Prefer this over computing dates yourself.',
}
const FROM_PROP = { type: 'string', description: 'Explicit start date YYYY-MM-DD. Overrides period when given with "to".' }
const TO_PROP = { type: 'string', description: 'Explicit end date YYYY-MM-DD.' }

const TOOLS: ToolDef[] = [
  // ── Reads ──────────────────────────────────
  {
    name: 'get_today',
    title: "Today's date",
    description:
      "The business's current date, weekday and timezone. Call this before any reasoning about relative dates (\"tomorrow\", \"next Tuesday\") instead of assuming what today is.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    run: () => read.getToday(),
  },
  {
    name: 'search_clients',
    title: 'Search clients',
    description:
      'Find clients by name, phone, address, email, contact name or property code. Use this to turn a name spoken by the user into the clientId every other tool needs. If several come back, ask which one before acting.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name, phone number, street, email or property code. At least 2 characters.' },
        limit: { type: 'number', description: 'Max results (default 15).' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    readOnly: true,
    run: args => read.searchClients(args),
  },
  {
    name: 'get_client',
    title: 'Client detail',
    description:
      'Full record for one client: contact details, billing settings, outstanding balance, last 10 services and last 10 invoices. Use for "when did we last clean X" and "does X owe us anything".',
    inputSchema: {
      type: 'object',
      properties: { clientId: { type: 'string', description: 'Client id from search_clients.' } },
      required: ['clientId'],
      additionalProperties: false,
    },
    readOnly: true,
    run: args => read.getClient(args),
  },
  {
    name: 'list_services',
    title: 'List services',
    description:
      'Services in a date range, with per-status counts and total value. This is the schedule: use it for "what do we have tomorrow", "what is still pending this week", or a single client\'s upcoming jobs.',
    inputSchema: {
      type: 'object',
      properties: {
        period: PERIOD_PROP,
        from: FROM_PROP,
        to: TO_PROP,
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled', 'reschedule'] },
        clientId: { type: 'string' },
        staffId: { type: 'string', description: 'Only services this staff member is assigned to.' },
        type: { type: 'string', description: 'Partial service type match, e.g. "Deep".' },
        limit: { type: 'number', description: 'Max rows (default 50).' },
      },
      additionalProperties: false,
    },
    readOnly: true,
    run: args => read.listServices(args),
  },
  {
    name: 'get_service',
    title: 'Service detail',
    description:
      'One service in full: client, address, pricing, assigned staff, the staff note thread and photo count. Call before modifying a service so you can read back what is about to change.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        serviceNumber: { type: 'number', description: 'The short number shown in the CRM, e.g. 6142.' },
      },
      additionalProperties: false,
    },
    readOnly: true,
    run: args => read.getService(args),
  },
  {
    name: 'check_availability',
    title: 'Check availability',
    description:
      'Which hourly slots are open on a given date (one crew per hour, Monday to Friday). Call before booking so you offer a time that is actually free.',
    inputSchema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'YYYY-MM-DD' } },
      required: ['date'],
      additionalProperties: false,
    },
    readOnly: true,
    run: args => read.checkAvailability(args),
  },
  {
    name: 'list_invoices',
    title: 'List invoices',
    description:
      'Invoices with totals billed and outstanding. Use unpaidOnly for "who still owes us". Filter by client or by issue date range.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue'] },
        clientId: { type: 'string' },
        unpaidOnly: { type: 'boolean', description: 'Only invoices that are not fully paid.' },
        period: PERIOD_PROP,
        from: FROM_PROP,
        to: TO_PROP,
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
    readOnly: true,
    run: args => read.listInvoices(args),
  },
  {
    name: 'get_invoice',
    title: 'Invoice detail',
    description: 'One invoice with its line items and every payment recorded against it.',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
        invoiceNumber: { type: 'string', description: 'e.g. "INV-2026-014".' },
      },
      additionalProperties: false,
    },
    readOnly: true,
    run: args => read.getInvoice(args),
  },
  {
    name: 'business_summary',
    title: 'Business summary',
    description:
      'One-call answer to "how are we doing": services by status and type, value completed vs still scheduled, cash actually collected, expenses, net, new clients, and total outstanding. Note that completed service value and cash collected are different numbers — say which one you are quoting.',
    inputSchema: {
      type: 'object',
      properties: { period: PERIOD_PROP, from: FROM_PROP, to: TO_PROP },
      additionalProperties: false,
    },
    readOnly: true,
    run: args => read.businessSummary(args),
  },
  {
    name: 'list_staff',
    title: 'List staff',
    description: "Staff with roles, pay rates and how many services each is assigned today. Use to resolve a name into the staffId needed to assign work.",
    inputSchema: {
      type: 'object',
      properties: { includeInactive: { type: 'boolean' } },
      additionalProperties: false,
    },
    readOnly: true,
    run: args => read.listStaff(args),
  },
  {
    name: 'list_expenses',
    title: 'List expenses',
    description: 'Expenses in a range with the total and a per-category breakdown. Defaults to this month.',
    inputSchema: {
      type: 'object',
      properties: {
        period: PERIOD_PROP,
        from: FROM_PROP,
        to: TO_PROP,
        category: { type: 'string' },
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
    readOnly: true,
    run: args => read.listExpenses(args),
  },
  {
    name: 'list_inventory',
    title: 'List inventory',
    description: 'Products with stock on hand, which are below their minimum, and total stock value.',
    inputSchema: {
      type: 'object',
      properties: {
        lowStockOnly: { type: 'boolean' },
        query: { type: 'string', description: 'Filter by product name or SKU.' },
      },
      additionalProperties: false,
    },
    readOnly: true,
    run: args => read.listInventory(args),
  },
  {
    name: 'list_pending_approvals',
    title: 'Pending approvals',
    description:
      'Everything waiting on the admin: phone-assistant requests needing approval, staff supply requests, and upcoming estimate visits. Good answer to "anything I need to deal with?".',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    readOnly: true,
    run: () => read.listPendingApprovals(),
  },
  {
    name: 'search',
    title: 'Search the CRM',
    description:
      'Free-text search across clients, services and invoices, returning ids usable with the fetch tool. Prefer the specific tools above when you already know what kind of record you want.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
      additionalProperties: false,
    },
    readOnly: true,
    run: args => read.searchEverything(args),
  },
  {
    name: 'fetch',
    title: 'Fetch a record',
    description: 'Retrieve one record by an id returned from the search tool, e.g. "client:<uuid>".',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    readOnly: true,
    run: args => read.fetchRecord(args),
  },

  // ── Writes ─────────────────────────────────
  {
    name: 'create_service',
    title: 'Book a service',
    description:
      'Schedule a new service for an existing client. Resolve the client with search_clients and the slot with check_availability first. Prices are filled in from the client\'s configured rates unless you pass basePrice explicitly.',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'From search_clients.' },
        serviceDate: { type: 'string', description: 'YYYY-MM-DD, Monday to Friday.' },
        serviceTime: { type: 'string', description: 'One of 08:00 through 17:00, on the hour.' },
        type: { type: 'string', description: 'e.g. "Standard Clean", "Deep Clean", "Move In/Out", "Painting".' },
        address: { type: 'string', description: "Defaults to the client's address." },
        unit: { type: 'string', description: 'Apartment or unit number.' },
        roomSize: { type: 'string', description: 'e.g. "1 bedroom", "3 bedroom" — drives automatic pricing.' },
        frequency: { type: 'string', enum: ['weekly', 'biweekly', 'monthly', 'one_time'] },
        basePrice: { type: 'number', description: 'Overrides automatic pricing.' },
        additionalFee: { type: 'number' },
        notes: { type: 'string', description: 'Internal notes for the crew.' },
        staffIds: { type: 'array', items: { type: 'string' }, description: 'Staff to assign, from list_staff.' },
        sendReminder: { type: 'boolean', description: 'Email the client a reminder the day before.' },
        allowDoubleBooking: { type: 'boolean', description: 'Only pass true after telling the user the slot is already taken.' },
      },
      required: ['clientId', 'serviceDate', 'serviceTime', 'type'],
      additionalProperties: false,
    },
    readOnly: false,
    run: (args, ctx) => write.createService(ctx, args),
  },
  {
    name: 'update_service',
    title: 'Change a service',
    description:
      'Reschedule, re-price, re-type or change the status of an existing service. Setting status to "cancelled" returns a confirmation preview first; call again with confirm: true to actually cancel.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        serviceDate: { type: 'string', description: 'New date YYYY-MM-DD.' },
        serviceTime: { type: 'string', description: 'New time on the hour.' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled', 'reschedule'] },
        type: { type: 'string' },
        basePrice: { type: 'number' },
        additionalFee: { type: 'number' },
        paymentMethod: { type: 'string' },
        notes: { type: 'string', description: 'Appended to the internal notes, not replacing them.' },
        allowDoubleBooking: { type: 'boolean' },
        confirm: { type: 'boolean', description: 'Required to cancel.' },
      },
      required: ['serviceId'],
      additionalProperties: false,
    },
    readOnly: false,
    destructive: true,
    run: (args, ctx) => write.updateService(ctx, args),
  },
  {
    name: 'assign_staff',
    title: 'Assign staff',
    description: 'Add staff to a service, or replace everyone currently assigned with replace: true.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        staffIds: { type: 'array', items: { type: 'string' }, description: 'From list_staff.' },
        replace: { type: 'boolean', description: 'Remove existing assignments first.' },
      },
      required: ['serviceId', 'staffIds'],
      additionalProperties: false,
    },
    readOnly: false,
    run: (args, ctx) => write.assignStaff(ctx, args),
  },
  {
    name: 'add_service_note',
    title: 'Add a note',
    description: 'Append a note to a service\'s staff conversation, attributed to you.',
    inputSchema: {
      type: 'object',
      properties: { serviceId: { type: 'string' }, body: { type: 'string' } },
      required: ['serviceId', 'body'],
      additionalProperties: false,
    },
    readOnly: false,
    run: (args, ctx) => write.addServiceNote(ctx, args),
  },
  {
    name: 'create_client',
    title: 'Create a client',
    description:
      'Add a new client. Search first — this refuses to create a second client with an existing name, because duplicates are painful to merge later.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        type: { type: 'string', enum: ['residential', 'commercial'] },
        phone: { type: 'string' },
        email: { type: 'string' },
        address: { type: 'string' },
        city: { type: 'string', description: 'Defaults to Fayetteville.' },
        state: { type: 'string', description: 'Defaults to NC.' },
        zip: { type: 'string' },
        contactName: { type: 'string' },
        contactPhone: { type: 'string' },
        frequency: { type: 'string', enum: ['weekly', 'biweekly', 'monthly', 'one_time'] },
        notes: { type: 'string' },
      },
      required: ['name'],
      additionalProperties: false,
    },
    readOnly: false,
    run: (args, ctx) => write.createClient(ctx, args),
  },
  {
    name: 'update_client',
    title: 'Update a client',
    description: 'Change a client\'s contact details, address, frequency or status.',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string' },
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        address: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        zip: { type: 'string' },
        contactName: { type: 'string' },
        contactPhone: { type: 'string' },
        frequency: { type: 'string', enum: ['weekly', 'biweekly', 'monthly', 'one_time'] },
        status: { type: 'string', description: 'e.g. "active", "inactive".' },
        notes: { type: 'string' },
      },
      required: ['clientId'],
      additionalProperties: false,
    },
    readOnly: false,
    run: (args, ctx) => write.updateClient(ctx, args),
  },
  {
    name: 'record_invoice_payment',
    title: 'Record a payment',
    description:
      'Record money received against an invoice; settles it automatically when the balance reaches zero. Always returns a confirmation preview first — read the amount and client back to the user, then call again with confirm: true.',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
        amount: { type: 'number', description: 'Cannot exceed the balance due.' },
        method: {
          type: 'string',
          enum: ['cash', 'zelle', 'venmo', 'paypal', 'cashapp', 'check', 'ach', 'card', 'credit_card', 'eft'],
        },
        platform: { type: 'string', enum: ['stripe', 'square', 'cash', 'zelle', 'venmo', 'paypal', 'cashapp', 'check', 'ach', 'card', 'other'] },
        reference: { type: 'string', description: 'Check number, confirmation code, etc.' },
        notes: { type: 'string' },
        paidAt: { type: 'string', description: 'YYYY-MM-DD, defaults to today.' },
        confirm: { type: 'boolean', description: 'Required to actually record it.' },
      },
      required: ['invoiceId', 'amount', 'method'],
      additionalProperties: false,
    },
    readOnly: false,
    destructive: true,
    run: (args, ctx) => write.recordInvoicePayment(ctx, args),
  },
  {
    name: 'create_expense',
    title: 'Log an expense',
    description: 'Record a business expense. Good for logging a purchase out loud right after making it.',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        category: { type: 'string', description: 'e.g. Supplies, Fuel, Equipment, Payroll.' },
        amount: { type: 'number' },
        expenseDate: { type: 'string', description: 'YYYY-MM-DD, defaults to today.' },
        supplier: { type: 'string' },
        paymentMethod: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['description', 'category', 'amount'],
      additionalProperties: false,
    },
    readOnly: false,
    run: (args, ctx) => write.createExpense(ctx, args),
  },
  {
    name: 'adjust_inventory',
    title: 'Adjust stock',
    description:
      'Record a stock movement: "in" to restock, "out" for usage. Movements are append-only, so a mistake can only be corrected with another movement — this returns a confirmation preview first.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'From list_inventory.' },
        type: { type: 'string', enum: ['in', 'out'] },
        quantity: { type: 'number', description: 'Positive whole number.' },
        comment: { type: 'string', description: 'Why — e.g. which job it was used on.' },
        confirm: { type: 'boolean', description: 'Required to actually apply it.' },
      },
      required: ['productId', 'type', 'quantity'],
      additionalProperties: false,
    },
    readOnly: false,
    destructive: true,
    run: (args, ctx) => write.adjustInventory(ctx, args),
  },
]

export function listTools(scope: string) {
  const canWrite = scope.split(/\s+/).includes(SCOPE_WRITE)
  return TOOLS.filter(tool => tool.readOnly || canWrite).map(tool => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: {
      title: tool.title,
      readOnlyHint: tool.readOnly,
      destructiveHint: tool.destructive ?? false,
      idempotentHint: false,
      // Everything is backed by this CRM's own database, nothing external.
      openWorldHint: false,
    },
  }))
}

export async function callTool(params: {
  name: string
  args: Record<string, unknown>
  actor: AuthUser
  scope: string
  clientName: string
}): Promise<ToolResult> {
  const tool = TOOLS.find(t => t.name === params.name)
  if (!tool) return fail(`Unknown tool "${params.name}"`)

  // Scope is enforced here, not just by hiding the tool from tools/list — a
  // client that cached a richer tool list must still be refused.
  if (!tool.readOnly && !params.scope.split(/\s+/).includes(SCOPE_WRITE)) {
    return fail(
      `This connection is read-only, so "${tool.name}" is not permitted. Reconnect Joyful CRM in ChatGPT and allow write access to enable changes.`
    )
  }

  return tool.run(params.args, { actor: params.actor, clientName: params.clientName })
}

export function toolCount(): number {
  return TOOLS.length
}
