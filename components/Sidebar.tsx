'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/', label: 'ภาพรวม', icon: '📊' },
  { href: '/console', label: 'คอนโซล', icon: '🖥️' },
  { href: '/settings', label: 'ตั้งค่า', icon: '⚙️' },
  { href: '/addons', label: 'ส่วนเสริม', icon: '🧩' },
  { href: '/system', label: 'ระบบ', icon: '🩺' },
]

function LogoutButton() {
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ปิดเน็ตชั่วคราว — ยังคงพาไปหน้า login
    }
    window.location.href = '/login'
  }
  return (
    <button type="button" onClick={() => void logout()} className="btn btn-sm w-full">
      ออกจากระบบ
    </button>
  )
}

export default function Sidebar({ username }: { username: string }) {
  const pathname = usePathname()
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-[#1b2536] bg-[#0a0f1a] p-4 md:h-dvh md:w-60 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2.5 px-1">
        <span className="text-3xl leading-none">🟩</span>
        <div>
          <div className="text-sm font-bold tracking-wide">BDS Dashboard</div>
          <div className="text-[11px] text-slate-500">Bedrock Server Manager</div>
        </div>
      </div>
      <nav className="flex flex-row gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto hidden space-y-3 border-t border-[#1b2536] pt-4 md:block">
        <div className="px-1">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">ผู้ใช้งาน</div>
          <div className="truncate text-sm font-semibold text-slate-300">{username}</div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  )
}
