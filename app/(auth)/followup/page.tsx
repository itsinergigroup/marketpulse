'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import PlatformBadge from '@/components/PlatformBadge'
import StageBadge from '@/components/StageBadge'
import { ContactStatus, CustomerTag, Platform } from '@prisma/client'
import type { Category } from '@/lib/followup-query'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FollowUpCustomer {
  id: string
  name: string
  phone: string
  platform: Platform
  tag: CustomerTag
  totalOrders: number
  totalSpend: number
  lastOrderDate: string | null
  lastOrderStatus: string | null
  followUp: {
    contactStatus: ContactStatus
    responseNote: string | null
    followedUpAt: string | null
    followedUpBy: { name: string } | null
  } | null
}

type ConfirmMode =
  | null
  | { kind: 'ids'; count: number; status: ContactStatus }
  | { kind: 'range'; from: number; to: number; status: ContactStatus }

// ─── Config ───────────────────────────────────────────────────────────────────

const contactStatusConfig: Record<ContactStatus, { label: string; color: string }> = {
  belum_dihubungi:  { label: 'Belum Dihubungi',  color: 'bg-surface-container-highest text-on-surface-variant' },
  menunggu_balasan: { label: 'Menunggu Balasan',  color: 'bg-secondary-container text-on-secondary-container'  },
  terkontак:        { label: 'Terkontак',         color: 'bg-primary-fixed text-on-primary-fixed'              },
  diabaikan:        { label: 'Diabaikan',         color: 'bg-error-container text-on-error-container'          },
  gagal_hubungi:    { label: 'Gagal Hubungi',     color: 'bg-tertiary-fixed text-on-tertiary-fixed'            },
}

const categories: { value: Category; label: string; icon: string }[] = [
  { value: 'semua',          label: 'Semua',              icon: 'groups'            },
  { value: 'baru_terkirim',  label: 'Baru Terkirim',      icon: 'local_shipping'    },
  { value: 'paket_diterima', label: 'Paket Diterima',     icon: 'inventory_2'       },
  { value: 'saatnya_beli',   label: 'Saatnya Beli Lagi',  icon: 'shopping_bag'      },
  { value: 'rutin',          label: 'Pelanggan Rutin',    icon: 'loyalty'           },
  { value: 'mulai_churn',    label: 'Mulai Churn',        icon: 'warning'           },
  { value: 'sudah_churn',    label: 'Sudah Churn',        icon: 'person_off'        },
  { value: 'big_spender',    label: 'Big Spender',        icon: 'workspace_premium' },
]

const categoryDescriptions: Partial<Record<Category, string>> = {
  baru_terkirim:  'Pesanan dalam pengiriman (7 hari terakhir) — konfirmasi paket sedang di jalan.',
  paket_diterima: 'Pesanan selesai (14 hari terakhir) — follow-up kepuasan pelanggan.',
  saatnya_beli:   'Pembelian terakhir 30–35 hari lalu (Repeat/VIP) — jendela reorder ideal.',
  rutin:          'Pelanggan aktif ≥2 pesanan, beli dalam 30 hari — jaga hubungan rutin.',
  mulai_churn:    'Pembelian terakhir 60–90 hari lalu (Repeat/VIP) — masih bisa diselamatkan.',
  sudah_churn:    'Tidak beli >90 hari ATAU tag At Risk/Lost — butuh kampanye win-back.',
  big_spender:    'Total belanja ≥ Rp 1.000.000 — perlakuan VIP, peluang upsell.',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <div className="fixed top-4 right-4 z-[60] flex items-center gap-sm bg-on-surface text-surface-container-lowest px-md py-sm rounded-lg shadow-lg text-body-md max-w-sm">
      <span className="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
      <span>{message}</span>
    </div>
  )
}

// ─── Update Modal ─────────────────────────────────────────────────────────────

interface UpdateModalProps {
  customer: FollowUpCustomer
  onClose: () => void
  onSaved: () => void
}

