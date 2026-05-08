'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Platform } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkippedRow {
  row?: number
  orderNumber: string
  reason: 'duplicate_order_number' | 'customer_not_found' | 'missing_field'
  detail?: string
}

interface ImportResult {
  imported: number
  skipped: number
  total: number
  durationMs: number
  skippedByReason?: {
    missingField: number
    duplicateOrderNumber: number
    customerNotFound: number
  }
  skippedRows?: SkippedRow[]
}

interface HistoryRecord {
  id: string
  platform: Platform
  fileName: string
  totalRows: number
  imported: number
  skipped: number
  durationMs: number
  importedAt: string
  user: { name: string }
}

type UploadPhase = 'uploading' | 'processing'

// ─── Config ───────────────────────────────────────────────────────────────────

const platformOptions: { value: Platform; label: string; color: string }[] = [
  { value: 'shopee', label: 'Shopee', color: 'bg-orange-500' },
  { value: 'tiktok', label: 'TikTok', color: 'bg-black' },
]

const shopeeColumns = [
  'No. Pesanan', 'Username (Pembeli)', 'Total Pembayaran',
  'Waktu Pesanan Dibuat', 'Nama Produk', 'Status Pesanan',
]
const tiktokColumns = [
  'Order ID', 'Buyer Username', 'Order Amount',
  'Created Time', 'Product Name', 'Order Status',
]

const Spinner = () => (
  <span style={{
    display: 'inline-block', width: '16px', height: '16px',
    border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0,
  }} />
)

// ─── Delete History Modal ─────────────────────────────────────────────────────

interface DeleteHistoryModalProps {
  record: HistoryRecord
  onClose: () => void
  onDeleted: () => void
}

