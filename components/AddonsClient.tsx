'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AddonInfo } from '@/lib/bedrock/addonManager'

interface AddonsResponse {
  worldName: string | null
  worldExists: boolean
  addons: AddonInfo[]
}

interface UploadResult {
  file: string
  error?: string
  packs?: Array<{ name: string; type: string; version: number[] }>
  warnings?: string[]
}

export default function AddonsClient() {
  const [data, setData] = useState<AddonsResponse | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [results, setResults] = useState<UploadResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/addons', { cache: 'no-store' })
      const body = (await res.json()) as AddonsResponse & { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'โหลดรายการไม่สำเร็จ')
        return
      }
      setData(body)
    } catch {
      setError('เชื่อมต่อไม่ได้')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return
    setUploading(true)
    setError(null)
    setResults(null)
    try {
      const form = new FormData()
      for (const file of list) form.append('files', file)
      const res = await fetch('/api/addons/upload', { method: 'POST', body: form })
      const body = (await res.json().catch(() => ({}))) as { results?: UploadResult[]; error?: string }
      if (!res.ok) {
        setError(body.error ?? 'อัปโหลดไม่สำเร็จ')
        return
      }
      setResults(body.results ?? [])
      await load()
    } catch {
      setError('อัปโหลดไม่สำเร็จ — ตรวจขนาดไฟล์และการเชื่อมต่อ')
    } finally {
      setUploading(false)
    }
  }

  const toggle = async (addon: AddonInfo) => {
    setError(null)
    try {
      const res = await fetch('/api/addons/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dirName: addon.dirName, type: addon.type, active: !addon.active }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) setError(body.error ?? 'เปลี่ยนสถานะไม่สำเร็จ')
      await load()
    } catch {
      setError('เชื่อมต่อไม่ได้')
    }
  }

  const remove = async (addon: AddonInfo) => {
    if (!window.confirm(`ลบ "${addon.name}" ออกจากเซิร์ฟเวอร์?`)) return
    setError(null)
    try {
      const res = await fetch('/api/addons/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dirName: addon.dirName, type: addon.type }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) setError(body.error ?? 'ลบไม่สำเร็จ')
      await load()
    } catch {
      setError('เชื่อมต่อไม่ได้')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">จัดการ Addons</h1>
        <p className="mt-1 text-sm text-slate-400">
          ลากวางไฟล์ <code className="rounded bg-[#0b1220] px-1.5 py-0.5 font-mono text-xs">.mcaddon</code>{' '}
          <code className="rounded bg-[#0b1220] px-1.5 py-0.5 font-mono text-xs">.mcpack</code> หรือ{' '}
          <code className="rounded bg-[#0b1220] px-1.5 py-0.5 font-mono text-xs">.zip</code> มาที่กล่องด้านล่าง
          ระบบจะแตกไฟล์ อ่าน manifest และติดตั้งให้ถูกโฟลเดอร์ (resource/behavior) พร้อมเปิดใช้กับโลกปัจจุบัน
        </p>
      </div>

      {data && !data.worldExists && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          ยังไม่พบโลก &quot;{data.worldName ?? 'Bedrock level'}&quot; — ติดตั้ง pack ได้ แต่ต้อง{' '}
          <b>เริ่มเซิร์ฟเวอร์ครั้งแรก</b> เพื่อสร้างโลกก่อน จึงจะเปิด/ปิดการใช้งาน pack ได้
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? 'border-emerald-400 bg-emerald-500/10' : 'border-[#26334a] bg-[#0b1220]/60'
        }`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          void upload(event.dataTransfer.files)
        }}
      >
        <span className="text-4xl">🧩</span>
        {uploading ? (
          <p className="text-sm font-semibold text-emerald-300">กำลังประมวลผลไฟล์...</p>
        ) : (
          <>
            <p className="text-sm font-semibold">ลากไฟล์มาวางที่นี่ หรือกดเลือกไฟล์</p>
            <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
              เลือกไฟล์ (.mcaddon / .mcpack / .zip)
            </button>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".mcaddon,.mcpack,.zip"
          onChange={(event) => {
            if (event.target.files) void upload(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {results && results.length > 0 && (
        <div className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold">ผลการติดตั้งล่าสุด</h2>
          {results.map((result, index) => (
            <div key={`${result.file}-${index}`} className="rounded-lg border border-[#1f2a3d] bg-[#0b1220] p-3 text-sm">
              <div className="font-mono text-xs text-slate-400">{result.file}</div>
              {result.error ? (
                <p className="mt-1 text-red-300">✗ {result.error}</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {(result.packs ?? []).map((pack) => (
                    <li key={pack.name} className="text-emerald-300">
                      ✓ {pack.name} ({pack.type === 'resource' ? 'Resource' : 'Behavior'} v{pack.version.join('.')})
                    </li>
                  ))}
                  {(result.warnings ?? []).map((warning, wIndex) => (
                    <li key={wIndex} className="text-amber-300">
                      ⚠ {warning}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-base font-semibold">
          Pack ที่ติดตั้งอยู่ {data ? `(${data.addons.length})` : ''}
        </h2>
        {!data ? (
          <p className="py-8 text-center text-sm text-slate-500">กำลังโหลด...</p>
        ) : data.addons.length === 0 ? (
          <p className="card py-10 text-center text-sm text-slate-500">ยังไม่มี pack ในระบบ</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.addons.map((addon) => (
              <div key={`${addon.type}:${addon.dirName}`} className="card flex items-start gap-3 p-4">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${
                    addon.type === 'resource' ? 'bg-sky-500/15' : 'bg-violet-500/15'
                  }`}
                >
                  {addon.type === 'resource' ? '🎨' : '⚙️'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold" title={addon.name}>
                      {addon.name}
                    </span>
                    <span className="text-xs text-slate-500">v{addon.version.join('.')}</span>
                    {addon.builtin && (
                      <span className="badge border-slate-500/40 bg-slate-500/10 text-slate-400">ติดตั้งมาให้</span>
                    )}
                    {addon.error && (
                      <span className="badge border-red-500/40 bg-red-500/10 text-red-300">{addon.error}</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500" title={addon.description}>
                    {addon.description || addon.uuid || addon.dirName}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={addon.active}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        addon.active ? 'bg-emerald-500' : 'bg-[#26334a]'
                      }`}
                      onClick={() => void toggle(addon)}
                      disabled={!!addon.error || (!data.worldExists && !addon.active)}
                      title={
                        !data.worldExists && !addon.active
                          ? 'ต้องเริ่มเซิร์ฟเวอร์ครั้งแรกเพื่อสร้างโลกก่อน'
                          : undefined
                      }
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                          addon.active ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                    <span className={`text-xs ${addon.active ? 'text-emerald-300' : 'text-slate-500'}`}>
                      {addon.active ? 'เปิดใช้งานกับโลกนี้' : 'ปิดใช้งาน'}
                    </span>
                    {!addon.builtin && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger ml-auto"
                        onClick={() => void remove(addon)}
                        disabled={!!addon.error}
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