function UpdateModal({ customer, onClose, onSaved }: UpdateModalProps) {
  const current = customer.followUp?.contactStatus ?? 'belum_dihubungi'
  const [status, setStatus] = useState<ContactStatus>(current)
  const [note, setNote]     = useState(customer.followUp?.responseNote ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function save() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/followup', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ customerId: customer.id, contactStatus: status, responseNote: note }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Gagal menyimpan')
    } else {
      onSaved()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-container-lowest rounded-xl shadow-elevation-3 w-full max-w-md p-xl flex flex-col gap-md mx-md">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-h2 text-on-surface">{customer.name}</h2>
            <div className="flex items-center gap-sm mt-xs">
              <PlatformBadge platform={customer.platform} />
              <span className="text-body-sm text-on-surface-variant">{customer.phone}</span>
              <StageBadge tag={customer.tag} />
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div>
          <label className="block text-label-md text-on-surface-variant mb-xs">Status Kontak</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ContactStatus)}
            className="w-full border border-outline rounded-xl px-md py-sm text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
          >
            {Object.entries(contactStatusConfig).map(([val, { label }]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-label-md text-on-surface-variant mb-xs">Catatan</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Catatan hasil follow-up..."
            className="w-full border border-outline rounded-xl px-md py-sm text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary placeholder:text-on-surface-variant resize-none"
          />
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container text-body-md rounded-lg px-md py-sm">{error}</div>
        )}

        <div className="flex gap-sm justify-end">
          <button
            onClick={onClose}
            className="px-lg py-sm rounded-full border border-outline text-label-md text-on-surface hover:bg-surface-container-low transition-colors"
          >
            Batal
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-lg py-sm rounded-full bg-primary text-on-primary text-label-md font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const LIMIT = 25

export default function FollowUpPage() {
  // Data
  const [customers, setCustomers]   = useState<FollowUpCustomer[]>([])
  const [total, setTotal]           = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [rowOffset, setRowOffset]   = useState(1)
  const [page, setPage]             = useState(1)

  // Filters
  const [platform, setPlatform]           = useState<Platform | ''>('')
  const [category, setCategory]           = useState<Category>('semua')
  const [search, setSearch]               = useState('')
  const [contactStatus, setContactStatus] = useState<ContactStatus | ''>('')
  const [tag, setTag]                     = useState<CustomerTag | ''>('')
  const [noFrom, setNoFrom]               = useState(0)
  const [noTo, setNoTo]                   = useState(0)
  const [noFromStr, setNoFromStr]         = useState('')
  const [noToStr, setNoToStr]             = useState('')

  // UI state
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<FollowUpCustomer | null>(null)
  const [exporting, setExporting]   = useState(false)
  const [toast, setToast]           = useState('')

  // Bulk mode
  const [bulkMode, setBulkMode]         = useState(false)
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus]     = useState<ContactStatus | ''>('')
  const [bulkApplying, setBulkApplying] = useState(false)
  const [confirmMode, setConfirmMode]   = useState<ConfirmMode>(null)
  const [updatedIds, setUpdatedIds]     = useState<Set<string>>(new Set())

  // Range inputs in action bar (separate from filter range)
  const [rangeFromStr, setRangeFromStr] = useState('')
  const [rangeToStr, setRangeToStr]     = useState('')

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Load ───────────────────────────────────────────────────────────────────

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), category })
    if (platform)      params.set('platform', platform)
    if (search)        params.set('search', search)
    if (contactStatus) params.set('status', contactStatus)
    if (tag)           params.set('tag', tag)
    if (noFrom > 0)    params.set('noFrom', String(noFrom))
    if (noTo > 0)      params.set('noTo', String(noTo))
    return params
  }, [page, category, platform, search, contactStatus, tag, noFrom, noTo])

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/followup?${buildParams()}`)
    const data = await res.json()
    setCustomers(data.customers ?? [])
    setTotal(data.total ?? 0)
    setTotalPages(data.totalPages ?? 1)
    setRowOffset(data.rowOffset ?? 1)
    setLoading(false)
  }, [buildParams])

  useEffect(() => { load() }, [load])

  // Clear selections and confirm when filters/page change
  useEffect(() => {
    setSelectedIds(new Set())
    setConfirmMode(null)
  }, [page, category, platform, search, contactStatus, tag, noFrom, noTo])

  // Cleanup flash timer on unmount
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  // ─── Bulk mode toggle ────────────────────────────────────────────────────────

  function toggleBulkMode() {
    if (bulkMode) {
      setBulkMode(false)
      setSelectedIds(new Set())
      setBulkStatus('')
      setConfirmMode(null)
      setRangeFromStr('')
      setRangeToStr('')
    } else {
      setBulkMode(true)
    }
  }

  // ─── Filter handlers ─────────────────────────────────────────────────────────

  function switchPlatform(p: Platform | '') { setPlatform(p); setPage(1) }
  function switchCategory(c: Category)      { setCategory(c); setPage(1) }

  function handleSearchInput(val: string) {
    setSearch(val)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => setPage(1), 300)
  }

  function applyNoRange() {
    const f = parseInt(noFromStr) || 0
    const t = parseInt(noToStr)   || 0
    setNoFrom(f)
    setNoTo(t)
    setPage(1)
  }

  function clearNoRange() {
    setNoFromStr('')
    setNoToStr('')
    setNoFrom(0)
    setNoTo(0)
    setPage(1)
  }

  // ─── Checkbox helpers ────────────────────────────────────────────────────────

  const allOnPageSelected  = customers.length > 0 && customers.every((c) => selectedIds.has(c.id))
  const someOnPageSelected = customers.some((c) => selectedIds.has(c.id))

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) {
        customers.forEach((c) => next.delete(c.id))
      } else {
        customers.forEach((c) => next.add(c.id))
      }
      return next
    })
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Range selection ─────────────────────────────────────────────────────────

  function handleRangeSelect() {
    const f = parseInt(rangeFromStr)
    const t = parseInt(rangeToStr)
    if (!f || !t || f < 1 || t < f) {
      setToast('Masukkan rentang nomor yang valid')
      return
    }
    if (!bulkStatus) {
      setToast('Pilih status terlebih dahulu')
      return
    }
    setConfirmMode({ kind: 'range', from: f, to: t, status: bulkStatus as ContactStatus })
  }

  // ─── Initiate checkbox bulk update ───────────────────────────────────────────

  function initiateBulkUpdate() {
    if (!bulkStatus || selectedIds.size === 0) return
    setConfirmMode({ kind: 'ids', count: selectedIds.size, status: bulkStatus as ContactStatus })
  }

  // ─── Confirm handlers ────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!confirmMode) return
    setBulkApplying(true)

    if (confirmMode.kind === 'ids') {
      const ids       = Array.from(selectedIds)
      const newStatus = confirmMode.status

      // Optimistic UI: update status badge immediately
      setCustomers((prev) =>
        prev.map((c) =>
          selectedIds.has(c.id)
            ? {
                ...c,
                followUp: {
                  contactStatus: newStatus,
                  responseNote:  c.followUp?.responseNote  ?? null,
                  followedUpAt:  new Date().toISOString(),
                  followedUpBy:  c.followUp?.followedUpBy  ?? null,
                },
              }
            : c
        )
      )

      // Green flash on updated rows
      if (flashTimer.current) clearTimeout(flashTimer.current)
      setUpdatedIds(new Set(ids))
      flashTimer.current = setTimeout(() => setUpdatedIds(new Set()), 1200)

      const res = await fetch('/api/followup/bulk-status', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ids, contactStatus: confirmMode.status }),
      })
      setBulkApplying(false)
      if (res.ok) {
        const d = await res.json()
        setToast(`${d.updated} pelanggan berhasil diperbarui`)
        setSelectedIds(new Set())
        setBulkStatus('')
        setConfirmMode(null)
        setBulkMode(false)
        load()
      } else {
        setToast('Gagal memperbarui pelanggan')
        setConfirmMode(null)
        load()
      }
    } else {
      // Range update via server-side range-status
      const res = await fetch('/api/followup/range-status', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          from:          confirmMode.from,
          to:            confirmMode.to,
          contactStatus: confirmMode.status,
          platform:      platform      || undefined,
          category,
          search:        search        || undefined,
          tag:           tag           || undefined,
          statusFilter:  contactStatus || undefined,
        }),
      })
      setBulkApplying(false)
      if (res.ok) {
        const d = await res.json()
        setToast(`${d.updated} pelanggan berhasil diperbarui`)
        setSelectedIds(new Set())
        setBulkStatus('')
        setRangeFromStr('')
        setRangeToStr('')
        setConfirmMode(null)
        setBulkMode(false)
        load()
      } else {
        setToast('Gagal memperbarui rentang')
        setConfirmMode(null)
        load()
      }
    }
  }

  // ─── Copy username ───────────────────────────────────────────────────────────

  async function copyUsername(name: string, plt: Platform) {
    try {
      await navigator.clipboard.writeText(name)
      const msg = plt === 'shopee'
        ? `Username disalin! Cari di chat Shopee: ${name}`
        : `Username disalin! Cari di chat TikTok Shop: ${name}`
      setToast(msg)
    } catch {
      setToast('Gagal menyalin username')
    }
  }

  // ─── Export ──────────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true)
    const params = buildParams()
    params.delete('page')
    params.delete('noFrom')
    params.delete('noTo')
    try {
      const res = await fetch(`/api/followup/export?${params}`)
      if (!res.ok) { setToast('Export gagal'); setExporting(false); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `followup-${category}-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setToast('Export berhasil')
    } catch {
      setToast('Export gagal')
    }
    setExporting(false)
  }

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const platformLabel = platform === 'shopee' ? 'Shopee' : platform === 'tiktok' ? 'TikTok' : 'Semua'
  const categoryLabel = categories.find((c) => c.value === category)?.label ?? 'Semua'
  const colSpan       = bulkMode ? 8 : 7

  return (
    <div className={`flex flex-col gap-lg ${bulkMode ? 'pb-32' : ''}`}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h1 text-on-surface">Follow-Up</h1>
          <p className="text-body-md text-on-surface-variant mt-xs">
            {total.toLocaleString('id-ID')} pelanggan · {platformLabel} · {categoryLabel}
          </p>
        </div>

        <div className="flex items-center gap-sm shrink-0 flex-wrap">
          {/* Update Massal toggle */}
          <button
            onClick={toggleBulkMode}
            className={`flex items-center gap-xs px-md py-xs rounded-full border text-label-md font-medium transition-colors ${
              bulkMode
                ? 'bg-primary text-on-primary border-primary'
                : 'border-outline text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {bulkMode ? 'check_box' : 'check_box_outline_blank'}
            </span>
            {bulkMode ? 'Keluar Mode Massal' : 'Update Massal'}
          </button>

          {/* Platform toggle */}
          <div className="flex rounded-full border border-outline overflow-hidden">
            {(['', 'shopee', 'tiktok'] as const).map((p, i) => (
              <button
                key={p}
                onClick={() => switchPlatform(p)}
                className={`px-md py-xs text-label-md font-medium transition-colors ${i > 0 ? 'border-l border-outline-variant' : ''} ${
                  platform === p
                    ? p === 'shopee' ? 'bg-orange-500 text-white'
                    : p === 'tiktok' ? 'bg-black text-white'
                    : 'bg-surface-container text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {p === '' ? 'Semua' : p === 'shopee' ? 'Shopee' : 'TikTok'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Category tabs ─────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto -mx-md px-md">
        <div className="flex gap-xs min-w-max border-b border-outline-variant">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => switchCategory(cat.value)}
              className={`flex items-center gap-xs px-md py-sm text-label-md font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                category === cat.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Category description ──────────────────────────────────────────────── */}
      {category !== 'semua' && categoryDescriptions[category] && (
        <div className="bg-secondary-container text-on-secondary-container rounded-xl px-md py-sm text-body-sm flex items-center gap-sm">
          <span className="material-symbols-outlined text-[16px] shrink-0">info</span>
          {categoryDescriptions[category]}
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-sm items-center">
        {/* Search */}
        <div className="flex items-center bg-surface-container-high rounded-full px-md gap-sm flex-1 min-w-[180px] max-w-xs">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0">search</span>
          <input
            type="text"
            placeholder="Cari username..."
            value={search}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="flex-1 py-xs bg-transparent border-0 focus:outline-none text-body-md text-on-surface placeholder:text-on-surface-variant"
          />
        </div>

        {/* Contact status filter */}
        <select
          value={contactStatus}
          onChange={(e) => { setContactStatus(e.target.value as ContactStatus | ''); setPage(1) }}
          className="border border-outline rounded-full px-md py-xs text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
        >
          <option value="">Semua Status Kontak</option>
          {Object.entries(contactStatusConfig).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>

        {/* Tag filter */}
        <select
          value={tag}
          onChange={(e) => { setTag(e.target.value as CustomerTag | ''); setPage(1) }}
          className="border border-outline rounded-full px-md py-xs text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
        >
          <option value="">Semua Tag</option>
          <option value="new">Baru</option>
          <option value="repeat">Repeat</option>
          <option value="vip">VIP</option>
          <option value="at_risk">At Risk</option>
          <option value="lost">Lost</option>
        </select>

        {/* Row range filter */}
        <div className="flex items-center gap-xs">
          <span className="text-body-sm text-on-surface-variant whitespace-nowrap">No.</span>
          <input
            type="number"
            min="1"
            placeholder="Dari"
            value={noFromStr}
            onChange={(e) => setNoFromStr(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyNoRange()}
            className="w-16 border border-outline rounded-full px-sm py-xs text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary text-center"
          />
          <span className="text-body-sm text-on-surface-variant">–</span>
          <input
            type="number"
            min="1"
            placeholder="Sampai"
            value={noToStr}
            onChange={(e) => setNoToStr(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyNoRange()}
            className="w-16 border border-outline rounded-full px-sm py-xs text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary text-center"
          />
          <button
            onClick={applyNoRange}
            className="px-sm py-xs rounded-full border border-outline text-label-sm text-on-surface hover:bg-surface-container-low transition-colors"
          >
            Terapkan
          </button>
          {(noFrom > 0 || noTo > 0) && (
            <button
              onClick={clearNoRange}
              className="px-sm py-xs rounded-full text-label-sm text-error hover:bg-error-container transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-xs px-md py-xs rounded-full border border-outline text-label-md text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">
            {exporting ? 'progress_activity' : 'download'}
          </span>
          {exporting ? 'Mengekspor...' : 'Export Excel'}
        </button>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div className="bg-surface-container-low rounded-xl overflow-hidden shadow-elevation-1">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md min-w-[960px]">
            <thead className="bg-surface-container border-b border-outline-variant">
              <tr>
                {/* Checkbox header — only in bulk mode */}
                {bulkMode && (
                  <th className="w-10 px-sm py-sm">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      ref={(el) => { if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected }}
                      onChange={toggleSelectAll}
                      className="accent-primary cursor-pointer"
                    />
                  </th>
                )}
                <th className="text-right px-sm py-sm text-label-sm text-on-surface-variant font-medium w-12">No.</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Pelanggan</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Tag</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Pesanan Terakhir</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Status Kontak</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Catatan</th>
                <th className="px-md py-sm text-right text-label-sm text-on-surface-variant font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading && (
                <tr>
                  <td colSpan={colSpan} className="py-xl text-center text-on-surface-variant">Memuat...</td>
                </tr>
              )}
              {!loading && customers.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="py-xl text-center text-on-surface-variant">Tidak ada data untuk filter ini.</td>
                </tr>
              )}
              {!loading && customers.map((c, idx) => {
                const cs         = c.followUp?.contactStatus ?? 'belum_dihubungi'
                const cfg        = contactStatusConfig[cs]
                const rowNo      = rowOffset + idx
                const isSelected = bulkMode && selectedIds.has(c.id)
                const isUpdated  = updatedIds.has(c.id)

                return (
                  <tr
                    key={c.id}
                    onClick={bulkMode ? () => toggleSelectOne(c.id) : undefined}
                    className={`transition-colors duration-700 ${
                      isUpdated
                        ? 'bg-green-50'
                        : isSelected
                        ? 'bg-surface-container-low'
                        : bulkMode
                        ? 'hover:bg-surface-container-low cursor-pointer'
                        : 'hover:bg-surface-container-low'
                    }`}
                  >
                    {/* Checkbox cell — only in bulk mode */}
                    {bulkMode && (
                      <td
                        className="px-sm py-sm text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(c.id)}
                          className="accent-primary cursor-pointer"
                        />
                      </td>
                    )}

                    {/* Row number */}
                    <td className="px-sm py-sm text-right text-on-surface-variant text-body-sm font-mono">
                      {rowNo}
                    </td>

                    {/* Customer */}
                    <td className="px-md py-sm">
                      <div className="flex items-center gap-sm">
                        <PlatformBadge platform={c.platform} />
                        <div className="min-w-0">
                          <div className="text-on-surface font-medium truncate max-w-[180px]">{c.name}</div>
                          {c.phone !== c.name && (
                            <div className="text-on-surface-variant text-body-sm truncate max-w-[180px]">{c.phone}</div>
                          )}
                          <div className="text-body-sm text-on-surface-variant">{formatRupiah(c.totalSpend)}</div>
                        </div>
                      </div>
                    </td>

                    {/* Tag */}
                    <td className="px-md py-sm whitespace-nowrap">
                      <StageBadge tag={c.tag} />
                    </td>

                    {/* Last order */}
                    <td className="px-md py-sm">
                      <div className="text-on-surface whitespace-nowrap">{formatDate(c.lastOrderDate)}</div>
                      {c.lastOrderStatus && (
                        <div className="text-body-sm text-on-surface-variant truncate max-w-[140px]">{c.lastOrderStatus}</div>
                      )}
                    </td>

                    {/* Contact status */}
                    <td className="px-md py-sm whitespace-nowrap">
                      <span className={`inline-flex items-center px-sm py-xs rounded-full text-label-sm font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>

                    {/* Note */}
                    <td className="px-md py-sm text-on-surface-variant text-body-sm max-w-[160px]">
                      <span className="line-clamp-2">{c.followUp?.responseNote ?? '-'}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-md py-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-xs justify-end">
                        <button
                          onClick={() => copyUsername(c.name, c.platform)}
                          title={`Salin username untuk chat ${c.platform === 'shopee' ? 'Shopee' : 'TikTok'}`}
                          className={`inline-flex items-center gap-xs px-sm py-xs rounded-full text-white text-label-sm font-medium transition-colors ${
                            c.platform === 'shopee'
                              ? 'bg-orange-500 hover:bg-orange-600'
                              : 'bg-zinc-800 hover:bg-zinc-900'
                          }`}
                        >
                          <span className="font-bold text-[11px]">
                            {c.platform === 'shopee' ? 'S' : 'T'}
                          </span>
                          Chat
                        </button>

                        <button
                          onClick={() => { if (!bulkMode) setSelected(c) }}
                          disabled={bulkMode}
                          className="inline-flex items-center gap-xs px-sm py-xs rounded-full border border-outline text-label-sm text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                          Update
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-md py-sm border-t border-outline-variant">
            <span className="text-body-sm text-on-surface-variant">
              Baris {rowOffset}–{Math.min(rowOffset + LIMIT - 1, total)} dari {total.toLocaleString('id-ID')}
            </span>
            <div className="flex gap-sm">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-md py-xs rounded-full border border-outline text-label-md text-on-surface disabled:opacity-40 hover:bg-surface-container-low transition-colors"
              >
                Sebelumnya
              </button>
              <span className="px-md py-xs text-label-md text-on-surface-variant">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-md py-xs rounded-full border border-outline text-label-md text-on-surface disabled:opacity-40 hover:bg-surface-container-low transition-colors"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Update modal ──────────────────────────────────────────────────────── */}
      {selected && (
        <UpdateModal customer={selected} onClose={() => setSelected(null)} onSaved={load} />
      )}

      {/* ── Bulk action bar (sticky bottom) ───────────────────────────────────── */}
      {bulkMode && (
        <div className="fixed bottom-0 left-64 right-0 z-40 bg-surface-container-low border-t border-outline-variant shadow-elevation-2">

          {/* Confirmation strip */}
          {confirmMode ? (
            <div className="px-lg py-sm flex flex-wrap items-center gap-md">
              <span className="material-symbols-outlined text-[18px] text-primary shrink-0">help</span>
              <span className="text-label-md text-on-surface font-medium">
                {confirmMode.kind === 'ids'
                  ? `Yakin update ${confirmMode.count} pelanggan ke status "${contactStatusConfig[confirmMode.status].label}"?`
                  : `Yakin update baris ${confirmMode.from}–${confirmMode.to} ke status "${contactStatusConfig[confirmMode.status].label}"?`
                }
              </span>
              <button
                onClick={handleConfirm}
                disabled={bulkApplying}
                className="flex items-center gap-xs px-md py-xs rounded-full bg-primary text-on-primary text-label-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {bulkApplying
                  ? <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> Memperbarui...</>
                  : 'Ya, Lanjutkan'
                }
              </button>
              <button
                onClick={() => setConfirmMode(null)}
                disabled={bulkApplying}
                className="px-md py-xs rounded-full border border-outline text-label-md text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-50"
              >
                Batal
              </button>
            </div>
          ) : (
            /* Normal bulk bar */
            <div className="px-lg py-sm flex flex-wrap items-center gap-md">

              {/* Selection count */}
              <span className="text-label-md text-on-surface font-medium shrink-0">
                {selectedIds.size} pelanggan dipilih
              </span>

              <div className="h-4 w-px bg-outline-variant shrink-0 hidden sm:block" />

              {/* Range selection */}
              <div className="flex items-center gap-xs flex-wrap">
                <span className="text-body-sm text-on-surface-variant whitespace-nowrap">Pilih No.</span>
                <input
                  type="number"
                  min="1"
                  placeholder="Dari"
                  value={rangeFromStr}
                  onChange={(e) => setRangeFromStr(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRangeSelect()}
                  className="w-16 border border-outline rounded-full px-sm py-xs text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary text-center"
                />
                <span className="text-body-sm text-on-surface-variant">sampai</span>
                <input
                  type="number"
                  min="1"
                  placeholder="Sampai"
                  value={rangeToStr}
                  onChange={(e) => setRangeToStr(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRangeSelect()}
                  className="w-16 border border-outline rounded-full px-sm py-xs text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary text-center"
                />
                <button
                  onClick={handleRangeSelect}
                  disabled={!rangeFromStr || !rangeToStr}
                  className="px-sm py-xs rounded-full border border-outline text-label-sm text-on-surface hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  Pilih Rentang
                </button>
              </div>

              <div className="h-4 w-px bg-outline-variant shrink-0 hidden sm:block" />

              {/* Status dropdown (shared) */}
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as ContactStatus | '')}
                className="border border-outline rounded-full px-md py-xs text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="">Pilih Status Baru</option>
                {Object.entries(contactStatusConfig).map(([v, { label }]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>

              <div className="flex-1 hidden sm:block" />

              {/* Apply checkbox selection */}
              <button
                disabled={!bulkStatus || selectedIds.size === 0}
                onClick={initiateBulkUpdate}
                className="flex items-center gap-xs px-md py-xs rounded-full bg-primary text-on-primary text-label-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                Terapkan ke Semua yang Dipilih
              </button>

              {/* Clear selection (stays in bulk mode) */}
              <button
                onClick={() => { setSelectedIds(new Set()); setBulkStatus('') }}
                className="flex items-center gap-xs px-md py-xs rounded-full border border-outline text-label-md text-on-surface hover:bg-surface-container-low transition-colors whitespace-nowrap"
              >
                Batalkan Pilihan
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </div>
  )
}
