'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  Save,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sliders,
  Gamepad2,
  Globe,
  Wifi,
  Terminal,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Download,
  Info,
  X,
  Shield,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  PROPERTY_FIELDS,
  PROPERTY_GROUP_ORDER,
  type PropertyFieldMeta,
} from '@/lib/bedrock/propertiesMeta'
import InstallPanel from './InstallPanel'
import WhitelistManager from './WhitelistManager'
import JoinServerCard from './JoinServerCard'
import { dialog } from '@/components/dialog'

interface PropertiesResponse {
  installed: boolean
  values: Record<string, string>
  worldName: string | null
  running?: boolean
}

const GROUP_ICON_MAP: Record<string, React.ReactNode> = {
  ทั่วไป: <Sliders size={18} className="text-[var(--ts-primary)]" />,
  เครือข่าย: <Wifi size={18} className="text-sky-400" />,
  เกม: <Gamepad2 size={18} className="text-purple-400" />,
  โลก: <Globe size={18} className="text-emerald-400" />,
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: PropertyFieldMeta
  value: string
  onChange: (value: string) => void
}) {
  if (field.type === 'boolean') {
    const checked = value === 'true'
    return (
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(checked ? 'false' : 'true')}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            checked ? 'bg-[var(--ts-primary)]' : 'bg-[var(--ts-surface-high)]'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <span
          className={`text-xs font-semibold ${
            checked ? 'text-[var(--ts-primary)]' : 'text-[var(--ts-on-surface-variant)]'
          }`}
        >
          {checked ? 'เปิดใช้งาน (True)' : 'ปิดใช้งาน (False)'}
        </span>
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <select className="input text-xs py-2" value={value} onChange={(e) => onChange(e.target.value)}>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {!field.options?.some((o) => o.value === value) && <option value={value}>{value}</option>}
      </select>
    )
  }

  return (
    <input
      className="input text-xs py-2"
      type={field.type === 'number' ? 'number' : 'text'}
      value={value}
      min={field.min}
      max={field.max}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`ระบุค่า ${field.label}`}
    />
  )
}

