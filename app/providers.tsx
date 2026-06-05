'use client'

import { SessionProvider } from 'next-auth/react'
import ThemeApplicator from '@/components/ThemeApplicator'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeApplicator />
      {children}
    </SessionProvider>
  )
}
