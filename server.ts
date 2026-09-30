import './lib/env'
import { createServer, type IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import next from 'next'
import { WebSocketServer, WebSocket } from 'ws'
import { initDb } from './lib/db'
import { SESSION_COOKIE, validateSessionToken } from './lib/session'
import { getRuntime, getRuntimeSnapshot, setBroadcast } from './lib/bedrock/runtime'

// Custom Server: Next.js Request Handler + WebSocket Server ใน process เดียวกัน
// ทำให้จัดการ persistent subprocess (bedrock_server) และสตรีม log แบบ real-time ได้

const port = Number(process.env.PORT ?? 3000)
const hostname = process.env.HOST ?? '0.0.0.0'
const dev = process.env.NODE_ENV !== 'production'

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}

async function main(): Promise<void> {
  await initDb()

  const app = next({ dev, hostname, port })
  const handle = app.getRequestHandler()
  await app.prepare()

  const runtime = getRuntime()
  const server = createServer((req, res) => {
    void handle(req, res)
  })

  const wss = new WebSocketServer({ noServer: true })
  const broadcast = (msg: unknown): void => {
    const payload = JSON.stringify(msg)
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload)
    }
  }
  setBroadcast(broadcast)

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    let pathname = '/'
    try {
      pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    } catch {
      // URL มีปัญหา — ให้ใช้ค่าเริ่มต้น
    }
    if (pathname === '/ws') {
      const cookies = parseCookies(req.headers.cookie)
      const token = cookies[SESSION_COOKIE]
      const user = token ? validateSessionToken(token) : null
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
      return
    }
    // เส้นทางอื่นของ Next.js เอง (เช่น /_next/webpack-hmr ในโหมด dev) — ไม่แตะ
    if (pathname.startsWith('/_next/')) return
    socket.destroy()
  })

  wss.on('connection', (ws: WebSocket) => {
    ws.send(JSON.stringify({ t: 'hello', ...getRuntimeSnapshot() }))
    ws.on('message', (raw: unknown) => {
      try {
        const msg = JSON.parse(String(raw)) as { t?: string; command?: unknown }
        if (msg.t === 'input' && typeof msg.command === 'string') {
          try {
            runtime.manager.sendCommand(msg.command, 'console')
          } catch (err) {
            ws.send(JSON.stringify({ t: 'error', message: err instanceof Error ? err.message : String(err) }))
          }
        } else if (msg.t === 'ping') {
          ws.send(JSON.stringify({ t: 'pong' }))
        }
      } catch {
        // ข้อความที่ไม่ใช่ JSON — ข้าม
      }
    })
  })

  server.on('error', (err) => {
    console.error('> เปิด HTTP server ไม่สำเร็จ:', err instanceof Error ? err.message : err)
    process.exit(1)
  })

  server.listen(port, hostname, () => {
    const displayHost = hostname === '0.0.0.0' ? 'localhost' : hostname
    console.log('')
    console.log('> ============================================================')
    console.log('>  Minecraft Bedrock Server Dashboard')
    console.log(`>  เปิดใช้งานที่:  http://${displayHost}:${port}`)
    console.log(`>  โหมด: ${dev ? 'development' : 'production'} | Node ${process.version} | ${process.platform}`)
    console.log('>  ครั้งแรกที่ใช้งาน: เปิดเบราว์เซอร์แล้วสร้างบัญชีแอดมินผ่าน Setup Wizard')
    console.log('> ============================================================')
    console.log('')
  })

  let shuttingDown = false
  const shutdown = (signal: string): void => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`\n> ได้รับสัญญาณ ${signal} — กำลังปิดระบบ...`)
    const forceExit = setTimeout(() => process.exit(0), 20_000)
    void runtime.manager
      .shutdown()
      .catch(() => undefined)
      .finally(() => {
        for (const client of wss.clients) client.terminate()
        void Promise.all([wss.close(), new Promise<void>((resolve) => server.close(() => resolve()))]).finally(() => {
          clearTimeout(forceExit)
          process.exit(0)
        })
      })
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('uncaughtException', (err) => {
    console.error('> Uncaught exception:', err)
  })
}

main().catch((err) => {
  console.error('> เริ่มเซิร์ฟเวอร์ไม่สำเร็จ:', err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})
