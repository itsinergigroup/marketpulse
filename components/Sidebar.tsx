'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { signOut } from 'next-auth/react'

const navItems = [
  { label: 'Dashboard', icon: 'dashboard',    href: '/dashboard' },
  { label: 'Pelanggan', icon: 'group',         href: '/pelanggan' },
  { label: 'Pesanan',   icon: 'shopping_cart', href: '/pesanan'   },
  { label: 'Import',    icon: 'upload_file',   href: '/import'    },
  { label: 'Follow-Up', icon: 'message',       href: '/followup'  },
]

function NavLink({
  href,
  icon,
  label,
  pathname,
}: {
  href: string
  icon: string
  label: string
  pathname: string
}) {
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={`flex items-center gap-sm px-md py-sm rounded-full text-label-md transition-colors ${
        active
          ? 'bg-primary-container text-on-primary-container font-medium'
          : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
      {label}
    </Link>
  )
}

export default function Sidebar() {
  const pathname          = usePathname()
  const { data: session } = useSession()
  const isAdmin           = (session?.user as { role?: string })?.role === 'admin'

  function handleLogout() {
    signOut({ callbackUrl: '/login' })
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-surface-container-lowest border-r border-outline-variant flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-sm px-lg py-lg border-b border-outline-variant">
        <span className="material-symbols-outlined text-primary text-[28px]">insights</span>
        <div>
          <div className="text-label-md font-semibold text-on-surface">MarketPulse</div>
          <div className="text-body-sm text-on-surface-variant">CRM Management</div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-sm py-md flex flex-col gap-xs overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} pathname={pathname} />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-sm py-md border-t border-outline-variant flex flex-col gap-xs">
        <NavLink href="/settings" icon="settings" label="Pengaturan" pathname={pathname} />

        {isAdmin && (
          <NavLink
            href="/settings/users"
            icon="manage_accounts"
            label="Kelola Akun"
            pathname={pathname}
          />
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-sm px-md py-sm rounded-full text-label-md text-error hover:bg-error-container transition-colors w-full text-left"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Keluar
        </button>
      </div>
    </aside>
  )
}
