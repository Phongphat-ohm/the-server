import type { Metadata } from 'next'
import DashboardClient from '@/components/DashboardClient'
import { getCurrentUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'ภาพรวม & คอนโซล' }

export default async function DashboardPage() {
  const user = await getCurrentUser()
  return <DashboardClient role={user?.role ?? 'admin'} />
}

