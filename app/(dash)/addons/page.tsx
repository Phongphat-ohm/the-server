import type { Metadata } from 'next'
import AddonsClient from '@/components/AddonsClient'

export const metadata: Metadata = { title: 'จัดการ Addons' }

export default function AddonsPage() {
  return <AddonsClient />
}
