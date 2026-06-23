'use client'

import { Briefcase, CheckCircle, Clock, Users } from 'lucide-react'
import CountUp from '@/components/ui/CountUp'

interface Props {
  totalServices:    number
  completedServices: number
  pendingServices:  number
  totalClients:     number
}

const STATS = (p: Props) => [
  {
    label:   'Total Services',
    value:   p.totalServices,
    formula: 'all statuses combined',
    icon: Briefcase,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    label:   'Completed',
    value:   p.completedServices,
    formula: `${p.totalServices ? Math.round(p.completedServices / p.totalServices * 100) : 0}% of total services`,
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    label:   'Pending',
    value:   p.pendingServices,
    formula: `${p.totalServices ? Math.round(p.pendingServices / p.totalServices * 100) : 0}% of total services`,
    icon: Clock,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    label:   'Active Clients',
    value:   p.totalClients,
    formula: 'all registered clients',
    icon: Users,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
]

export default function DashboardStats(props: Props) {
  const stats = STATS(props)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`bg-[var(--surface)] border ${stat.border} rounded-xl p-5 shadow-[var(--shadow-rest,none)]`}
          style={{ animation: `fadeSlideUp 0.4s ease both`, animationDelay: `${i * 80}ms` }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[var(--muted)]">{stat.label}</span>
            <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
              <stat.icon size={16} className={stat.color} />
            </div>
          </div>
          <div className={`text-3xl font-bold ${stat.color}`}>
            <CountUp value={stat.value} duration={700} />
          </div>
          <div className="text-[10px] text-[var(--muted)] mt-1.5 font-mono">{stat.formula}</div>
        </div>
      ))}
    </div>
  )
}
