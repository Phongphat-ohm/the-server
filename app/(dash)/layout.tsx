import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { getCurrentUser } from '@/lib/auth'
import { needsSetup } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  if (needsSetup()) redirect('/setup')
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar username={user.username} />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  )
}
