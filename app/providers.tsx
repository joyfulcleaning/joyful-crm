'use client'

import { SessionProvider } from 'next-auth/react'
import ThemeApplicator from '@/components/ThemeApplicator'
import { LanguageProvider } from '@/lib/i18n'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <ThemeApplicator />
        {children}
      </LanguageProvider>
    </SessionProvider>
  )
}