export default function SettingsClient({ role = 'admin' }: { role?: string }) {
  const [data, setData] = useState<PropertiesResponse | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null)
  const [restarting, setRestarting] = useState(false)

  // Password state
  const [showPassword, setShowPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNextPw, setShowNextPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  // Install / Reinstall state
  const [showInstallPanel, setShowInstallPanel] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const load = async () => {
    try {
      const res = await fetch('/api/settings/properties', { cache: 'no-store' })
      const body = (await res.json()) as PropertiesResponse
      setData(body)
      if (body.values) setValues(body.values)
    } catch {
      setMessage({ kind: 'error', text: 'โหลดการตั้งค่าไม่สำเร็จ — กรุณาตรวจสอบการเชื่อมต่อเซิร์ฟเวอร์' })
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const knownKeys = useMemo(() => new Set(PROPERTY_FIELDS.map((f) => f.key)), [])
  const advancedKeys = useMemo(
    () => Object.keys(values).filter((key) => !knownKeys.has(key)).sort(),
    [values, knownKeys]
  )

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/properties', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updates: values }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; needsRestart?: boolean }
      if (!res.ok) {
        setMessage({ kind: 'error', text: body.error ?? 'บันทึกการตั้งค่าไม่สำเร็จ' })
        dialog.toast({ message: body.error ?? 'บันทึกการตั้งค่าไม่สำเร็จ', type: 'error' })
        return
      }
      const msg = body.needsRestart
        ? 'บันทึกการตั้งค่าแล้ว — เซิร์ฟเวอร์กำลังทำงาน ต้องรีสตาร์ทจึงจะมีผล'
        : 'บันทึกการตั้งค่าเซิร์ฟเวอร์เรียบร้อยแล้ว'
      setMessage({ kind: body.needsRestart ? 'warn' : 'ok', text: msg })
      dialog.toast({ message: msg, type: body.needsRestart ? 'warning' : 'success' })
    } catch {
      setMessage({ kind: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์' })
      dialog.toast({ message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const restart = async () => {
    const ok = await dialog.confirm({
      title: 'ยืนยันการรีสตาร์ทเซิร์ฟเวอร์',
      message:
        'ผู้เล่นทุกคนในเซิร์ฟเวอร์จะถูกตัดการเชื่อมต่อชั่วคราวขณะเซิร์ฟเวอร์เริ่มต้นใหม่ คุณต้องการดำเนินการต่อหรือไม่?',
      type: 'warning',
      confirmText: 'รีสตาร์ทเซิร์ฟเวอร์',
      cancelText: 'ยกเลิก',
      isDanger: true,
    })
    if (!ok) return

    setRestarting(true)
    try {
      await fetch('/api/bedrock/restart', { method: 'POST' })
      setMessage({
        kind: 'ok',
        text: 'กำลังรีสตาร์ทเซิร์ฟเวอร์ — ติดตามสถานะได้ที่หน้าภาพรวมหรือคอนโซล',
      })
      dialog.toast({ message: 'กำลังรีสตาร์ทเซิร์ฟเวอร์...', type: 'info' })
    } catch {
      setMessage({ kind: 'error', text: 'รีสตาร์ทไม่สำเร็จ — ตรวจสอบสถานะในหน้าคอนโซล' })
      dialog.toast({ message: 'รีสตาร์ทไม่สำเร็จ', type: 'error' })
    } finally {
      setRestarting(false)
    }
  }

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordMessage(null)
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordMessage({ kind: 'error', text: 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน' })
      dialog.toast({ message: 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน', type: 'error' })
      return
    }
    setPasswordLoading(true)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.next,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setPasswordMessage({ kind: 'error', text: body.error ?? 'เปลี่ยนรหัสผ่านไม่สำเร็จ' })
        dialog.toast({ message: body.error ?? 'เปลี่ยนรหัสผ่านไม่สำเร็จ', type: 'error' })
        return
      }
      setPasswordMessage({ kind: 'ok', text: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว' })
      dialog.toast({ message: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว', type: 'success' })
      setPasswordForm({ current: '', next: '', confirm: '' })
      setShowPassword(false)
    } catch {
      setPasswordMessage({ kind: 'error', text: 'เชื่อมต่อไม่ได้' })
      dialog.toast({ message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', type: 'error' })
    } finally {
      setPasswordLoading(false)
    }
  }

  // ── Render: Not Installed ──────────────────────────────────────────────────
  if (data && !data.installed) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ts-on-surface)] flex items-center gap-2.5">
              <Settings size={24} className="text-[var(--ts-primary)]" />
              <span>ตั้งค่าเซิร์ฟเวอร์</span>
            </h1>
            <p className="text-xs text-[var(--ts-on-surface-variant)] mt-0.5">
              จัดการ server.properties พอร์ต ระดับความยาก โหมดเกม และบัญชีผู้ดูแลระบบ
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center space-y-4 shadow-xl backdrop-blur-md"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 ring-8 ring-amber-500/10 shadow-lg">
            <AlertTriangle size={32} />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-bold text-[var(--ts-on-surface)]">
              ยังไม่ได้ติดตั้ง Bedrock Dedicated Server
            </h3>
            <p className="text-xs text-[var(--ts-on-surface-variant)] leading-relaxed">
              ไฟล์คอนฟิก server.properties จะพร้อมให้ตั้งค่าหลังจากการติดตั้งเซิร์ฟเวอร์เสร็จสิ้น คุณสามารถเริ่มติดตั้งได้ทันทีด้านล่างนี้
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInstallPanel(true)}
            className="btn btn-primary inline-flex items-center gap-2 text-xs py-2.5 px-5 shadow-lg"
          >
            <Download size={16} />
            <span>เปิดหน้าต่างติดตั้งเซิร์ฟเวอร์เดี๋ยวนี้</span>
          </button>
        </motion.div>

        {showInstallPanel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6"
          >
            <InstallPanel onInstalled={() => void load()} />
          </motion.div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ts-on-surface)] flex items-center gap-2.5">
            <Settings size={24} className="text-[var(--ts-primary)]" />
            <span>ตั้งค่าเซิร์ฟเวอร์</span>
          </h1>
          <p className="text-xs text-[var(--ts-on-surface-variant)] mt-0.5">
            ปรับแต่ง server.properties พอร์ต จำนวนผู้เล่น โหมดเกม และการตั้งค่าขั้นสูง
          </p>
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !data}
          className="btn btn-primary inline-flex items-center gap-2 text-xs font-semibold py-2.5 px-4 shadow-lg shadow-[var(--ts-primary)]/15 transition-all"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin text-[var(--ts-on-primary)]" />
          ) : (
            <Save size={16} />
          )}
          <span>{saving ? 'กำลังบันทึกการตั้งค่า...' : 'บันทึกการตั้งค่า'}</span>
        </button>
      </div>

      {/* ── Top Status Alerts ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-xs sm:text-sm backdrop-blur-md shadow-lg ${
              message.kind === 'ok'
                ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-200 shadow-emerald-950/20'
                : message.kind === 'warn'
                  ? 'border-amber-500/40 bg-amber-950/60 text-amber-200 shadow-amber-950/20'
                  : 'border-rose-500/40 bg-rose-950/60 text-rose-200 shadow-rose-950/20'
            }`}
          >
            <div className="flex items-center gap-3">
              {message.kind === 'ok' && <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />}
              {message.kind === 'warn' && <AlertTriangle size={18} className="text-amber-400 shrink-0" />}
              {message.kind === 'error' && <AlertCircle size={18} className="text-rose-400 shrink-0" />}
              <span className="font-medium leading-relaxed">{message.text}</span>
            </div>

            <div className="flex items-center gap-2">
              {message.kind === 'warn' && (
                <button
                  type="button"
                  onClick={() => void restart()}
                  disabled={restarting}
                  className="btn btn-sm inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/20 text-xs font-semibold text-amber-200 hover:bg-amber-500/30"
                >
                  <RefreshCw size={13} className={restarting ? 'animate-spin' : ''} />
                  <span>{restarting ? 'กำลังรีสตาร์ท...' : 'รีสตาร์ทเดี๋ยวนี้'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setMessage(null)}
                className="p-1 opacity-70 hover:opacity-100 transition-opacity rounded-lg hover:bg-white/10"
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Server Connection & Domain Card ─────────────────────────────────── */}
      <JoinServerCard role={role} />

      {/* ── Main Settings Groups / Skeleton ──────────────────────────────────── */}
      {!data ? (
        <div className="space-y-5 animate-pulse">
          <div className="rounded-3xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-lg bg-[var(--ts-surface-high)]" />
              <div className="h-5 w-32 rounded-lg bg-[var(--ts-surface-high)]" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-14 rounded-2xl bg-[var(--ts-surface-low)]" />
              <div className="h-14 rounded-2xl bg-[var(--ts-surface-low)]" />
            </div>
          </div>
          <div className="rounded-3xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-lg bg-[var(--ts-surface-high)]" />
              <div className="h-5 w-32 rounded-lg bg-[var(--ts-surface-high)]" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-14 rounded-2xl bg-[var(--ts-surface-low)]" />
              <div className="h-14 rounded-2xl bg-[var(--ts-surface-low)]" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {PROPERTY_GROUP_ORDER.map((group) => {
            const fields = PROPERTY_FIELDS.filter((f) => f.group === group)
            if (fields.length === 0) return null

            return (
              <section
                key={group}
                className="card p-6 rounded-3xl space-y-5 shadow-lg border border-[var(--ts-outline-variant)]"
              >
                <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--ts-outline-variant)]/60">
                  {GROUP_ICON_MAP[group] ?? <Sliders size={18} className="text-[var(--ts-primary)]" />}
                  <h2 className="text-base font-bold text-[var(--ts-on-surface)]">
                    หมวดหมู่{group}
                  </h2>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div
                      key={field.key}
                      className="space-y-1.5 rounded-2xl border border-[var(--ts-outline-variant)]/50 bg-[var(--ts-surface-low)]/50 p-3.5 transition-all hover:border-[var(--ts-outline-variant)] hover:bg-[var(--ts-surface-low)]"
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-[var(--ts-on-surface)]">
                          {field.label}
                        </label>
                        <span className="font-mono text-[10px] text-[var(--ts-on-surface-variant)] px-1.5 py-0.5 rounded bg-[var(--ts-surface-high)]">
                          {field.key}
                        </span>
                      </div>

                      <FieldInput
                        field={field}
                        value={values[field.key] ?? ''}
                        onChange={(value) =>
                          setValues((prev) => ({ ...prev, [field.key]: value }))
                        }
                      />

                      {field.hint && (
                        <p className="flex items-center gap-1.5 text-[11px] text-[var(--ts-on-surface-variant)] pt-0.5">
                          <Info size={12} className="shrink-0 text-[var(--ts-primary)]/70" />
                          <span>{field.hint}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Whitelist Manager: แสดงเมื่อเปิดใช้งาน Whitelist (white-list = true) */}
                {group === 'เครือข่าย' && values['white-list'] === 'true' && (
                  <div className="pt-2">
                    <WhitelistManager serverRunning={data?.running} />
                  </div>
                )}
              </section>
            )
          })}

          {/* ── Advanced Raw Keys ────────────────────────────────────────────── */}
          {advancedKeys.length > 0 && (
            <section className="card p-6 rounded-3xl shadow-lg border border-[var(--ts-outline-variant)]">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-2.5">
                  <Terminal size={18} className="text-amber-400" />
                  <div>
                    <h2 className="text-base font-bold text-[var(--ts-on-surface)]">
                      คีย์การตั้งค่าขั้นสูงอื่น ๆ ({advancedKeys.length})
                    </h2>
                    <p className="text-xs text-[var(--ts-on-surface-variant)] mt-0.5">
                      คีย์ที่ไม่มีในกลุ่มมาตรฐาน สามารถแก้ไขค่าดิบได้โดยตรง
                    </p>
                  </div>
                </div>
                <div className="p-1 rounded-xl bg-[var(--ts-surface-high)] text-[var(--ts-on-surface)]">
                  {advancedOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              <AnimatePresence>
                {advancedOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-5 pt-4 border-t border-[var(--ts-outline-variant)]/60 grid gap-3 sm:grid-cols-2 overflow-hidden"
                  >
                    {advancedKeys.map((key) => (
                      <div
                        key={key}
                        className="rounded-2xl border border-[var(--ts-outline-variant)]/50 bg-[var(--ts-surface-low)]/50 p-3 space-y-1"
                      >
                        <label className="font-mono text-[11px] font-semibold text-[var(--ts-primary)]">
                          {key}
                        </label>
                        <input
                          className="input text-xs py-1.5"
                          value={values[key] ?? ''}
                          onChange={(e) =>
                            setValues((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          placeholder={`ระบุค่า ${key}`}
                        />
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}
        </>
      )}

      {/* ── Admin Account Security Section ───────────────────────────────────── */}
      <section className="card p-6 rounded-3xl space-y-4 shadow-lg border border-[var(--ts-outline-variant)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <KeyRound size={20} className="text-rose-400" />
            <div>
              <h2 className="text-base font-bold text-[var(--ts-on-surface)]">
                ความปลอดภัยบัญชีแอดมิน (Admin Security)
              </h2>
              <p className="text-xs text-[var(--ts-on-surface-variant)] mt-0.5">
                เปลี่ยนรหัสผ่านเพื่อเข้าใช้งานแดชบอร์ดจัดการเซิร์ฟเวอร์
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm inline-flex items-center gap-1.5 text-xs py-2 px-3.5 rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] text-[var(--ts-on-surface)] hover:bg-[var(--ts-surface-high)]"
            onClick={() => setShowPassword((v) => !v)}
          >
            <Lock size={14} className="text-rose-400" />
            <span>{showPassword ? 'ย่อแบบฟอร์ม' : 'เปลี่ยนรหัสผ่าน'}</span>
          </button>
        </div>

        <AnimatePresence>
          {showPassword && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-[var(--ts-outline-variant)]/60 grid max-w-lg gap-4 overflow-hidden"
              onSubmit={changePassword}
            >
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--ts-on-surface)]" htmlFor="pw-current">
                  รหัสผ่านปัจจุบัน
                </label>
                <div className="relative">
                  <input
                    id="pw-current"
                    className="input w-full text-xs py-2.5 pr-10"
                    type={showCurrentPw ? 'text' : 'password'}
                    value={passwordForm.current}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, current: e.target.value }))
                    }
                    placeholder="กรอกรหัสผ่านปัจจุบันของคุณ"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)]"
                  >
                    {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--ts-on-surface)]" htmlFor="pw-next">
                  รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)
                </label>
                <div className="relative">
                  <input
                    id="pw-next"
                    className="input w-full text-xs py-2.5 pr-10"
                    type={showNextPw ? 'text' : 'password'}
                    value={passwordForm.next}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, next: e.target.value }))}
                    placeholder="ระบุรหัสผ่านใหม่ที่ต้องการ"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNextPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)]"
                  >
                    {showNextPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--ts-on-surface)]" htmlFor="pw-confirm">
                  ยืนยันรหัสผ่านใหม่
                </label>
                <div className="relative">
                  <input
                    id="pw-confirm"
                    className="input w-full text-xs py-2.5 pr-10"
                    type={showConfirmPw ? 'text' : 'password'}
                    value={passwordForm.confirm}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))
                    }
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้งเพื่อยืนยัน"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)]"
                  >
                    {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Form Message */}
              {passwordMessage && (
                <div
                  className={`flex items-center gap-2.5 rounded-xl border p-3 text-xs ${
                    passwordMessage.kind === 'ok'
                      ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                      : 'border-rose-500/40 bg-rose-950/40 text-rose-200'
                  }`}
                >
                  {passwordMessage.kind === 'ok' ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-400 shrink-0" />
                  )}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="btn btn-primary inline-flex items-center gap-2 text-xs py-2.5 px-4 shadow-lg"
                >
                  {passwordLoading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Shield size={15} />
                  )}
                  <span>{passwordLoading ? 'กำลังบันทึกรหัสผ่าน...' : 'บันทึกรหัสผ่านใหม่'}</span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </section>

      {/* ── Server Installation & Reinstall Section ───────────────────────────── */}
      <section className="card p-6 rounded-3xl space-y-4 shadow-lg border border-[var(--ts-outline-variant)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Download size={20} className="text-[var(--ts-primary)]" />
            <div>
              <h2 className="text-base font-bold text-[var(--ts-on-surface)]">
                การติดตั้งและอัปเดตเซิร์ฟเวอร์ (Server Installation & Reinstall)
              </h2>
              <p className="text-xs text-[var(--ts-on-surface-variant)] mt-0.5">
                อัปเดตเวอร์ชันใหม่ ซ่อมแซมระบบ หรือติดตั้งใหม่ทั้งหมด (Fresh Clean Reinstall)
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm inline-flex items-center gap-1.5 text-xs py-2 px-3.5 rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] text-[var(--ts-on-surface)] hover:bg-[var(--ts-surface-high)]"
            onClick={() => setShowInstallPanel((v) => !v)}
          >
            <Download size={14} className="text-[var(--ts-primary)]" />
            <span>{showInstallPanel ? 'ย่อหน้าต่าง' : 'เปิดการติดตั้ง / Reinstall'}</span>
          </button>
        </div>

        <AnimatePresence>
          {showInstallPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-[var(--ts-outline-variant)]/60 overflow-hidden"
            >
              <InstallPanel onInstalled={() => void load()} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  )
}
