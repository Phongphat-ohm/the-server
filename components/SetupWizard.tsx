'use client'

import { useEffect, useState } from 'react'
import SpecSummary from './SpecSummary'
import InstallPanel from './InstallPanel'
import type { SystemSpecs } from '@/lib/system/specs'

const STEPS = ['ตรวจสอบระบบ', 'สร้างแอดมิน', 'ติดตั้งเซิร์ฟเวอร์', 'เสร็จสิ้น']

export default function SetupWizard() {
  const [step, setStep] = useState(1)
  const [specs, setSpecs] = useState<SystemSpecs | null>(null)
  const [specsError, setSpecsError] = useState<string | null>(null)
  const [form, setForm] = useState({ username: '', password: '', confirm: '' })
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (step !== 1 || specs) return
    fetch('/api/system/specs', { cache: 'no-store' })
      .then((r) => r.json())
      .then((body: SystemSpecs & { error?: string }) => {
        if (body.error) setSpecsError(body.error)
        else setSpecs(body)
      })
      .catch(() => setSpecsError('ตรวจสอบระบบไม่สำเร็จ — กดปุ่มรีเฟรชเพื่อลองใหม่'))
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
      {/* ตัวบอกขั้นตอน */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, index) => {
          const number = index + 1
          const state = number < step ? 'done' : number === step ? 'current' : 'todo'
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  state === 'done'
                    ? 'bg-emerald-500 text-white'
                    : state === 'current'
                      ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/50'
                      : 'bg-[#141c2b] text-slate-500'
                }`}
              >
                {state === 'done' ? '✓' : number}
              </span>
              <span className={`hidden text-xs sm:block ${state === 'todo' ? 'text-slate-600' : 'text-slate-300'}`}>
                {label}
              </span>
              {number < STEPS.length && <span className="h-px flex-1 bg-[#1f2a3d]" />}
            </li>
          )
        })}
      </ol>

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">ขั้นที่ 1 — ตรวจสอบความพร้อมของเครื่อง</h2>
            <p className="mt-1 text-sm text-slate-400">
              ตรวจสเปก CPU / RAM / พื้นที่ดิสก์ และประเมินว่าเครื่องนี้เหมาะกับผู้เล่นกี่คน
            </p>
          </div>
          {specsError && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              {specsError}
            </p>
          )}
          {specs ? (
            <SpecSummary specs={specs} />
          ) : (
            <div className="py-16 text-center text-sm text-slate-500">
              กำลังตรวจสอบฮาร์ดแวร์...
            </div>
          )}
          <div className="flex justify-end">
            <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!specs}>
              ถัดไป →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <form className="space-y-6" onSubmit={createAdmin}>
          <div>
            <h2 className="text-lg font-semibold">ขั้นที่ 2 — สร้างบัญชีแอดมิน</h2>
            <p className="mt-1 text-sm text-slate-400">
              บัญชีนี้ใช้เข้าสู่ระบบ Dashboard (สร้างได้ครั้งเดียวช่วงตั้งค่าแรก สร้างเสร็จจะล็อกอินให้อัตโนมัติ)
            </p>
          </div>
          <div className="grid max-w-md gap-4">
            <div>
              <label className="label" htmlFor="setup-username">
                ชื่อผู้ใช้ (a-z A-Z 0-9 _ . - ยาว 3-32)
              </label>
              <input
                id="setup-username"
                className="input"
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="label" htmlFor="setup-password">
                รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)
              </label>
              <input
                id="setup-password"
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="label" htmlFor="setup-confirm">
                ยืนยันรหัสผ่าน
              </label>
              <input
                id="setup-confirm"
                className="input"
                type="password"
                value={form.confirm}
                onChange={(e) => setForm((prev) => ({ ...prev, confirm: e.target.value }))}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {formError && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {formError}
              </p>
            )}
          </div>
          <div className="flex justify-between">
            <button type="button" className="btn" onClick={() => setStep(1)}>
              ← ย้อนกลับ
            </button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'กำลังสร้าง...' : 'สร้างบัญชีและไปต่อ →'}
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">ขั้นที่ 3 — ติดตั้ง Bedrock Server</h2>
            <p className="mt-1 text-sm text-slate-400">
              ดาวน์โหลดไฟล์ทางการจาก Mojang แล้วติดตั้งลงโฟลเดอร์ <code className="font-mono text-xs">server_data/</code>{' '}
              ของเครื่องนี้ ({'แยกเวอร์ชัน Windows/Linux ให้อัตโนมัติ'}) — จะข้ามขั้นตอนนี้ไปติดตั้งทีหลังก็ได้
            </p>
          </div>
          <InstallPanel />
          <div className="flex justify-between">
            <button className="btn" onClick={() => setStep(2)}>
              ← ย้อนกลับ
            </button>
            <button className="btn btn-primary" onClick={() => setStep(4)}>
              ถัดไป →
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 text-center">
          <div className="text-5xl">🎉</div>
          <div>
            <h2 className="text-lg font-semibold">ตั้งค่าเสร็จเรียบร้อย!</h2>
            <p className="mt-1 text-sm text-slate-400">
              บัญชีแอดมินพร้อมใช้งานแล้ว กดปุ่มด้านล่างเพื่อเข้าสู่แดชบอร์ด จากที่นั่นคุณสามารถเริ่ม/หยุดเซิร์ฟเวอร์
              ดูคอนโซลสด แก้ไข server.properties และติดตั้ง addons ได้ทั้งหมด
            </p>
          </div>
          <button
            className="btn btn-primary mx-auto"
            onClick={() => {
              window.location.href = '/'
            }}
          >
            เข้าสู่แดชบอร์ด →
          </button>
        </div>
      )}
    </div>
  )
}
