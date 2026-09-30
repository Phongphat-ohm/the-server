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
    <div className="flex min-h-dvh flex-col md:flex-row bg-[var(--ts-surface)]/75">
      <Sidebar username={user.username} role={user.role} />
      <main className="min-w-0 flex-1 p-4 pt-18 md:p-8 md:pt-8 max-w-[1320px] w-full mx-auto">
        {children}
      </main>
    </div>
  )
}
