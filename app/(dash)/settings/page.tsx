import type { Metadata } from 'next'
import SettingsClient from '@/components/SettingsClient'
import { getCurrentUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'ตั้งค่าเซิร์ฟเวอร์' }

export default async function SettingsPage() {
  const user = await getCurrentUser()
  return <SettingsClient role={user?.role ?? 'admin'} />
}

