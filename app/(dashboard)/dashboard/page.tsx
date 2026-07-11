import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

import DashboardHeader from '@/components/dashboard/DashboardHeader'
import DashboardStats from '@/components/dashboard/DashboardStats'
import RecentServices, { RecentServiceRow } from '@/components/dashboard/RecentServices'
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

  const recentRows: RecentServiceRow[] = recentServices.map(service => ({
    id: service.id,
    serviceNumber: service.serviceNumber,
    clientName: service.client.name,
    type: service.type,
    dateStr: service.serviceDate
      ? (([y, m, d]) => `${m}-${d}-${y}`)(new Date(service.serviceDate).toISOString().split('T')[0].split('-'))
      : '—',
    status: service.status,
    total: Number(service.total),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader />

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
      <RecentServices services={recentRows} showTotals={user?.role === 'admin'} />
    </div>
  )
}
