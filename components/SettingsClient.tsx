'use client'

import { useEffect, useMemo, useState } from 'react'
import { PROPERTY_FIELDS, PROPERTY_GROUP_ORDER, type PropertyFieldMeta } from '@/lib/bedrock/propertiesMeta'

interface PropertiesResponse {
  installed: boolean
  values: Record<string, string>
  worldName: string | null
  running?: boolean
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
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
          className="h-4 w-4 accent-emerald-500"
        />
        <span className={checked ? 'text-emerald-300' : 'text-slate-400'}>{checked ? 'เปิด' : 'ปิด'}</span>
      </label>
    )
  }
  if (field.type === 'select') {
    return (
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {/* ค่าเดิมที่ไม่อยู่ในตัวเลือก — แสดงความครบถ้วน */}
        {!field.options?.some((o) => o.value === value) && <option value={value}>{value}</option>}
      </select>
    )
  }
  return (
    <input
      className="input"
      type={field.type === 'number' ? 'number' : 'text'}
      value={value}
      min={field.min}
      max={field.max}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export default function SettingsClient() {
  const [data, setData] = useState<PropertiesResponse | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null)
  const [restarting, setRestarting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordMessage, setPasswordMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/settings/properties', { cache: 'no-store' })
      const body = (await res.json()) as PropertiesResponse
      setData(body)
      if (body.values) setValues(body.values)
    } catch {
      setMessage({ kind: 'error', text: 'โหลดการตั้งค่าไม่สำเร็จ' })
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setMessage({ kind: 'error', text: body.error ?? 'บันทึกไม่สำเร็จ' })
        return
      }
      setMessage(
        body.needsRestart
          ? { kind: 'warn', text: 'บันทึกแล้ว — เซิร์ฟเวอร์กำลังทำงาน ต้องรีสตาร์ทจึงจะมีผล' }
          : { kind: 'ok', text: 'บันทึกการตั้งค่าเรียบร้อย' }
      )
    } catch {
      setMessage({ kind: 'error', text: 'เชื่อมต่อไม่ได้' })
    } finally {
      setSaving(false)
    }
  }

  const restart = async () => {
    setRestarting(true)
    try {
      await fetch('/api/bedrock/restart', { method: 'POST' })
      setMessage({ kind: 'ok', text: 'กำลังรีสตาร์ทเซิร์ฟเวอร์ — ดูสถานะได้ที่หน้าภาพรวม/คอนโซล' })
    } catch {
      setMessage({ kind: 'error', text: 'รีสตาร์ทไม่สำเร็จ' })
    } finally {
      setRestarting(false)
    }
  }

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordMessage(null)
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordMessage({ kind: 'error', text: 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน' })
      return
    }
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.next }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setPasswordMessage({ kind: 'error', text: body.error ?? 'เปลี่ยนรหัสผ่านไม่สำเร็จ' })
        return
      }
      setPasswordMessage({ kind: 'ok', text: 'เปลี่ยนรหัสผ่านสำเร็จ' })
      setPasswordForm({ current: '', next: '', confirm: '' })
    } catch {
      setPasswordMessage({ kind: 'error', text: 'เชื่อมต่อไม่ได้' })
    }
  }

  if (data && !data.installed) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">ตั้งค่าเซิร์ฟเวอร์</h1>
        <div className="card p-8 text-center text-sm text-slate-400">
          ยังไม่ได้ติดตั้ง Bedrock Server — ไปหน้าภาพรวมเพื่อติดตั้งก่อน แล้วจึงตั้งค่าได้
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">ตั้งค่าเซิร์ฟเวอร์</h1>
        <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
          {saving ? 'กำลังบันทึก...' : '💾 บันทึกการตั้งค่า'}
        </button>
      </div>

      {message && (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
            message.kind === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : message.kind === 'warn'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-red-500/40 bg-red-500/10 text-red-300'
          }`}
        >
          <span className="min-w-0 flex-1">{message.text}</span>
          {message.kind === 'warn' && (
            <button className="btn btn-sm" onClick={() => void restart()} disabled={restarting}>
              {restarting ? 'กำลังรีสตาร์ท...' : '↻ รีสตาร์ทเดี๋ยวนี้'}
            </button>
          )}
        </div>
      )}

      {!data ? (
        <div className="py-20 text-center text-sm text-slate-500">กำลังโหลด...</div>
      ) : (
        <>
          {PROPERTY_GROUP_ORDER.map((group) => {
            const fields = PROPERTY_FIELDS.filter((f) => f.group === group)
            if (fields.length === 0) return null
            return (
              <section key={group} className="card p-5">
                <h2 className="mb-4 text-base font-semibold">{group}</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div key={field.key}>
                      <label className="label">
                        {field.label} <span className="font-mono text-[10px] text-slate-600">{field.key}</span>
                      </label>
                      <FieldInput
                        field={field}
                        value={values[field.key] ?? ''}
                        onChange={(value) => setValues((prev) => ({ ...prev, [field.key]: value }))}
                      />
                      {field.hint && <p className="mt-1 text-xs text-slate-500">{field.hint}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )
          })}

          {advancedKeys.length > 0 && (
            <details className="card p-5">
              <summary className="cursor-pointer text-base font-semibold">
                คีย์ขั้นสูงอื่น ๆ ({advancedKeys.length}) — แก้ไขแบบดิบ ๆ
              </summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {advancedKeys.map((key) => (
                  <div key={key}>
                    <label className="label font-mono text-[10px]">{key}</label>
                    <input
                      className="input"
                      value={values[key] ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">บัญชีแอดมิน</h2>
          <button className="btn btn-sm" onClick={() => setShowPassword((v) => !v)}>
            {showPassword ? 'ย่อ' : 'เปลี่ยนรหัสผ่าน'}
          </button>
        </div>
        {showPassword && (
          <form className="mt-4 grid max-w-md gap-3" onSubmit={changePassword}>
            <div>
              <label className="label" htmlFor="pw-current">
                รหัสผ่านปัจจุบัน
              </label>
              <input
                id="pw-current"
                className="input"
                type="password"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="pw-next">
                รหัสผ่านใหม่ (8 ตัวอักษรขึ้นไป)
              </label>
              <input
                id="pw-next"
                className="input"
                type="password"
                value={passwordForm.next}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, next: e.target.value }))}
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="label" htmlFor="pw-confirm">
                ยืนยันรหัสผ่านใหม่
              </label>
              <input
                id="pw-confirm"
                className="input"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
                required
                minLength={8}
              />
            </div>
            {passwordMessage && (
              <p
                className={`rounded-lg border px-3 py-2 text-sm ${
                  passwordMessage.kind === 'ok'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/40 bg-red-500/10 text-red-300'
                }`}
              >
                {passwordMessage.text}
              </p>
            )}
            <button type="submit" className="btn btn-primary w-fit">
              เปลี่ยนรหัสผ่าน
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
