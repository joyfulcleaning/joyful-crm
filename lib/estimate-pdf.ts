import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import nodePath from 'node:path'

const LOGO_VENMO   = 'data:image/png;base64,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'
const LOGO_CASHAPP = 'data:image/png;base64,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'
const LOGO_ZELLE   = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAGmUlEQVR42r2YTYglVxXHf+fcWx/vvXr9ujsz0TFBkijRZKFEyEYYcRH8gCDZxI26iAsXAcWICAHxYyWC4jKCEN1ExW9QEoKCQsDEDxBJYoySiU4y6Ukm09P9Xr2Pqrp1joueGZOFkG7pdzYXqrj3/uqe869z7hHeoLm7iIi7+0ngDFCZmU+nU3F3RISNjQ1UFXdnOp1iZri7b29vC1ADN4nIhStrvZF9I/+HXYFxP9hLRK6OV55feXdUOzTgbDYjxoiqYmaUZXkVYrVaYebgEEMOwUGg6zpSSqSUjh+wrmuKoiCEQN/3bG1tXT25vUt7hBzyQaAI49d9VNe1ZFl+/ID/M0Z7oxgJf/3pnHOPJ8rJJdoZ3PT+glvu3KBZtdRNffyAVVWhqoQQMDOatkXc6JNTVgOefewlnnhgwcZWxvRSx/v6infddZIi7ynKNZzgeHzgOjew3tjbn+KWcFcGg22GwwGTUWBjM6BtIs8z6JXhYEjIdQ0ungFjEIWgynAzx1zwXpAAUcG7BjMlJfAsIAFC0PWomDFcOr/k3J8aFEGC49bj7owmNdMXOyQ33CKSCYuXlLNPLOmaDlNZj0hefGbK9z5+jtBHvEgEU1wS4MRsSFENsMYYVMI/Hl3wt4f/TjInLy4DyjEDFkGpxgXRBqSQ0BRx7YEePII5Io66gGbkoQDvWbFczwlqMPq2Q/qMPiQwx8UBB2nBFfMAGIYjMaPHQar1AMYiJ2w46okYE2oJFwFTHEdwXBISOgop6XYdFadnTTF4/a0TPvfYrXhylssGt4P8OxgWiAqYMF3MqUaRR77yKk//eEUxcjpfw29mNpuR54GNUxm99QxSxN0RIGSOCHSp4/qs5InvznnyR6+Qb4xJKVDJ+XXkYsiLFWHZ0ffG5taEoIq5s7+/T9ckBls5L/+h45df+DdZsYWmSCsN9VHi/fBTahRFJaCi6OUlVARxyIcBP5/xg3ufR7oSKw3BiBao6zcfP2BVVWR5JMsCWaZ0XUPTLelWHZJFRsWAH37+WV59NhGrAbE9qAlTmPP2u88fP+B4PKaqKgbDAcPxiMVyyWp/xd68ZlJV/O6bF3jqV8J4cxvvG3JV5u2SD31xm888ePpy6XOsLn6N2cGQrGW4nfP0I7v85us12xtDUt+Rq3JhN3H7J0acvvetzGazdak4JwQl9UbQSD7JmD3Z8dCnXyCPJeiSyIBF3XLdexvu+trNrFLLUVSih1dxzXxes6wTq9keo/GA2Od8/7M7yE5BLCFYgTWOnuj45AM305aJ+uL0aPeeQ8+oalwcJ9FLRAn87P4znP29U273tHag6GnTcfe3rmP7nRX9rEOjUFOvI5NU5DFDJFFtbvD4t8/x5+8koYGaSCsX0Oa2M08Gzo2Sl5+TGZKv5HSn7h4pFpxQXbI0bJ1SxWYKiOFv9dFGiO4XGcSdpPiuvFLN/nL7l3f0+/pIOJTRi8M/K9OzYLKpLLt/CYe3L+KJfMXYFKLilC5IFajhD/LtHKaTg8U9vX3cVnFWzJRRmMBVq9o/GNd8oZSv4KyH1bB3X/YxKe7uBRZ1c7pHixEpzLe2gqJVWb5rqjxGnLJTgELDHlhvJCK8JekH8S09AvAzXrxLVAAAAAElFTkSuQmCC'
const LOGO_PAYPAL  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAD3ElEQVR42u2YPW9cRRSGn3Nmdu21F8fOt4MJJAGhBAJISDQIkSJBFBEpkWip6fkFICq6CImSghYkfgEFVUSBIAIJKVIgBH/GXq/tvR9zDsWsjWmQdp1dGeQp79W988x7zvvO3Cvu7hzioRzycQR4BHgE+F8HjAd52AG3hO0lqezdE3FUQGS/DjLwHHKQoE4Y4d+K4E4yI2gAsbwi0fEo6O4EEX76dZEH91cJMfaVdBRl7mSbq1dO0wgBSwlVzZDjUND7IJac1259yvd3lqA9BbXvVTG0hFcuzvDxh+9w442LWG1ojOMCdESElUddLt+6zdqGI03HPVdR3XAitrnDTKvmzlcf8NwzpzAHVRm9i3eXtLK6TWe9wDRhtWOpxlPCDDwlmnMtOp3El9/8ACKY2XhiZlf0h4vrlNsFoa+KoAjgAh4cM0Mayt17K/ie78cQM7vT/L7cgeSIRPASyi3EEhAQBw1KvV1wrI4IYOMC3B0Pl7cBzcpZje9sgCdcIuJOCor0dviu22GxdE5FxX03G0dUYsdwz730YLkLAi4GVu9FTHTDJTsmtBI/xlk+u7uGqu4L9VFudX0J/ljuZEAM99R3seRCCkiq0FYbuXiJb3/r5Al15IBC7Jviz8UuxJCb0hzxvkEEgghW9GhcvoLPz7HRC7hLNtGoFRQRiqJkcWUbYsgl72ejS46htLXDxMmzpLdeh8qYjQnp35ORmsQdRHnU6bG2sQNBsyJFiZY1BIFmk3j1ReTta6SZY8hGwYW5qb3dO4wS0NwIoiw/6rK+3UPiBFLVNG68iT79JF5V6BMtqjMnKGuIVYkH4frCVG7MAW08hIL55UurXVKZ0KYTPWIvXaI8cRyqCnFFykQUKKvICzMFN8+3cdeBTRIHj5kMuLjagwTijrUmSSHiOyVqYKkAh2TGbKPg9rXzTDebmDkqMuqg/nubwwSxGpluMBGalG6IOVeOCU9NNLg4K7z/8jlePT5FbYkoMvChdQgFM+CDpU1EcupZaxKaEasL2lH4+uYCz7Yn9/WtE3W4yNXBH8gevPdwHY9CnQRrtfEokIQzE4Gzk40cNe75iCXCsGNgBVUSEOmtd4luTFtFNdOg1JzQZyaE6Rj6ixGGRxu2B1XBnc8/eZfVTsF0M/DRL5t8cb8gauB0u5lPLg56ULphAAUFnIX5WRbm87W1n7eotyrQmrlo+3pVxg+4e1hwh1Q7qonr55R2I6He4L3n54DUX8jBx4E+O2sccSf844PScRJysKPm4wHEDUNxqzEc8YiIoOFxFPdxAJJjZL9Xvb/XiMhhADz6eXQE+P8H/AsAF+RuW9XV+wAAAABJRU5ErkJggg=='

