import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import AppLayout from '@/components/AppLayout'
import NextAuthProvider from '@/components/NextAuthProvider'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <NextAuthProvider>
      <AppLayout>{children}</AppLayout>
    </NextAuthProvider>
  )
}
