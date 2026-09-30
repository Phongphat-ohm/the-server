import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'BDS Dashboard',
    template: '%s · BDS Dashboard',
  },
  description: 'แดชบอร์ดจัดการ Minecraft Bedrock Dedicated Server — ติดตั้ง ควบคุม และตั้งค่าผ่านเว็บ',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}