function DeleteHistoryModal({ record, onClose, onDeleted }: DeleteHistoryModalProps) {
  const [checked, setChecked] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/import/history/${record.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        let errMsg = `Server error ${res.status}`
        try { const d = await res.json(); errMsg = d.error ?? errMsg } catch { /* HTML response */ }
        setError(errMsg)
        setDeleting(false)
        return
      }
      onDeleted()
      onClose()
    } catch {
      setError('Koneksi gagal')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-lg w-full max-w-md p-xl flex flex-col gap-md mx-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-error text-[24px]">delete</span>
            <h2 className="text-h2 text-on-surface">Hapus Riwayat Import?</h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="bg-surface-container rounded-lg px-md py-sm flex flex-col gap-xs text-body-md">
          <div className="flex gap-sm">
            <span className="text-on-surface-variant shrink-0">File:</span>
            <span className="text-on-surface font-medium truncate">{record.fileName}</span>
          </div>
          <div className="flex gap-sm">
            <span className="text-on-surface-variant shrink-0">Platform:</span>
            <span className="text-on-surface capitalize">{record.platform}</span>
          </div>
          <div className="flex gap-sm">
            <span className="text-on-surface-variant shrink-0">Diimpor:</span>
            <span className="text-on-surface">
              {new Date(record.importedAt).toLocaleDateString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
          <div className="flex gap-sm">
            <span className="text-on-surface-variant shrink-0">Hasil:</span>
            <span className="text-on-surface">{record.imported.toLocaleString('id-ID')} berhasil, {record.skipped.toLocaleString('id-ID')} dilewati</span>
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline-variant rounded-lg px-md py-sm text-body-sm text-on-surface-variant flex items-start gap-sm">
          <span className="material-symbols-outlined text-[16px] shrink-0 mt-[2px]">info</span>
          <span>
            Tindakan ini hanya menghapus <strong className="text-on-surface">catatan riwayat import</strong>, bukan data pelanggan atau pesanan yang sudah tersimpan.
          </span>
        </div>

        <label className="flex items-start gap-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-[3px] accent-error"
          />
          <span className="text-body-md text-on-surface">
            Saya mengerti riwayat ini akan dihapus permanen
          </span>
        </label>

        {error && (
          <div className="bg-error-container text-on-error-container text-body-md rounded-lg px-md py-sm">{error}</div>
        )}

        <div className="flex gap-sm justify-end">
          <button
            onClick={onClose}
            className="px-lg py-sm rounded-lg border border-outline-variant text-label-md text-on-surface hover:bg-surface-container-low transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            disabled={!checked || deleting}
            className="px-lg py-sm rounded-lg bg-error text-on-error text-label-md font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? 'Menghapus...' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Clear Platform Data Modal ────────────────────────────────────────────────

interface ClearPlatformModalProps {
  platform: Platform
  onClose: () => void
  onCleared: () => void
}

function ClearPlatformModal({ platform, onClose, onCleared }: ClearPlatformModalProps) {
  const [checked, setChecked] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState('')
  const label = platform === 'shopee' ? 'Shopee' : 'TikTok'

  async function handleClear() {
    setClearing(true)
    setError('')
    try {
      const res = await fetch('/api/import/clear', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, confirm: true }),
      })
      let d: { error?: string } = {}
      try { d = await res.json() } catch { /* non-JSON response (e.g. HTML 500) */ }
      if (!res.ok) {
        setError(d.error ?? `Server error ${res.status}`)
        setClearing(false)
        return
      }
      onCleared()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Koneksi gagal')
      setClearing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-lg w-full max-w-md p-xl flex flex-col gap-md mx-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-error text-[24px]">warning</span>
            <h2 className="text-h2 text-on-surface">Hapus Semua Data {label}?</h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="bg-error-container text-on-error-container rounded-lg px-md py-sm text-body-md flex items-start gap-sm">
          <span className="material-symbols-outlined text-[16px] shrink-0 mt-[2px]">dangerous</span>
          <span>
            Tindakan ini akan menghapus <strong>semua pelanggan, pesanan, dan riwayat import</strong> untuk platform <strong>{label}</strong> secara permanen. Tidak dapat dibatalkan.
          </span>
        </div>

        <label className="flex items-start gap-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-[3px] accent-error"
          />
          <span className="text-body-md text-on-surface">
            Saya mengerti semua data <strong>{label}</strong> akan dihapus permanen dan tidak bisa dikembalikan
          </span>
        </label>

        {error && (
          <div className="bg-error-container text-on-error-container text-body-md rounded-lg px-md py-sm">{error}</div>
        )}

        <div className="flex gap-sm justify-end">
          <button
            onClick={onClose}
            className="px-lg py-sm rounded-lg border border-outline-variant text-label-md text-on-surface hover:bg-surface-container-low transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleClear}
            disabled={!checked || clearing}
            className="px-lg py-sm rounded-lg bg-error text-on-error text-label-md font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {clearing ? 'Menghapus...' : `Hapus Semua Data ${label}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="fixed bottom-lg right-lg z-50 flex items-center gap-sm bg-on-surface text-surface px-md py-sm rounded-lg shadow-lg text-body-md animate-in fade-in slide-in-from-bottom-2">
      <span className="material-symbols-outlined text-[18px]">check_circle</span>
      {message}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === 'admin'

  // Upload state
  const [platform, setPlatform] = useState<Platform>('shopee')
  const [file, setFile]         = useState<File | null>(null)
  const [loading, setLoading]   = useState(false)
  const [phase, setPhase]       = useState<UploadPhase>('uploading')
  const [progress, setProgress] = useState<number | null>(null)
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [error, setError]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // History state
  const [history, setHistory]           = useState<HistoryRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<HistoryRecord | null>(null)
  const [clearPlatform, setClearPlatform] = useState<Platform | null>(null)
  const [toast, setToast]               = useState('')

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/import/history')
      const data = await res.json()
      setHistory(data.history ?? [])
    } catch {
      // silently fail — history is non-critical
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  function resetLoadingState() {
    setLoading(false)
    setProgress(null)
  }

  function handleImport() {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    setProgress(0)
    setPhase('uploading')

    const fd = new FormData()
    fd.append('file', file)
    // Do NOT set Content-Type manually — browser sets it with boundary for FormData

    const endpoint = platform === 'shopee' ? '/api/import/shopee' : '/api/import/tiktok'

    const xhr = new XMLHttpRequest()
    xhr.withCredentials = true          // pass session cookies
    xhr.timeout = 10 * 60 * 1000       // 10 min for large files

    // Phase 1: file uploading 0→90%
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 90))
      }
    }

    // Phase 2: file received, server processing
    xhr.upload.onload = () => {
      setProgress(90)
      setPhase('processing')
    }

    // Phase 3: response received — done
    xhr.onload = () => {
      resetLoadingState()
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) {
          setResult(data)
          setFile(null)
          if (fileRef.current) fileRef.current.value = ''
          loadHistory()
        } else {
          setError(data.error ?? `Server error ${xhr.status}`)
        }
      } catch {
        setError('Gagal membaca respons server')
      }
    }

    xhr.onerror   = () => { resetLoadingState(); setError('Koneksi gagal') }
    xhr.ontimeout = () => { resetLoadingState(); setError('Request timeout — file terlalu besar atau server lambat') }

    xhr.open('POST', endpoint)
    xhr.send(fd)
  }

  const columns = platform === 'shopee' ? shopeeColumns : tiktokColumns

  return (
    <div className="flex flex-col gap-lg w-full">
      <div>
        <h1 className="text-h1 text-on-surface">Import Pesanan</h1>
        <p className="text-body-md text-on-surface-variant mt-xs">Upload file Excel dari Shopee atau TikTok Shop</p>
      </div>

      {/* Platform selector */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
        <h2 className="text-h2 text-on-surface">Pilih Platform</h2>
        <div className="flex gap-sm">
          {platformOptions.map((p) => (
            <button
              key={p.value}
              onClick={() => setPlatform(p.value)}
              className={`flex items-center gap-sm px-lg py-sm rounded-lg border-2 transition-colors text-label-md font-medium ${
                platform === p.value
                  ? 'border-primary text-primary bg-surface-container-low'
                  : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
              }`}
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded ${p.color} text-white font-bold text-xs`}>
                {p.label[0]}
              </span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Column guide */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
        <h2 className="text-h2 text-on-surface">Kolom yang Diproses ({platform === 'shopee' ? 'Shopee' : 'TikTok'})</h2>
        <p className="text-body-sm text-on-surface-variant">Kolom lain dalam file akan diabaikan secara otomatis.</p>
        <div className="overflow-x-auto">
          <table className="text-body-sm w-full">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="text-left py-xs pr-md text-label-sm text-on-surface-variant font-medium w-8">#</th>
                <th className="text-left py-xs text-label-sm text-on-surface-variant font-medium">Nama Kolom</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {columns.map((col, i) => (
                <tr key={i}>
                  <td className="py-xs pr-md text-on-surface-variant font-mono">{i + 1}</td>
                  <td className="py-xs text-on-surface">{col}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* File upload */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
        <h2 className="text-h2 text-on-surface">Upload File</h2>

        <div
          className="border-2 border-dashed border-outline-variant rounded-lg p-xl flex flex-col items-center gap-sm cursor-pointer hover:border-primary transition-colors"
          onClick={() => !loading && fileRef.current?.click()}
        >
          <span className="material-symbols-outlined text-on-surface-variant text-[40px]">upload_file</span>
          {file ? (
            <div className="text-center">
              <p className="text-label-md text-on-surface">{file.name}</p>
              <p className="text-body-sm text-on-surface-variant">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-label-md text-on-surface">Klik untuk pilih file</p>
              <p className="text-body-sm text-on-surface-variant">.xlsx, .xls</p>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError('') }}
        />

        {progress !== null && (
          <div className="flex flex-col gap-xs">
            <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-300 bg-primary ${phase === 'processing' ? 'animate-pulse' : ''}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-body-sm text-on-surface-variant">
              {phase === 'uploading' ? `Mengunggah file... ${progress}%` : 'Memproses data, harap tunggu...'}
            </p>
          </div>
        )}

        {error && (
          <div className="bg-error-container text-on-error-container text-body-md rounded-lg px-md py-sm">{error}</div>
        )}

        {result && (
          <div className="bg-surface-container rounded-lg px-md py-sm flex flex-col gap-sm">
            <p className="text-label-md text-on-surface">
              Berhasil mengimpor {result.imported.toLocaleString('id-ID')} transaksi
              <span className="text-body-sm text-on-surface-variant font-normal ml-sm">
                ({(result.durationMs / 1000).toFixed(1)}s)
              </span>
            </p>

            {result.skipped > 0 ? (
              <>
                <p className="text-body-md text-on-surface-variant">
                  {result.skipped.toLocaleString('id-ID')} dilewati dari {result.total.toLocaleString('id-ID')} baris data.
                </p>
                {result.skippedByReason && (
                  <div className="flex flex-wrap gap-sm text-body-sm">
                    {result.skippedByReason.duplicateOrderNumber > 0 && (
                      <span className="bg-surface-container-high text-on-surface-variant px-sm py-xs rounded">
                        Duplikat: {result.skippedByReason.duplicateOrderNumber.toLocaleString('id-ID')}
                      </span>
                    )}
                    {result.skippedByReason.missingField > 0 && (
                      <span className="bg-surface-container-high text-on-surface-variant px-sm py-xs rounded">
                        Field kosong: {result.skippedByReason.missingField.toLocaleString('id-ID')}
                      </span>
                    )}
                    {result.skippedByReason.customerNotFound > 0 && (
                      <span className="bg-surface-container-high text-on-surface-variant px-sm py-xs rounded">
                        Customer tidak ditemukan: {result.skippedByReason.customerNotFound.toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>
                )}
                {result.skippedRows && result.skippedRows.length > 0 && (
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(result.skippedRows, null, 2)], { type: 'application/json' })
                      const url  = URL.createObjectURL(blob)
                      const a    = document.createElement('a')
                      a.href     = url
                      a.download = `skipped-rows-${platform}-${Date.now()}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="self-start flex items-center gap-xs text-body-sm text-primary hover:underline"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Unduh laporan baris dilewati ({result.skippedRows.length})
                  </button>
                )}
              </>
            ) : (
              <p className="text-body-md text-on-surface-variant">
                Semua {result.total.toLocaleString('id-ID')} baris berhasil diproses.
              </p>
            )}
          </div>
        )}

        <button
          disabled={!file || loading}
          onClick={handleImport}
          className="self-start flex items-center gap-sm bg-primary text-on-primary rounded-lg px-lg py-sm text-label-md font-medium hover:bg-primary-container transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Spinner />
          ) : (
            <span className="material-symbols-outlined text-[18px]">upload</span>
          )}
          {!loading && 'Import Sekarang'}
          {loading && phase === 'uploading' && progress !== null && `Mengunggah... ${progress}%`}
          {loading && phase === 'processing' && 'Memproses...'}
        </button>
      </div>

      {/* ── Import History ─────────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-lg py-md border-b border-outline-variant flex items-center justify-between">
          <div>
            <h2 className="text-h2 text-on-surface">Riwayat Import</h2>
            <p className="text-body-sm text-on-surface-variant mt-xs">
              {history.length} catatan · hapus riwayat tidak menghapus data
            </p>
          </div>
          <button
            onClick={loadHistory}
            disabled={historyLoading}
            className="inline-flex items-center gap-xs px-sm py-xs rounded border border-outline-variant text-label-sm text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-40"
          >
            <span className={`material-symbols-outlined text-[16px] ${historyLoading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-body-md min-w-[640px]">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Platform</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Nama File</th>
                <th className="text-right px-md py-sm text-label-sm text-on-surface-variant font-medium">Baris</th>
                <th className="text-right px-md py-sm text-label-sm text-on-surface-variant font-medium">Berhasil</th>
                <th className="text-right px-md py-sm text-label-sm text-on-surface-variant font-medium">Dilewati</th>
                <th className="text-right px-md py-sm text-label-sm text-on-surface-variant font-medium">Durasi</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Waktu</th>
                <th className="px-md py-sm"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {historyLoading && (
                <tr><td colSpan={8} className="py-xl text-center text-on-surface-variant">Memuat...</td></tr>
              )}
              {!historyLoading && history.length === 0 && (
                <tr><td colSpan={8} className="py-xl text-center text-on-surface-variant">Belum ada riwayat import.</td></tr>
              )}
              {!historyLoading && history.map((h) => (
                <tr key={h.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-md py-sm">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-white font-bold text-xs ${h.platform === 'shopee' ? 'bg-orange-500' : 'bg-black'}`}>
                      {h.platform === 'shopee' ? 'S' : 'T'}
                    </span>
                  </td>
                  <td className="px-md py-sm">
                    <div className="text-on-surface max-w-[180px] truncate" title={h.fileName}>{h.fileName}</div>
                    <div className="text-body-sm text-on-surface-variant">{h.user.name}</div>
                  </td>
                  <td className="px-md py-sm text-right text-on-surface-variant">{h.totalRows.toLocaleString('id-ID')}</td>
                  <td className="px-md py-sm text-right">
                    <span className="text-on-surface font-medium">{h.imported.toLocaleString('id-ID')}</span>
                  </td>
                  <td className="px-md py-sm text-right text-on-surface-variant">{h.skipped.toLocaleString('id-ID')}</td>
                  <td className="px-md py-sm text-right text-on-surface-variant whitespace-nowrap">
                    {(h.durationMs / 1000).toFixed(1)}s
                  </td>
                  <td className="px-md py-sm text-on-surface-variant whitespace-nowrap text-body-sm">
                    {new Date(h.importedAt).toLocaleDateString('id-ID', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-md py-sm">
                    <button
                      onClick={() => setDeleteTarget(h)}
                      title="Hapus riwayat ini"
                      className="inline-flex items-center p-xs rounded text-on-surface-variant hover:text-error hover:bg-error-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Danger Zone — admin only ────────────────────────────────────────── */}
      {isAdmin ? (
        <div className="bg-surface-container-lowest border border-error rounded-xl p-lg flex flex-col gap-md">
          <div>
            <h2 className="text-h2 text-error">Zona Bahaya</h2>
            <p className="text-body-sm text-on-surface-variant mt-xs">
              Hapus semua pelanggan, pesanan, dan riwayat import untuk satu platform. Tidak dapat dibatalkan.
            </p>
          </div>
          <div className="flex gap-sm flex-wrap">
            <button
              onClick={() => setClearPlatform('shopee')}
              className="flex items-center gap-sm px-md py-sm rounded-lg border border-error text-error text-label-md font-medium hover:bg-error-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">delete_forever</span>
              Hapus Semua Data Shopee
            </button>
            <button
              onClick={() => setClearPlatform('tiktok')}
              className="flex items-center gap-sm px-md py-sm rounded-lg border border-error text-error text-label-md font-medium hover:bg-error-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">delete_forever</span>
              Hapus Semua Data TikTok
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteHistoryModal
          record={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setToast('Riwayat berhasil dihapus')
            loadHistory()
          }}
        />
      )}

      {clearPlatform && (
        <ClearPlatformModal
          platform={clearPlatform}
          onClose={() => setClearPlatform(null)}
          onCleared={() => {
            setToast(`Semua data ${clearPlatform === 'shopee' ? 'Shopee' : 'TikTok'} berhasil dihapus`)
            loadHistory()
          }}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </div>
  )
}
