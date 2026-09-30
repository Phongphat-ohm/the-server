'use client'

import { motion } from 'framer-motion'
import type { ServerStatus } from '@/lib/types'

const STATUS_META: Record<
  ServerStatus,
  {
    label: string
    dotColor: string
    textColor: string
    bgColor: string
    borderColor: string
    pulse?: boolean
  }
> = {
  not_installed: {
    label: 'ยังไม่ติดตั้ง',
    dotColor: '#8e9192',
    textColor: '#c4c7c8',
    bgColor: 'rgba(68, 71, 72, 0.25)',
    borderColor: 'rgba(142, 145, 146, 0.4)',
  },
  stopped: {
    label: 'หยุดทำงาน',
    dotColor: '#8e9192',
    textColor: '#c4c7c8',
    bgColor: 'rgba(68, 71, 72, 0.25)',
    borderColor: 'rgba(142, 145, 146, 0.4)',
  },
  starting: {
    label: 'กำลังเริ่ม...',
    dotColor: '#8fcdff',
    textColor: '#8fcdff',
    bgColor: 'rgba(26, 77, 109, 0.4)',
    borderColor: 'rgba(143, 205, 255, 0.4)',
    pulse: true,
  },
  running: {
    label: 'กำลังทำงาน',
    dotColor: '#7bdcb5',
    textColor: '#7bdcb5',
    bgColor: 'rgba(26, 109, 77, 0.35)',
    borderColor: 'rgba(123, 220, 181, 0.4)',
    pulse: true,
  },
  stopping: {
    label: 'กำลังหยุด...',
    dotColor: '#ffb4ab',
    textColor: '#ffb4ab',
    bgColor: 'rgba(155, 0, 0, 0.25)',
    borderColor: 'rgba(207, 46, 46, 0.4)',
    pulse: true,
  },
  crashed: {
    label: 'ล้มเหลว',
    dotColor: '#cf2e2e',
    textColor: '#ffb4ab',
    bgColor: 'rgba(155, 0, 0, 0.35)',
    borderColor: 'rgba(207, 46, 46, 0.5)',
  },
}

export default function StatusBadge({ status }: { status: ServerStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.stopped
  return (
    <span
      className="badge transition-colors"
      style={{
        backgroundColor: meta.bgColor,
        borderColor: meta.borderColor,
        color: meta.textColor,
      }}
    >
      {meta.pulse ? (
        <span className="relative flex h-2 w-2 items-center justify-center">
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: meta.dotColor }}
            animate={{ scale: [1, 2, 1], opacity: [0.75, 0, 0.75] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: meta.dotColor }}
          />
        </span>
      ) : (
        <span
          className="inline-flex h-2 w-2 rounded-full"
          style={{ backgroundColor: meta.dotColor }}
        />
      )}
      <span>{meta.label}</span>
    </span>
  )
}
