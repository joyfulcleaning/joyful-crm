'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useI18n, Dict } from '@/lib/i18n'
import {
  LayoutDashboard,
  Calendar,
  Map,
  Briefcase,
  Users,
  UserCheck,
  DollarSign,
  BarChart3,
  Download,
  Settings,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

const COLLAPSED_KEY = 'joyful-sidebar-collapsed'

const navItems: { href: string; icon: any; labelKey: keyof Dict['nav'] }[] = [
  { href: '/dashboard',    icon: LayoutDashboard, labelKey: 'dashboard'  },
  { href: '/ai-requests',  icon: Bot,             labelKey: 'aiRequests' },
  { href: '/calendar',     icon: Calendar,        labelKey: 'calendar'   },
  { href: '/map',          icon: Map,             labelKey: 'map'        },
  { href: '/services',    icon: Briefcase,       labelKey: 'services'  },
  { href: '/clients',     icon: Users,           labelKey: 'clients'   },
  { href: '/staff',       icon: UserCheck,       labelKey: 'staff'     },
  { href: '/finances',    icon: DollarSign,      labelKey: 'finances'  },
  { href: '/analytics',   icon: BarChart3,       labelKey: 'analytics' },
  { href: '/export',      icon: Download,        labelKey: 'export'    },
  { href: '/settings',    icon: Settings,        labelKey: 'settings'  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { t } = useI18n()
  const [light, setLight] = useState(false)
  const [aiPending, setAiPending] = useState(0)
  const [collapsed, setCollapsed] = useState(false)

  // Starts expanded; compact only if this browser chose it before.
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1') } catch {}
  }, [])

  const toggleCollapsed = () => {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1') } catch {}
      return !c
    })
  }

  useEffect(() => {
    const update = () => setLight(document.body.classList.contains('light'))
    update()
    window.addEventListener('theme-change', update)
    return () => window.removeEventListener('theme-change', update)
  }, [])

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch('/api/sync-status')
        if (!res.ok) return
        const data = await res.json()
        // Both queues on the Requests page: inbound leads and staff supply
        // requests. The badge is "things waiting on you", not one of the two.
        if (!cancelled) setAiPending((data.aiRequestsPending || 0) + (data.supplyRequestsPending || 0))
      } catch {}
    }
    check()
    const id = setInterval(check, 8000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return (
    <aside className={cn(
      'flex flex-col flex-shrink-0 border-r transition-[width,background-color,border-color] duration-200',
      collapsed ? 'w-16' : 'w-56',
      light ? 'bg-[#E3E6ED] border-[#D3D7E0]' : 'bg-gray-900 border-gray-800'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center justify-center border-b',
        collapsed ? 'px-2 py-4' : 'px-4 py-5',
        light ? 'border-[#D3D7E0]' : 'border-gray-800'
      )}>
        <Image
          src="/Joyful_logo_transparent.png"
          alt="Joyful Cleaning Services"
          width={collapsed ? 40 : 80}
          height={collapsed ? 40 : 80}
          priority
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? t.nav[item.labelKey] : undefined}
              className={cn(
                'relative flex items-center rounded-lg text-sm transition-colors font-medium',
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2',
                isActive
                  ? light
                    ? 'bg-[rgba(74,63,176,0.10)] text-[#4A3FB0] font-semibold'
                    : 'bg-[rgba(74,63,176,0.15)] text-[#7B72D8]'
                  : light
                    ? 'text-[#5b5374] hover:text-[#1F1A3D] hover:bg-[rgba(74,63,176,0.05)]'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <item.icon size={collapsed ? 18 : 16} />
              {!collapsed && <span className="flex-1">{t.nav[item.labelKey]}</span>}
              {item.href === '/ai-requests' && aiPending > 0 && (
                <span className={cn(
                  'text-[10px] font-bold rounded-full bg-[#f59e0b] text-white leading-none',
                  collapsed ? 'absolute top-0.5 right-1.5 px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5'
                )}>
                  {aiPending}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className={cn(
        'flex items-center border-t py-3',
        collapsed ? 'justify-center px-2' : 'gap-2 px-4',
        light ? 'border-[#D3D7E0]' : 'border-gray-800'
      )}>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className={cn('text-[10px]', light ? 'text-gray-500' : 'text-gray-500')}>Joyful Cleaning Services Corp.</p>
            <p className={cn('text-[10px]', light ? 'text-gray-400' : 'text-gray-600')}>NC</p>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? t.nav.expandMenu : t.nav.collapseMenu}
          aria-label={collapsed ? t.nav.expandMenu : t.nav.collapseMenu}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            light
              ? 'text-[#5b5374] hover:text-[#1F1A3D] hover:bg-[rgba(74,63,176,0.08)]'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          )}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>
    </aside>
  )
}
