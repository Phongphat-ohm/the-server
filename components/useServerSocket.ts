'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { InstallJob, StatusSnapshot, WsServerMessage } from '@/lib/types'

export interface ServerSocket {
  connected: boolean
  status: StatusSnapshot | null
  job: InstallJob | null
  sendCommand: (command: string) => boolean
}

/** เชื่อมต่อ WebSocket ที่ path /ws พร้อมเล่น log ย้อนหลังจาก hello และ reconnect อัตโนมัติ */
export function useServerSocket(onLog?: (line: string) => void): ServerSocket {
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<StatusSnapshot | null>(null)
  const [job, setJob] = useState<InstallJob | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const onLogRef = useRef(onLog)
  onLogRef.current = onLog

  useEffect(() => {
    let closed = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      if (closed) return
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        if (!closed) retryTimer = setTimeout(connect, 2000)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (event: MessageEvent<string>) => {
        let msg: WsServerMessage
        try {
          msg = JSON.parse(event.data) as WsServerMessage
        } catch {
          return
        }
        switch (msg.t) {
          case 'hello':
            setStatus(msg.status)
            setJob(msg.job ?? null)
            for (const line of msg.logs) onLogRef.current?.(line)
            break
          case 'status':
            setStatus(msg.status)
            break
          case 'log':
            for (const line of msg.lines) onLogRef.current?.(line)
            break
          case 'install':
            setJob(msg.job ?? null)
            break
          default:
            break
        }
      }
    }

    connect()
    return () => {
      closed = true
      if (retryTimer) clearTimeout(retryTimer)
      wsRef.current?.close()
    }
  }, [])

  const sendCommand = useCallback((command: string): boolean => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: 'input', command }))
      return true
    }
    return false
  }, [])

  return { connected, status, job, sendCommand }
}