export function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('T')[0].split('-')
  return `${m}-${d}-${y}`
}

export interface EstimateData {
  estimateNumber: string
  issueDate:      string
  validUntil:     string
  clientName:     string
  clientEmail:    string
  clientPhone:    string
  clientAddress:  string
  notes:          string
  taxRate:        number
  items:          Array<{ description: string; qty: number; unitPrice: number; total: number }>
  subtotal:       number
  tax:            number
  total:          number
}

export async function generateEstimatePDF(estimate: EstimateData): Promise<Buffer> {
  const fontBase64  = fs.readFileSync(nodePath.join(process.cwd(), 'public', 'Joyful.ttf')).toString('base64')
  const logoDataUrl = `data:image/png;base64,${fs.readFileSync(nodePath.join(process.cwd(), 'public', 'Joyful_logo_transparent.png')).toString('base64')}`

  const itemsRows = estimate.items.map(item => `
    <tr>
      <td>${item.description || '—'}</td>
      <td style="text-align:center">${item.qty}</td>
      <td style="text-align:right">$${Number(item.unitPrice).toFixed(2)}</td>
      <td style="text-align:right;font-weight:700">$${Number(item.total ?? (item.qty * item.unitPrice)).toFixed(2)}</td>
    </tr>
  `).join('')

  const totalsHtml = estimate.taxRate > 0 ? `
    <div class="total-row"><span>Subtotal</span><span>$${Number(estimate.subtotal).toFixed(2)}</span></div>
    <div class="total-row"><span>Tax (${estimate.taxRate}%)</span><span>$${Number(estimate.tax).toFixed(2)}</span></div>
  ` : ''

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @font-face { font-family: Joyful; src: url('data:font/truetype;base64,${fontBase64}') format('truetype'); font-weight: normal; font-style: normal; }
    body { font-family: Joyful, cursive; font-size: 12px; color: #1a1a2e; background: #fff;
           border: 2px solid rgba(15,23,42,0.3); border-radius: 12px; }
    .page { padding: 32px 40px; max-width: 680px; margin: 0 auto; position: relative; }
    .page::before { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
                     background-image: url('${logoDataUrl}'); background-repeat: no-repeat;
                     background-position: center; background-size: 380px auto; opacity: 0.1; }
    .header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
    .brand-name { font-size: 26px; font-weight: 700; color: #4b3fa0; }
    .brand-info { font-size: 11px; color: #6b7280; margin-top: 4px; line-height: 1.6; }
    .estimate-word { position: absolute; top: 88px; right: 0; font-size: 32px; font-weight: 700; color: #4b3fa0; opacity: 0.5; letter-spacing: 3px; }
    .divider { border-top: 1px solid #e5e7eb; margin: 16px 0; }
    .bill-section { display: flex; justify-content: space-between; margin-bottom: 22px; }
    .label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
    .client-name { font-size: 15px; font-weight: 700; color: #111827; }
    .client-info { font-size: 11px; color: #4b5563; line-height: 1.7; margin-top: 2px; }
    .est-number { font-size: 18px; font-weight: 700; color: #4f8ef7; font-family: Joyful, cursive; }
    .est-meta { font-size: 11px; color: #6b7280; line-height: 1.8; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    thead tr { background: #f9fafb; border-bottom: 2px solid #e5e7eb; }
    th { padding: 8px 10px; font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
    th:last-child, th:nth-last-child(2) { text-align: right; }
    th:nth-child(2) { text-align: center; }
    td { padding: 7px 10px; font-size: 12px; border-bottom: 1px solid #f3f4f6; }
    td:nth-child(2) { text-align: center; }
    .totals { margin-left: auto; width: 250px; background: #f9fafb; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px; }
    .total-row { display: flex; justify-content: space-between; font-size: 12.5px; color: #4b5563; padding: 3px 0; }
    .total-final { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; color: #111827; border-top: 2px solid #e5e7eb; margin-top: 6px; padding-top: 8px; }
    .total-amount { color: #059669; font-size: 16px; font-family: monospace; }
    .payment-box { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 7px; padding: 10px 14px; margin-bottom: 16px; }
    .payment-row { font-size: 11px; color: #4b5563; margin-bottom: 5px; display: flex; align-items: center; gap: 8px; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 14px; border-top: 1px solid #e5e7eb; }
    .footer-note { font-size: 11px; color: #6b7280; line-height: 1.7; max-width: 300px; }
    .footer-brand { font-size: 14px; font-weight: 700; color: #4b3fa0; }
  </style>
</head>
<body>
<div class="page">
  <div class="estimate-word">ESTIMATE</div>
  <div class="header">
    <img src="${logoDataUrl}" style="width:56px;height:56px;object-fit:contain"/>
    <div>
      <div class="brand-name">Joyful Cleaning Services Corp.</div>
      <div class="brand-info">320 Laketree Blvd, Spring Lake NC 28390<br/>(919) 322-9092 · joyfulcleaningservicesnc@gmail.com</div>
    </div>
  </div>
  <div class="divider"></div>
  <div class="bill-section">
    <div>
      <div class="label">Prepared For</div>
      <div class="client-name">${estimate.clientName || '—'}</div>
      <div class="client-info">
        ${estimate.clientEmail ? estimate.clientEmail + '<br/>' : ''}
        ${estimate.clientPhone ? estimate.clientPhone + '<br/>' : ''}
        ${estimate.clientAddress ? estimate.clientAddress : ''}
      </div>
    </div>
    <div style="text-align:right">
      <div class="label">Estimate Details</div>
      <div class="est-number">Number: ${estimate.estimateNumber}</div>
      <div class="est-meta">
        Issue Date: ${formatDate(estimate.issueDate)}<br/>
        Valid Until: ${formatDate(estimate.validUntil)}
      </div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>
  <div class="totals">
    ${totalsHtml}
    <div class="total-final">
      <span>TOTAL</span>
      <span class="total-amount">$${Number(estimate.total).toFixed(2)}</span>
    </div>
  </div>
  ${estimate.notes ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:10px 14px;margin-bottom:18px;font-size:11px;color:#4b5563;line-height:1.7"><strong style="font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:#9ca3af;">Notes</strong><br/>${estimate.notes}</div>` : ''}
  <div class="payment-box">
    <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Payment Methods</div>
    <div class="payment-row"><img src="${LOGO_ZELLE}"   style="width:18px;height:18px;object-fit:contain;border-radius:4px;flex-shrink:0"/> <span><strong>Zelle:</strong> @joyfulcleaningservices</span></div>
    <div class="payment-row"><img src="${LOGO_CASHAPP}" style="width:18px;height:18px;object-fit:contain;border-radius:4px;flex-shrink:0"/> <span><strong>Cashapp:</strong> $Nathashasalcedo</span></div>
    <div class="payment-row"><img src="${LOGO_VENMO}"   style="width:18px;height:18px;object-fit:contain;border-radius:4px;flex-shrink:0"/> <span><strong>Venmo:</strong> @joyfulcleaningservices</span></div>
    <div class="payment-row"><img src="${LOGO_PAYPAL}"  style="width:18px;height:18px;object-fit:contain;border-radius:4px;flex-shrink:0"/> <span><strong>PayPal:</strong> @joyfulcleaningnc</span></div>
    <div class="payment-row">💳 <span><strong>Debit / Credit Card</strong> — 3% service fee applies</span></div>
    <div class="payment-row">💵 <span><strong>Cash or Check</strong> accepted</span></div>
  </div>
  <div class="footer">
    <div class="footer-note">
      This estimate is valid until ${formatDate(estimate.validUntil)}.<br/>
      Thank you for choosing Joyful Cleaning Services Corp.
    </div>
    <div style="display:flex;align-items:center;gap:8px;opacity:0.7">
      <img src="${logoDataUrl}" style="height:36px;width:auto;object-fit:contain"/>
      <div class="footer-brand">Joyful Cleaning Services Corp.</div>
    </div>
  </div>
</div>
</body>
</html>`

  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || await chromium.executablePath()
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: null,
    executablePath,
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '8px', right: '8px', bottom: '8px', left: '8px' } })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

export function buildEmailHtml(estimate: EstimateData): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#4b3fa0,#4f8ef7);padding:28px 32px;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:1px;">Joyful Cleaning Services Corp.</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:4px;">320 Laketree Blvd, Spring Lake NC 28390</div>
    </div>
    <div style="padding:28px 32px;">
      <p style="font-size:15px;font-weight:700;color:#111827;margin-bottom:8px;">Hello${estimate.clientName ? ', ' + estimate.clientName : ''}!</p>
      <p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:24px;">
        Thank you for your interest in Joyful Cleaning Services Corp.! Please find attached estimate
        <strong>${estimate.estimateNumber}</strong> for the requested cleaning services.
      </p>
      <p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:24px;">
        The estimated total is <strong style="color:#059669;font-size:15px;">$${Number(estimate.total).toFixed(2)}</strong>.
        This estimate is valid until <strong>${formatDate(estimate.validUntil)}</strong>.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Estimate Summary</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:4px 0;color:#4b5563;">Estimate #</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#4f8ef7;font-family:monospace">${estimate.estimateNumber}</td></tr>
          <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:4px 0;color:#4b5563;">Issue Date</td><td style="padding:4px 0;text-align:right;font-weight:600">${formatDate(estimate.issueDate)}</td></tr>
          <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:4px 0;color:#4b5563;">Valid Until</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#f87171">${formatDate(estimate.validUntil)}</td></tr>
          <tr><td style="padding:8px 0 0;font-size:15px;font-weight:700;color:#111827">Estimated Total</td><td style="padding:8px 0 0;text-align:right;font-size:15px;font-weight:700;color:#059669;font-family:monospace">$${Number(estimate.total).toFixed(2)}</td></tr>
        </table>
      </div>
      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Payment Methods</div>
        <div style="font-size:12px;color:#4b5563;line-height:2;">
          💳 <strong>Debit / Credit Card</strong> — 3% service fee applies<br/>
          ⚡ <strong>Zelle:</strong> @joyfulcleaningservices<br/>
          💚 <strong>Cashapp:</strong> $Nathashasalcedo<br/>
          💜 <strong>Venmo:</strong> @joyfulcleaningservices<br/>
          🔵 <strong>PayPal:</strong> @joyfulcleaningnc<br/>
          💵 <strong>Cash or Check</strong> accepted
        </div>
      </div>
      <p style="font-size:13px;color:#374151;margin-top:20px;">
        Warm regards,<br/>
        <strong>Joyful Cleaning Services Corp. Team</strong><br/>
        <span style="color:#6b7280">(919) 322-9092 · joyfulcleaningservicesnc@gmail.com</span>
      </p>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
      <div style="font-size:11px;color:#9ca3af;">Joyful Cleaning Services Corp. · 320 Laketree Blvd, Spring Lake NC 28390</div>
    </div>
  </div>
</body>
</html>`
}
