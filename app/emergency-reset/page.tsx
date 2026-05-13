import { prisma } from '@/lib/prisma'
import EmergencyResetForm from './EmergencyResetForm'

export default async function EmergencyResetPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token  = searchParams.token ?? ''
  const secret = process.env.EMERGENCY_RESET_TOKEN ?? ''

  const ip = 'server-render'
  console.log(`[emergency-reset] page access, token_present=${!!token}, configured=${secret.length >= 32}`)

  const valid = secret.length >= 32 && token.length > 0 && token === secret

  if (!valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-md">
        <div className="w-full max-w-xs text-center flex flex-col items-center gap-md">
          <span className="material-symbols-outlined text-error text-[56px]">lock</span>
          <h1 className="text-h1 text-on-surface">Access Denied</h1>
          <p className="text-body-md text-on-surface-variant">Token tidak valid atau tidak ada.</p>
        </div>
      </div>
    )
  }

  const users = await prisma.user.findMany({
    select:  { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-md py-xl">
      <EmergencyResetForm users={users} token={token} />
    </div>
  )
}
