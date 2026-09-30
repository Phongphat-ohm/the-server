'use client'

import '@xterm/xterm/css/xterm.css'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { Terminal as XTermTerminal } from '@xterm/xterm'
import type { FitAddon as XTermFitAddon } from '@xterm/addon-fit'

export interface TerminalHandle {
  writeLine: (line: string) => void
  clear: () => void
  focus: () => void
}

function writeColorized(term: XTermTerminal, line: string): void {
  if (/ERROR|FAILED|FATAL/i.test(line)) {
    term.writeln(`\x1b[31m${line}\x1b[0m`)
  } else if (/WARN/i.test(line)) {
    term.writeln(`\x1b[33m${line}\x1b[0m`)
  } else if (line.startsWith('[Dashboard]')) {
    term.writeln(`\x1b[36m${line}\x1b[0m`)
  } else {
    term.writeln(line)
  }
}

const Terminal = forwardRef<TerminalHandle, { className?: string }>(function Terminal({ className }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<{ term: XTermTerminal; fit: XTermFitAddon } | null>(null)

  useEffect(() => {
    let disposed = false
    let observer: ResizeObserver | null = null
    let resizeListener: (() => void) | null = null

    void (async () => {
      const [{ Terminal: TerminalCtor }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
      ])
      if (disposed || !containerRef.current) return
      const term = new TerminalCtor({
        convertEol: false,
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
        scrollback: 5000,
        disableStdin: true,
        theme: {
          background: '#05070d',
          foreground: '#c9d6e8',
          cursor: '#22c55e',
          selectionBackground: '#1d4ed855',
        },
      })
      const fit = new FitAddon()
      term.loadAddon(fit)
      term.open(containerRef.current)
      try {
        fit.fit()
      } catch {
        // ยังไม่มีขนาด — ข้ามไปก่อน
      }
      term.writeln('\x1b[36m[Dashboard] เชื่อมต่อคอนโซลแล้ว — รอบันทึกจากเซิร์ฟเวอร์...\x1b[0m')
      termRef.current = { term, fit }

      observer = new ResizeObserver(() => {
        try {
          fit.fit()
        } catch {
          // container ถูกซ่อนชั่วคราว
        }
      })
      observer.observe(containerRef.current)
      resizeListener = () => {
        try {
          fit.fit()
        } catch {
          // ข้าม
        }
      }
      window.addEventListener('resize', resizeListener)
    })()

    return () => {
      disposed = true
      if (resizeListener) window.removeEventListener('resize', resizeListener)
      observer?.disconnect()
      termRef.current?.term.dispose()
      termRef.current = null
    }
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      writeLine: (line: string) => {
        const current = termRef.current
        if (current) writeColorized(current.term, line)
      },
      clear: () => termRef.current?.term.clear(),
      focus: () => termRef.current?.term.focus(),
    }),
    []
  )

  return <div ref={containerRef} className={className} />
})

export default Terminal
