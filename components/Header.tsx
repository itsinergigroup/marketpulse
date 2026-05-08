'use client'

import { useSession } from 'next-auth/react'

export default function Header() {
  const { data: session } = useSession()
  const initials = session?.user?.name
    ? session.user.name.slice(0, 2).toUpperCase()
    : 'AD'

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-surface-container-lowest border-b border-outline-variant flex items-center px-container-margin z-20">
      <div className="flex-1 relative max-w-sm">
        <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
          search
        </span>
        <input
          type="text"
          placeholder="Cari..."
          className="w-full pl-10 pr-md py-xs border border-outline-variant rounded-lg text-body-md bg-surface-container focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant transition-colors"
        />
      </div>

      <div className="flex items-center gap-md ml-auto">
        <button className="text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-[22px]">notifications</span>
        </button>

        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary text-label-sm font-semibold">
          {initials}
        </div>
      </div>
    </header>
  )
}
