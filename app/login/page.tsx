import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import LoginForm from '@/components/LoginForm'
import { getCurrentUser } from '@/lib/auth'
import { needsSetup } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ',
  description: 'เข้าสู่ระบบจัดการเซิร์ฟเวอร์ THE SERVER',
}

export default async function LoginPage() {
  if (needsSetup()) redirect('/setup')
  const user = await getCurrentUser()
  if (user) redirect('/')

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 bg-[var(--ts-surface)]">
      <div className="w-full max-w-sm">
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
            THE SERVER
          </h1>
          <p className="mt-1 text-xs text-[var(--ts-on-surface-variant)]">
            เข้าสู่ระบบเพื่อจัดการ Minecraft Bedrock Server
          </p>
        </div>

        {/* Card Form */}
        <div className="card p-6 shadow-xl">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
