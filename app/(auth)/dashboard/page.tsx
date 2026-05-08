'use client'

import { useEffect, useState } from 'react'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import PlatformBadge from '@/components/PlatformBadge'
import StageBadge from '@/components/StageBadge'
import { Platform, CustomerTag } from '@prisma/client'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler)

interface DashboardData {
  kpi: {
    totalCustomers: number
    totalOrders: number
    totalRevenue: number
    newCustomers: number
    orderGrowth: number
  }
  recentOrders: {
    id: string
    orderNumber: string
    platform: Platform
    totalAmount: number
    orderDate: string
    status: string
    productName: string
    customer: { name: string; phone: string }
  }[]
  topCustomers: {
    id: string
    name: string
    phone: string
    platform: Platform
    tag: CustomerTag
    totalOrders: number
    totalSpend: number
  }[]
  charts: {
    ordersByDay: { orderDate: string; _sum: { totalAmount: number }; _count: number }[]
    customersByTag: { tag: CustomerTag; _count: number }[]
  }
}

function KpiCard({
  label,
  value,
  icon,
  sub,
  positive,
}: {
  label: string
  value: string
  icon: string
  sub?: string
  positive?: boolean
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex items-start gap-md">
      <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-primary text-[22px]">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-body-sm text-on-surface-variant">{label}</p>
        <p className="text-h1 text-on-surface mt-xs">{value}</p>
        {sub && (
          <p className={`text-body-sm mt-xs ${positive ? 'text-green-600' : 'text-error'}`}>{sub}</p>
        )}
      </div>
    </div>
  )
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const tagColors: Record<CustomerTag, string> = {
  new: '#3b82f6',
  repeat: '#f97316',
  vip: '#a855f7',
  at_risk: '#ef4444',
  lost: '#9ca3af',
}

const tagLabels: Record<CustomerTag, string> = {
  new: 'Baru',
  repeat: 'Repeat',
  vip: 'VIP',
  at_risk: 'At Risk',
  lost: 'Lost',
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined text-primary animate-spin text-[32px]">progress_activity</span>
      </div>
    )
  }

  if (!data) return <p className="text-error">Gagal memuat data.</p>

  const { kpi, recentOrders, topCustomers, charts } = data

  const lineLabels = charts.ordersByDay.map((d) =>
    new Date(d.orderDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
  )
  const lineValues = charts.ordersByDay.map((d) => d._sum.totalAmount ?? 0)

  const donutLabels = charts.customersByTag.map((t) => tagLabels[t.tag])
  const donutValues = charts.customersByTag.map((t) => t._count)
  const donutColors = charts.customersByTag.map((t) => tagColors[t.tag])

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="text-h1 text-on-surface">Dashboard</h1>
        <p className="text-body-md text-on-surface-variant mt-xs">Overview performa toko 30 hari terakhir</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-md">
        <KpiCard
          label="Total Pelanggan"
          value={kpi.totalCustomers.toLocaleString()}
          icon="group"
          sub={`+${kpi.newCustomers} bulan ini`}
          positive
        />
        <KpiCard
          label="Total Pesanan"
          value={kpi.totalOrders.toLocaleString()}
          icon="shopping_cart"
          sub={`${kpi.orderGrowth >= 0 ? '+' : ''}${kpi.orderGrowth}% vs bulan lalu`}
          positive={kpi.orderGrowth >= 0}
        />
        <KpiCard
          label="Total Revenue"
          value={formatRupiah(kpi.totalRevenue)}
          icon="payments"
        />
        <KpiCard
          label="Pelanggan Baru"
          value={kpi.newCustomers.toLocaleString()}
          icon="person_add"
          sub="30 hari terakhir"
          positive
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-md">
        <div className="xl:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg">
          <h2 className="text-h2 text-on-surface mb-md">Revenue Harian</h2>
          {lineValues.length > 0 ? (
            <Line
              data={{
                labels: lineLabels,
                datasets: [
                  {
                    label: 'Revenue',
                    data: lineValues,
                    borderColor: '#01696f',
                    backgroundColor: 'rgba(1,105,111,0.08)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    ticks: { callback: (v) => 'Rp ' + Number(v).toLocaleString('id-ID') },
                    grid: { color: '#bec8c920' },
                  },
                  x: { grid: { display: false } },
                },
              }}
            />
          ) : (
            <p className="text-body-md text-on-surface-variant text-center py-xl">Belum ada data pesanan.</p>
          )}
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg">
          <h2 className="text-h2 text-on-surface mb-md">Segmen Pelanggan</h2>
          {donutValues.length > 0 ? (
            <Doughnut
              data={{
                labels: donutLabels,
                datasets: [{ data: donutValues, backgroundColor: donutColors, borderWidth: 2, borderColor: '#fff' }],
              }}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } },
                },
              }}
            />
          ) : (
            <p className="text-body-md text-on-surface-variant text-center py-xl">Belum ada data pelanggan.</p>
          )}
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-md">
        {/* Recent Orders */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg">
          <h2 className="text-h2 text-on-surface mb-md">Pesanan Terbaru</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-body-md">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="text-left py-sm text-label-sm text-on-surface-variant font-medium">Pelanggan</th>
                  <th className="text-left py-sm text-label-sm text-on-surface-variant font-medium">Produk</th>
                  <th className="text-right py-sm text-label-sm text-on-surface-variant font-medium">Total</th>
                  <th className="text-right py-sm text-label-sm text-on-surface-variant font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {recentOrders.length === 0 && (
                  <tr><td colSpan={4} className="py-lg text-center text-on-surface-variant">Belum ada pesanan.</td></tr>
                )}
                {recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-sm pr-sm">
                      <div className="flex items-center gap-xs">
                        <PlatformBadge platform={o.platform} />
                        <span className="text-on-surface truncate max-w-[100px]">{o.customer.name}</span>
                      </div>
                    </td>
                    <td className="py-sm pr-sm text-on-surface-variant truncate max-w-[100px]">{o.productName}</td>
                    <td className="py-sm text-right text-on-surface font-medium">{formatRupiah(o.totalAmount)}</td>
                    <td className="py-sm text-right text-on-surface-variant whitespace-nowrap">{formatDate(o.orderDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg">
          <h2 className="text-h2 text-on-surface mb-md">Top Pelanggan</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-body-md">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="text-left py-sm text-label-sm text-on-surface-variant font-medium">Nama</th>
                  <th className="text-left py-sm text-label-sm text-on-surface-variant font-medium">Tag</th>
                  <th className="text-right py-sm text-label-sm text-on-surface-variant font-medium">Pesanan</th>
                  <th className="text-right py-sm text-label-sm text-on-surface-variant font-medium">Total Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {topCustomers.length === 0 && (
                  <tr><td colSpan={4} className="py-lg text-center text-on-surface-variant">Belum ada data.</td></tr>
                )}
                {topCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-sm pr-sm">
                      <div className="flex items-center gap-xs">
                        <PlatformBadge platform={c.platform} />
                        <span className="text-on-surface truncate max-w-[100px]">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-sm pr-sm"><StageBadge tag={c.tag} /></td>
                    <td className="py-sm text-right text-on-surface">{c.totalOrders}</td>
                    <td className="py-sm text-right text-on-surface font-medium">{formatRupiah(c.totalSpend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
