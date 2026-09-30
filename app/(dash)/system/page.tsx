import type { Metadata } from 'next'
import SystemClient from '@/components/SystemClient'

export const metadata: Metadata = { title: 'ตรวจสอบระบบ' }

export default function SystemPage() {
  return <SystemClient />
}
