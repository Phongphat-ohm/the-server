import type { SystemSpecs } from '@/lib/system/specs'

const STATUS_DOT: Record<string, string> = {
  pass: 'bg-emerald-400',
  warn: 'bg-amber-400',
  fail: 'bg-red-400',
}

const STATUS_TEXT: Record<string, string> = {
  pass: 'ผ่าน',
  warn: 'ควรระวัง',
  fail: 'ไม่ผ่าน',
}

function ScoreRing({ score }: { score: number }) {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  const color = score >= 85 ? '#22c55e' : score >= 65 ? '#84cc16' : score >= 45 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#1f2a3d" strokeWidth="8" />
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
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">/ 100</span>
      </div>
    </div>
  )
}

export default function SpecSummary({ specs }: { specs: SystemSpecs }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <ScoreRing score={specs.score} />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="text-lg font-bold">{specs.grade}</div>
          <p className="mt-1 text-sm text-slate-400">
            เครื่องนี้รองรับผู้เล่นพร้อมกันประมาณ{' '}
            <span className="font-semibold text-emerald-300">{specs.recommendedPlayers} คน</span>{' '}
            (ประมาณการจาก RAM ว่าง — ขึ้นกับ addons และกิจกรรมในเกมด้วย)
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {specs.platformLabel} · {specs.arch} · Node {specs.nodeVersion}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#1f2a3d] bg-[#0b1220] p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">CPU</div>
          <div className="truncate text-sm font-semibold" title={specs.cpu.brand}>
            {specs.cpu.brand || 'ไม่ทราบชื่อ'}
          </div>
          <div className="text-xs text-slate-400">
            {specs.cpu.cores} threads / {specs.cpu.physicalCores} cores
            {specs.cpu.speedGhz ? ` @ ${specs.cpu.speedGhz} GHz` : ''}
          </div>
        </div>
        <div className="rounded-xl border border-[#1f2a3d] bg-[#0b1220] p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">RAM</div>
          <div className="text-sm font-semibold">
            {specs.mem.totalGb} GB ทั้งหมด / {specs.mem.freeGb} GB ว่าง
          </div>
          <div className="text-xs text-slate-400">เกณฑ์: ขั้นต่ำ 2 GB · แนะนำ 4 GB+</div>
        </div>
        <div className="rounded-xl border border-[#1f2a3d] bg-[#0b1220] p-3">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">ดิสก์ (พื้นที่ติดตั้ง)</div>
          <div className="text-sm font-semibold">
            {specs.disk ? `${specs.disk.freeGb} GB ว่าง / ${specs.disk.totalGb} GB` : 'ตรวจไม่ได้'}
          </div>
          <div className="text-xs text-slate-400">{specs.disk ? `(${specs.disk.mount})` : 'ลองรีเฟรชอีกครั้ง'}</div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">รายการตรวจสอบ</h3>
        <div className="divide-y divide-[#1b2536] overflow-hidden rounded-xl border border-[#1f2a3d]">
          {specs.checks.map((check) => (
            <div key={check.id} className="flex items-start gap-3 bg-[#0b1220]/60 px-4 py-3">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[check.status] ?? 'bg-slate-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{check.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{check.value}</span>
                    <span
                      className={`badge ${
                        check.status === 'pass'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : check.status === 'warn'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                            : 'border-red-500/40 bg-red-500/10 text-red-300'
                      }`}
                    >
                      {STATUS_TEXT[check.status]}
                    </span>
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{check.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
