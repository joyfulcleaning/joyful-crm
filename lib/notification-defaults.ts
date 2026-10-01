/**
 * Server-side default for `notif.{eventKey}.push` when no Setting row exists.
 *
 * Setting rows are only written when an admin saves the Settings page, and the
 * UI's own defaults live in the client bundle. That means a newly shipped
 * notification event has no row at all, and treating a missing row as "off"
 * silently drops every push until someone happens to open Settings and save —
 * which is exactly how the service-note pushes went missing.
 *
 * An existing row always wins, so deliberately-disabled events stay disabled.
 * Anything not listed here defaults to off.
 */
const PUSH_DEFAULTS: Record<string, boolean> = {
  serviceNote:          true,
  aiRequest:            true,
  quoteRequest:         true,
  schedulePublished:    true,
  businessPhoneOffline: true,
}

export function defaultPushEnabled(eventKey: string): boolean {
  return PUSH_DEFAULTS[eventKey] ?? false
}

/** Default recipient roles for `notif.{eventKey}.roles` when the row is absent. */
const ROLE_DEFAULTS: Record<string, string> = {
  schedulePublished: 'user',
  serviceNote:       'admin,user',
}

export function defaultPushRoles(eventKey: string): string {
  return ROLE_DEFAULTS[eventKey] ?? 'admin'
}
