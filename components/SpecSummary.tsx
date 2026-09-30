import type { SystemSpecs } from '@/lib/system/specs'
import { CheckCircle2, AlertTriangle, XCircle, Cpu, HardDrive, Server } from 'lucide-react'

function ScoreRing({ score }: { score: number }) {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  const color =
    score >= 85
      ? '#7bdcb5'
      : score >= 65
        ? '#8fcdff'
        : score >= 45
          ? '#f59e0b'
          : '#cf2e2e'

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--ts-outline-variant)"
          strokeWidth="8"
          opacity="0.4"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-mono text-[var(--ts-on-surface)]">{score}</span>
        <span className="text-[10px] uppercase font-semibold tracking-wider text-[var(--ts-on-surface-variant)]">
          / 100
        </span>
      </div>
    </div>
  )
}

export default function SpecSummary({ specs }: { specs: SystemSpecs }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6 rounded-2xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] p-5">
        <ScoreRing score={specs.score} />
        <div className="min-w-0 flex-1 text-center sm:text-left space-y-1.5">
          <div className="text-lg font-bold text-[var(--ts-on-surface)]">{specs.grade}</div>
          <p className="text-xs text-[var(--ts-on-surface-variant)] leading-relaxed">
            เครื่องนี้รองรับผู้เล่นพร้อมกันประมาณ{' '}
            <span className="font-bold text-[var(--ts-tertiary)]">{specs.recommendedPlayers} คน</span>{' '}
            (ประมาณการจาก RAM ว่าง — ประสิทธิภาพจริงขึ้นกับ addons และกิจกรรมในเกม)
          </p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
            <span className="badge border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] text-[var(--ts-on-surface-variant)] text-[10px]">
              {specs.platformLabel}
            </span>
            <span className="badge border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] text-[var(--ts-on-surface-variant)] text-[10px]">
              {specs.arch}
            </span>
            <span className="badge border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] text-[var(--ts-on-surface-variant)] text-[10px]">
              Node {specs.nodeVersion}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {/* CPU */}
        <div className="rounded-2xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ts-on-surface-variant)]">
            <Cpu size={13} className="text-[var(--ts-primary)]" />
            <span>ซีพียู (CPU)</span>
          </div>
          <div className="truncate text-sm font-bold text-[var(--ts-on-surface)]" title={specs.cpu.brand}>
            {specs.cpu.brand || 'ไม่ทราบชื่อ'}
          </div>
          <div className="text-xs font-mono text-[var(--ts-on-surface-variant)]">
            {specs.cpu.cores} threads / {specs.cpu.physicalCores} cores
            {specs.cpu.speedGhz ? ` @ ${specs.cpu.speedGhz} GHz` : ''}
          </div>
        </div>

        {/* RAM */}
        <div className="rounded-2xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ts-on-surface-variant)]">
            <Server size={13} className="text-[var(--ts-tertiary)]" />
            <span>หน่วยความจำ (RAM)</span>
          </div>
          <div className="text-sm font-bold text-[var(--ts-on-surface)]">
            {specs.mem.freeGb} GB <span className="text-xs font-normal text-[var(--ts-on-surface-variant)]">ว่างจาก {specs.mem.totalGb} GB</span>
          </div>
          <div className="text-xs text-[var(--ts-on-surface-variant)]">
            เกณฑ์: ขั้นต่ำ 2 GB • แนะนำ 4 GB+
          </div>
        </div>

        {/* Disk */}
        <div className="rounded-2xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ts-on-surface-variant)]">
            <HardDrive size={13} className="text-amber-400" />
            <span>พื้นที่ดิสก์</span>
          </div>
          <div className="text-sm font-bold text-[var(--ts-on-surface)]">
            {specs.disk ? `${specs.disk.freeGb} GB ว่าง` : 'ตรวจไม่ได้'}
            {specs.disk ? <span className="text-xs font-normal text-[var(--ts-on-surface-variant)]"> / {specs.disk.totalGb} GB</span> : null}
          </div>
          <div className="text-xs text-[var(--ts-on-surface-variant)]">
            {specs.disk ? `ไดรฟ์ (${specs.disk.mount})` : 'ลองรีเฟรชอีกครั้ง'}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--ts-on-surface-variant)]">
          ผลการตรวจสอบความพร้อม
        </h3>
        <div className="divide-y divide-[var(--ts-outline-variant)]/60 overflow-hidden rounded-2xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)]">
          {specs.checks.map((check) => (
            <div key={check.id} className="flex items-start gap-3 p-3.5 transition-colors hover:bg-[var(--ts-surface-high)]/40">
              <span className="mt-0.5 shrink-0">
                {check.status === 'pass' && <CheckCircle2 size={16} className="text-[var(--ts-tertiary)]" />}
                {check.status === 'warn' && <AlertTriangle size={16} className="text-amber-400" />}
                {check.status === 'fail' && <XCircle size={16} className="text-[var(--ts-error)]" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--ts-on-surface)]">{check.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--ts-on-surface-variant)]">{check.value}</span>
                    <span
                      className={`badge text-[10px] py-0.5 px-2 ${
                        check.status === 'pass'
                          ? 'border-[var(--ts-tertiary)]/30 bg-[var(--ts-tertiary-container)]/30 text-[var(--ts-tertiary)]'
                          : check.status === 'warn'
                            ? 'border-amber-500/30 bg-amber-500/20 text-amber-300'
                            : 'border-[var(--ts-error)]/30 bg-[var(--ts-error-container)]/30 text-[#ffb4ab]'
                      }`}
                    >
                      {check.status === 'pass' ? 'ผ่าน' : check.status === 'warn' ? 'ควรระวัง' : 'ไม่ผ่าน'}
                    </span>
                  </div>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--ts-on-surface-variant)]">{check.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
