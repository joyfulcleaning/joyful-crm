import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  Briefcase,
  CheckCircle,
  Clock,
  Users,
} from 'lucide-react'
import WeeklyGrowthChart from '@/components/charts/WeeklyGrowthChart'
import WeeklyServicesChart from '@/components/charts/WeeklyServicesChart'
import CumulativeNetIncomeChart from '@/components/charts/CumulativeNetIncomeChart'
import MonthlyFinancesChart from '@/components/charts/MonthlyFinancesChart'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  // Get stats
  const [totalServices, completedServices, pendingServices, totalClients] =
    await Promise.all([
      prisma.service.count(),
      prisma.service.count({ where: { status: 'completed' } }),
      prisma.service.count({ where: { status: 'pending' } }),
      prisma.client.count(),
    ])

  // Get recent services
  const recentServices = await prisma.service.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { client: true, staff: { include: { user: true } } },
  })


  const stats = [
    {
      label: 'Total Services',
      value: totalServices,
      icon: Briefcase,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      label: 'Completed',
      value: completedServices,
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Pending',
      value: pendingServices,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'Active Clients',
      value: totalClients,
      icon: Users,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
    },
  ]

  const statusColors: Record<string, string> = {
    pending:     'bg-[rgba(245,158,11,0.1)] text-[#f59e0b]',
    in_progress: 'bg-[rgba(79,142,247,0.12)] text-[#4f8ef7]',
    completed:   'bg-[rgba(56,217,169,0.1)] text-[#38d9a9]',
    cancelled:   'bg-[rgba(248,113,113,0.1)] text-[#f87171]',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Dashboard</h1>
        <p className="text-[var(--muted)] text-sm mt-1">
          Operational overview · {new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`bg-[var(--surface)] border ${stat.border} rounded-xl p-5 shadow-[var(--shadow-rest,none)]`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[var(--muted)]">{stat.label}</span>
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon size={16} className={stat.color} />
              </div>
            </div>
            <div className={`text-3xl font-bold ${stat.color}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Net Income Growth */}
      <WeeklyGrowthChart />

      {/* Weekly Services Volume */}
      <WeeklyServicesChart />

      {/* Cumulative Net Income */}
      <CumulativeNetIncomeChart />

      {/* Monthly Finances */}
      <MonthlyFinancesChart />

      {/* Recent Services */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-rest,none)]">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">Recent Services</h2>
        </div>
        <div className="overflow-x-auto">
          {recentServices.length === 0 ? (
            <div className="px-6 py-12 text-center text-[var(--muted)]">
              No services yet. Create your first service to get started.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Status</th>
                  {user?.role === 'admin' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Total</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {recentServices.map((service) => (
                  <tr key={service.id} className="hover:bg-[var(--surface2)] transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-[#4f8ef7]">
                      #{service.serviceNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--text)]">
                      {service.client.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--muted2)]">
                      {service.type}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--muted)]">
                      {service.serviceDate ? (([y,m,d]) => `${m}/${d}/${y}`)(new Date(service.serviceDate).toISOString().split('T')[0].split('-')) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[service.status] || 'bg-[rgba(107,114,128,0.1)] text-[var(--muted)]'}`}>
                        {service.status.replace('_', ' ')}
                      </span>
                    </td>
                    {user?.role === 'admin' && (
                      <td className="px-6 py-4 text-sm font-semibold text-[#38d9a9]">
                        ${Number(service.total).toFixed(2)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}