import type { Metadata } from 'next'
import SettingsClient from '@/components/SettingsClient'

export const metadata: Metadata = { title: 'ตั้งค่าเซิร์ฟเวอร์' }

export default function SettingsPage() {
  return <SettingsClient />
}
