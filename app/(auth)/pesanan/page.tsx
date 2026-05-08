'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import PlatformBadge from '@/components/PlatformBadge'
import { Platform } from '@prisma/client'
import type { Movement } from '@/app/api/orders/products/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  uniqueProducts: number
  totalTransactions: number
  avgOrderValue: number
  topProduct: string
  topProductCount: number
}

interface ChartProduct {
  productName: string
  orderCount: number
  totalRevenue: number
}

interface ProductRow {
  productName: string
  platform: Platform
  orderCount: number
  totalRevenue: number
  lastSoldDate: string
  ordersLast30Days: number
  movement: Movement
}

interface HistoryOrder {
  id: string
  orderNumber: string
  platform: Platform
  customerName: string
  orderDate: string
  totalAmount: number
  status: string
}

interface MonthlyPoint {
  month: string   // "YYYY-MM"
  count: number
  revenue: number
}

interface HistoryData {
  stats: { totalOrders: number; totalRevenue: number; avgOrderValue: number }
  monthly: MonthlyPoint[]
  orders: HistoryOrder[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const movementConfig: Record<Movement, { label: string; badge: string }> = {
  fast:   { label: '🔥 Fast Moving',  badge: 'bg-green-100 text-green-800' },
  normal: { label: '📦 Normal',       badge: 'bg-blue-100 text-blue-800'   },
  slow:   { label: '🐢 Slow Moving',  badge: 'bg-red-100 text-red-800'     },
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, icon }: {
  title: string; value: string; sub?: string; icon: string
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-sm">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-on-surface-variant">{title}</span>
        <span className="material-symbols-outlined text-primary text-[20px]">{icon}</span>
      </div>
      <div className="text-h1 text-on-surface">{value}</div>
      {sub && <div className="text-body-sm text-on-surface-variant truncate">{sub}</div>}
    </div>
  )
}

// ─── Horizontal Bar Chart (Chart.js via canvas) ────────────────────────────────

function HBarChart({ data, sortBy }: { data: ChartProduct[]; sortBy: 'count' | 'revenue' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Store destroy fn so we can call it on cleanup without holding the Chart class
  const destroyRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return

    let cancelled = false

    import('chart.js/auto').then(({ Chart }) => {
      if (cancelled || !canvasRef.current) return

      destroyRef.current?.()

      const labels = data.map((d) =>
        d.productName.length > 45 ? d.productName.slice(0, 45) + '…' : d.productName,
      )
      const values = data.map((d) => (sortBy === 'revenue' ? d.totalRevenue : d.orderCount))

      const chart = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              data:            values,
              backgroundColor: '#004f54',
              borderRadius:    4,
              barThickness:    20,
            },
          ],
        },
        options: {
          indexAxis:  'y',
          responsive: true,
          animation:  { duration: 500 },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) =>
                  sortBy === 'revenue'
                    ? ' Rp ' + (ctx.raw as number).toLocaleString('id-ID')
                    : ` ${ctx.raw} pesanan`,
              },
            },
          },
          scales: {
            x: {
              ticks: {
                callback: (v) =>
                  sortBy === 'revenue'
                    ? 'Rp ' + (Number(v) / 1000).toFixed(0) + 'K'
                    : String(v),
                font: { size: 11 },
              },
              grid: { color: '#bec8c9' },
            },
            y: {
              ticks: { font: { size: 11 } },
              grid: { display: false },
            },
          },
        },
      })

      destroyRef.current = () => chart.destroy()
    })

    return () => {
      cancelled = true
      destroyRef.current?.()
      destroyRef.current = null
    }
  }, [data, sortBy])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant text-body-md">
        Tidak ada data produk.
      </div>
    )
  }

  return (
    <div style={{ height: `${Math.max(200, data.length * 36 + 40)}px` }}>
      <canvas ref={canvasRef} />
    </div>
  )
}

// ─── Product Detail Modal ──────────────────────────────────────────────────────

