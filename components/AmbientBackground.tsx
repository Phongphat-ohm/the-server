'use client'

import { motion } from 'framer-motion'

export default function AmbientBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* ── Subtle Digital Grid Overlay ───────────────────────── */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(143, 205, 255, 0.4) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(143, 205, 255, 0.4) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* ── Ambient Radial Gradient Base ──────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 0%, rgba(26, 77, 109, 0.25) 0%, transparent 60%),
            radial-gradient(circle at 100% 100%, rgba(26, 109, 77, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 0% 100%, rgba(6, 147, 227, 0.12) 0%, transparent 50%)
          `,
        }}
      />

      {/* ── Glowing Animated Orb 1 (Sky Blue - Primary) ───────── */}
      <motion.div
        className="absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-40 blur-[130px]"
        style={{
          background: 'radial-gradient(circle, #8fcdff 0%, #1a4d6d 70%, transparent 100%)',
        }}
        animate={{
          x: [0, 80, -40, 0],
          y: [0, 60, 30, 0],
          scale: [1, 1.15, 0.95, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* ── Glowing Animated Orb 2 (Emerald - Tertiary) ────────── */}
      <motion.div
        className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full opacity-30 blur-[140px]"
        style={{
          background: 'radial-gradient(circle, #7bdcb5 0%, #1a6d4d 70%, transparent 100%)',
        }}
        animate={{
          x: [0, -70, 30, 0],
          y: [0, -50, 40, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* ── Glowing Animated Orb 3 (Deep Space Cyan - Accent) ──── */}
      <motion.div
        className="absolute -bottom-40 left-1/4 h-[30rem] w-[30rem] rounded-full opacity-25 blur-[150px]"
        style={{
          background: 'radial-gradient(circle, #0693e3 0%, #0055a8 70%, transparent 100%)',
        }}
        animate={{
          x: [0, 50, -60, 0],
          y: [0, -40, 20, 0],
          scale: [0.95, 1.1, 1, 0.95],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* ── Vignette Rim ──────────────────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--ts-surface)] via-transparent to-[var(--ts-surface)]/40 opacity-80" />
    </div>
  )
}
