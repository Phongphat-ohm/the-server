'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { User, Lock, Eye, EyeOff, LogIn, Loader2, AlertCircle } from 'lucide-react'

export default function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'เข้าสู่ระบบไม่สำเร็จ')
        return
      }
      router.replace('/')
      router.refresh()
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Username Field */}
      <div>
        <label className="label block mb-1 text-sm font-medium" htmlFor="login-username">
          ชื่อผู้ใช้
        </label>
        <div className="relative flex items-center">
          <div className="pointer-events-none absolute left-3.5 z-10 flex items-center justify-center text-[var(--ts-on-surface-variant)]">
            <User size={18} />
          </div>
          <input
            id="login-username"
            className="input input-has-left-icon"
            style={{ paddingLeft: '2.75rem' }}
            placeholder="เช่น admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
      </div>

      {/* Password Field */}
      <div>
        <label className="label block mb-1 text-sm font-medium" htmlFor="login-password">
          รหัสผ่าน
        </label>
        <div className="relative flex items-center">
          <div className="pointer-events-none absolute left-3.5 z-10 flex items-center justify-center text-[var(--ts-on-surface-variant)]">
            <Lock size={18} />
          </div>
          <input
            id="login-password"
            className="input input-has-left-icon input-has-right-icon"
            style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2.5 z-10 flex items-center justify-center p-1 text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)] transition-colors focus:outline-none"
            tabIndex={-1}
            aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>


      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2.5 rounded-xl border border-[var(--ts-error)]/40 bg-[var(--ts-error-container)]/30 px-3.5 py-2.5 text-xs text-[#ffb4ab]"
        >
          <AlertCircle size={15} className="shrink-0 text-[var(--ts-error)]" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Submit Button */}
      <motion.button
        type="submit"
        whileHover={{ scale: busy ? 1 : 1.01 }}
        whileTap={{ scale: busy ? 1 : 0.98 }}
        className="btn btn-primary w-full gap-2 shadow-md"
        disabled={busy}
      >
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>กำลังตรวจสอบ...</span>
          </>
        ) : (
          <>
            <LogIn size={16} />
            <span>เข้าสู่ระบบ</span>
          </>
        )}
      </motion.button>
    </form>
  )
}