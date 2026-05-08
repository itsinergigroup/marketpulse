'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface StaffUser {
  id:        string
  name:      string
  email:     string
  role:      string
  createdAt: string
}

// ─── Add User Modal ───────────────────────────────────────────────────────────

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [pwd, setPwd]           = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pwd !== confirmPwd) { setError('Password tidak cocok'); return }
    if (pwd.length < 8)     { setError('Password minimal 8 karakter'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/users', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ name, email, password: pwd }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Gagal membuat akun'); setSaving(false); return }
      onCreated()
      onClose()
    } catch { setError('Koneksi gagal'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-lg w-full max-w-md p-xl flex flex-col gap-md mx-md">
        <div className="flex items-center justify-between">
          <h2 className="text-h2 text-on-surface">Tambah Akun Staff</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          {[
            { label: 'Nama Lengkap', value: name,       setter: setName,       type: 'text',     placeholder: 'Nama lengkap' },
            { label: 'Email',         value: email,      setter: setEmail,      type: 'email',    placeholder: 'email@domain.com' },
            { label: 'Password',      value: pwd,        setter: setPwd,        type: 'password', placeholder: 'Min. 8 karakter' },
            { label: 'Konfirmasi',    value: confirmPwd, setter: setConfirmPwd, type: 'password', placeholder: 'Ulangi password' },
          ].map(({ label, value, setter, type, placeholder }) => (
            <div key={label}>
              <label className="block text-label-md text-on-surface-variant mb-xs">{label}</label>
              <input
                type={type}
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
                required
                className="w-full border border-outline-variant rounded-lg px-md py-sm text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary placeholder:text-on-surface-variant"
              />
            </div>
          ))}

          {error && (
            <div className="bg-error-container text-on-error-container text-body-md rounded-lg px-md py-sm">{error}</div>
          )}

          <div className="flex gap-sm justify-end">
            <button type="button" onClick={onClose}
              className="px-lg py-sm rounded-lg border border-outline-variant text-label-md text-on-surface hover:bg-surface-container-low transition-colors">
              Batal
            </button>
            <button type="submit" disabled={saving}
              className="px-lg py-sm rounded-lg bg-primary text-on-primary text-label-md font-medium hover:bg-primary-container transition-colors disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Buat Akun'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose }: { user: StaffUser; onClose: () => void }) {
  const [pwd, setPwd]           = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pwd !== confirmPwd) { setError('Password tidak cocok'); return }
    if (pwd.length < 8)     { setError('Password minimal 8 karakter'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method:      'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ newPassword: pwd }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Gagal'); setSaving(false); return }
      setDone(true)
    } catch { setError('Koneksi gagal'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-lg w-full max-w-md p-xl flex flex-col gap-md mx-md">
        <div className="flex items-center justify-between">
          <h2 className="text-h2 text-on-surface">Reset Password</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-md py-md">
            <span className="material-symbols-outlined text-[48px] text-primary">check_circle</span>
            <p className="text-body-md text-on-surface text-center">Password berhasil direset untuk <strong>{user.name}</strong></p>
            <button onClick={onClose}
              className="px-lg py-sm rounded-lg bg-primary text-on-primary text-label-md font-medium hover:bg-primary-container transition-colors">
              Tutup
            </button>
          </div>
        ) : (
          <>
            <p className="text-body-md text-on-surface-variant">
              Reset password untuk <strong className="text-on-surface">{user.name}</strong> ({user.email})
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-md">
              <div>
                <label className="block text-label-md text-on-surface-variant mb-xs">Password Baru</label>
                <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
                  placeholder="Min. 8 karakter" required
                  className="w-full border border-outline-variant rounded-lg px-md py-sm text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-label-md text-on-surface-variant mb-xs">Konfirmasi Password</label>
                <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Ulangi password" required
                  className="w-full border border-outline-variant rounded-lg px-md py-sm text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary" />
              </div>
              {error && <div className="bg-error-container text-on-error-container text-body-md rounded-lg px-md py-sm">{error}</div>}
              <div className="flex gap-sm justify-end">
                <button type="button" onClick={onClose}
                  className="px-lg py-sm rounded-lg border border-outline-variant text-label-md text-on-surface hover:bg-surface-container-low transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="px-lg py-sm rounded-lg bg-primary text-on-primary text-label-md font-medium hover:bg-primary-container transition-colors disabled:opacity-60">
                  {saving ? 'Menyimpan...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ user, onClose, onDeleted }: { user: StaffUser; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState('')

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE', credentials: 'include' })
      const d   = await res.json()
      if (!res.ok) { setError(d.error ?? 'Gagal'); setDeleting(false); return }
      onDeleted()
      onClose()
    } catch { setError('Koneksi gagal'); setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-lg w-full max-w-md p-xl flex flex-col gap-md mx-md">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-error text-[24px]">warning</span>
          <h2 className="text-h2 text-on-surface">Hapus Akun?</h2>
        </div>
        <p className="text-body-md text-on-surface-variant">
          Hapus akun <strong className="text-on-surface">{user.name}</strong> ({user.email}) secara permanen?
        </p>
        {error && <div className="bg-error-container text-on-error-container text-body-md rounded-lg px-md py-sm">{error}</div>}
        <div className="flex gap-sm justify-end">
          <button onClick={onClose}
            className="px-lg py-sm rounded-lg border border-outline-variant text-label-md text-on-surface hover:bg-surface-container-low transition-colors">
            Batal
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="px-lg py-sm rounded-lg bg-error text-on-error text-label-md font-medium hover:opacity-90 disabled:opacity-60 transition-opacity">
            {deleting ? 'Menghapus...' : 'Ya, Hapus'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [users, setUsers]           = useState<StaffUser[]>([])
  const [loading, setLoading]       = useState(true)
  const [showAdd, setShowAdd]       = useState(false)
  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null)

  // Redirect if not admin
  useEffect(() => {
    if (status === 'loading') return
    if (!session || (session.user as { role?: string }).role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [session, status, router])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/users', { credentials: 'include' })
      const data = await res.json()
      setUsers(data.users ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && (session?.user as { role?: string })?.role === 'admin') {
      loadUsers()
    }
  }, [status, session, loadUsers])

  const roleBadge = (role: string) =>
    role === 'admin'
      ? 'bg-purple-100 text-purple-800'
      : 'bg-surface-container text-on-surface-variant'

  if (status === 'loading') return null

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 text-on-surface">Kelola Akun Staff</h1>
          <p className="text-body-md text-on-surface-variant mt-xs">{users.length} akun terdaftar</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-sm px-md py-sm rounded-lg bg-primary text-on-primary text-label-md font-medium hover:bg-primary-container transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Tambah Akun Staff
        </button>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Nama</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Email</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Role</th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-medium">Dibuat</th>
                <th className="px-md py-sm text-label-sm text-on-surface-variant font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading && (
                <tr><td colSpan={5} className="py-xl text-center text-on-surface-variant">Memuat...</td></tr>
              )}
              {!loading && users.map((u) => {
                const isSelf = u.id === (session?.user as { id?: string })?.id
                return (
                  <tr key={u.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-md py-sm">
                      <div className="text-on-surface font-medium">{u.name}</div>
                      {isSelf && <div className="text-body-sm text-primary">(Akun saya)</div>}
                    </td>
                    <td className="px-md py-sm text-on-surface-variant">{u.email}</td>
                    <td className="px-md py-sm">
                      <span className={`inline-flex items-center px-sm py-xs rounded-full text-label-sm font-medium ${roleBadge(u.role)}`}>
                        {u.role === 'admin' ? '👑 Admin' : 'Staff'}
                      </span>
                    </td>
                    <td className="px-md py-sm text-on-surface-variant whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-md py-sm">
                      <div className="flex items-center gap-xs justify-end">
                        <button
                          onClick={() => setResetTarget(u)}
                          className="inline-flex items-center gap-xs px-sm py-xs rounded border border-outline-variant text-label-sm text-on-surface hover:bg-surface-container-low transition-colors whitespace-nowrap"
                        >
                          <span className="material-symbols-outlined text-[14px]">lock_reset</span>
                          Reset Password
                        </button>
                        <button
                          disabled={isSelf}
                          onClick={() => setDeleteTarget(u)}
                          title={isSelf ? 'Tidak dapat menghapus akun sendiri' : 'Hapus akun'}
                          className="inline-flex items-center p-xs rounded text-on-surface-variant hover:text-error hover:bg-error-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd    && <AddUserModal       onClose={() => setShowAdd(false)}    onCreated={loadUsers} />}
      {resetTarget && <ResetPasswordModal user={resetTarget}                  onClose={() => setResetTarget(null)} />}
      {deleteTarget && <DeleteConfirm    user={deleteTarget}                  onClose={() => setDeleteTarget(null)} onDeleted={loadUsers} />}
    </div>
  )
}
