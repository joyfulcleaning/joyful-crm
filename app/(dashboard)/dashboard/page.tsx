import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import DashboardStats from '@/components/dashboard/DashboardStats'
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
      <DashboardStats
        totalServices={totalServices}
        completedServices={completedServices}
        pendingServices={pendingServices}
        totalClients={totalClients}
      />

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