# ChatGPT connector (MCP)

Lets ChatGPT read and change Joyful CRM data by voice or text, from the same
chat that already knows you — no separate assistant, no database access.

## Why it is built this way

ChatGPT **refuses plain API keys for MCP servers**. Its docs are explicit:
*"you are expected to implement an OAuth 2.1 flow that conforms to the MCP
authorization spec"*, and it "cannot present custom API keys". That is why
there is a whole OAuth server in here rather than a shared secret like
`AI_API_KEY` (which is what the Vapi/Retell phone assistant uses on
`/api/ai/*`).

The resource owner is always an existing **admin User**. The consent screen runs
behind the normal NextAuth session, so no new kind of identity exists.

## Moving parts

| Path | What it is |
| --- | --- |
| `/api/assistant/mcp` | The MCP endpoint. Streamable HTTP, stateless, JSON-RPC. |
| `/.well-known/oauth-protected-resource` | RFC 9728 discovery — where ChatGPT starts. |
| `/.well-known/oauth-authorization-server` | RFC 8414 authorization server metadata. |
| `/api/oauth/register` | RFC 7591 dynamic client registration. |
| `/oauth/authorize` | Consent screen (admin session required). |
| `/api/oauth/authorize` | Approval POST target; mints the authorization code. |
| `/api/oauth/token` | Authorization code (PKCE S256) + refresh token grants. |
| `/api/oauth/revoke` | RFC 7009 revocation, called by "Disconnect". |
| `/settings/assistants` | List and cut off connected assistants. |

The `.well-known` paths are **rewrites** declared in `next.config.ts`. A literal
`app/.well-known/` directory is not a dependable route segment, because the
leading dot marks it hidden.

Code: `lib/oauth.ts` (the OAuth server), `lib/assistant-tools.ts` (the catalog),
`lib/assistant-read.ts` / `lib/assistant-write.ts` (the handlers),
`lib/assistant-common.ts` (date/period helpers).

## Deploying

1. **`NEXTAUTH_URL` must be the real public origin** on Vercel — e.g.
   `https://joyful-crm.vercel.app`. It is the OAuth `issuer` and the token
   audience, and it must be byte-identical across discovery, authorization and
   validation. It is deliberately read from config rather than the request Host
   header, because on Vercel that header differs between the production domain
   and per-deployment URLs.

   Locally `.env` has `http://localhost:3000`. If that value ever reaches
   production, discovery will advertise `localhost` and ChatGPT cannot connect.

2. The three `oauth_*` tables are already created in Supabase. After pulling
   this branch elsewhere, run `npx prisma generate`.

3. Optional: `MCP_ALLOWED_ORIGINS` (comma-separated) if a browser-based MCP
   client needs to reach the endpoint. ChatGPT calls server-to-server and sends
   no `Origin`, so it is not needed for ChatGPT.

## Connecting from ChatGPT

1. Settings → Connectors → add a custom connector (this needs developer mode;
   availability depends on your plan).
2. URL: `https://<your-domain>/api/assistant/mcp`
3. ChatGPT discovers the OAuth server, registers itself, and opens the consent
   screen. Sign in as admin if prompted.
4. On the consent screen, decide read-only vs read & write with the checkbox.
   **Leave write unchecked for the first few days.** Reconnecting is how you
   upgrade later.

## Safety model

- **Scope.** `crm.read` always; `crm.write` only if the checkbox was ticked.
  Write tools are hidden from a read-only token *and* refused if called anyway —
  hiding alone would not stop a client with a cached tool list.
- **Confirmation.** `record_invoice_payment`, `adjust_inventory` and cancelling
  via `update_service` return `confirmationRequired` plus a preview and write
  nothing until called again with `confirm: true`. This lives in the API, not in
  the prompt — an instruction the model can forget is not a safety control.
- **Audit.** Every write lands in the audit log (Settings → Activity Log) with
  `via: 'assistant'` and the connector's name, so an assistant change is
  distinguishable from a web or mobile one.
- **Admin only.** A token for a non-admin or deactivated user is rejected on
  every request; the user row is re-read each time rather than trusted from the
  token.
- **Token handling.** Access tokens last 1 hour, refresh tokens 60 days and are
  rotated on every use. Reusing a rotated refresh token, or replaying an
  authorization code, revokes the whole grant.
- Tokens are stored only as SHA-256 digests.

## Tools

Read: `get_today`, `search_clients`, `get_client`, `list_services`,
`get_service`, `check_availability`, `list_invoices`, `get_invoice`,
`business_summary`, `list_staff`, `list_expenses`, `list_inventory`,
`list_pending_approvals`, plus `search` / `fetch` (the read-only pair ChatGPT
expects for deep research and company knowledge).

Write: `create_service`, `update_service`, `assign_staff`, `add_service_note`,
`create_client`, `update_client`, `record_invoice_payment`, `create_expense`,
`adjust_inventory`.

Two things are handled server-side on purpose, because models get them wrong:

- **Dates.** `get_today` exists so the model never guesses the date, and
  `period` values (`this_week`, `last_month`, …) are resolved in
  `America/New_York` — including the Saturday→Friday work week.
- **Money framing.** `business_summary` reports completed service value and cash
  actually collected as separate figures, since they diverge and quoting the
  wrong one as "revenue" is misleading.

## Verifying it works

```bash
npx ts-node scripts/test-assistant-connector.ts https://<your-domain>
```

56 checks covering discovery, registration, PKCE, replay detection, refresh
rotation, scope enforcement, confirmation gating and protocol framing. It
creates one throwaway OAuth client and deletes it afterwards (including on
failure). It reads real CRM data but writes nothing outside the `oauth_*`
tables — the confirmation tests deliberately stop at the preview and then assert
the record was left untouched.

## Known gaps

- The connector's **happy-path writes have not been executed against live
  data** — doing so would have created real services and payments in the
  production CRM. Validation, scope, confirmation and error paths are covered;
  the actual INSERT/UPDATE statements are the same Prisma calls the web app
  already uses, but they are unproven end-to-end. Worth doing one real booking
  by voice and checking the Activity Log.
- `/settings/assistants` is **English only** — it has no entry in `lib/i18n.tsx`
  yet, unlike the rest of the dashboard.
- There is no link to `/settings/assistants` from the Settings tabs; it is
  reachable by URL and from the consent screen. Adding a tab means touching the
  1,200-line settings page and both i18n dictionaries.
- Tool access is all-or-nothing per scope. There is no per-tool or per-entity
  permission (e.g. "schedule but never touch invoices").
- Expired authorization codes and tokens are never purged. Harmless but the
  tables grow slowly; a cron could delete `expiresAt < now()`.
