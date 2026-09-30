import type { Metadata } from 'next'
import ConsoleClient from '@/components/ConsoleClient'

export const metadata: Metadata = { title: 'คอนโซล' }

export default function ConsolePage() {
  return <ConsoleClient />
}
