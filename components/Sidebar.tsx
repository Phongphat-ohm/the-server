'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard,
  Files,
  Settings,
  Puzzle,
  Activity,
  Users,
  LogOut,
  Menu,
  X,
  User,
  ShieldCheck,
} from 'lucide-react'
import { dialog } from '@/components/dialog'

const NAV = [
  { href: '/', label: 'ภาพรวม & คอนโซล', icon: LayoutDashboard },
  { href: '/files', label: 'จัดการไฟล์', icon: Files },
  { href: '/settings', label: 'ตั้งค่า', icon: Settings },
  { href: '/addons', label: 'ส่วนเสริม', icon: Puzzle },
  { href: '/system', label: 'ระบบ', icon: Activity },
  { href: '/users', label: 'ผู้ใช้งาน', icon: Users, adminOnly: true },
]

function LogoutButton() {
  const logout = async () => {
    const ok = await dialog.confirm({
      title: 'ออกจากระบบ',
      message: 'คุณต้องการออกจากระบบแดชบอร์ดใช่หรือไม่?',
      type: 'warning',
      confirmText: 'ออกจากระบบ',
      cancelText: 'ยกเลิก',
      isDanger: true,
    })
    if (!ok) return

    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ปิดเน็ตชั่วคราว — ยังคงพาไปหน้า login
    }
    window.location.href = '/login'
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="btn btn-sm w-full flex items-center justify-center gap-2 border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface-variant)] transition-all hover:text-[var(--ts-error)] hover:border-[var(--ts-error)] hover:bg-[var(--ts-surface-highest)]"
    >
      <LogOut size={14} />
      <span>ออกจากระบบ</span>
    </button>
  )
}

export default function Sidebar({
  username,
  role = 'admin',
}: {
  username: string
  role?: string
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const items = NAV.filter((item) => !item.adminOnly || role === 'admin')

  const renderNavLinks = (onItemClick?: () => void) => (
    <div className="flex flex-col gap-1.5 w-full">
      {items.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <div key={item.href} className="w-full">
            <Link
              href={item.href}
              onClick={onItemClick}
              className={`group relative flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 w-full overflow-hidden select-none ${
                active
                  ? 'bg-[var(--ts-primary-container)] text-[var(--ts-primary)] shadow-[0_2px_12px_rgba(143,205,255,0.15)] ring-1 ring-[var(--ts-primary)]/30'
                  : 'text-[var(--ts-on-surface-variant)] hover:bg-[var(--ts-surface-high)] hover:text-[var(--ts-on-surface)]'
              }`}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2.5 : 2}
                className="shrink-0 transition-transform duration-200 group-hover:scale-110"
              />
              <span className="truncate">{item.label}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ts-primary)] shadow-[0_0_8px_var(--ts-primary)]" />
              )}
            </Link>
          </div>
        )
      })}
    </div>
  )

  return (
    <>
      {/* ── Desktop Sidebar (No X-Scroll Overflow) ───────── */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col gap-6 border-r border-[var(--ts-outline-variant)] bg-[var(--ts-surface-dim)] p-5 h-dvh sticky top-0 overflow-x-hidden overflow-y-auto">
        {/* Brand Header */}
        <Link href="/" className="flex items-center gap-3 px-1 transition-opacity hover:opacity-90 shrink-0">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] p-1 shadow-sm">
            <Image
              src="/logo.png"
              alt="THE SERVER"
              width={34}
              height={34}
              className="object-contain"
              priority
            />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold tracking-tight text-[var(--ts-on-surface)] truncate">
              THE SERVER
            </div>
            <div className="text-[11px] font-medium text-[var(--ts-on-surface-variant)] truncate">
              Bedrock Server Manager
            </div>
          </div>
        </Link>

        {/* Navigation (Strictly overflow-x-hidden) */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
          {renderNavLinks()}
        </nav>

        {/* User Card & Logout Footer */}
        <div className="border-t border-[var(--ts-outline-variant)] pt-4 space-y-3 shrink-0">
          <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl bg-[var(--ts-surface-low)] border border-[var(--ts-outline-variant)]/60">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ts-primary-container)] text-[var(--ts-primary)]">
              {role === 'admin' ? <ShieldCheck size={16} /> : <User size={16} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ts-on-surface-variant)]">
                  {role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
                </span>
              </div>
              <div className="truncate text-xs font-bold text-[var(--ts-on-surface)]">
                {username}
              </div>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* ── Mobile Top Bar ───────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-[var(--ts-outline-variant)] bg-[var(--ts-surface-dim)]/95 backdrop-blur-md px-4 shadow-sm">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] p-0.5">
            <Image
              src="/logo.png"
              alt="THE SERVER"
              width={26}
              height={26}
              className="object-contain"
            />
          </div>
          <span className="text-sm font-bold tracking-tight text-[var(--ts-on-surface)]">
            THE SERVER
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface)] transition-colors hover:bg-[var(--ts-surface-highest)]"
          aria-label="เปิดเมนู"
        >
          <Menu size={18} />
        </button>
      </header>

      {/* ── Mobile Drawer (Animated) ─────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />

            {/* Slide-in Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] border-r border-[var(--ts-outline-variant)] bg-[var(--ts-surface-dim)] p-5 flex flex-col gap-6 shadow-2xl overflow-x-hidden"
            >
              <div className="flex items-center justify-between pb-1 border-b border-[var(--ts-outline-variant)] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] p-0.5">
                    <Image
                      src="/logo.png"
                      alt="THE SERVER"
                      width={28}
                      height={28}
                      className="object-contain"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--ts-on-surface)]">THE SERVER</div>
                    <div className="text-[10px] text-[var(--ts-on-surface-variant)]">Bedrock Manager</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)]"
                  aria-label="ปิดเมนู"
                >
                  <X size={16} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
                {renderNavLinks(() => setMobileOpen(false))}
              </nav>

              <div className="border-t border-[var(--ts-outline-variant)] pt-4 space-y-3 shrink-0">
                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-[var(--ts-surface-low)] border border-[var(--ts-outline-variant)]/60">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ts-primary-container)] text-[var(--ts-primary)]">
                    {role === 'admin' ? <ShieldCheck size={15} /> : <User size={15} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase font-semibold text-[var(--ts-on-surface-variant)]">
                      {role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
                    </div>
                    <div className="truncate text-xs font-bold text-[var(--ts-on-surface)]">
                      {username}
                    </div>
                  </div>
                </div>
                <LogoutButton />
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
