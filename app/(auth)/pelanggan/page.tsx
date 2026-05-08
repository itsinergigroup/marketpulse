'use client'

import { useEffect, useState, useCallback } from 'react'
import PlatformBadge from '@/components/PlatformBadge'
import StageBadge from '@/components/StageBadge'
import { CustomerTag, Platform } from '@prisma/client'

interface Customer {
  id: string
  name: string
  phone: string
  platform: Platform
  tag: CustomerTag
  totalOrders: number
  totalSpend: number
  lastOrderDate: string | null
  followUp: { contactStatus: string } | null
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const tagOptions: { value: CustomerTag | ''; label: string }[] = [
  { value: '', label: 'Semua Tag' },
  { value: 'new', label: 'Baru' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'vip', label: 'VIP' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'lost', label: 'Lost' },
]

const platformOptions: { value: Platform | ''; label: string }[] = [
  { value: '', label: 'Semua Platform' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'tiktok', label: 'TikTok' },
]

export default function PelangganPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<CustomerTag | ''>('')
  const [platform, setPlatform] = useState<Platform | ''>('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (search) params.set('search', search)
    if (tag) params.set('tag', tag)
    if (platform) params.set('platform', platform)

    const res = await fetch(`/api/customers?${params}`)
    const data = await res.json()
    setCustomers(data.customers ?? [])
    setTotal(data.total ?? 0)
    setTotalPages(data.totalPages ?? 1)
    setLoading(false)
  }, [page, search, tag, platform])

  useEffect(() => { load() }, [load])

  function handleSearch(e: React.FormEvent<HTMLInputElement>) {
    setSearch(e.currentTarget.value)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="text-h1 text-on-surface">Pelanggan</h1>
        <p className="text-body-md text-on-surface-variant mt-xs">{total} pelanggan terdaftar</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-sm">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
          <input
            type="text"
            placeholder="Cari nama atau no. HP..."
            value={search}
            onInput={handleSearch}
            className="w-full pl-9 pr-md py-xs border border-outline-variant rounded-lg text-body-md bg-surface-container-lowest focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant transition-colors"
          />
        </div>
        <select
          value={tag}
          onChange={(e) => { setTag(e.target.value as CustomerTag | ''); setPage(1) }}
          className="border border-outline-variant rounded-lg px-md py-xs text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
        >
          {tagOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={platform}
          onChange={(e) => { setPlatform(e.target.value as Platform | ''); setPage(1) }}
          className="border border-outline-variant rounded-lg px-md py-xs text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
        >
          {platformOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Pelanggan</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">No. HP</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Tag</th>
                <th className="text-right px-md py-sm text-label-sm text-on-surface-variant font-medium">Pesanan</th>
                <th className="text-right px-md py-sm text-label-sm text-on-surface-variant font-medium">Total Spend</th>
                <th className="text-right px-md py-sm text-label-sm text-on-surface-variant font-medium">Pesanan Terakhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading && (
                <tr><td colSpan={6} className="py-xl text-center text-on-surface-variant">Memuat...</td></tr>
              )}
              {!loading && customers.length === 0 && (
                <tr><td colSpan={6} className="py-xl text-center text-on-surface-variant">Tidak ada pelanggan.</td></tr>
              )}
              {!loading && customers.map((c) => (
                <tr key={c.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-md py-sm">
                    <div className="flex items-center gap-sm">
                      <PlatformBadge platform={c.platform} />
                      <span className="text-on-surface font-medium">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-md py-sm text-on-surface-variant">{c.phone}</td>
                  <td className="px-md py-sm"><StageBadge tag={c.tag} /></td>
                  <td className="px-md py-sm text-right text-on-surface">{c.totalOrders}</td>
                  <td className="px-md py-sm text-right text-on-surface font-medium">{formatRupiah(c.totalSpend)}</td>
                  <td className="px-md py-sm text-right text-on-surface-variant">{formatDate(c.lastOrderDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-md py-sm border-t border-outline-variant">
            <span className="text-body-sm text-on-surface-variant">
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex gap-sm">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-md py-xs rounded border border-outline-variant text-label-md text-on-surface disabled:opacity-40 hover:bg-surface-container-low transition-colors"
              >
                Sebelumnya
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-md py-xs rounded border border-outline-variant text-label-md text-on-surface disabled:opacity-40 hover:bg-surface-container-low transition-colors"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
