import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import UsersClient from '@/components/UsersClient'
import { getCurrentUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'จัดการผู้ใช้งาน' }

export default async function UsersPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/')

  return <UsersClient currentUserId={user.id} />
}
