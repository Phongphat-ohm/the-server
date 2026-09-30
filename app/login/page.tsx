import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import LoginForm from '@/components/LoginForm'
import { getCurrentUser } from '@/lib/auth'
import { needsSetup } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'เข้าสู่ระบบ' }

export default async function LoginPage() {
  if (needsSetup()) redirect('/setup')
  const user = await getCurrentUser()
  if (user) redirect('/')
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-5xl">🟩</div>
          <h1 className="mt-2 text-xl font-bold">BDS Dashboard</h1>
          <p className="text-sm text-slate-400">เข้าสู่ระบบเพื่อจัดการ Minecraft Bedrock Server</p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
