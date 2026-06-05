'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
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
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/calendar',  icon: Calendar,        label: 'Calendar'  },
  { href: '/map',       icon: Map,             label: 'Map'       },
  { href: '/services',  icon: Briefcase,       label: 'Services'  },
  { href: '/clients',   icon: Users,           label: 'Clients'   },
  { href: '/staff',     icon: UserCheck,       label: 'Staff'     },
  { href: '/finances',  icon: DollarSign,      label: 'Finances'  },
  { href: '/analytics', icon: BarChart3,       label: 'Analytics' },
  { href: '/export',    icon: Download,        label: 'Export'    },
  { href: '/settings',  icon: Settings,        label: 'Settings'  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [light, setLight] = useState(false)

  useEffect(() => {
    const update = () => setLight(document.body.classList.contains('light'))
    update()
    window.addEventListener('theme-change', update)
    return () => window.removeEventListener('theme-change', update)
  }, [])

  return (
    <aside className={cn(
      'w-56 flex flex-col flex-shrink-0 border-r transition-colors',
      light ? 'bg-[#E3E6ED] border-[#D3D7E0]' : 'bg-gray-900 border-gray-800'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center justify-center px-4 py-5 border-b',
        light ? 'border-[#D3D7E0]' : 'border-gray-800'
      )}>
        <Image
          src="/Joyful_logo_transparent.png"
          alt="Joyful Cleaning Services"
          width={80}
          height={80}
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
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors font-medium',
                isActive
                  ? light
                    ? 'bg-[rgba(74,63,176,0.10)] text-[#4A3FB0] font-semibold'
                    : 'bg-[rgba(74,63,176,0.15)] text-[#7B72D8]'
                  : light
                    ? 'text-[#5b5374] hover:text-[#1F1A3D] hover:bg-[rgba(74,63,176,0.05)]'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className={cn(
        'px-4 py-3 border-t',
        light ? 'border-[#D3D7E0]' : 'border-gray-800'
      )}>
        <p className={cn('text-[10px]', light ? 'text-gray-500' : 'text-gray-500')}>Joyful Services LLC</p>
        <p className={cn('text-[10px]', light ? 'text-gray-400' : 'text-gray-600')}>Fayetteville, NC</p>
      </div>
    </aside>
  )
}
