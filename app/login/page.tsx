'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Email atau password salah')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-md">
      <div className="w-full max-w-sm">
        <div className="text-center mb-xl">
          <div className="flex items-center justify-center gap-sm mb-md">
            <span className="material-symbols-outlined text-primary text-[32px]">
              insights
            </span>
            <span className="text-h1 text-on-surface font-semibold">MarketPulse</span>
          </div>
          <p className="text-body-md text-on-surface-variant">CRM Management</p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-xl shadow-sm">
          <h2 className="text-h2 text-on-surface mb-lg">Masuk</h2>

          {error && (
            <div className="bg-error-container text-on-error-container text-body-md rounded-lg px-md py-sm mb-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-md">
            <div>
              <label className="block text-label-md text-on-surface-variant mb-xs">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary transition-colors"
                placeholder="admin@marketpulse.com"
              />
            </div>

            <div>
              <label className="block text-label-md text-on-surface-variant mb-xs">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-outline-variant rounded-lg px-md py-sm text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary rounded-lg py-sm text-label-md font-medium hover:bg-primary-container transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-sm"
            >
              {loading ? 'Memuat...' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
