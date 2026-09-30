'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Terminal, { type TerminalHandle } from './Terminal'
import StatusBadge from './StatusBadge'
import { useServerSocket } from './useServerSocket'

const QUICK_COMMANDS = ['list', 'say สวัสดีจากแดชบอร์ด!', 'help']

export default function ConsoleClient() {
  const termRef = useRef<TerminalHandle>(null)
  const onLog = useCallback((line: string) => termRef.current?.writeLine(line), [])
  const { connected, status, sendCommand } = useServerSocket(onLog)

  const [input, setInput] = useState('')
  const [localHistory, setLocalHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [savedHistory, setSavedHistory] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/bedrock/history?limit=30', { cache: 'no-store' })
      .then((r) => r.json())
      .then((body: { history?: Array<{ command: string }> }) => {
        setSavedHistory((body.history ?? []).map((h) => h.command))
      })
      .catch(() => undefined)
  }, [])

  const submit = async (raw?: string) => {
    const command = (raw ?? input).trim()
    if (!command) return
    setInput('')
    setHistoryIndex(-1)
    setLocalHistory((prev) => [command, ...prev].slice(0, 100))
    const sent = sendCommand(command)
    if (sent) {
      setError(null)
      return
    }
    // สำรอง: ถ้า WebSocket ไม่พร้อม ใช้ REST แทน
    try {
      const res = await fetch('/api/bedrock/command', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(res.ok ? null : (body.error ?? 'ส่งคำสั่งไม่สำเร็จ'))
    } catch {
      setError('ส่งคำสั่งไม่สำเร็จ — เชื่อมต่อไม่ได้')
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.min(historyIndex + 1, localHistory.length - 1)
      if (next >= 0) {
        setHistoryIndex(next)
        setInput(localHistory[next])
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = historyIndex - 1
      setHistoryIndex(next)
      setInput(next >= 0 ? localHistory[next] : '')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold">คอนโซลสด</h1>
        {status && <StatusBadge status={status.status} />}
        <span
          className={`badge ${
            connected
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-slate-500/40 bg-slate-500/10 text-slate-400'
          }`}
        >
          <span className={`h-2 w-2 rounded-full bg-current ${connected ? 'animate-pulse' : ''}`} />
          {connected ? 'เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อ...'}
        </span>
        <button type="button" className="btn btn-sm" onClick={() => termRef.current?.clear()}>
          ล้างหน้าจอ
        </button>
      </div>

      <div className="card p-2">
        <Terminal ref={termRef} className="h-[58vh] w-full overflow-hidden rounded-lg px-2 py-1" />
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <span className="flex items-center pl-2 font-mono text-sm text-emerald-400">$</span>
        <input
          className="input font-mono"
          placeholder='พิมพ์คำสั่ง เช่น list, op ชื่อผู้เล่น, say ทดสอบ (ใส่ / นำหน้าก็ได้)'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary">
          ส่ง
        </button>
      </form>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">คำสั่งด่วน:</span>
        {QUICK_COMMANDS.map((command) => (
          <button key={command} type="button" className="btn btn-sm" onClick={() => void submit(command)}>
            {command}
          </button>
        ))}
      </div>

      {savedHistory.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-300">
            ประวัติคำสั่งล่าสุด ({savedHistory.length})
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {savedHistory.map((command, index) => (
              <button
                key={`${command}-${index}`}
                type="button"
                className="btn btn-sm font-mono"
                onClick={() => void submit(command)}
              >
                {command}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