function ProductDetailModal({
  product,
  onClose,
}: {
  product: ProductRow
  onClose: () => void
}) {
  const [data, setData]     = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const destroyRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const params = new URLSearchParams({
      name:     product.productName,
      platform: product.platform,
    })
    fetch(`/api/orders/products/history?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [product])

  // Mini line chart for monthly data
  useEffect(() => {
    if (!data?.monthly || data.monthly.length === 0 || !canvasRef.current) return

    import('chart.js/auto').then(({ Chart }) => {
      if (!canvasRef.current) return
      destroyRef.current?.()

      const chart = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels:   data.monthly.map((m) => m.month),
          datasets: [
            {
              label:           'Pesanan',
              data:            data.monthly.map((m) => m.count),
              borderColor:     '#004f54',
              backgroundColor: 'rgba(0,79,84,0.1)',
              tension:         0.3,
              fill:            true,
              pointRadius:     4,
            },
          ],
        },
        options: {
          responsive: true,
          plugins:    { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { font: { size: 11 }, stepSize: 1 } },
            x: { ticks: { font: { size: 11 } } },
          },
        },
      })
      destroyRef.current = () => chart.destroy()
    })

    return () => { destroyRef.current?.(); destroyRef.current = null }
  }, [data])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-md">
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-lg py-md border-b border-outline-variant flex items-start justify-between gap-md">
          <div className="min-w-0">
            <h2 className="text-h2 text-on-surface line-clamp-2">{product.productName}</h2>
            <div className="flex items-center gap-sm mt-xs">
              <PlatformBadge platform={product.platform} />
              <span className={`inline-flex items-center px-sm py-xs rounded-full text-label-sm font-medium ${movementConfig[product.movement].badge}`}>
                {movementConfig[product.movement].label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface shrink-0">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-lg flex flex-col gap-lg">
          {loading && <div className="text-center text-on-surface-variant py-xl">Memuat...</div>}
          {data && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-sm">
                {[
                  { label: 'Total Pesanan',  value: data.stats.totalOrders.toLocaleString('id-ID') },
                  { label: 'Total Revenue',  value: fmt(data.stats.totalRevenue) },
                  { label: 'Rata-rata',      value: fmt(data.stats.avgOrderValue) },
                ].map((s) => (
                  <div key={s.label} className="bg-surface-container rounded-lg p-sm text-center">
                    <div className="text-body-sm text-on-surface-variant">{s.label}</div>
                    <div className="text-label-md text-on-surface font-medium mt-xs">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Monthly chart */}
              {data.monthly.length > 0 && (
                <div>
                  <h3 className="text-label-md text-on-surface-variant mb-sm">Pesanan per Bulan (6 bulan terakhir)</h3>
                  <div style={{ height: '140px' }}>
                    <canvas ref={canvasRef} />
                  </div>
                </div>
              )}

              {/* Recent orders */}
              <div>
                <h3 className="text-label-md text-on-surface-variant mb-sm">Pesanan Terbaru</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-body-sm">
                    <thead className="bg-surface-container-low">
                      <tr>
                        <th className="text-left px-sm py-xs text-label-sm text-on-surface-variant font-medium">No. Pesanan</th>
                        <th className="text-left px-sm py-xs text-label-sm text-on-surface-variant font-medium">Pelanggan</th>
                        <th className="text-left px-sm py-xs text-label-sm text-on-surface-variant font-medium">Tanggal</th>
                        <th className="text-right px-sm py-xs text-label-sm text-on-surface-variant font-medium">Jumlah</th>
                        <th className="text-left px-sm py-xs text-label-sm text-on-surface-variant font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {data.orders.map((o) => (
                        <tr key={o.id} className="hover:bg-surface-container-low">
                          <td className="px-sm py-xs font-mono text-on-surface">{o.orderNumber}</td>
                          <td className="px-sm py-xs text-on-surface truncate max-w-[100px]">{o.customerName}</td>
                          <td className="px-sm py-xs text-on-surface-variant whitespace-nowrap">{fmtDate(o.orderDate)}</td>
                          <td className="px-sm py-xs text-right text-on-surface whitespace-nowrap">{fmt(o.totalAmount)}</td>
                          <td className="px-sm py-xs">
                            <span className="inline-flex items-center px-xs py-[2px] rounded-full text-[11px] font-medium bg-surface-container text-on-surface-variant">
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const LIMIT = 25

export default function PesananPage() {
  // KPI
  const [kpi, setKpi]         = useState<KpiData | null>(null)
  const [kpiLoading, setKpiLoading] = useState(true)

  // Chart
  const [chartData, setChartData]     = useState<ChartProduct[]>([])
  const [chartLoading, setChartLoading] = useState(true)
  const [chartSortBy, setChartSortBy] = useState<'count' | 'revenue'>('count')
  const [chartPlatform, setChartPlatform] = useState<Platform | ''>('')

  // FSN Table
  const [products, setProducts]   = useState<ProductRow[]>([])
  const [total, setTotal]         = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [tablePage, setTablePage] = useState(1)
  const [tableSearch, setTableSearch]     = useState('')
  const [tablePlatform, setTablePlatform] = useState<Platform | ''>('')
  const [tableMovement, setTableMovement] = useState<Movement | ''>('')
  const [tableSortBy, setTableSortBy]     = useState('count')
  const [tableLoading, setTableLoading]   = useState(true)

  // Export
  const [exporting, setExporting] = useState(false)

  // Detail modal
  const [selected, setSelected] = useState<ProductRow | null>(null)

  // ── Fetch KPI ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setKpiLoading(true)
    fetch('/api/orders/products?mode=kpi')
      .then((r) => r.json())
      .then((d) => { setKpi(d); setKpiLoading(false) })
      .catch(() => setKpiLoading(false))
  }, [])

  // ── Fetch Chart ────────────────────────────────────────────────────────────
  const loadChart = useCallback(async () => {
    setChartLoading(true)
    const params = new URLSearchParams({ mode: 'chart', sortBy: chartSortBy, limit: '10' })
    if (chartPlatform) params.set('platform', chartPlatform)
    try {
      const res  = await fetch(`/api/orders/products?${params}`)
      const data = await res.json()
      setChartData(data.products ?? [])
    } finally {
      setChartLoading(false)
    }
  }, [chartSortBy, chartPlatform])

  useEffect(() => { loadChart() }, [loadChart])

  // ── Fetch FSN Table ────────────────────────────────────────────────────────
  const loadTable = useCallback(async () => {
    setTableLoading(true)
    const params = new URLSearchParams({ mode: 'table', page: String(tablePage), limit: String(LIMIT), sortBy: tableSortBy })
    if (tablePlatform) params.set('platform', tablePlatform)
    if (tableSearch)   params.set('search', tableSearch)
    if (tableMovement) params.set('movement', tableMovement)
    try {
      const res  = await fetch(`/api/orders/products?${params}`)
      const data = await res.json()
      setProducts(data.products ?? [])
      setTotal(data.total ?? 0)
      setTotalPages(data.totalPages ?? 1)
    } finally {
      setTableLoading(false)
    }
  }, [tablePage, tablePlatform, tableSearch, tableMovement, tableSortBy])

  useEffect(() => { loadTable() }, [loadTable])

  // Reset page when filters change
  const updateTableFilter = (fn: () => void) => { fn(); setTablePage(1) }

  async function handleExportFSN() {
    setExporting(true)
    const params = new URLSearchParams({ sortBy: tableSortBy })
    if (tablePlatform) params.set('platform', tablePlatform)
    if (tableSearch)   params.set('search', tableSearch)
    if (tableMovement) params.set('movement', tableMovement)
    try {
      const res = await fetch(`/api/orders/products/export?${params}`, { credentials: 'include' })
      if (!res.ok) { setExporting(false); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `fsn-produk-${Date.now()}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-h1 text-on-surface">Analitik Produk</h1>
        <p className="text-body-md text-on-surface-variant mt-xs">
          Performa dan klasifikasi pergerakan produk
        </p>
      </div>

      {/* ── Section 1: KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
        {kpiLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg h-24 animate-pulse" />
          ))
        ) : kpi ? (
          <>
            <KpiCard title="Total Produk Unik"    value={kpi.uniqueProducts.toLocaleString('id-ID')} icon="category" />
            <KpiCard title="Produk Terlaris"       value={String(kpi.topProductCount) + ' pesanan'} sub={kpi.topProduct} icon="trending_up" />
            <KpiCard title="Total Transaksi"       value={kpi.totalTransactions.toLocaleString('id-ID')} icon="receipt_long" />
            <KpiCard title="Rata-rata Nilai Order" value={fmt(Math.round(kpi.avgOrderValue))} icon="payments" />
          </>
        ) : null}
      </div>

      {/* ── Section 2: Top 10 Chart ─────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <h2 className="text-h2 text-on-surface">Top 10 Produk</h2>
          <div className="flex gap-sm flex-wrap">
            {/* Sort toggle */}
            <div className="flex rounded-lg border border-outline-variant overflow-hidden">
              {(['count', 'revenue'] as const).map((v, i) => (
                <button
                  key={v}
                  onClick={() => setChartSortBy(v)}
                  className={`px-md py-xs text-label-md font-medium transition-colors ${i > 0 ? 'border-l border-outline-variant' : ''} ${
                    chartSortBy === v ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {v === 'count' ? 'Terbanyak Dibeli' : 'Revenue Tertinggi'}
                </button>
              ))}
            </div>
            {/* Platform filter */}
            <div className="flex rounded-lg border border-outline-variant overflow-hidden">
              {([['', 'Semua'], ['shopee', 'Shopee'], ['tiktok', 'TikTok']] as [string, string][]).map(([v, label], i) => (
                <button
                  key={v}
                  onClick={() => setChartPlatform(v as Platform | '')}
                  className={`px-md py-xs text-label-md font-medium transition-colors ${i > 0 ? 'border-l border-outline-variant' : ''} ${
                    chartPlatform === v
                      ? v === 'shopee' ? 'bg-orange-500 text-white'
                      : v === 'tiktok' ? 'bg-black text-white'
                      : 'bg-surface-container text-on-surface'
                      : 'text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {chartLoading ? (
          <div className="h-48 flex items-center justify-center text-on-surface-variant">Memuat chart...</div>
        ) : (
          <HBarChart data={chartData} sortBy={chartSortBy} />
        )}
      </div>

      {/* ── Section 3: FSN Table ────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        {/* Filters */}
        <div className="p-md border-b border-outline-variant flex flex-wrap gap-sm items-center">
          <div className="w-full flex items-center justify-between gap-sm">
            <h2 className="text-h2 text-on-surface">Klasifikasi Pergerakan Produk (FSN)</h2>
            <button
              onClick={handleExportFSN}
              disabled={exporting}
              className="flex items-center gap-xs px-md py-xs rounded-lg border border-outline-variant text-label-md text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[18px]">{exporting ? 'progress_activity' : 'download'}</span>
              {exporting ? 'Mengekspor...' : 'Export Excel'}
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
            <input
              type="text"
              placeholder="Cari nama produk..."
              value={tableSearch}
              onChange={(e) => updateTableFilter(() => setTableSearch(e.target.value))}
              className="w-full pl-9 pr-md py-xs border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
            />
          </div>

          {/* Platform */}
          <select
            value={tablePlatform}
            onChange={(e) => updateTableFilter(() => setTablePlatform(e.target.value as Platform | ''))}
            className="border border-outline-variant rounded-lg px-md py-xs text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
          >
            <option value="">Semua Platform</option>
            <option value="shopee">Shopee</option>
            <option value="tiktok">TikTok</option>
          </select>

          {/* Movement */}
          <select
            value={tableMovement}
            onChange={(e) => updateTableFilter(() => setTableMovement(e.target.value as Movement | ''))}
            className="border border-outline-variant rounded-lg px-md py-xs text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
          >
            <option value="">Semua Pergerakan</option>
            <option value="fast">🔥 Fast Moving</option>
            <option value="normal">📦 Normal</option>
            <option value="slow">🐢 Slow Moving</option>
          </select>

          {/* Sort */}
          <select
            value={tableSortBy}
            onChange={(e) => updateTableFilter(() => setTableSortBy(e.target.value))}
            className="border border-outline-variant rounded-lg px-md py-xs text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
          >
            <option value="count">Terbanyak Terjual</option>
            <option value="revenue">Revenue Tertinggi</option>
            <option value="latest">Terbaru</option>
          </select>

          <span className="text-body-sm text-on-surface-variant ml-auto">{total.toLocaleString('id-ID')} produk</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-body-md min-w-[800px]">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Produk</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Platform</th>
                <th className="text-right px-md py-sm text-label-sm text-on-surface-variant font-medium">Terjual</th>
                <th className="text-right px-md py-sm text-label-sm text-on-surface-variant font-medium">Revenue</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Terakhir Terjual</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Pergerakan</th>
                <th className="px-md py-sm"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {tableLoading && (
                <tr><td colSpan={7} className="py-xl text-center text-on-surface-variant">Memuat...</td></tr>
              )}
              {!tableLoading && products.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-xl text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[40px] block mb-sm">inventory_2</span>
                    Tidak ada produk ditemukan.
                  </td>
                </tr>
              )}
              {!tableLoading && products.map((p, idx) => (
                <tr key={`${p.productName}|${p.platform}|${idx}`} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-md py-sm">
                    <div className="text-on-surface max-w-[280px] line-clamp-2" title={p.productName}>
                      {p.productName}
                    </div>
                    <div className="text-body-sm text-on-surface-variant mt-xs">
                      {p.ordersLast30Days > 0 && `${p.ordersLast30Days} pesanan 30 hari terakhir`}
                    </div>
                  </td>
                  <td className="px-md py-sm">
                    <PlatformBadge platform={p.platform} />
                  </td>
                  <td className="px-md py-sm text-right text-on-surface font-medium">
                    {p.orderCount.toLocaleString('id-ID')}
                  </td>
                  <td className="px-md py-sm text-right text-on-surface whitespace-nowrap">
                    {fmt(p.totalRevenue)}
                  </td>
                  <td className="px-md py-sm text-on-surface-variant whitespace-nowrap">
                    {fmtDate(p.lastSoldDate)}
                  </td>
                  <td className="px-md py-sm">
                    <span className={`inline-flex items-center px-sm py-xs rounded-full text-label-sm font-medium ${movementConfig[p.movement].badge}`}>
                      {movementConfig[p.movement].label}
                    </span>
                  </td>
                  <td className="px-md py-sm">
                    <button
                      onClick={() => setSelected(p)}
                      className="inline-flex items-center gap-xs px-sm py-xs rounded border border-outline-variant text-label-sm text-on-surface hover:bg-surface-container-low transition-colors whitespace-nowrap"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-md py-sm border-t border-outline-variant">
            <span className="text-body-sm text-on-surface-variant">
              Halaman {tablePage} dari {totalPages}
            </span>
            <div className="flex gap-sm">
              <button
                disabled={tablePage <= 1}
                onClick={() => setTablePage((p) => p - 1)}
                className="px-md py-xs rounded border border-outline-variant text-label-md text-on-surface disabled:opacity-40 hover:bg-surface-container-low transition-colors"
              >
                Sebelumnya
              </button>
              <button
                disabled={tablePage >= totalPages}
                onClick={() => setTablePage((p) => p + 1)}
                className="px-md py-xs rounded border border-outline-variant text-label-md text-on-surface disabled:opacity-40 hover:bg-surface-container-low transition-colors"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ────────────────────────────────────────────────────── */}
      {selected && (
        <ProductDetailModal product={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
