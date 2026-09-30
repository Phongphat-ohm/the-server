import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import SetupWizard from '@/components/SetupWizard'
import { needsSetup } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'ตั้งค่าเริ่มต้น',
  description: 'เริ่มต้นใช้งานและตั้งค่าเซิร์ฟเวอร์ THE SERVER',
}

export default function SetupPage() {
  if (!needsSetup()) redirect('/')

  return (
    <div className="min-h-dvh bg-[var(--ts-surface)] p-4 py-8 md:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Brand Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] p-1.5 shadow-md">
            <Image
              src="/logo.png"
              alt="THE SERVER"
              width={48}
              height={48}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ts-on-surface)]">
            ยินดีต้อนรับสู่ THE SERVER
          </h1>
          <p className="mt-1 text-xs text-[var(--ts-on-surface-variant)]">
            ตั้งค่าเบื้องต้นเพียงไม่กี่ขั้นตอน แล้วคุณก็พร้อมรัน Minecraft Bedrock Server ได้ทันที
          </p>
        </div>

        {/* Wizard Card Container */}
        <div className="card p-6 md:p-8 shadow-xl">
          <SetupWizard />
        </div>
      </div>
    </div>
  )
}
