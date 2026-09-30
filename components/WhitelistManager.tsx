'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Users,
  User,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Sparkles,
} from 'lucide-react'
import { dialog } from '@/components/dialog'

export interface WhitelistEntry {
  name: string
  xuid?: string
  ignoresPlayerLimit?: boolean
}

interface WhitelistManagerProps {
  serverRunning?: boolean
}

export default function WhitelistManager({ serverRunning = false }: WhitelistManagerProps) {
  const [entries, setEntries] = useState<WhitelistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newPlayerName, setNewPlayerName] = useState('')
  const [ignoresLimit, setIgnoresLimit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadWhitelist = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/whitelist', { cache: 'no-store' })
      const body = (await res.json()) as { entries?: WhitelistEntry[]; error?: string }
      if (res.ok && body.entries) {
        setEntries(body.entries)
      }
    } catch {
      setError('ไม่สามารถโหลดรายชื่อ Whitelist ได้')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadWhitelist()
  }, [loadWhitelist])

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newPlayerName.trim()
    if (!trimmed) {
      setError('กรุณาระบุชื่อผู้เล่น (Gamertag)')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/whitelist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          ignoresPlayerLimit: ignoresLimit,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        entries?: WhitelistEntry[]
        error?: string
      }
      if (!res.ok) {
        setError(body.error ?? 'เพิ่มผู้เล่นไม่สำเร็จ')
        dialog.toast({ message: body.error ?? 'เพิ่มผู้เล่นไม่สำเร็จ', type: 'error' })
        return
      }

      setEntries(body.entries ?? [])
      setNewPlayerName('')
      setIgnoresLimit(false)
      dialog.toast({
        message: `เพิ่ม "${trimmed}" เข้า Whitelist เรียบร้อยแล้ว`,
        type: 'success',
      })
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
      dialog.toast({ message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemovePlayer = async (player: WhitelistEntry) => {
    const ok = await dialog.confirm({
      title: 'ยืนยันการลบออกจาก Whitelist',
      message: `คุณต้องการนำผู้เล่น "${player.name}" ออกจาก Whitelist ใช่หรือไม่? ผู้เล่นนี้จะไม่สามารถเข้าเซิร์ฟเวอร์ได้อีก`,
      type: 'warning',
      confirmText: 'ลบออกจาก Whitelist',
      cancelText: 'ยกเลิก',
      isDanger: true,
    })
    if (!ok) return

    setDeletingName(player.name)
    setError(null)
    try {
      const res = await fetch(
        `/api/settings/whitelist?name=${encodeURIComponent(player.name)}`,
        { method: 'DELETE' }
      )
      const body = (await res.json().catch(() => ({}))) as {
        entries?: WhitelistEntry[]
        error?: string
      }
      if (!res.ok) {
        setError(body.error ?? 'ลบผู้เล่นไม่สำเร็จ')
        dialog.toast({ message: body.error ?? 'ลบผู้เล่นไม่สำเร็จ', type: 'error' })
        return
      }

      setEntries(body.entries ?? [])
      dialog.toast({
        message: `นำ "${player.name}" ออกจาก Whitelist แล้ว`,
        type: 'info',
      })
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
      dialog.toast({ message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', type: 'error' })
    } finally {
      setDeletingName(null)
    }
  }

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.name.toLowerCase().includes(q))
  }, [entries, search])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.99 }}
      transition={{ duration: 0.25 }}
      className="rounded-3xl border border-emerald-500/30 bg-emerald-950/15 p-6 shadow-xl space-y-5 backdrop-blur-md"
    >
      {/* ── Section Header ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-emerald-500/20">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 ring-4 ring-emerald-500/10">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[var(--ts-on-surface)]">
                การจัดการรายชื่อ Whitelist (Allowlist)
              </h3>
              <span className="badge border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-mono text-[11px] px-2 py-0.5">
                {entries.length} คน
              </span>
            </div>
            <p className="text-xs text-[var(--ts-on-surface-variant)] mt-0.5">
              เฉพาะผู้เล่นที่มีชื่อในรายการนี้เท่านั้นที่จะได้รับอนุญาตให้เชื่อมต่อเข้าเล่นในเซิร์ฟเวอร์
            </p>
          </div>
        </div>

        {serverRunning && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>ซิงค์แบบเรียลไทม์กับเซิร์ฟเวอร์</span>
          </span>
        )}
      </div>

      {/* ── Error Banner ─────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-between rounded-2xl border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-200"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-1 opacity-70 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Player Form ──────────────────────────────────── */}
      <form onSubmit={handleAddPlayer} className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ts-on-surface-variant)] pointer-events-none">
              <User size={15} />
            </div>
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => {
                setNewPlayerName(e.target.value)
                if (error) setError(null)
              }}
              placeholder="พิมพ์ชื่อ Gamertag ผู้เล่นที่ต้องการอนุญาต (เช่น Steve, Alex)..."
              disabled={submitting}
              className="input w-full text-xs font-mono py-2.5 pl-9 pr-3 rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] focus:border-emerald-500"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--ts-on-surface)] select-none shrink-0 px-1">
            <input
              type="checkbox"
              checked={ignoresLimit}
              onChange={(e) => setIgnoresLimit(e.target.checked)}
              className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
            />
            <span>ข้ามขีดจำกัดผู้เล่น (Ignores Max Limit)</span>
          </label>

          <button
            type="submit"
            disabled={submitting || !newPlayerName.trim()}
            className="btn btn-primary inline-flex items-center justify-center gap-2 text-xs py-2.5 px-4 rounded-xl shadow-lg shrink-0 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <UserPlus size={15} />
            )}
            <span>{submitting ? 'กำลังเพิ่ม...' : 'เพิ่มเข้า Whitelist'}</span>
          </button>
        </div>
      </form>

      {/* ── Player List Section ──────────────────────────────── */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[var(--ts-on-surface)] flex items-center gap-1.5">
            <Users size={14} className="text-emerald-400" />
            <span>รายชื่อผู้เล่นที่ได้รับอนุญาต ({filteredEntries.length})</span>
          </span>

          {entries.length > 5 && (
            <div className="relative w-48">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ts-on-surface-variant)]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ..."
                className="input w-full text-xs py-1.5 pl-8 pr-2 rounded-lg"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-[var(--ts-on-surface-variant)] space-x-2">
            <Loader2 size={16} className="animate-spin text-emerald-400" />
            <span>กำลังโหลดรายชื่อ Whitelist...</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-950/10 p-6 text-center space-y-1.5">
            <p className="text-xs font-medium text-[var(--ts-on-surface)]">
              {search
                ? `ไม่พบผู้เล่นที่ตรงกับ "${search}"`
                : 'ยังไม่มีผู้เล่นใน Whitelist'}
            </p>
            <p className="text-[11px] text-[var(--ts-on-surface-variant)] leading-relaxed">
              {search
                ? 'ลองตรวจสอบตัวสะกดชื่อ Gamertag อีกครั้ง'
                : 'พิมพ์ชื่อ Gamertag ในช่องด้านบนแล้วกด "เพิ่มเข้า Whitelist" เพื่ออนุญาตผู้เล่น'}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-64 overflow-y-auto p-1">
            <AnimatePresence>
              {filteredEntries.map((player) => {
                const isDeleting = deletingName === player.name
                return (
                  <motion.div
                    key={player.name}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-[var(--ts-surface-container)] px-3.5 py-2.5 shadow-sm transition-all hover:border-emerald-500/40 hover:bg-[var(--ts-surface-high)]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0 font-bold text-xs">
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-semibold text-[var(--ts-on-surface)] truncate">
                          {player.name}
                        </p>
                        {player.ignoresPlayerLimit && (
                          <span className="inline-block text-[10px] text-emerald-400 font-medium">
                            ข้ามขีดจำกัด
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleRemovePlayer(player)}
                      title={`นำ ${player.name} ออกจาก Whitelist`}
                      className="p-1.5 rounded-lg text-[var(--ts-on-surface-variant)] hover:text-rose-400 hover:bg-rose-500/15 transition-all shrink-0 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <Loader2 size={14} className="animate-spin text-rose-400" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}
