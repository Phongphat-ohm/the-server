'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Puzzle,
  Palette,
  Layers,
  Upload,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
  RefreshCw,
  Loader2,
  FileArchive,
  Link2,
  Info,
  Server,
  FlaskConical,
  Sparkles,
} from 'lucide-react'
import type { AddonInfo } from '@/lib/bedrock/addonManager'
import { dialog } from '@/components/dialog'

interface AddonsResponse {
  worldName: string | null
  worldExists: boolean
  serverVersion: string | null
  texturepackRequired?: boolean
  experiments?: {
    available: boolean
    enabled: boolean
    flags: Record<string, boolean>
  }
  addons: AddonInfo[]
  counts?: {
    all: number
    custom: number
    builtin: number
    behavior: number
    resource: number
  }
}


interface UploadResult {
  file: string
  error?: string
  packs?: Array<{ name: string; type: string; version: number[] }>
  warnings?: string[]
}

type TabCategory = 'all' | 'behavior' | 'resource'
type StatusFilter = 'all' | 'active' | 'inactive'
type SourceFilter = 'all' | 'custom' | 'builtin'

export default function AddonsClient() {
  const [data, setData] = useState<AddonsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [results, setResults] = useState<UploadResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<TabCategory>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('custom')
  const [searchQuery, setSearchQuery] = useState('')

  // Toggling busy state per dirName
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [syncingExperiments, setSyncingExperiments] = useState(false)


  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/addons', { cache: 'no-store' })
      const body = (await res.json()) as AddonsResponse & { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'โหลดรายการ Addons ไม่สำเร็จ')
        return
      }
      setData(body)
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setLoading(false)
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
      const uploadResults = body.results ?? []
      setResults(uploadResults)
      const hasErrors = uploadResults.some((r) => r.error)
      const hasSuccess = uploadResults.some((r) => !r.error)
      if (hasErrors && !hasSuccess) {
        setError('ติดตั้ง Addon ไม่สำเร็จ โปรดดูรายละเอียดข้อผิดพลาดด้านล่าง')
      } else if (hasErrors && hasSuccess) {
        setError('ติดตั้งสำเร็จบางส่วน แต่มีบางไฟล์เกิดข้อผิดพลาด')
        setSuccess('ติดตั้ง Addon บางไฟล์เรียบร้อยแล้ว')
        setTimeout(() => setSuccess(null), 4000)
      } else {
        setSuccess('ติดตั้งและเปิดใช้งาน Addons เสร็จเรียบร้อย')
        setTimeout(() => setSuccess(null), 4000)
      }
      await load()
    } catch {
      setError('อัปโหลดไม่สำเร็จ — ตรวจสอบขนาดไฟล์และการเชื่อมต่อ')
    } finally {
      setUploading(false)
    }
  }

  const toggle = async (addon: AddonInfo) => {
    setToggling(`${addon.type}:${addon.dirName}`)
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
    } finally {
      setToggling(null)
    }
  }

  const remove = async (addon: AddonInfo) => {
    const confirmed = await dialog.confirm({
      title: 'ยืนยันการลบแอดออน',
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบ "${addon.name}" ออกจากเซิร์ฟเวอร์? ไฟล์ของแอดออนนี้จะถูกลบถาวร`,
      type: 'danger',
      confirmText: 'ลบแอดออน',
      cancelText: 'ยกเลิก',
      isDanger: true,
    })
    if (!confirmed) return

    setDeleting(`${addon.type}:${addon.dirName}`)
    setError(null)
    try {
      const res = await fetch('/api/addons/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dirName: addon.dirName, type: addon.type }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'ลบไม่สำเร็จ')
        dialog.toast({ message: body.error ?? 'ลบแอดออนไม่สำเร็จ', type: 'error' })
      } else {
        setSuccess(`ลบ "${addon.name}" สำเร็จแล้ว`)
        dialog.toast({ message: `ลบ "${addon.name}" สำเร็จแล้ว`, type: 'success' })
        setTimeout(() => setSuccess(null), 3000)
      }
      await load()
    } catch {
      setError('เชื่อมต่อไม่ได้')
      dialog.toast({ message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', type: 'error' })
    } finally {
      setDeleting(null)
    }
  }

  const handleEnableExperiments = async () => {
    setSyncingExperiments(true)
    setError(null)
    try {
      const res = await fetch('/api/addons/experiments', { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as AddonsResponse & { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'เปิดใช้งานการทดลองไม่สำเร็จ')
        return
      }
      setData(body)
      setSuccess('เปิดใช้งานการทดลอง (Experimental Gameplay) ทั้งหมดในโลก และซิงค์แพ็ก BDS เรียบร้อยแล้ว')
      setTimeout(() => setSuccess(null), 4000)
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setSyncingExperiments(false)
    }
  }

  // Filtered Addons

  const filteredAddons = useMemo(() => {
    if (!data?.addons) return []
    return data.addons.filter((addon) => {
      // Source filter (custom / builtin / all)
      if (sourceFilter === 'custom' && addon.packSource !== 'custom') return false
      if (sourceFilter === 'builtin' && addon.packSource !== 'builtin') return false

      // Tab filter
      if (activeTab === 'behavior' && addon.type !== 'behavior') return false
      if (activeTab === 'resource' && addon.type !== 'resource') return false

      // Status filter
      if (statusFilter === 'active' && !addon.active) return false
      if (statusFilter === 'inactive' && addon.active) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = addon.name.toLowerCase().includes(q)
        const matchDesc = addon.description.toLowerCase().includes(q)
        const matchUuid = addon.uuid.toLowerCase().includes(q)
        if (!matchName && !matchDesc && !matchUuid) return false
      }

      return true
    })
  }, [data, activeTab, statusFilter, sourceFilter, searchQuery])

  // Count per category — use server-provided counts when available
  const counts = useMemo(() => {
    const serverCounts = data?.counts
    const list = data?.addons ?? []
    // Filter counts based on current sourceFilter for tab badges
    const visibleList = sourceFilter === 'all' ? list
      : list.filter((a) => a.packSource === sourceFilter)
    return {
      all: serverCounts?.all ?? list.length,
      custom: serverCounts?.custom ?? list.filter((a) => a.packSource === 'custom').length,
      builtin: serverCounts?.builtin ?? list.filter((a) => a.packSource === 'builtin').length,
      behavior: visibleList.filter((a) => a.type === 'behavior').length,
      resource: visibleList.filter((a) => a.type === 'resource').length,
      tabAll: visibleList.length,
    }
  }, [data, sourceFilter])

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ts-on-surface)] flex items-center gap-2.5">
            <Puzzle size={24} className="text-[var(--ts-primary)]" />
            <span>จัดการส่วนเสริม (Addons)</span>
          </h1>
          <p className="text-xs text-[var(--ts-on-surface-variant)] mt-0.5">
            แยกหมวดหมู่ Behavior Packs & Resource Packs พร้อมตรวจสอบความเข้ากันได้ของเวอร์ชันเซิร์ฟเวอร์
          </p>
        </div>

        {data?.serverVersion && (
          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] px-3 py-1.5 text-xs text-[var(--ts-on-surface-variant)]">
            <Server size={14} className="text-[var(--ts-primary)]" />
            <span>เวอร์ชันเซิร์ฟเวอร์:</span>
            <span className="font-mono font-bold text-[var(--ts-on-surface)]">
              v{data.serverVersion}
            </span>
          </div>
        )}
      </div>

      {/* ── World Notice ──────────────────────────────────────── */}
      {data && !data.worldExists && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-300">
          <Info size={18} className="shrink-0" />
          <span>
            ยังไม่พบข้อมูลโลก &quot;{data.worldName ?? 'Bedrock level'}&quot; — คุณสามารถติดตั้ง pack เตรียมไว้ได้ แต่ต้อง{' '}
            <strong className="font-bold underline">เริ่มเซิร์ฟเวอร์ครั้งแรก</strong> เพื่อสร้างโลกก่อน จึงจะสามารถเปิดใช้งาน pack กับโลกได้
          </span>
        </div>
      )}

      {/* ── Alerts ────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-[var(--ts-error)]/40 bg-[var(--ts-error-container)]/30 p-3.5 text-xs text-[#ffb4ab]">
          <AlertTriangle size={16} className="shrink-0 text-[var(--ts-error)]" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 rounded-xl border border-[var(--ts-tertiary)]/40 bg-[var(--ts-tertiary-container)]/25 p-3.5 text-xs text-[var(--ts-tertiary)]">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* ── Experiments & Resource Pack Auto-Config Status ────── */}
      {data && data.worldExists && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] p-4 shadow-sm">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                data.experiments?.enabled
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              <FlaskConical size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[var(--ts-on-surface)]">
                  โหมดทดลอง (Experimental Gameplay):
                </span>
                {data.experiments?.enabled ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                    <CheckCircle2 size={12} />
                    เปิดใช้งานแล้ว (อัตโนมัติ)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                    <AlertTriangle size={12} />
                    ยังไม่ได้เปิด
                  </span>
                )}

                <span className="text-zinc-600 hidden sm:inline">•</span>

                <span className="text-xs text-[var(--ts-on-surface-variant)]">
                  บังคับดาวน์โหลด Texture Pack:
                </span>
                {data.texturepackRequired ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-400">
                    <CheckCircle2 size={12} />
                    เปิด (true)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/15 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">
                    ปิด (false)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--ts-on-surface-variant)] mt-1">
                ระบบจะสร้าง <code className="font-mono text-[var(--ts-primary)]">valid_known_packs.json</code>, บังคับโหลด Texture Pack, และเปิด flag การทดลองใน <code className="font-mono text-[var(--ts-primary)]">level.dat</code> ให้อัตโนมัติทุกครั้งที่เริ่มเซิร์ฟเวอร์
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnableExperiments}
            disabled={syncingExperiments}
            className="btn btn-secondary gap-2 text-xs font-semibold shadow-sm ml-auto"
            title="ซิงค์ valid_known_packs.json, บังคับ texturepack-required=true, และเปิดการทดลองใน level.dat ทั้งหมดทันที"
          >
            {syncingExperiments ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} className="text-amber-400" />
            )}
            <span>เปิดการทดลอง & ซิงค์แพ็กทันที</span>
          </button>
        </div>
      )}

      {/* ── Source Filter Bar ─────────────────────────────────── */}
      {data && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--ts-on-surface-variant)] font-medium shrink-0">แสดง:</span>
          {(
            [
              { value: 'custom', label: 'ติดตั้งเอง', count: counts.custom, color: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40' },
              { value: 'builtin', label: 'ติดมากับเกม', count: counts.builtin, color: 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/40' },
              { value: 'all', label: 'ทั้งหมด', count: counts.all, color: 'bg-[var(--ts-primary-container)] text-[var(--ts-primary)] ring-[var(--ts-primary)]/40' },
            ] as { value: SourceFilter; label: string; count: number; color: string }[]
          ).map(({ value, label, count, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSourceFilter(value)}
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-semibold transition-all ring-1 ${
                sourceFilter === value
                  ? `${color} shadow-sm`
                  : 'ring-transparent text-[var(--ts-on-surface-variant)] hover:bg-[var(--ts-surface-high)] hover:text-[var(--ts-on-surface)]'
              }`}
            >
              <span>{label}</span>
              <span className="font-mono opacity-70">({count})</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Upload Drag & Drop Area ───────────────────────────── */}

      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
          dragOver
            ? 'border-[var(--ts-primary)] bg-[var(--ts-primary-container)]/20 ring-4 ring-[var(--ts-primary)]/10 scale-[1.005]'
            : 'border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] hover:border-[var(--ts-outline)]'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files) void upload(e.dataTransfer.files)
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ts-surface-high)] text-[var(--ts-primary)] shadow-sm">
          {uploading ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <FileArchive size={24} />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-[var(--ts-on-surface)]">
            {uploading ? 'กำลังติดตั้งและอ่าน Manifest...' : 'ลากไฟล์ Addon มาวางที่นี่ หรือกดเลือกไฟล์'}
          </p>
          <p className="text-xs text-[var(--ts-on-surface-variant)]">
            รองรับไฟล์ <code className="font-mono text-[var(--ts-primary)]">.mcaddon</code>,{' '}
            <code className="font-mono text-[var(--ts-primary)]">.mcpack</code>, หรือ{' '}
            <code className="font-mono text-[var(--ts-primary)]">.zip</code> (แยกประเภท BP/RP และเปิดใช้กับโลกให้อัตโนมัติ)
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn btn-primary gap-2 text-xs font-semibold shadow-md mt-1"
        >
          <Upload size={14} />
          <span>เลือกไฟล์ Addon จากเครื่อง</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".mcaddon,.mcpack,.zip"
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {/* ── Upload Results Card ───────────────────────────────── */}
      <AnimatePresence>
        {results && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="card p-4 space-y-3 border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)]"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--ts-outline-variant)]/60">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ts-on-surface)] flex items-center gap-2">
                <CheckCircle2 size={15} className="text-[var(--ts-tertiary)]" />
                <span>ผลการติดตั้งไฟล์ล่าสุด</span>
              </h3>
              <button
                type="button"
                onClick={() => setResults(null)}
                className="text-xs text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)]"
              >
                ปิด
              </button>
            </div>

            <div className="space-y-2">
              {results.map((r, i) => (
                <div
                  key={`${r.file}-${i}`}
                  className="rounded-xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] p-3 text-xs space-y-1.5"
                >
                  <div className="font-mono font-bold text-[var(--ts-on-surface)] flex items-center gap-1.5">
                    <FileArchive size={14} className="text-[var(--ts-primary)]" />
                    <span>{r.file}</span>
                  </div>
                  {r.error ? (
                    <p className="text-[var(--ts-error)] flex items-center gap-1">
                      <XCircle size={13} />
                      <span>{r.error}</span>
                    </p>
                  ) : (
                    <ul className="space-y-1 pl-1">
                      {(r.packs ?? []).map((pack) => (
                        <li key={pack.name} className="flex items-center gap-1.5 text-[var(--ts-tertiary)] font-medium">
                          <CheckCircle2 size={13} />
                          <span>
                            {pack.name} ({pack.type === 'resource' ? 'Resource Pack' : 'Behavior Pack'} v
                            {pack.version.join('.')})
                          </span>
                        </li>
                      ))}
                      {(r.warnings ?? []).map((warning, wIdx) => (
                        <li key={wIdx} className="flex items-center gap-1.5 text-amber-300">
                          <AlertTriangle size={13} />
                          <span>{warning}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Category Tabs & Filter Toolbar ────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--ts-outline-variant)]/60 pb-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-[var(--ts-primary-container)] text-[var(--ts-primary)] shadow-sm ring-1 ring-[var(--ts-primary)]/40'
                : 'text-[var(--ts-on-surface-variant)] hover:bg-[var(--ts-surface-high)] hover:text-[var(--ts-on-surface)]'
            }`}
          >
            <Layers size={14} />
            <span>ทั้งหมด</span>
            <span className="badge text-[10px] py-0 px-1.5 bg-[var(--ts-surface-low)] font-mono">
              {counts.tabAll}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('behavior')}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'behavior'
                ? 'bg-violet-500/25 text-violet-300 shadow-sm ring-1 ring-violet-500/40'
                : 'text-[var(--ts-on-surface-variant)] hover:bg-[var(--ts-surface-high)] hover:text-[var(--ts-on-surface)]'
            }`}
          >
            <Puzzle size={14} />
            <span>Behavior Packs (BP)</span>
            <span className="badge text-[10px] py-0 px-1.5 bg-[var(--ts-surface-low)] font-mono">
              {counts.behavior}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('resource')}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'resource'
                ? 'bg-sky-500/25 text-sky-300 shadow-sm ring-1 ring-sky-500/40'
                : 'text-[var(--ts-on-surface-variant)] hover:bg-[var(--ts-surface-high)] hover:text-[var(--ts-on-surface)]'
            }`}
          >
            <Palette size={14} />
            <span>Resource Packs (RP)</span>
            <span className="badge text-[10px] py-0 px-1.5 bg-[var(--ts-surface-low)] font-mono">
              {counts.resource}
            </span>
          </button>
        </div>

        {/* Search & Status Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex items-center flex-1 sm:w-56">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ts-on-surface-variant)] z-10" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ Pack..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-has-left-icon text-xs py-2 rounded-xl w-full"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>


          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="input text-xs py-1.5 px-3 rounded-xl w-auto cursor-pointer"
          >
            <option value="all">สถานะทั้งหมด</option>
            <option value="active">เปิดใช้งานอยู่</option>
            <option value="inactive">ปิดใช้งาน</option>
          </select>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="p-2 rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)]"
            title="รีเฟรชรายการ"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Addons Grid ───────────────────────────────────────── */}
      <div>
        {loading && !data ? (
          <div className="py-20 text-center space-y-2">
            <Loader2 size={24} className="animate-spin text-[var(--ts-primary)] mx-auto" />
            <p className="text-xs text-[var(--ts-on-surface-variant)]">กำลังโหลดรายการ Addons...</p>
          </div>
        ) : filteredAddons.length === 0 ? (
          <div className="card py-16 text-center space-y-2 border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)]">
            <Puzzle size={36} className="mx-auto text-[var(--ts-outline)] opacity-40" />
            <p className="text-sm font-bold text-[var(--ts-on-surface)]">ไม่พบ Addons ตามเงื่อนไข</p>
            <p className="text-xs text-[var(--ts-on-surface-variant)]">
              {searchQuery || statusFilter !== 'all'
                ? 'ลองล้างคำค้นหาหรือเปลี่ยนตัวกรองสถานะ'
                : sourceFilter === 'custom'
                ? 'ยังไม่มี Addon ที่ติดตั้งเอง — ลากไฟล์ .mcaddon หรือ .mcpack มาวางในกล่องด้านบนเพื่อติดตั้ง'
                : 'ลองเปลี่ยนตัวกรองหรือลากไฟล์ .mcaddon มาวางเพื่อติดตั้ง'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredAddons.map((addon) => {
              const isBP = addon.type === 'behavior'
              const key = `${addon.type}:${addon.dirName}`
              const isTogglingThis = toggling === key
              const isDeletingThis = deleting === key

              return (
                <div
                  key={key}
                  className={`card flex flex-col justify-between p-4.5 space-y-3.5 border transition-all ${
                    addon.active
                      ? 'border-[var(--ts-primary)]/40 bg-[var(--ts-surface-container)] shadow-sm'
                      : 'border-[var(--ts-outline-variant)]/70 bg-[var(--ts-surface-low)] opacity-90'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Category Icon */}
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                        isBP
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {isBP ? <Puzzle size={20} /> : <Palette size={20} />}
                    </div>

                    {/* Information */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-bold text-sm text-[var(--ts-on-surface)]" title={addon.name}>
                          {addon.name}
                        </span>
                        <span className="font-mono text-xs text-[var(--ts-on-surface-variant)]">
                          v{addon.version.join('.')}
                        </span>
                      </div>

                      {/* Badges Bar */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {/* Type Badge */}
                        <span
                          className={`badge text-[10px] py-0.5 px-2 font-bold ${
                            isBP
                              ? 'border-violet-500/40 bg-violet-500/20 text-violet-300'
                              : 'border-sky-500/40 bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {isBP ? 'Behavior' : 'Resource'}
                        </span>

                        {/* Compatibility Status Badge */}
                        {addon.compatibilityStatus === 'compatible' && (
                          <span
                            className="badge text-[10px] py-0.5 px-2 border-[var(--ts-tertiary)]/40 bg-[var(--ts-tertiary-container)]/30 text-[var(--ts-tertiary)] gap-1"
                            title={addon.compatibilityNote ?? undefined}
                          >
                            <CheckCircle2 size={11} />
                            <span>เข้ากันได้</span>
                          </span>
                        )}

                        {addon.compatibilityStatus === 'warning' && (
                          <span
                            className="badge text-[10px] py-0.5 px-2 border-amber-500/40 bg-amber-500/20 text-amber-300 gap-1"
                            title={addon.compatibilityNote ?? undefined}
                          >
                            <AlertTriangle size={11} />
                            <span>{addon.compatibilityNote ?? 'ควรระวัง'}</span>
                          </span>
                        )}

                        {addon.compatibilityStatus === 'unknown' && addon.minEngineVersion && (
                          <span className="badge text-[10px] py-0.5 px-2 border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface-variant)]">
                            v{addon.minEngineVersion.join('.')}+
                          </span>
                        )}

                        {addon.packSource === 'custom' ? (
                          <span className="badge text-[10px] py-0.5 px-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 gap-1">
                            ติดตั้งเอง
                          </span>
                        ) : (
                          <span className="badge text-[10px] py-0.5 px-2 border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface-variant)]">
                            ติดมากับเกม
                          </span>
                        )}

                        {addon.error && (
                          <span className="badge text-[10px] py-0.5 px-2 border-[var(--ts-error)]/40 bg-[var(--ts-error-container)]/30 text-[#ffb4ab]">
                            {addon.error}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-[var(--ts-on-surface-variant)] line-clamp-2 pt-0.5" title={addon.description}>
                        {addon.description || `UUID: ${addon.uuid}`}
                      </p>
                    </div>
                  </div>

                  {/* ── Dependency Warning Box ──────────────────────── */}
                  {addon.dependencyWarnings && addon.dependencyWarnings.length > 0 && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-300 space-y-1">
                      {addon.dependencyWarnings.map((w, wIdx) => (
                        <div key={wIdx} className="flex items-start gap-1.5">
                          <Link2 size={14} className="shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Footer Controls ─────────────────────────────── */}
                  <div className="flex items-center justify-between border-t border-[var(--ts-outline-variant)]/50 pt-3">
                    {/* Toggle Switch */}
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={addon.active}
                        disabled={isTogglingThis || !!addon.error || (!data?.worldExists && !addon.active)}
                        onClick={() => void toggle(addon)}
                        className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          addon.active ? 'bg-[var(--ts-primary)]' : 'bg-[var(--ts-surface-high)] border border-[var(--ts-outline-variant)]'
                        }`}
                        title={
                          !data?.worldExists && !addon.active
                            ? 'ต้องเริ่มเซิร์ฟเวอร์ครั้งแรกเพื่อสร้างโลกก่อน'
                            : undefined
                        }
                      >
                        <motion.span
                          layout
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className={`absolute top-0.5 h-5 w-5 rounded-full shadow-sm ${
                            addon.active ? 'left-[22px] bg-[var(--ts-on-primary)]' : 'left-0.5 bg-[var(--ts-outline)]'
                          }`}
                        />
                      </button>
                      <span className={`text-xs font-semibold ${addon.active ? 'text-[var(--ts-primary)]' : 'text-[var(--ts-on-surface-variant)]'}`}>
                        {isTogglingThis ? 'กำลังเปลี่ยน...' : addon.active ? 'เปิดใช้งานกับโลกนี้' : 'ปิดใช้งาน'}
                      </span>
                    </div>

                    {/* Delete Button */}
                    {!addon.builtin && (
                      <button
                        type="button"
                        onClick={() => void remove(addon)}
                        disabled={isDeletingThis || !!addon.error}
                        className="btn btn-sm btn-danger text-xs gap-1.5 px-3"
                        title="ลบ Addon นี้ออกจากเซิร์ฟเวอร์"
                      >
                        {isDeletingThis ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                        <span>ลบ</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
