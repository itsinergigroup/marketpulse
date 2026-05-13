'use client'

import { useState } from 'react'
import Link from 'next/link'

interface User {
  id:    string
  name:  string
  email: string
}

interface Props {
  users: User[]
  token: string
}

export default function EmergencyResetForm({ users, token }: Props) {
  const [userId,    setUserId]    = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [succeeded, setSucceeded] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!userId) { setError('Pilih user terlebih dahulu'); return }
    if (password.length < 8) { setError('Password minimal 8 karakter'); return }
    if (password !== confirm) { setError('Password tidak cocok'); return }

    setLoading(true)
    try {
      const res  = await fetch('/api/emergency-reset', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, userId, newPassword: password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
      } else {
        setSucceeded(true)
      }
    } catch {
      setError('Koneksi gagal')
    } finally {
      setLoading(false)
    }
  }

  if (succeeded) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-surface-container-low rounded-xl shadow-elevation-2 p-xl flex flex-col items-center gap-md text-center">
          <span className="material-symbols-outlined text-[48px]" style={{ color: '#2e7d32' }}>check_circle</span>
          <h2 className="text-h2 text-on-surface">Password Berhasil Direset</h2>
          <p className="text-body-md text-on-surface-variant">
            Password berhasil direset. Silakan login.
          </p>
          <Link
            href="/login"
            className="mt-sm bg-primary text-on-primary rounded-full px-xl py-sm text-label-md font-medium hover:opacity-90 transition-opacity"
          >
            Ke Halaman Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      {/* Header */}
      <div className="text-center mb-xl">
        <div className="flex items-center justify-center gap-sm mb-md">
          <span className="material-symbols-outlined text-primary text-[32px]">lock_reset</span>
          <span className="text-h1 text-on-surface font-semibold">MarketPulse</span>
        </div>
        <p className="text-body-md text-on-surface-variant">Emergency Password Reset</p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-elevation-2 p-xl flex flex-col gap-md">
        {/* Warning banner */}
        <div className="bg-error-container text-on-error-container rounded-xl px-md py-sm text-body-sm flex items-start gap-sm">
          <span className="material-symbols-outlined text-[16px] shrink-0 mt-[2px]">warning</span>
          <span>Halaman ini hanya untuk keperluan darurat. Setiap akses dicatat.</span>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container text-body-md rounded-xl px-md py-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          {/* User select */}
          <div>
            <label className="block text-label-md text-on-surface-variant mb-xs">
              Pilih User
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className="w-full border border-outline rounded-xl px-md py-sm text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary"
            >
              <option value="">— Pilih user —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {/* New password */}
          <div>
            <label className="block text-label-md text-on-surface-variant mb-xs">
              Password Baru
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Minimal 8 karakter"
              className="w-full border border-outline rounded-xl px-md py-sm text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant"
            />
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-label-md text-on-surface-variant mb-xs">
              Konfirmasi Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              placeholder="Ulangi password baru"
              className="w-full border border-outline rounded-xl px-md py-sm text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary rounded-full py-sm text-label-md font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed mt-sm"
          >
            {loading ? 'Mereset...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
