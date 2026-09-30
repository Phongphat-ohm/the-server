'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Download,
  Sparkles,
  Layers,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  ShieldAlert,
  X,
} from 'lucide-react'
import type { InstallJob } from '@/lib/types'
import { useServerSocket } from './useServerSocket'
import VersionAutoComplete from './VersionAutoComplete'

const PHASE_LABEL: Record<string, string> = {
  resolving: 'กำลังตรวจสอบเวอร์ชัน',
  downloading: 'กำลังดาวน์โหลด',
  extracting: 'กำลังแตกไฟล์',
  merging: 'กำลังติดตั้งไฟล์',
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

export type InstallType = 'update' | 'fresh'

export default function InstallPanel({ onInstalled }: { onInstalled?: () => void }) {
  const [mode, setMode] = useState<'latest' | 'custom'>('latest')
  const [installType, setInstallType] = useState<InstallType>('update')
  const [custom, setCustom] = useState('')
  const [latest, setLatest] = useState<string | null>(null)
  const [versions, setVersions] = useState<string[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [job, setJob] = useState<InstallJob | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const notifiedRef = useRef(false)

  // Safety confirmation modal for fresh clean install
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const { job: wsJob } = useServerSocket()

  useEffect(() => {
    if (wsJob) setJob(wsJob)
  }, [wsJob])

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

  const executeInstall = async (isFresh: boolean) => {
    setBusy(true)
    setError(null)
    notifiedRef.current = false
    setShowConfirmModal(false)
    setConfirmInput('')

    try {
      const version = mode === 'latest' ? 'latest' : custom.trim()
      if (mode === 'custom' && !version) {
        setError('กรุณาเลือกเวอร์ชันที่ต้องการติดตั้งจากรายการ AutoComplete')
        return
      }
      const res = await fetch('/api/bedrock/install', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version, freshInstall: isFresh }),
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

  const handleStartClick = () => {
    if (installType === 'fresh') {
      setShowConfirmModal(true)
    } else {
      void executeInstall(false)
    }
  }

  const percent =
    job && job.phase === 'downloading' && job.totalBytes && job.totalBytes > 0
      ? Math.min(100, Math.round((job.receivedBytes / job.totalBytes) * 100))
      : job && job.phase === 'extracting' && job.extractProgress
        ? job.extractProgress.percent
        : null

  return (
    <div className="space-y-4">
      {/* ── Version Selection Grid ────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Mode 1: Latest */}
        <label
          className={`flex cursor-pointer flex-col gap-2 rounded-2xl border p-4 transition-all ${
            mode === 'latest'
              ? 'border-[var(--ts-primary)] bg-[var(--ts-primary-container)]/20 shadow-[0_0_12px_rgba(143,205,255,0.1)] ring-1 ring-[var(--ts-primary)]/40'
              : 'border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] hover:border-[var(--ts-outline)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className={mode === 'latest' ? 'text-[var(--ts-primary)]' : 'text-[var(--ts-on-surface-variant)]'} />
              <span className="font-semibold text-sm text-[var(--ts-on-surface)]">เวอร์ชันล่าสุด</span>
            </div>
            <input
              type="radio"
              name="install-mode"
              checked={mode === 'latest'}
              onChange={() => setMode('latest')}
              className="accent-[var(--ts-primary)]"
            />
          </div>
          <p className="text-xs text-[var(--ts-on-surface-variant)]">
            ตรวจจับและดาวน์โหลดเวอร์ชันเสถียรล่าสุดจาก Mojang อัตโนมัติ
          </p>
          {latest && (
            <div className="mt-auto pt-1">
              <span className="badge border-[var(--ts-primary)]/30 bg-[var(--ts-primary-container)]/30 text-[var(--ts-primary)] font-mono text-[11px]">
                v{latest}
              </span>
            </div>
          )}
          {listError && <span className="text-[11px] text-amber-400">{listError}</span>}
        </label>

        {/* Mode 2: Custom / AutoComplete */}
        <div
          onClick={() => setMode('custom')}
          className={`flex cursor-pointer flex-col gap-2 rounded-2xl border p-4 transition-all ${
            mode === 'custom'
              ? 'border-[var(--ts-primary)] bg-[var(--ts-primary-container)]/20 shadow-[0_0_12px_rgba(143,205,255,0.1)] ring-1 ring-[var(--ts-primary)]/40'
              : 'border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] hover:border-[var(--ts-outline)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={16} className={mode === 'custom' ? 'text-[var(--ts-primary)]' : 'text-[var(--ts-on-surface-variant)]'} />
              <span className="font-semibold text-sm text-[var(--ts-on-surface)]">ระบุเวอร์ชัน (AutoComplete)</span>
            </div>
            <input
              type="radio"
              name="install-mode"
              checked={mode === 'custom'}
              onChange={() => setMode('custom')}
              className="accent-[var(--ts-primary)]"
            />
          </div>
          <p className="text-xs text-[var(--ts-on-surface-variant)]">
            เลือกจากรายการหรือค้นหาเลขเวอร์ชันทางการ (ป้องกันการพิมพ์ผิด)
          </p>
          <div className="mt-auto pt-1" onClick={(e) => e.stopPropagation()}>
            <VersionAutoComplete
              value={custom}
              onChange={(v) => {
                setCustom(v)
                setMode('custom')
              }}
              versions={versions}
              latestVersion={latest}
              disabled={mode !== 'custom'}
            />
          </div>
        </div>
      </div>

      {/* ── Install Mode Option (Update/Repair vs Fresh Reinstall) ─ */}
      <div className="rounded-2xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ts-on-surface)] flex items-center gap-2">
            <RefreshCw size={14} className="text-[var(--ts-primary)]" />
            <span>รูปแบบการติดตั้ง</span>
          </span>
          <span className="text-[11px] text-[var(--ts-on-surface-variant)]">
            {installType === 'update' ? 'คงข้อมูลเดิม' : 'ล้างข้อมูลใหม่สะอาด'}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Option A: Update & Repair */}
          <label
            className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3.5 transition-all ${
              installType === 'update'
                ? 'border-[var(--ts-tertiary)] bg-[var(--ts-tertiary-container)]/15 ring-1 ring-[var(--ts-tertiary)]/40'
                : 'border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] hover:border-[var(--ts-outline)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--ts-on-surface)]">
                <CheckCircle2 size={15} className="text-[var(--ts-tertiary)]" />
                <span>อัปเดต / ซ่อมแซม (แนะนำ)</span>
              </div>
              <input
                type="radio"
                name="install-type"
                checked={installType === 'update'}
                onChange={() => setInstallType('update')}
                className="accent-[var(--ts-tertiary)]"
              />
            </div>
            <p className="text-[11px] text-[var(--ts-on-surface-variant)] leading-relaxed">
              คงไฟล์ <code className="font-mono text-[10px] text-[var(--ts-on-surface)]">server.properties</code>, โลก (Worlds), และ Addons เดิมไว้อย่างปลอดภัย
            </p>
          </label>

          {/* Option B: Fresh Reinstall */}
          <label
            className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3.5 transition-all ${
              installType === 'fresh'
                ? 'border-rose-500/60 bg-rose-500/10 ring-1 ring-rose-500/40'
                : 'border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] hover:border-[var(--ts-outline)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
                <Trash2 size={15} className="text-rose-400" />
                <span>ติดตั้งใหม่ทั้งหมด (Fresh Install)</span>
              </div>
              <input
                type="radio"
                name="install-type"
                checked={installType === 'fresh'}
                onChange={() => setInstallType('fresh')}
                className="accent-rose-500"
              />
            </div>
            <p className="text-[11px] text-rose-300/80 leading-relaxed">
              ล้างโฟลเดอร์เซิร์ฟเวอร์ทั้งหมด และติดตั้งใหม่สะอาด 100% (ข้อมูลโลกและการตั้งค่าจะถูกลบ)
            </p>
          </label>
        </div>

        {installType === 'fresh' && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertTriangle size={15} className="shrink-0 text-rose-400" />
            <span>คำเตือน: โหมดติดตั้งใหม่จะลบข้อมูลเดิมทั้งหมด หากมีข้อมูลสำคัญโปรดสำรองไฟล์ไว้ก่อน</span>
          </div>
        )}
      </div>

      {/* ── Main Action Button ─────────────────────────────────── */}
      <motion.button
        type="button"
        whileHover={{ scale: busy || jobActive ? 1 : 1.01 }}
        whileTap={{ scale: busy || jobActive ? 1 : 0.98 }}
        className={`btn w-full gap-2 font-semibold shadow-md ${
          installType === 'fresh'
            ? 'border-rose-600 bg-rose-600 text-white hover:bg-rose-500'
            : 'btn-primary'
        }`}
        onClick={handleStartClick}
        disabled={busy || jobActive}
      >
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>กำลังเริ่ม...</span>
          </>
        ) : jobActive ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>{job.freshInstall ? 'กำลังติดตั้งใหม่ (Fresh)...' : 'กำลังติดตั้ง / อัปเดต...'}</span>
          </>
        ) : installType === 'fresh' ? (
          <>
            <Trash2 size={16} />
            <span>ติดตั้งเซิร์ฟเวอร์ใหม่ทั้งหมด (Fresh Clean Reinstall)</span>
          </>
        ) : (
          <>
            <Download size={16} />
            <span>เริ่มติดตั้ง / อัปเดตเซิร์ฟเวอร์</span>
          </>
        )}
      </motion.button>

      {/* ── Error Box ─────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-[var(--ts-error)]/40 bg-[var(--ts-error-container)]/30 px-3.5 py-2.5 text-sm text-[#ffb4ab]">
          <AlertCircle size={16} className="shrink-0 text-[var(--ts-error)]" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Job Progress Display ──────────────────────────────── */}
      <AnimatePresence>
        {job && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-2xl border p-4.5 space-y-2.5 transition-all ${
              job.phase === 'error'
                ? 'border-[var(--ts-error)]/40 bg-[var(--ts-error-container)]/20'
                : job.phase === 'done'
                  ? 'border-[var(--ts-tertiary)]/40 bg-[var(--ts-tertiary-container)]/20'
                  : 'border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)]'
            }`}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-[var(--ts-on-surface)] flex items-center gap-2">
                {job.phase === 'done' && <CheckCircle2 size={16} className="text-[var(--ts-tertiary)]" />}
                {job.phase === 'error' && <AlertCircle size={16} className="text-[var(--ts-error)]" />}
                {jobActive && <Loader2 size={15} className="animate-spin text-[var(--ts-primary)]" />}
                <span>
                  {job.phase === 'extracting' && job.extractProgress
                    ? `กำลังแตกไฟล์ (${job.extractProgress.extracted}/${job.extractProgress.total} ไฟล์)`
                    : PHASE_LABEL[job.phase] ?? job.phase}
                  {job.freshInstall ? ' [Clean Wipe]' : ''} — เวอร์ชัน{' '}
                  {job.version === 'latest' ? 'ล่าสุด' : job.version}
                </span>
              </span>
              {percent !== null && (
                <span className="font-mono text-xs font-bold text-[var(--ts-primary)]">{percent}%</span>
              )}
            </div>

            {jobActive && (
              <>
                {percent !== null ? (
                  <div className="h-2.5 overflow-hidden rounded-full border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, var(--ts-primary-container), var(--ts-primary))',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ ease: [0.2, 0, 0.38, 0.9], duration: 0.2 }}
                    />
                  </div>
                ) : (
                  <div className="progress-indeterminate" />
                )}
                {job.phase === 'downloading' && job.receivedBytes > 0 && (
                  <div className="flex justify-between text-[11px] font-mono text-[var(--ts-on-surface-variant)]">
                    <span>ดาวน์โหลดแล้ว {formatBytes(job.receivedBytes)}</span>
                    {job.totalBytes ? <span>จากทั้งหมด {formatBytes(job.totalBytes)}</span> : null}
                  </div>
                )}
                {job.phase === 'extracting' && job.extractProgress && (
                  <div className="flex justify-between text-[11px] font-mono text-[var(--ts-on-surface-variant)]">
                    <span>แตกไฟล์แล้ว {job.extractProgress.extracted} จาก {job.extractProgress.total} ไฟล์</span>
                    <span className="font-bold text-[var(--ts-primary)]">{job.extractProgress.percent}%</span>
                  </div>
                )}
                {job.phase === 'merging' && (
                  <div className="text-[11px] text-[var(--ts-on-surface-variant)]">
                    กำลังคัดลอกไฟล์ลงโฟลเดอร์เซิร์ฟเวอร์...
                  </div>
                )}
                {job.phase === 'finalizing' && (
                  <div className="text-[11px] text-[var(--ts-on-surface-variant)]">
                    กำลังตรวจสอบความเรียบร้อยและบันทึกประวัติเวอร์ชัน...
                  </div>
                )}
              </>
            )}

            {job.phase === 'error' && job.error && (
              <p className="text-xs text-[#ffb4ab]">{job.error}</p>
            )}
            {job.phase === 'done' && (
              <p className="text-xs text-[var(--ts-tertiary)]">
                {job.freshInstall
                  ? 'ติดตั้งเซิร์ฟเวอร์ใหม่สะอาดหมดจดเรียบร้อยแล้ว — เริ่มเซิร์ฟเวอร์เพื่อเริ่มเล่นได้ทันที'
                  : 'พร้อมใช้งานแล้ว — ข้อมูลเดิม (server.properties, worlds) ถูกคงไว้เรียบร้อย'}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirmation Modal for Fresh Reinstall ────────────── */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-rose-500/50 bg-[var(--ts-surface-container)] p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--ts-outline-variant)]">
                <div className="flex items-center gap-2.5 text-rose-400">
                  <ShieldAlert size={20} />
                  <h3 className="font-bold text-base text-[var(--ts-on-surface)]">
                    ยืนยันการติดตั้งเซิร์ฟเวอร์ใหม่ทั้งหมด
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="rounded-lg p-1 text-[var(--ts-on-surface-variant)] hover:bg-[var(--ts-surface-high)]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs text-[var(--ts-on-surface-variant)] leading-relaxed">
                <p>
                  คุณกำลังจะดำเนินการ{' '}
                  <strong className="text-rose-400 font-bold underline">
                    ติดตั้งเซิร์ฟเวอร์ใหม่แบบล้างข้อมูลสะอาด (Clean Wipe)
                  </strong>
                </p>
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300 space-y-1">
                  <p className="font-bold">⚠️ สิ่งที่จะเกิดขึ้น:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    <li>ข้อมูลโลก (Worlds) ทั้งหมดจะถูกลบถาวร</li>
                    <li>ส่วนเสริม Addons (BP/RP) ทั้งหมดจะถูกลบ</li>
                    <li>ไฟล์การตั้งค่า server.properties จะถูกรีเซ็ตใหม่</li>
                  </ul>
                </div>
                <p>
                  เพื่อป้องกันความผิดพลาด กรุณาพิมพ์คำว่า{' '}
                  <code className="rounded bg-rose-500/20 px-1.5 py-0.5 font-mono font-bold text-rose-300">
                    REINSTALL
                  </code>{' '}
                  ในช่องด้านล่างเพื่อยืนยัน:
                </p>
              </div>

              <input
                type="text"
                placeholder="พิมพ์ REINSTALL เพื่อยืนยัน"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="input font-mono text-center tracking-widest uppercase border-rose-500/40 text-sm focus:border-rose-500"
                autoFocus
              />

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmModal(false)
                    setConfirmInput('')
                  }}
                  className="btn btn-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={confirmInput !== 'REINSTALL' || busy}
                  onClick={() => void executeInstall(true)}
                  className="btn btn-sm border-rose-600 bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>ยืนยันและติดตั้งใหม่</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
