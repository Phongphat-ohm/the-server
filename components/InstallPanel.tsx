'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { InstallJob } from '@/lib/types'

const PHASE_LABEL: Record<string, string> = {
  resolving: 'กำลังตรวจสอบเวอร์ชัน',
  downloading: 'กำลังดาวน์โหลด',
  extracting: 'กำลังแตกไฟล์',
  merging: 'กำลังติดตั้งไฟล์ (คงค่าเดิมไว้)',
  finalizing: 'กำลังตั้งค่าสิทธิ์',
  done: 'ติดตั้งเสร็จสิ้น',
  error: 'ล้มเหลว',
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export default function InstallPanel({ onInstalled }: { onInstalled?: () => void }) {
  const [mode, setMode] = useState<'latest' | 'custom'>('latest')
  const [custom, setCustom] = useState('')
  const [latest, setLatest] = useState<string | null>(null)
  const [versions, setVersions] = useState<string[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [job, setJob] = useState<InstallJob | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const notifiedRef = useRef(false)

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/bedrock/install', { cache: 'no-store' })
      const body = (await res.json()) as { job?: InstallJob | null }
      if (body.job) setJob(body.job)
    } catch {
      // รอรอบถัดไป
    }
  }, [])

  useEffect(() => {
    fetch('/api/bedrock/versions', { cache: 'no-store' })
      .then((r) => r.json())
      .then(
        (body: { latest?: string | null; versions?: Array<{ version: string }>; error?: string }) => {
          if (body.error) {
            setListError(body.error)
            return
          }
          setLatest(body.latest ?? null)
          setVersions((body.versions ?? []).map((v) => v.version))
        }
      )
      .catch(() => setListError('โหลดรายการเวอร์ชันไม่สำเร็จ (อาจออฟไลน์) — พิมพ์เลขเวอร์ชันเองได้'))
    void poll()
  }, [poll])

  const jobActive = job !== null && job.phase !== 'done' && job.phase !== 'error'

  useEffect(() => {
    if (!jobActive) return
    const timer = setInterval(() => void poll(), 1000)
    return () => clearInterval(timer)
  }, [jobActive, poll])

  useEffect(() => {
    if (job?.phase === 'done' && !notifiedRef.current) {
      notifiedRef.current = true
      onInstalled?.()
    }
  }, [job, onInstalled])

  const start = async () => {
    setBusy(true)
    setError(null)
    notifiedRef.current = false
    try {
      const version = mode === 'latest' ? 'latest' : custom.trim()
      if (mode === 'custom' && !version) {
        setError('กรุณาระบุเลขเวอร์ชัน เช่น 1.21.93.01')
        return
      }
      const res = await fetch('/api/bedrock/install', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version }),
      })
      const body = (await res.json().catch(() => ({}))) as { job?: InstallJob; error?: string }
      if (!res.ok) {
        setError(body.error ?? 'เริ่มติดตั้งไม่สำเร็จ')
        return
      }
      if (body.job) setJob(body.job)
      void poll()
    } catch {
      setError('เชื่อมต่อไม่ได้')
    } finally {
      setBusy(false)
    }
  }

  const percent =
    job && job.phase === 'downloading' && job.totalBytes && job.totalBytes > 0
      ? Math.min(100, Math.round((job.receivedBytes / job.totalBytes) * 100))
      : null

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="radio"
            name="install-mode"
            checked={mode === 'latest'}
            onChange={() => setMode('latest')}
            className="mt-0.5 accent-emerald-500"
          />
          <span>
            <span className="font-medium">เวอร์ชันล่าสุด (ตรวจจับอัตโนมัติ)</span>
            {latest && <span className="ml-1 text-emerald-400">{latest}</span>}
            {listError && <span className="block text-xs text-amber-400">{listError}</span>}
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="radio"
            name="install-mode"
            checked={mode === 'custom'}
            onChange={() => setMode('custom')}
            className="mt-0.5 accent-emerald-500"
          />
          <span className="min-w-0 flex-1">
            <span className="font-medium">ระบุเวอร์ชันเอง</span>
            <input
              className="input mt-1.5"
              placeholder="เช่น 1.21.93.01"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              list="bedrock-versions"
              disabled={mode !== 'custom'}
            />
            <datalist id="bedrock-versions">
              {versions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </span>
        </label>
      </div>

      <button type="button" className="btn btn-primary w-full" onClick={() => void start()} disabled={busy || jobActive}>
        {busy ? 'กำลังเริ่ม...' : jobActive ? 'กำลังติดตั้ง...' : '⬇ เริ่มติดตั้ง / อัปเดต'}
      </button>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {job && (
        <div
          className={`rounded-xl border p-4 ${
            job.phase === 'error'
              ? 'border-red-500/40 bg-red-500/5'
              : job.phase === 'done'
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-[#1f2a3d] bg-[#0b1220]'
          }`}
        >
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">
              {PHASE_LABEL[job.phase] ?? job.phase} — เวอร์ชัน {job.version === 'latest' ? 'ล่าสุด' : job.version}
            </span>
            {percent !== null && <span className="text-slate-400">{percent}%</span>}
          </div>
          {jobActive && (
            <>
              {percent !== null ? (
                <div className="h-2.5 overflow-hidden rounded-full border border-[#26334a] bg-[#0b1220]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-700 to-emerald-400 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              ) : (
                <div className="progress-indeterminate" />
              )}
              {job.phase === 'downloading' && job.receivedBytes > 0 && (
                <p className="mt-1.5 text-xs text-slate-500">
                  {formatBytes(job.receivedBytes)}
                  {job.totalBytes ? ` / ${formatBytes(job.totalBytes)}` : ''}
                </p>
              )}
            </>
          )}
          {job.phase === 'error' && job.error && <p className="text-sm text-red-300">{job.error}</p>}
          {job.phase === 'done' && (
            <p className="text-sm text-emerald-300">พร้อมใช้งานแล้ว — ข้อมูลเดิม (server.properties, worlds) ถูกคงไว้</p>
          )}
        </div>
      )}
    </div>
  )
}
