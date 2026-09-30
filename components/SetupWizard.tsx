'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  UserPlus,
  Server,
  PartyPopper,
  Eye,
  EyeOff,
  User,
  Lock,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import SpecSummary from './SpecSummary'
import InstallPanel from './InstallPanel'
import type { SystemSpecs } from '@/lib/system/specs'

const STEPS = [
  { id: 1, label: 'ตรวจสอบระบบ' },
  { id: 2, label: 'สร้างแอดมิน' },
  { id: 3, label: 'ติดตั้งเซิร์ฟเวอร์' },
  { id: 4, label: 'เสร็จสิ้น' },
]

export default function SetupWizard() {
  const [step, setStep] = useState(1)
  const [specs, setSpecs] = useState<SystemSpecs | null>(null)
  const [specsLoading, setSpecsLoading] = useState(false)
  const [specsError, setSpecsError] = useState<string | null>(null)

  const [form, setForm] = useState({ username: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchSpecs = () => {
    setSpecsLoading(true)
    setSpecsError(null)
    fetch('/api/system/specs', { cache: 'no-store' })
      .then((r) => r.json())
      .then((body: SystemSpecs & { error?: string }) => {
        if (body.error) setSpecsError(body.error)
        else setSpecs(body)
      })
      .catch(() => setSpecsError('ตรวจสอบระบบไม่สำเร็จ — กดปุ่มลองใหม่'))
      .finally(() => setSpecsLoading(false))
  }

  useEffect(() => {
    if (step === 1 && !specs) {
      fetchSpecs()
    }
  }, [step, specs])

  const createAdmin = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    if (form.password !== form.confirm) {
      setFormError('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/setup/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: form.username, password: form.password }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setFormError(body.error ?? 'สร้างบัญชีไม่สำเร็จ')
        return
      }
      setStep(3)
    } catch {
      setFormError('เชื่อมต่อไม่ได้')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Stepper Indicator ─────────────────────────────────── */}
      <ol className="flex items-center justify-between gap-2 border-b border-[var(--ts-outline-variant)]/60 pb-6">
        {STEPS.map((s, index) => {
          const isDone = s.id < step
          const isCurrent = s.id === step
          return (
            <li key={s.id} className="flex flex-1 items-center gap-2">
              <div className="flex items-center gap-2">
                <motion.span
                  animate={{
                    scale: isCurrent ? 1.05 : 1,
                    backgroundColor: isDone
                      ? 'var(--ts-tertiary)'
                      : isCurrent
                        ? 'var(--ts-primary)'
                        : 'var(--ts-surface-high)',
                    color: isDone
                      ? 'var(--ts-on-tertiary)'
                      : isCurrent
                        ? 'var(--ts-on-primary)'
                        : 'var(--ts-on-surface-variant)',
                  }}
                  transition={{ duration: 0.2 }}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent ? 'shadow-[0_0_12px_rgba(143,205,255,0.4)]' : ''
                  }`}
                >
                  {isDone ? <CheckCircle2 size={16} strokeWidth={2.5} /> : s.id}
                </motion.span>
                <span
                  className={`hidden text-xs font-semibold sm:inline-block ${
                    isCurrent
                      ? 'text-[var(--ts-on-surface)]'
                      : isDone
                        ? 'text-[var(--ts-tertiary)]'
                        : 'text-[var(--ts-on-surface-variant)]'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded-full transition-colors ${
                    isDone ? 'bg-[var(--ts-tertiary)]' : 'bg-[var(--ts-outline-variant)]/40'
                  }`}
                />
              )}
            </li>
          )
        })}
      </ol>

      {/* ── Step Content with AnimatePresence ─────────────────── */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step-1"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-lg font-bold text-[var(--ts-on-surface)]">
                ขั้นที่ 1 — ตรวจสอบความพร้อมของระบบ
              </h2>
              <p className="mt-1 text-xs text-[var(--ts-on-surface-variant)]">
                ประเมินสเปก CPU, RAM, พื้นที่ว่าง และความเข้ากันได้ของระบบปฏิบัติการ
              </p>
            </div>

            {specsError && (
              <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-300">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{specsError}</span>
                </div>
                <button
                  type="button"
                  onClick={fetchSpecs}
                  className="btn btn-sm text-xs gap-1 border-amber-500/40 bg-amber-500/20 text-amber-200"
                >
                  <RefreshCw size={12} />
                  <span>ลองใหม่</span>
                </button>
              </div>
            )}

            {specs ? (
              <SpecSummary specs={specs} />
            ) : specsLoading ? (
              <div className="py-20 text-center space-y-2">
                <Loader2 size={24} className="animate-spin text-[var(--ts-primary)] mx-auto" />
                <div className="text-xs text-[var(--ts-on-surface-variant)]">
                  กำลังตรวจสอบฮาร์ดแวร์...
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-[var(--ts-outline-variant)]/60">
              <button
                type="button"
                className="btn btn-primary gap-2"
                onClick={() => setStep(2)}
                disabled={!specs}
              >
                <span>ถัดไป</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.form
            key="step-2"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
            onSubmit={createAdmin}
          >
            <div>
              <h2 className="text-lg font-bold text-[var(--ts-on-surface)] flex items-center gap-2">
                <UserPlus size={20} className="text-[var(--ts-primary)]" />
                <span>ขั้นที่ 2 — สร้างบัญชีแอดมิน</span>
              </h2>
              <p className="mt-1 text-xs text-[var(--ts-on-surface-variant)]">
                บัญชีนี้จะได้รับสิทธิ์ดูแลระบบสูงสุด เพื่อใช้จัดการ Dashboard และคำสั่งเซิร์ฟเวอร์
              </p>
            </div>

            <div className="grid max-w-md gap-4">
              <div>
                <label className="label" htmlFor="setup-username">
                  ชื่อผู้ใช้ (a-z A-Z 0-9 _ . - ยาว 3-32 ตัวอักษร)
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center text-[var(--ts-on-surface-variant)]">
                    <User size={18} />
                  </div>
                  <input
                    id="setup-username"
                    className="input input-has-left-icon"
                    style={{ paddingLeft: '2.75rem' }}
                    placeholder="เช่น admin"
                    value={form.username}
                    onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="setup-password">
                  รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center text-[var(--ts-on-surface-variant)]">
                    <Lock size={18} />
                  </div>
                  <input
                    id="setup-password"
                    className="input input-has-left-icon input-has-right-icon"
                    style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center p-1 text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)] transition-colors focus:outline-none"
                    tabIndex={-1}
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="setup-confirm">
                  ยืนยันรหัสผ่าน
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center text-[var(--ts-on-surface-variant)]">
                    <Lock size={18} />
                  </div>
                  <input
                    id="setup-confirm"
                    className="input input-has-left-icon input-has-right-icon"
                    style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.confirm}
                    onChange={(e) => setForm((prev) => ({ ...prev, confirm: e.target.value }))}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center p-1 text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)] transition-colors focus:outline-none"
                    tabIndex={-1}
                    aria-label={showConfirm ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>


              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-[var(--ts-error)]/40 bg-[var(--ts-error-container)]/30 p-3 text-xs text-[#ffb4ab]">
                  <AlertCircle size={15} className="shrink-0 text-[var(--ts-error)]" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2 border-t border-[var(--ts-outline-variant)]/60">
              <button
                type="button"
                className="btn gap-2"
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={16} />
                <span>ย้อนกลับ</span>
              </button>
              <button
                type="submit"
                className="btn btn-primary gap-2"
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>กำลังสร้าง...</span>
                  </>
                ) : (
                  <>
                    <span>สร้างบัญชีและไปต่อ</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </motion.form>
        )}

        {step === 3 && (
          <motion.div
            key="step-3"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-lg font-bold text-[var(--ts-on-surface)] flex items-center gap-2">
                <Server size={20} className="text-[var(--ts-primary)]" />
                <span>ขั้นที่ 3 — ติดตั้ง Bedrock Server</span>
              </h2>
              <p className="mt-1 text-xs text-[var(--ts-on-surface-variant)]">
                ดาวน์โหลดและติดตั้งตัวเซิร์ฟเวอร์ทางการลงโฟลเดอร์ <code className="font-mono text-[11px] text-[var(--ts-primary)]">server_data/</code> (สามารถข้ามไปติดตั้งทีหลังบนหน้าภาพรวมได้)
              </p>
            </div>

            <InstallPanel />

            <div className="flex justify-between pt-2 border-t border-[var(--ts-outline-variant)]/60">
              <button
                type="button"
                className="btn gap-2"
                onClick={() => setStep(2)}
              >
                <ArrowLeft size={16} />
                <span>ย้อนกลับ</span>
              </button>
              <button
                type="button"
                className="btn btn-primary gap-2"
                onClick={() => setStep(4)}
              >
                <span>ถัดไป</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="space-y-6 py-6 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--ts-tertiary-container)]/40 text-[var(--ts-tertiary)] shadow-lg ring-1 ring-[var(--ts-tertiary)]/50">
              <PartyPopper size={32} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-[var(--ts-on-surface)]">
                ตั้งค่าเสร็จเรียบร้อยแล้ว!
              </h2>
              <p className="mx-auto max-w-md text-xs text-[var(--ts-on-surface-variant)] leading-relaxed">
                ระบบพร้อมทำงานแล้ว คุณสามารถเริ่มเซิร์ฟเวอร์ ดูคอนโซลสด จัดการแอดออน และแก้ไขการตั้งค่าทั้งหมดได้จากแดชบอร์ด
              </p>
            </div>

            <div className="pt-4">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="btn btn-primary gap-2 shadow-lg px-8 text-sm"
                onClick={() => {
                  window.location.href = '/'
                }}
              >
                <span>เข้าสู่แดชบอร์ด</span>
                <ArrowRight size={16} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
