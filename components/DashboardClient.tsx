'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import {
  Play,
  Square,
  RotateCcw,
  Terminal as TerminalIcon,
  Activity,
  Users,
  Cpu,
  HardDrive,
  Globe,
  Clock,
  Tag,
  AlertCircle,
  Loader2,
  ChevronRight,
  Download,
  Send,
  Maximize2,
  Minimize2,
  Trash2,
  Sparkles,
  History,
} from 'lucide-react'
import StatusBadge from './StatusBadge'
import InstallPanel from './InstallPanel'
import Terminal, { type TerminalHandle } from './Terminal'
import JoinServerCard from './JoinServerCard'
import { useServerSocket } from './useServerSocket'
import { dialog } from '@/components/dialog'
import type { InstallJob, QuickMachineStats, StatusSnapshot } from '@/lib/types'

interface StatusResponse extends StatusSnapshot {
  machine: QuickMachineStats | null
  job: InstallJob | null
}

const QUICK_COMMANDS = [
  'list',
  'say สวัสดีจากแดชบอร์ด!',
  'help',
  'time set day',
  'weather clear',
  'whitelist list',
]

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h} ชม ${m} นาที`
  if (m > 0) return `${m} นาที ${s} วิ`
  return `${s} วินาที`
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
}

export default function DashboardClient({ role = 'admin' }: { role?: string }) {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Console State ──────────────────────────────────────────────────────────
  const termRef = useRef<TerminalHandle>(null)
  const onLog = useCallback((line: string) => termRef.current?.writeLine(line), [])
  const { connected, status: wsStatus, sendCommand } = useServerSocket(onLog)

  const [input, setInput] = useState('')
  const [localHistory, setLocalHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [savedHistory, setSavedHistory] = useState<string[]>([])
  const [consoleError, setConsoleError] = useState<string | null>(null)
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(false)

  // Fetch command history
  useEffect(() => {
    fetch('/api/bedrock/history?limit=30', { cache: 'no-store' })
      .then((r) => r.json())
      .then((body: { history?: Array<{ command: string }> }) => {
        setSavedHistory((body.history ?? []).map((h) => h.command))
      })
      .catch(() => undefined)
  }, [])

  // Sync WebSocket status into local data
  useEffect(() => {
    if (wsStatus) {
      setData((prev) => {
        if (!prev) return null
        return {
          ...prev,
          ...wsStatus,
        }
      })
    }
  }, [wsStatus])

  // Periodic poll for hardware stats & fallback
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/bedrock/status', { cache: 'no-store' })
      if (res.ok) {
        const body = (await res.json()) as StatusResponse
        setData(body)
      }
    } catch {
      // โหมดออฟไลน์
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), 3500)
    return () => clearInterval(timer)
  }, [refresh])

  // ── Server Controls ────────────────────────────────────────────────────────
  const control = async (action: 'start' | 'stop' | 'restart') => {
    if (action === 'stop') {
      const ok = await dialog.confirm({
        title: 'ยืนยันการหยุดเซิร์ฟเวอร์',
        message:
          'ผู้เล่นทุกคนจะถูกตัดการเชื่อมต่อ และเซิร์ฟเวอร์จะหยุดทำงานทันที คุณต้องการดำเนินการต่อหรือไม่?',
        type: 'danger',
        confirmText: 'หยุดเซิร์ฟเวอร์',
        cancelText: 'ยกเลิก',
        isDanger: true,
      })
      if (!ok) return
    } else if (action === 'restart') {
      const ok = await dialog.confirm({
        title: 'ยืนยันการรีสตาร์ทเซิร์ฟเวอร์',
        message:
          'ผู้เล่นทุกคนจะถูกตัดการเชื่อมต่อชั่วคราวขณะเซิร์ฟเวอร์เริ่มต้นใหม่ คุณต้องการดำเนินการต่อหรือไม่?',
        type: 'warning',
        confirmText: 'รีสตาร์ทเซิร์ฟเวอร์',
        cancelText: 'ยกเลิก',
        isDanger: true,
      })
      if (!ok) return
    }

    setBusy(action)
    setError(null)
    try {
      const res = await fetch(`/api/bedrock/${action}`, { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'ทำรายการไม่สำเร็จ')
        dialog.toast({ message: body.error ?? 'ทำรายการไม่สำเร็จ', type: 'error' })
      } else {
        dialog.toast({
          message:
            action === 'start'
              ? 'ส่งคำสั่งเริ่มเซิร์ฟเวอร์แล้ว'
              : action === 'stop'
                ? 'ส่งคำสั่งหยุดเซิร์ฟเวอร์แล้ว'
                : 'กำลังรีสตาร์ทเซิร์ฟเวอร์...',
          type: 'info',
        })
      }
    } catch {
      setError('เชื่อมต่อไม่ได้')
      dialog.toast({ message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', type: 'error' })
    } finally {
      setBusy(null)
      void refresh()
    }
  }

  // ── Console Command Submission ─────────────────────────────────────────────
  const submitCommand = async (raw?: string) => {
    const command = (raw ?? input).trim()
    if (!command) return
    setInput('')
    setHistoryIndex(-1)
    setLocalHistory((prev) => [command, ...prev].slice(0, 100))

    const sent = sendCommand(command)
    if (sent) {
      setConsoleError(null)
      return
    }

    // Fallback via REST API if WebSocket is not ready
    try {
      const res = await fetch('/api/bedrock/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setConsoleError(res.ok ? null : (body.error ?? 'ส่งคำสั่งไม่สำเร็จ'))
    } catch {
      setConsoleError('ส่งคำสั่งไม่สำเร็จ — เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    }
  }

  const onConsoleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.min(historyIndex + 1, localHistory.length - 1)
      if (next >= 0) {
        setHistoryIndex(next)
        setInput(localHistory[next])
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = historyIndex - 1
      setHistoryIndex(next)
      setInput(next >= 0 ? localHistory[next] : '')
    }
  }

  if (!data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-8 w-44 rounded-2xl bg-[var(--ts-surface-high)]" />
          <div className="h-7 w-28 rounded-full bg-[var(--ts-surface-high)]" />
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="card h-64 lg:col-span-2 bg-[var(--ts-surface-container)]" />
          <div className="card h-64 bg-[var(--ts-surface-container)]" />
          <div className="card h-80 lg:col-span-3 bg-[var(--ts-surface-container)]" />
        </div>
      </div>
    )
  }

  const isActive =
    data.status === 'starting' || data.status === 'running' || data.status === 'stopping'
  const canStart = data.status === 'stopped' || data.status === 'crashed'

  return (
    <div className="space-y-6">
      {/* ── Page Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ts-on-surface)] flex items-center gap-2.5">
            <span>ภาพรวม & คอนโซลสด</span>
          </h1>
          <p className="text-xs text-[var(--ts-on-surface-variant)] mt-0.5">
            มอนิเตอร์สถานะการทำงาน ควบคุมเซิร์ฟเวอร์ และป้อนคำสั่งแบบ Real-time ในหน้าเดียว
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <StatusBadge status={data.status} />
          <span
            className={`badge hidden sm:inline-flex items-center gap-1.5 font-mono text-xs ${
              connected
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-500/40 bg-slate-500/10 text-slate-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full bg-current ${connected ? 'animate-pulse' : ''}`}
            />
            {connected ? 'WebSocket เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อ...'}
          </span>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl border border-[var(--ts-error)]/40 bg-[var(--ts-error-container)]/30 px-4 py-3 text-sm text-[#ffb4ab]"
        >
          <AlertCircle size={18} className="shrink-0 text-[var(--ts-error)]" />
          <span>{error}</span>
        </motion.div>
      )}

      {!data.binExists ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-6 md:p-8 space-y-4 rounded-3xl"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ts-primary-container)] text-[var(--ts-primary)]">
              <Globe size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--ts-on-surface)]">
                ติดตั้ง Minecraft Bedrock Server
              </h2>
              <p className="text-xs text-[var(--ts-on-surface-variant)]">
                ยังไม่พบไฟล์เซิร์ฟเวอร์ในระบบ — เลือกรุ่นเพื่อดาวน์โหลดและติดตั้งได้ทันที
              </p>
            </div>
          </div>
          <InstallPanel onInstalled={() => void refresh()} />
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* ── Top Row: Server Controls & Online Players ──────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Main Status & Controls Card */}
            <motion.div variants={itemVariants} className="card p-6 lg:col-span-2 space-y-5 rounded-3xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ts-outline-variant)]/60 pb-4">
                <div>
                  <h2 className="text-base font-bold text-[var(--ts-on-surface)]">
                    การควบคุมการทำงาน
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--ts-on-surface-variant)]">
                    <span>PID: {data.pid ?? '-'}</span>
                    <span>•</span>
                    <span>ความจุ: {data.maxPlayers ?? '-'} คน</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {canStart && (
                    <motion.button
                      whileHover={{ scale: busy ? 1 : 1.02 }}
                      whileTap={{ scale: busy ? 1 : 0.98 }}
                      className="btn btn-primary gap-2"
                      onClick={() => void control('start')}
                      disabled={busy !== null}
                    >
                      {busy === 'start' ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Play size={15} fill="currentColor" />
                      )}
                      <span>{busy === 'start' ? 'กำลังเริ่ม...' : 'เริ่มเซิร์ฟเวอร์'}</span>
                    </motion.button>
                  )}

                  {isActive && (
                    <>
                      <motion.button
                        whileHover={{ scale: busy ? 1 : 1.02 }}
                        whileTap={{ scale: busy ? 1 : 0.98 }}
                        className="btn btn-danger gap-2"
                        onClick={() => void control('stop')}
                        disabled={busy !== null}
                      >
                        {busy === 'stop' ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Square size={14} fill="currentColor" />
                        )}
                        <span>{busy === 'stop' ? 'กำลังหยุด...' : 'หยุด'}</span>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: busy || data.status !== 'running' ? 1 : 1.02 }}
                        whileTap={{ scale: busy || data.status !== 'running' ? 1 : 0.98 }}
                        className="btn gap-2"
                        onClick={() => void control('restart')}
                        disabled={busy !== null || data.status !== 'running'}
                      >
                        <RotateCcw size={15} className={busy === 'restart' ? 'animate-spin' : ''} />
                        <span>{busy === 'restart' ? 'กำลังรีสตาร์ท...' : 'รีสตาร์ท'}</span>
                      </motion.button>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Metrics Grid */}
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] p-3.5 transition-colors hover:border-[var(--ts-outline)]">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ts-on-surface-variant)]">
                    <Tag size={12} className="text-[var(--ts-primary)]" />
                    <span>เวอร์ชัน</span>
                  </div>
                  <dd className="mt-1.5 font-mono text-sm font-bold text-[var(--ts-on-surface)] truncate">
                    {data.version ?? '-'}
                  </dd>
                </div>

                <div className="rounded-2xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] p-3.5 transition-colors hover:border-[var(--ts-outline)]">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ts-on-surface-variant)]">
                    <Globe size={12} className="text-[var(--ts-tertiary)]" />
                    <span>โลก (World)</span>
                  </div>
                  <dd
                    className="mt-1.5 text-sm font-bold text-[var(--ts-on-surface)] truncate"
                    title={data.worldName ?? undefined}
                  >
                    {data.worldName ?? '-'}
                  </dd>
                </div>

                <div className="rounded-2xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] p-3.5 transition-colors hover:border-[var(--ts-outline)]">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ts-on-surface-variant)]">
                    <Activity size={12} className="text-[var(--ts-secondary)]" />
                    <span>พอร์ต (UDP)</span>
                  </div>
                  <dd className="mt-1.5 font-mono text-sm font-bold text-[var(--ts-on-surface)]">
                    {data.serverPort ?? '-'}
                  </dd>
                </div>

                <div className="rounded-2xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] p-3.5 transition-colors hover:border-[var(--ts-outline)]">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ts-on-surface-variant)]">
                    <Clock size={12} className="text-amber-400" />
                    <span>เวลาทำงาน</span>
                  </div>
                  <dd className="mt-1.5 text-sm font-bold text-[var(--ts-on-surface)] truncate">
                    {data.uptimeSec !== null ? formatUptime(data.uptimeSec) : '-'}
                  </dd>
                </div>
              </dl>

              {/* Quick Links */}
              <div className="flex flex-wrap items-center justify-between text-xs pt-1 gap-2">
                <a
                  href="#live-console"
                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--ts-primary)] hover:underline"
                >
                  <TerminalIcon size={14} />
                  <span>เลื่อนไปที่คอนโซลสด & ป้อนคำสั่งด้านล่าง</span>
                  <ChevronRight size={14} />
                </a>

                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-primary)] transition-colors hover:underline"
                >
                  <Download size={14} />
                  <span>ตั้งค่าเซิร์ฟเวอร์ / ติดตั้งใหม่</span>
                </Link>
              </div>
            </motion.div>

            {/* Online Players Card */}
            <motion.div variants={itemVariants} className="card p-6 flex flex-col justify-between rounded-3xl">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[var(--ts-outline-variant)]/60 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--ts-primary-container)] text-[var(--ts-primary)]">
                      <Users size={15} />
                    </div>
                    <h2 className="text-base font-bold text-[var(--ts-on-surface)]">
                      ผู้เล่นออนไลน์
                    </h2>
                  </div>
                  <span className="badge border-[var(--ts-primary)]/30 bg-[var(--ts-primary-container)]/30 font-mono text-xs text-[var(--ts-primary)]">
                    {data.players.length}
                    {data.maxPlayers ? `/${data.maxPlayers}` : ''}
                  </span>
                </div>

                {data.players.length === 0 ? (
                  <div className="py-10 text-center space-y-1">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ts-surface-low)] text-[var(--ts-on-surface-variant)] mb-2">
                      <Users size={18} />
                    </div>
                    <p className="text-xs font-semibold text-[var(--ts-on-surface-variant)]">
                      ยังไม่มีผู้เล่นออนไลน์
                    </p>
                    <p className="text-[11px] text-[var(--ts-outline)]">
                      ผู้เล่นที่เชื่อมต่อจะปรากฏที่นี่อัตโนมัติ
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {data.players.map((player) => (
                      <li
                        key={`${player.name}-${player.xuid}`}
                        className="flex items-center gap-2.5 rounded-xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] px-3 py-2 text-sm"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--ts-tertiary-container)] text-xs font-bold text-[var(--ts-tertiary)]">
                          {player.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-[var(--ts-on-surface)]">
                          {player.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="pt-4 border-t border-[var(--ts-outline-variant)]/60 mt-auto">
                <div className="text-[11px] text-[var(--ts-on-surface-variant)] text-center">
                  อัปเดตสถานะอัตโนมัติแบบ Real-time
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── Server Connection / Join Card (IP, Port, Domain) ─────────────── */}
          <motion.div variants={itemVariants}>
            <JoinServerCard serverStatus={data.status} role={role} />
          </motion.div>

          {/* ── Live Server Console Section (รวมอยู่ในหน้าเดียว) ───────────────── */}
          <motion.div
            id="live-console"
            variants={itemVariants}
            className="card p-6 rounded-3xl space-y-4 border border-[var(--ts-outline-variant)] shadow-xl"
          >
            {/* Console Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--ts-outline-variant)]/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ts-primary-container)]/40 text-[var(--ts-primary)]">
                  <TerminalIcon size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[var(--ts-on-surface)]">
                      คอนโซลสดเซิร์ฟเวอร์ (Live BDS Console)
                    </h2>
                    <span
                      className={`badge text-[10px] font-mono py-0.5 px-2 ${
                        connected
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-500/40 bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {connected ? 'Live' : 'Connecting'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ts-on-surface-variant)] mt-0.5">
                    ดูบันทึกการทำงานสดจากเซิร์ฟเวอร์ และส่งคำสั่งควบคุมได้โดยตรง
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm inline-flex items-center gap-1.5 text-xs rounded-xl"
                  onClick={() => setIsConsoleExpanded((prev) => !prev)}
                  title={isConsoleExpanded ? 'ย่อขนาดคอนโซล' : 'ขยายขนาดคอนโซล'}
                >
                  {isConsoleExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  <span>{isConsoleExpanded ? 'ขนาดปกติ' : 'ขยายจอ'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-sm inline-flex items-center gap-1.5 text-xs rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] hover:bg-[var(--ts-surface-high)]"
                  onClick={() => termRef.current?.clear()}
                >
                  <Trash2 size={13} />
                  <span>ล้างหน้าจอ</span>
                </button>
              </div>
            </div>

            {/* Terminal Window */}
            <div className="rounded-2xl border border-[var(--ts-outline-variant)]/80 bg-[#05070d] p-2 shadow-inner">
              <Terminal
                ref={termRef}
                className={`${
                  isConsoleExpanded ? 'h-[32rem]' : 'h-80'
                } w-full overflow-hidden rounded-xl px-2 py-1 transition-all duration-300`}
              />
            </div>

            {/* Command Input Bar */}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void submitCommand()
              }}
            >
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-emerald-400 pointer-events-none select-none">
                  $
                </span>
                <input
                  className="input w-full font-mono text-xs py-2.5 pl-8 pr-3 rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] focus:border-[var(--ts-primary)]"
                  placeholder="พิมพ์คำสั่ง Minecraft เช่น list, op <ชื่อ>, say สวัสดี, gamemode 1 (ใส่ / หรือไม่ใส่ก็ได้)..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onConsoleKeyDown}
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary inline-flex items-center gap-1.5 text-xs py-2.5 px-4 rounded-xl shadow-lg shrink-0"
              >
                <Send size={14} />
                <span>ส่งคำสั่ง</span>
              </button>
            </form>

            {consoleError && (
              <p className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-3.5 py-2 text-xs text-rose-200">
                {consoleError}
              </p>
            )}

            {/* Quick Commands & History */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--ts-on-surface-variant)] flex items-center gap-1 mr-1">
                  <Sparkles size={12} className="text-amber-400" />
                  <span>คำสั่งด่วน:</span>
                </span>
                {QUICK_COMMANDS.map((cmd) => (
                  <button
                    key={cmd}
                    type="button"
                    className="btn btn-sm font-mono text-[11px] py-1 px-2.5 rounded-lg border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] hover:border-[var(--ts-primary)]/50 hover:bg-[var(--ts-surface-high)]"
                    onClick={() => void submitCommand(cmd)}
                  >
                    {cmd}
                  </button>
                ))}
              </div>

              {savedHistory.length > 0 && (
                <details className="group relative">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-[var(--ts-primary)] hover:underline inline-flex items-center gap-1">
                    <History size={13} />
                    <span>ประวัติคำสั่ง ({savedHistory.length})</span>
                  </summary>
                  <div className="absolute right-0 bottom-full z-50 mb-2 w-72 max-h-48 overflow-y-auto rounded-2xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] p-2 shadow-2xl backdrop-blur-md space-y-1">
                    <p className="text-[10px] uppercase font-bold text-[var(--ts-on-surface-variant)] px-2 py-1">
                      คลิกเพื่อป้อนคำสั่งซ้ำ
                    </p>
                    {savedHistory.map((cmd, idx) => (
                      <button
                        key={`${cmd}-${idx}`}
                        type="button"
                        onClick={() => void submitCommand(cmd)}
                        className="w-full text-left font-mono text-[11px] px-2.5 py-1.5 rounded-lg text-[var(--ts-on-surface)] hover:bg-[var(--ts-surface-high)] truncate block"
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </motion.div>

          {/* ── Bottom Row: Machine Stats Summary ──────────────────────────────── */}
          <motion.div variants={itemVariants} className="card p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--ts-tertiary-container)] text-[var(--ts-tertiary)]">
                  <Activity size={15} />
                </div>
                <h2 className="text-base font-bold text-[var(--ts-on-surface)]">
                  สถานะฮาร์ดแวร์เครื่องแม่ข่าย
                </h2>
              </div>
              <Link
                href="/system"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ts-primary)] hover:underline"
              >
                <span>รายละเอียดระบบ</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--ts-on-surface-variant)]">
                    <Cpu size={14} className="text-[var(--ts-primary)]" />
                    <span>โหลด CPU</span>
                  </div>
                  <div className="mt-1 text-2xl font-bold font-mono text-[var(--ts-on-surface)]">
                    {data.machine?.cpuLoadPct !== null && data.machine?.cpuLoadPct !== undefined
                      ? `${data.machine.cpuLoadPct}%`
                      : '-'}
                  </div>
                </div>
                {data.machine?.cpuLoadPct !== null && data.machine?.cpuLoadPct !== undefined && (
                  <div className="w-24 h-2.5 rounded-full overflow-hidden bg-[var(--ts-surface-container)] border border-[var(--ts-outline-variant)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, data.machine.cpuLoadPct)}%`,
                        background:
                          data.machine.cpuLoadPct > 80
                            ? 'var(--ts-error)'
                            : data.machine.cpuLoadPct > 50
                              ? '#f59e0b'
                              : 'var(--ts-tertiary)',
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--ts-on-surface-variant)]">
                    <HardDrive size={14} className="text-[var(--ts-tertiary)]" />
                    <span>RAM ที่ว่าง</span>
                  </div>
                  <div className="mt-1 text-2xl font-bold font-mono text-[var(--ts-on-surface)]">
                    {data.machine?.memFreeGb !== null && data.machine?.memFreeGb !== undefined
                      ? `${data.machine.memFreeGb} GB`
                      : '-'}
                  </div>
                </div>
                {data.machine?.memTotalGb &&
                  data.machine?.memFreeGb !== null &&
                  data.machine?.memFreeGb !== undefined && (
                    <div className="text-right">
                      <div className="text-[11px] text-[var(--ts-on-surface-variant)]">ทั้งหมด</div>
                      <div className="text-xs font-bold font-mono text-[var(--ts-on-surface)]">
                        {data.machine.memTotalGb} GB
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
