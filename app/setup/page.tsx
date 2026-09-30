import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import SetupWizard from '@/components/SetupWizard'
import { needsSetup } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'ตั้งค่าครั้งแรก' }

export default function SetupPage() {
  if (!needsSetup()) redirect('/')
  return (
    <div className="mx-auto max-w-2xl p-4 py-10 md:p-8">
      <div className="mb-8 text-center">
        <div className="text-5xl">🟩</div>
        <h1 className="mt-2 text-2xl font-bold">ยินดีต้อนรับสู่ BDS Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          ตั้งค่าเบื้องต้นเพียงไม่กี่ขั้นตอน แล้วคุณก็พร้อมรัน Bedrock Server ได้เลย
        </p>
      </div>
      <div className="card p-6">
        <SetupWizard />
      </div>
    </div>
  )
}
