import type { ServerStatus } from '@/lib/types'

const STATUS_META: Record<ServerStatus, { label: string; className: string; pulse?: boolean }> = {
  not_installed: { label: 'ยังไม่ติดตั้ง', className: 'border-zinc-600/50 bg-zinc-600/10 text-zinc-400' },
  stopped: { label: 'หยุดทำงาน', className: 'border-slate-500/50 bg-slate-500/10 text-slate-300' },
  starting: { label: 'กำลังเริ่ม...', className: 'border-amber-500/50 bg-amber-500/10 text-amber-300', pulse: true },
  running: { label: 'กำลังทำงาน', className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300', pulse: true },
  stopping: { label: 'กำลังหยุด...', className: 'border-amber-500/50 bg-amber-500/10 text-amber-300', pulse: true },
  crashed: { label: 'ล้มเหลว', className: 'border-red-500/50 bg-red-500/10 text-red-300' },
}

export default function StatusBadge({ status }: { status: ServerStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.stopped
  return (
    <span className={`badge ${meta.className}`}>
      <span className={`h-2 w-2 rounded-full bg-current ${meta.pulse ? 'animate-pulse' : ''}`} />
      {meta.label}
    </span>
  )
}
