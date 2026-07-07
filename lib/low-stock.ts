import { notifyEvent } from './notify-admin'

// Fires the Settings → Notifications "Low Stock" event (push + email,
// per the notif.lowStock toggles) when a product's stock drops below its
// minimum. Only fires on the crossing — while the product stays low no
// further alerts are sent, so a busy week doesn't spam the admin.
export async function maybeNotifyLowStock(
  product: { name: string; sku: string; currentStock: number; minimumStock: number; unitOfMeasure: string },
  previousStock: number
) {
  if (!product || product.minimumStock <= 0) return
  const isLow  = product.currentStock < product.minimumStock
  const wasLow = previousStock < product.minimumStock
  if (!isLow || wasLow) return

  await notifyEvent('lowStock', {
    pushTitle:    `⚠️ Low stock: ${product.name}`,
    pushBody:     `${product.currentStock} ${product.unitOfMeasure} left (minimum ${product.minimumStock}). Time to reorder.`,
    pushData:     { type: 'lowStock', sku: product.sku },
    emailSubject: `⚠️ Low stock alert: ${product.name} — ${product.currentStock} left`,
    emailHtml: `
      <div style="font-family:Arial,sans-serif;max-width:480px">
        <h2 style="color:#f59e0b;margin-bottom:4px">⚠️ Low Stock Alert</h2>
        <p style="font-size:14px;color:#333">
          <strong>${product.name}</strong> (${product.sku}) dropped below its minimum stock level.
        </p>
        <table style="font-size:14px;color:#333;border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0">Current stock:</td><td><strong style="color:#f87171">${product.currentStock} ${product.unitOfMeasure}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0">Minimum:</td><td>${product.minimumStock} ${product.unitOfMeasure}</td></tr>
        </table>
        <p style="font-size:13px;color:#666">Open Finances → Inventory in the CRM to reorder.</p>
      </div>
    `,
  })
}
