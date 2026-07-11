'use client'

import { useI18n } from '@/lib/i18n'

export default function DashboardHeader() {
  const { t } = useI18n()
  const dateLabel = new Date().toLocaleDateString(t.locale, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)]">{t.dashboard.title}</h1>
      <p className="text-[var(--muted)] text-sm mt-1">
        {t.dashboard.subtitle} · {dateLabel}
      </p>
    </div>
  )
}
