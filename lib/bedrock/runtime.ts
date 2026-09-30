import { BedrockProcessManager } from './processManager'
import type { InstallJob, StatusSnapshot, WsServerMessage } from '../types'

// Singleton ของสถานะรันไทม์ทั้งหมด (process manager + install job + ช่องทาง broadcast)
// เก็บบน globalThis เพื่อให้ custom server (server.ts) และ Next.js API routes
// มองเห็น instance เดียวกันแม้อยู่คนละ module graph

export interface BedrockRuntime {
  manager: BedrockProcessManager
  currentJob: InstallJob | null
  broadcast: (msg: WsServerMessage) => void
}

const g = globalThis as unknown as { __bdsRuntime?: BedrockRuntime }

export function getRuntime(): BedrockRuntime {
  if (!g.__bdsRuntime) {
    const runtime: BedrockRuntime = {
      manager: new BedrockProcessManager(),
      currentJob: null,
      broadcast: () => {},
    }
    runtime.manager.setEmit((msg) => runtime.broadcast(msg))
    g.__bdsRuntime = runtime
  }
  return g.__bdsRuntime
}

/** เรียกจาก server.ts เมื่อ WebSocket server พร้อม */
export function setBroadcast(fn: (msg: WsServerMessage) => void): void {
  const runtime = getRuntime()
  runtime.broadcast = fn
  runtime.manager.setEmit(fn)
}

export function getRuntimeSnapshot(): {
  status: StatusSnapshot
  logs: string[]
  job: InstallJob | null
} {
  const runtime = getRuntime()
  return {
    status: runtime.manager.getSnapshot(),
    logs: runtime.manager.getRecentLogs(300),
    job: runtime.currentJob,
  }
}
