'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe,
  Copy,
  Check,
  ExternalLink,
  Wifi,
  Server,
  Settings,
  RefreshCw,
  Info,
  Sparkles,
  Share2,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { dialog } from '@/components/dialog'
import type { ConnectionInfo, ServerStatus } from '@/lib/types'

interface JoinServerCardProps {
  serverStatus?: ServerStatus
  role?: string
}

export default function JoinServerCard({ serverStatus = 'stopped', role = 'admin' }: JoinServerCardProps) {
  const [info, setInfo] = useState<ConnectionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [domainInput, setDomainInput] = useState('')
  const [savingDomain, setSavingDomain] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchConnection = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/settings/connection', { cache: 'no-store' })
      if (res.ok) {
        const data = (await res.json()) as ConnectionInfo
        setInfo(data)
        setDomainInput(data.domain ?? '')
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
      if (isRefresh) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchConnection()
  }, [fetchConnection])

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      dialog.toast({
        message: `คัดลอกแล้ว: ${text}`,
        type: 'success',
        duration: 2500,
      })
      setTimeout(() => setCopiedKey(null), 2500)
    } catch {
      dialog.alert({
        title: 'คัดลอกข้อมูล',
        message: text,
        type: 'info',
      })
    }
  }

  const handleSaveDomain = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (role !== 'admin') return

    setSavingDomain(true)
    try {
      const res = await fetch('/api/settings/connection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain: domainInput }),
      })
      const data = (await res.json()) as { ok?: boolean; message?: string; connection?: ConnectionInfo; error?: string }

      if (res.ok && data.connection) {
        setInfo(data.connection)
        setDomainInput(data.connection.domain ?? '')
        setShowConfig(false)
        dialog.toast({
          message: data.message ?? 'อัปเดต Domain สำหรับเข้าเล่นเรียบร้อยแล้ว',
          type: 'success',
        })
      } else {
        dialog.alert({
          title: 'บันทึกไม่สำเร็จ',
          message: data.error ?? 'เกิดข้อผิดพลาดในการบันทึก Domain',
          type: 'error',
        })
      }
    } catch (err) {
      dialog.alert({
        title: 'ข้อผิดพลาดการเชื่อมต่อ',
        message: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้: ' + (err instanceof Error ? err.message : String(err)),
        type: 'error',
      })
    } finally {
      setSavingDomain(false)
    }
  }

  const isRunning = serverStatus === 'running'
  const fullAddress = info ? `${info.primaryHost}:${info.serverPort}` : ''

  return (
    <div className="card p-6 rounded-3xl border border-[var(--ts-outline-variant)] shadow-lg relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 rounded-full bg-[var(--ts-primary)]/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--ts-outline-variant)]/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--ts-primary-container)] text-[var(--ts-primary)] shadow-sm">
            <Share2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--ts-on-surface)]">
                ข้อมูลการเชื่อมต่อเข้าเล่น (Join Server)
              </h2>
              <span
                className={`badge text-[11px] font-semibold py-0.5 px-2.5 ${
                  isRunning
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                    : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                {isRunning ? 'พร้อมเชื่อมต่อ' : 'เซิร์ฟเวอร์ยังไม่เริ่ม'}
              </span>
            </div>
            <p className="text-xs text-[var(--ts-on-surface-variant)] mt-0.5">
              IP และ Port สำหรับแชร์ให้ผู้เล่นนำไปกรอกในเกม Minecraft Bedrock
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {role === 'admin' && (
            <button
              type="button"
              onClick={() => setShowConfig((prev) => !prev)}
              className={`btn btn-sm inline-flex items-center gap-1.5 text-xs rounded-xl transition-all ${
                showConfig
                  ? 'border-[var(--ts-primary)] bg-[var(--ts-primary-container)] text-[var(--ts-primary)]'
                  : 'border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)]'
              }`}
              title="ตั้งค่า Domain / IP เข้าเล่น"
            >
              <Settings size={13} className={showConfig ? 'rotate-90 transition-transform' : ''} />
              <span>{showConfig ? 'ปิดการตั้งค่า' : 'ตั้งค่า Domain'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void fetchConnection(true)}
            disabled={refreshing}
            className="btn btn-sm inline-flex items-center gap-1 text-xs rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)]"
            title="รีเฟรชข้อมูล IP"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Admin Domain Configuration Panel (Animated) */}
      <AnimatePresence>
        {showConfig && role === 'admin' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <form
              onSubmit={handleSaveDomain}
              className="mt-4 p-4 rounded-2xl border border-[var(--ts-primary)]/30 bg-[var(--ts-primary-container)]/10 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--ts-primary)]">
                  <Globe size={15} />
                  <span>กำหนด Domain หรือ IP หลักสำหรับให้ผู้เล่นเชื่อมต่อ</span>
                </div>
                {info?.domain && (
                  <button
                    type="button"
                    onClick={() => {
                      setDomainInput('')
                      setTimeout(() => void handleSaveDomain(), 50)
                    }}
                    disabled={savingDomain}
                    className="text-[11px] text-[var(--ts-error)] hover:underline"
                  >
                    ล้างการตั้งค่า (ใช้ IP อัตโนมัติ)
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="เช่น play.myserver.com หรือ 103.xxx.xxx.xxx"
                    className="input w-full font-mono text-xs py-2 px-3 rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] focus:border-[var(--ts-primary)]"
                    disabled={savingDomain}
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingDomain}
                  className="btn btn-primary btn-sm flex items-center justify-center gap-1.5 rounded-xl shrink-0 px-4 text-xs font-semibold"
                >
                  {savingDomain ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>บันทึก Domain</span>
                    </>
                  )}
                </button>
              </div>

              {/* Suggestions / Shortcuts */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-[var(--ts-on-surface-variant)]">
                <span className="font-semibold text-[var(--ts-outline)]">แนะนำคลิกเลือก:</span>
                {info?.publicIp && (
                  <button
                    type="button"
                    onClick={() => setDomainInput(info.publicIp!)}
                    className="rounded-lg px-2 py-0.5 border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] hover:border-[var(--ts-primary)] hover:text-[var(--ts-primary)] transition-colors font-mono"
                  >
                    🌐 Public IP: {info.publicIp}
                  </button>
                )}
                {info?.localIps.map((ip) => (
                  <button
                    key={ip}
                    type="button"
                    onClick={() => setDomainInput(ip)}
                    className="rounded-lg px-2 py-0.5 border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] hover:border-[var(--ts-primary)] hover:text-[var(--ts-primary)] transition-colors font-mono"
                  >
                    🏠 LAN: {ip}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-[var(--ts-on-surface-variant)]/80 leading-relaxed">
                💡 <strong>คำแนะนำ:</strong> หากคุณมี Domain ของตนเอง (เช่น Cloudflare, No-IP หรือ Namecheap) ให้สร้าง DNS Record ชนิด <strong>A</strong> ชี้มายัง Public IP ของเครื่องนี้ แล้วระบุชื่อโดเมนในช่องด้านบนได้เลย
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Connection Display Cards */}
      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--ts-on-surface-variant)]">
          <Loader2 size={16} className="animate-spin text-[var(--ts-primary)]" />
          <span>กำลังโหลดข้อมูลเครือข่าย...</span>
        </div>
      ) : info ? (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Primary Host Card */}
            <div className="md:col-span-7 flex flex-col justify-between p-4 rounded-2xl border border-[var(--ts-outline-variant)]/80 bg-[var(--ts-surface-low)] hover:border-[var(--ts-primary)]/40 transition-colors">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--ts-on-surface-variant)] flex items-center gap-1.5">
                    <Globe size={13} className="text-[var(--ts-primary)]" />
                    Server Address / IP / Domain
                  </span>
                  <span className="badge text-[10px] font-medium border-[var(--ts-primary)]/30 bg-[var(--ts-primary-container)]/30 text-[var(--ts-primary)]">
                    {info.domain
                      ? 'Custom Domain'
                      : info.publicIp === info.primaryHost
                      ? 'Public IP'
                      : 'Local LAN'}
                  </span>
                </div>
                <div className="font-mono text-lg font-extrabold text-[var(--ts-on-surface)] tracking-tight truncate select-all">
                  {info.primaryHost}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[var(--ts-outline-variant)]/50 flex items-center justify-between">
                <span className="text-[11px] text-[var(--ts-outline)]">
                  {info.domain ? 'โดเมนที่แอดมินกำหนดไว้' : 'ตรวจพบอัตโนมัติจากเครือข่าย'}
                </span>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(info.primaryHost, 'host')}
                  className="btn btn-sm text-xs inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] hover:bg-[var(--ts-surface-highest)] text-[var(--ts-on-surface)]"
                >
                  {copiedKey === 'host' ? (
                    <>
                      <Check size={12} className="text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>คัดลอก IP/Domain</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Port Card */}
            <div className="md:col-span-5 flex flex-col justify-between p-4 rounded-2xl border border-[var(--ts-outline-variant)]/80 bg-[var(--ts-surface-low)] hover:border-[var(--ts-primary)]/40 transition-colors">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--ts-on-surface-variant)] flex items-center gap-1.5">
                    <Server size={13} className="text-[var(--ts-tertiary)]" />
                    Port (พอร์ต)
                  </span>
                  <span className="badge text-[10px] font-medium border-slate-500/30 bg-slate-500/10 text-slate-300">
                    IPv4 / IPv6
                  </span>
                </div>
                <div className="font-mono text-lg font-extrabold text-[var(--ts-tertiary)] tracking-tight truncate select-all">
                  {info.serverPort}
                  {info.serverPortV6 && info.serverPortV6 !== info.serverPort ? (
                    <span className="text-xs font-normal text-[var(--ts-on-surface-variant)] ml-2">
                      (v6: {info.serverPortV6})
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[var(--ts-outline-variant)]/50 flex items-center justify-between">
                <span className="text-[11px] text-[var(--ts-outline)]">
                  ค่ามาตรฐาน Bedrock
                </span>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(String(info.serverPort), 'port')}
                  className="btn btn-sm text-xs inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] hover:bg-[var(--ts-surface-highest)] text-[var(--ts-on-surface)]"
                >
                  {copiedKey === 'port' ? (
                    <>
                      <Check size={12} className="text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>คัดลอก Port</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions & 1-Click Join Bar */}
          <div className="p-3.5 rounded-2xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xs font-semibold text-[var(--ts-on-surface-variant)] shrink-0">
                ที่อยู่เต็ม:
              </span>
              <code className="px-2.5 py-1 rounded-lg bg-[var(--ts-surface-dim)] border border-[var(--ts-outline-variant)] text-xs font-mono font-bold text-[var(--ts-primary)] select-all truncate">
                {fullAddress}
              </code>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copyToClipboard(fullAddress, 'full')}
                className="btn btn-sm inline-flex items-center gap-1.5 text-xs rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] hover:bg-[var(--ts-surface-highest)] text-[var(--ts-on-surface)]"
              >
                {copiedKey === 'full' ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">คัดลอกที่อยู่เต็มแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>คัดลอก Address:Port</span>
                  </>
                )}
              </button>

              <a
                href={info.quickJoinUrl}
                className="btn btn-primary btn-sm inline-flex items-center gap-1.5 text-xs rounded-xl shadow-md font-semibold hover:shadow-lg transition-all"
                title="เปิดแอป Minecraft และเพิ่มเซิร์ฟเวอร์อัตโนมัติ"
              >
                <Sparkles size={13} />
                <span>1-Click Join เข้าเกม</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Network Details / How to Join Expandable Info */}
          <details className="group rounded-2xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)]/50 transition-colors">
            <summary className="flex items-center justify-between p-3.5 cursor-pointer text-xs font-semibold text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)] select-none">
              <div className="flex items-center gap-2">
                <Info size={14} className="text-[var(--ts-primary)]" />
                <span>วิธีนำ IP ไปเชื่อมต่อในเกม Minecraft Bedrock & รายการ IP อื่นๆ</span>
              </div>
              <span className="text-[10px] text-[var(--ts-outline)] group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>

            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[var(--ts-outline-variant)]/40 text-xs text-[var(--ts-on-surface-variant)]">
              {/* Step-by-Step Instructions */}
              <div className="space-y-1">
                <div className="font-bold text-[var(--ts-on-surface)]">
                  ขั้นตอนการเข้าร่วมเซิร์ฟเวอร์ในเกม (มือถือ, คอนโซล, หรือ PC):
                </div>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-[var(--ts-on-surface-variant)] pl-1">
                  <li>เปิดเกม Minecraft Bedrock Edition แล้วกดปุ่ม <strong>เล่น (Play)</strong></li>
                  <li>ไปที่แท็บ <strong>เซิร์ฟเวอร์ (Servers)</strong> แล้วเลื่อนลงด้านล่างสุด</li>
                  <li>กด <strong>เพิ่มเซิร์ฟเวอร์ (Add Server)</strong></li>
                  <li>
                    ตั้งชื่อเซิร์ฟเวอร์ตามต้องการ, กรอกที่อยู่เซิร์ฟเวอร์: <code className="font-mono text-[var(--ts-primary)] bg-[var(--ts-surface-dim)] px-1 py-0.5 rounded">{info.primaryHost}</code>, และ Port: <code className="font-mono text-[var(--ts-tertiary)] bg-[var(--ts-surface-dim)] px-1 py-0.5 rounded">{info.serverPort}</code>
                  </li>
                  <li>กด <strong>บันทึก (Save)</strong> หรือ <strong>เล่น (Play)</strong> เพื่อเข้าสู่โลกได้ทันที!</li>
                </ol>
              </div>

              {/* IP Table / Overview */}
              <div className="pt-2 border-t border-[var(--ts-outline-variant)]/40">
                <div className="font-bold text-[var(--ts-on-surface)] mb-1.5">
                  IP ที่ตรวจพบในเครื่องนี้:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-[var(--ts-surface-dim)] border border-[var(--ts-outline-variant)]/60">
                    <div className="font-semibold text-[var(--ts-on-surface)] flex items-center gap-1">
                      <Wifi size={12} className="text-emerald-400" />
                      <span>IP ในวงแลน (Local LAN):</span>
                    </div>
                    <div className="font-mono text-[var(--ts-primary)] mt-0.5">
                      {info.localIps.join(', ') || '127.0.0.1'}
                    </div>
                    <div className="text-[10px] text-[var(--ts-outline)] mt-0.5">
                      ใช้เมื่อต่อ Wi-Fi เดียวกันในบ้าน
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-[var(--ts-surface-dim)] border border-[var(--ts-outline-variant)]/60">
                    <div className="font-semibold text-[var(--ts-on-surface)] flex items-center gap-1">
                      <Globe size={12} className="text-sky-400" />
                      <span>IP สาธารณะ (Public WAN):</span>
                    </div>
                    <div className="font-mono text-sky-300 mt-0.5">
                      {info.publicIp || 'ไม่สามารถตรวจจับได้ (กรุณาดูที่เร้าเตอร์)'}
                    </div>
                    <div className="text-[10px] text-[var(--ts-outline)] mt-0.5">
                      ใช้สำหรับเล่นกับเพื่อนผ่านอินเทอร์เน็ต (ต้อง Forward Port 19132 UDP)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  )
}
