'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Topbar() {
  const { data: session } = useSession()
  const user = session?.user as any
  const [light, setLight] = useState(false)

  useEffect(() => {
    const update = () => setLight(document.body.classList.contains('light'))
    update()
    window.addEventListener('theme-change', update)
    return () => window.removeEventListener('theme-change', update)
  }, [])

  return (
    <header className={cn(
      'h-14 flex items-center justify-between px-6 flex-shrink-0 transition-colors',
      light
        ? 'bg-[#E3E6ED] shadow-[0_1px_0_#D3D7E0,0_4px_16px_-8px_rgba(74,63,176,0.10)]'
        : 'bg-gray-900 border-b border-gray-800'
    )}>
      {/* Left */}
      <div className="flex items-center gap-2">
        <span className={cn('text-sm', light ? 'text-[#5b5374]' : 'text-gray-400')}>
          Welcome back,{' '}
          <span className={cn('font-medium', light ? 'text-[#1F1A3D]' : 'text-white')}>
            {session?.user?.name?.split(' ')[0]}
          </span>
        </span>
      </div>
      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Role badge */}
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          user?.role === 'admin'
            ? 'bg-[rgba(61,58,159,0.1)] text-[#3D3A9F] border border-[rgba(61,58,159,0.2)]'
            : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
        }`}>
          {user?.role === 'admin' ? '👑 Admin' : '👷 Staff'}
        </span>
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-[rgba(61,58,159,0.15)] border border-[rgba(61,58,159,0.25)] flex items-center justify-center">
          <span className="text-[#3D3A9F] text-xs font-bold">
            {session?.user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
          </span>
        </div>
        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            light
              ? 'text-[#5b5374] hover:text-[#1F1A3D] hover:bg-[rgba(74,63,176,0.08)]'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          )}
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
