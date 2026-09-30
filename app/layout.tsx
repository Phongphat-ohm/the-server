import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import AmbientBackground from '@/components/AmbientBackground'
import { DialogProvider } from '@/components/dialog'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'THE SERVER',
    template: '%s · THE SERVER',
  },
  description: 'แดชบอร์ดจัดการ Minecraft Bedrock Dedicated Server — ติดตั้ง ควบคุม และตั้งค่าผ่านเว็บ',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body className="relative min-h-dvh selection:bg-[var(--ts-primary)] selection:text-[var(--ts-on-primary)]">
        <AmbientBackground />
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  )
}
