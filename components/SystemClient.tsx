'use client'

import { useCallback, useEffect, useState } from 'react'
import SpecSummary from './SpecSummary'
import type { SystemSpecs } from '@/lib/system/specs'

export default function SystemClient() {
  const [specs, setSpecs] = useState<SystemSpecs | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/system/specs', { cache: 'no-store' })
      const body = (await res.json()) as SystemSpecs & { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'ตรวจสอบไม่สำเร็จ')
        return
      }
      setSpecs(body)
    } catch {
      setError('เชื่อมต่อไม่ได้')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">ตรวจสอบระบบ (Hardware Pre-flight)</h1>
          <p className="mt-1 text-sm text-slate-400">
            ข้อมูลสเปกเครื่องและคะแนนความเหมาะสมสำหรับการรัน Bedrock Server
          </p>
        </div>
        <button className="btn" onClick={() => void load()} disabled={loading}>
          {loading ? 'กำลังตรวจสอบ...' : '↻ ตรวจสอบใหม่'}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="card p-6">
        {loading && !specs ? (
          <div className="py-20 text-center text-sm text-slate-500">กำลังรวบรวมข้อมูลฮาร์ดแวร์...</div>
        ) : specs ? (
          <SpecSummary specs={specs} />
        ) : null}
      </div>

      {specs && (
        <p className="text-center text-xs text-slate-600">
          ข้อมูลจากแพ็กเกจ systeminformation · ตรวจเมื่อ{' '}
          {new Date(specs.fetchedAt).toLocaleString('th-TH')}
        </p>
      )}
    </div>
  )
}
