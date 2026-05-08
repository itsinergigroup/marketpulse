'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Password baru tidak cocok' })
      return
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password minimal 6 karakter' })
      return
    }

    setSaving(true)
    setMessage(null)

    const res = await fetch('/api/settings/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setMessage({ type: 'error', text: data.error ?? 'Gagal mengubah password' })
    } else {
      setMessage({ type: 'success', text: 'Password berhasil diubah' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="flex flex-col gap-lg max-w-lg">
      <div>
        <h1 className="text-h1 text-on-surface">Pengaturan</h1>
        <p className="text-body-md text-on-surface-variant mt-xs">Kelola akun Anda</p>
      </div>

      {/* Profile info */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
        <h2 className="text-h2 text-on-surface">Profil</h2>
        <div className="flex items-center gap-md">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-on-primary text-h2 font-semibold">
            {session?.user?.name?.slice(0, 2).toUpperCase() ?? 'AD'}
          </div>
          <div>
            <p className="text-label-md text-on-surface font-medium">{session?.user?.name ?? '-'}</p>
            <p className="text-body-sm text-on-surface-variant">{session?.user?.email ?? '-'}</p>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
        <h2 className="text-h2 text-on-surface">Ubah Password</h2>

        {message && (
          <div className={`text-body-md rounded-lg px-md py-sm ${
            message.type === 'success'
              ? 'bg-surface-container text-on-surface'
              : 'bg-error-container text-on-error-container'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="flex flex-col gap-md">
          <div>
            <label className="block text-label-md text-on-surface-variant mb-xs">Password Saat Ini</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full border border-outline-variant rounded-lg px-md py-sm text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-label-md text-on-surface-variant mb-xs">Password Baru</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full border border-outline-variant rounded-lg px-md py-sm text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-label-md text-on-surface-variant mb-xs">Konfirmasi Password Baru</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full border border-outline-variant rounded-lg px-md py-sm text-body-md bg-surface-container-lowest text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="self-start bg-primary text-on-primary rounded-lg px-lg py-sm text-label-md font-medium hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
