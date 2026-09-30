'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import StatusBadge from './StatusBadge'
import InstallPanel from './InstallPanel'
import type { InstallJob, QuickMachineStats, StatusSnapshot } from '@/lib/types'

interface StatusResponse extends StatusSnapshot {
  machine: QuickMachineStats | null
  job: InstallJob | null
}

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h} ชม ${m} นาที`
  if (m > 0) return `${m} นาที ${s} วินาที`
  return `${s} วินาที`
}

export default function DashboardClient() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/bedrock/status', { cache: 'no-store' })
      if (res.ok) setData((await res.json()) as StatusResponse)
    } catch {
      // รอรอบถัดไป
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 3000)
    return () => clearInterval(timer)
  }, [refresh])

  const control = async (action: 'start' | 'stop' | 'restart') => {
    setBusy(action)
    setError(null)
    try {
      const res = await fetch(`/api/bedrock/${action}`, { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) setError(body.error ?? 'ทำรายการไม่สำเร็จ')
    } catch {
      setError('เชื่อมต่อไม่ได้')
    } finally {
      setBusy(null)
      void refresh()
    }
  }

  if (!data) {
    return <div className="py-20 text-center text-sm text-slate-500">กำลังโหลดข้อมูล...</div>
  }

  const isActive = data.status === 'starting' || data.status === 'running' || data.status === 'stopping'
  const canStart = data.status === 'stopped' || data.status === 'crashed'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">ภาพรวมเซิร์ฟเวอร์</h1>
        <StatusBadge status={data.status} />
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {!data.binExists ? (
        <div className="card p-6">
          <h2 className="text-lg font-semibold">ติดตั้ง Minecraft Bedrock Server</h2>
          <p className="mt-1 mb-4 text-sm text-slate-400">
            ยังไม่พบไฟล์ bedrock_server ในระบบ — เลือกเวอร์ชันแล้วกดติดตั้ง ระบบจะดาวน์โหลดจากเซิร์ฟเวอร์ทางการของ
            Mojang ให้อัตโนมัติ
          </p>
          <InstallPanel onInstalled={() => void refresh()} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card space-y-4 p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-lg font-semibold">สถานะ</h2>
              {canStart && (
                <button className="btn btn-primary" onClick={() => void control('start')} disabled={busy !== null}>
                  {busy === 'start' ? 'กำลังเริ่ม...' : '▶ เริ่มเซิร์ฟเวอร์'}
                </button>
              )}
              {isActive && (
                <>
                  <button className="btn btn-danger" onClick={() => void control('stop')} disabled={busy !== null}>
                    {busy === 'stop' ? 'กำลังหยุด...' : '■ หยุด'}
                  </button>
                  <button
                    className="btn"
                    onClick={() => void control('restart')}
                    disabled={busy !== null || data.status !== 'running'}
                  >
                    {busy === 'restart' ? 'กำลังรีสตาร์ท...' : '↻ รีสตาร์ท'}
                  </button>
                </>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#1f2a3d] bg-[#0b1220] p-3">
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">เวอร์ชัน</dt>
                <dd className="mt-0.5 truncate text-sm font-semibold">{data.version ?? '-'}</dd>
              </div>
              <div className="rounded-xl border border-[#1f2a3d] bg-[#0b1220] p-3">
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">โลก (World)</dt>
                <dd className="mt-0.5 truncate text-sm font-semibold" title={data.worldName ?? undefined}>
                  {data.worldName ?? '-'}
                </dd>
              </div>
              <div className="rounded-xl border border-[#1f2a3d] bg-[#0b1220] p-3">
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">พอร์ตเกม (UDP)</dt>
                <dd className="mt-0.5 text-sm font-semibold">{data.serverPort ?? '-'}</dd>
              </div>
              <div className="rounded-xl border border-[#1f2a3d] bg-[#0b1220] p-3">
                <dt className="text-[11px] uppercase tracking-wider text-slate-500">เวลาทำงาน</dt>
                <dd className="mt-0.5 text-sm font-semibold">
                  {data.uptimeSec !== null ? formatUptime(data.uptimeSec) : '-'}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span>PID: {data.pid ?? '-'}</span>
              <span>·</span>
              <span>จำกัดผู้เล่น: {data.maxPlayers ?? '-'}</span>
              <span>·</span>
              <Link href="/console" className="text-emerald-400 hover:underline">
                เปิดคอนโซล →
              </Link>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-lg font-semibold">
              ผู้เล่นออนไลน์ ({data.players.length}
              {data.maxPlayers ? `/${data.maxPlayers}` : ''})
            </h2>
            {data.players.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">ยังไม่มีผู้เล่นออนไลน์</p>
            ) : (
              <ul className="space-y-2">
                {data.players.map((player) => (
                  <li
                    key={`${player.name}-${player.xuid}`}
                    className="flex items-center gap-2 rounded-lg border border-[#1f2a3d] bg-[#0b1220] px-3 py-2"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 text-xs font-bold text-emerald-300">
                      {player.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{player.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5 lg:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">เครื่องเซิร์ฟเวอร์</h2>
              <Link href="/system" className="text-xs text-emerald-400 hover:underline">
                ดูรายละเอียด →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#1f2a3d] bg-[#0b1220] p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-500">โหลด CPU</div>
                <div className="mt-1 text-xl font-bold">
                  {data.machine?.cpuLoadPct !== null && data.machine?.cpuLoadPct !== undefined
                    ? `${data.machine.cpuLoadPct}%`
                    : '-'}
                </div>
              </div>
              <div className="rounded-xl border border-[#1f2a3d] bg-[#0b1220] p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-500">RAM ว่าง</div>
                <div className="mt-1 text-xl font-bold">
                  {data.machine?.memFreeGb !== null && data.machine?.memFreeGb !== undefined
                    ? `${data.machine.memFreeGb} GB / ${data.machine.memTotalGb ?? '-'} GB`
                    : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
