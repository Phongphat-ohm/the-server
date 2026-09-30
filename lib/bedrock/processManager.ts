import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { SERVER_DIR, serverBinaryPath } from '../paths'
import { getDb, getSetting } from '../db'
import { getPropertyValue } from './properties'
import { autoConfigureAddonsAndWorld } from './addonManager'
import type { PlayerInfo, ServerStatus, StatusSnapshot, WsServerMessage } from '../types'


const MAX_LOG_LINES = 2000
const MAX_STREAM_BUFFER = 64 * 1024

// รูปแบบ log ของ Bedrock: [INFO] Player connected: Steve, xuid: 2535...
const RE_PLAYER_CONNECTED = /Player connected:\s*(.+?),\s*xuid:\s*(\d+)/i
const RE_PLAYER_DISCONNECTED = /Player disconnected:\s*(.+?),\s*xuid:\s*(\d+)/i

export class BedrockProcessManager {
  private proc: ChildProcess | null = null
  private stdoutBuf = ''
  private stderrBuf = ''
  private players = new Map<string, PlayerInfo>()
  private startedAt: number | null = null
  private stopRequested = false
  private exitWaiters: Array<() => void> = []
  private emitFn: ((msg: WsServerMessage) => void) | null = null

  logs: string[] = []
  status: ServerStatus = 'stopped'
  lastExit: { code: number | null; signal: string | null; at: number } | null = null

  constructor() {
    this.status = this.binExists() ? 'stopped' : 'not_installed'
  }

  setEmit(fn: (msg: WsServerMessage) => void): void {
    this.emitFn = fn
  }

  private emit(msg: WsServerMessage): void {
    try {
      this.emitFn?.(msg)
    } catch {
      // ห้ามให้ปัญหาฝั่ง broadcast กระทบกระบวนการเซิร์ฟเวอร์
    }
  }

  binExists(): boolean {
    try {
      return fs.existsSync(serverBinaryPath())
    } catch {
      return false
    }
  }

  isProcessActive(): boolean {
    return this.proc !== null
  }

  private setStatus(status: ServerStatus): void {
    this.status = status
    this.emit({ t: 'status', status: this.getSnapshot() })
  }

  appendLog(line: string): void {
    this.logs.push(line)
    if (this.logs.length > MAX_LOG_LINES) {
      this.logs.splice(0, this.logs.length - MAX_LOG_LINES)
    }
    this.emit({ t: 'log', lines: [line] })
    // ตรวจจับผู้เล่นเข้า/ออกจากรูปแบบ log
    const connected = RE_PLAYER_CONNECTED.exec(line)
    if (connected) {
      this.players.set(connected[1], { name: connected[1], xuid: connected[2] ?? null, joinedAt: Date.now() })
      this.emit({ t: 'status', status: this.getSnapshot() })
      return
    }
    const disconnected = RE_PLAYER_DISCONNECTED.exec(line)
    if (disconnected) {
      this.players.delete(disconnected[1])
      this.emit({ t: 'status', status: this.getSnapshot() })
    }
  }

  start(): void {
    if (this.proc) throw new Error('เซิร์ฟเวอร์กำลังทำงานอยู่แล้ว')
    if (!this.binExists()) throw new Error('ยังไม่พบ bedrock_server — ติดตั้งเซิร์ฟเวอร์ก่อนเริ่มทำงาน')

    this.stopRequested = false
    this.players.clear()
    this.startedAt = Date.now()
    this.lastExit = null

    const env: NodeJS.ProcessEnv = { ...process.env }
    if (process.platform !== 'win32') {
      // Linux: Bedrock server ต้องหาไลบรารี .so ของตัวเองในโฟลเดอร์เดียวกัน
      env.LD_LIBRARY_PATH = [SERVER_DIR, process.env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter)
    }

    this.setStatus('starting')

    // ซิงค์คอนฟิก Addons, valid_known_packs.json, texturepack-required, และเปิด experiment gameplay ใน level.dat อัตโนมัติ
    try {
      const configRes = autoConfigureAddonsAndWorld()
      if (configRes.experimentsEnabled) {
        this.appendLog('[Dashboard] เปิดใช้งานการทดลอง (Experimental Gameplay) ในโลกปัจจุบันอัตโนมัติแล้ว')
      }
      if (configRes.texturepackRequired) {
        this.appendLog('[Dashboard] บังคับให้ผู้เล่นดาวน์โหลด Resource Pack (texturepack-required=true)')
      }
    } catch (err) {
      this.appendLog(`[Dashboard] คำเตือน: ซิงค์การตั้งค่า Addon/World ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`)
    }

    const proc = spawn(serverBinaryPath(), [], {

      cwd: SERVER_DIR,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.proc = proc
    this.appendLog(`[Dashboard] กำลังเริ่มเซิร์ฟเวอร์... (PID ${proc.pid ?? '?'})`)

    proc.stdout?.setEncoding('utf8')
    proc.stderr?.setEncoding('utf8')
    proc.stdout?.on('data', (chunk: string) => this.onStreamData('stdout', chunk))
    proc.stderr?.on('data', (chunk: string) => this.onStreamData('stderr', chunk))
    proc.on('error', (err: NodeJS.ErrnoException) => {
      this.appendLog(`[Dashboard] เริ่มกระบวนการไม่สำเร็จ: ${err.message}`)
      this.handleExit(null, String(err.code ?? 'error'))
    })
    proc.on('exit', (code, signal) => this.handleExit(code, signal))

    // ถ้าไม่มี output ภายใน 3 วินาที ถือว่ารันแล้ว (กระบวนการยังไม่ exit)
    const markRunning = setTimeout(() => {
      if (this.status === 'starting' && this.proc) this.setStatus('running')
    }, 3000)
    proc.once('exit', () => clearTimeout(markRunning))
  }

  private onStreamData(stream: 'stdout' | 'stderr', chunk: string): void {
    if (stream === 'stdout') this.stdoutBuf += chunk
    else this.stderrBuf += chunk

    if (this.status === 'starting') this.setStatus('running')

    const current = stream === 'stdout' ? this.stdoutBuf : this.stderrBuf
    const lines = current.split(/\r?\n/)
    const remainder = lines.pop() ?? ''
    if (stream === 'stdout') this.stdoutBuf = remainder
    else this.stderrBuf = remainder

    if (this.stdoutBuf.length > MAX_STREAM_BUFFER) this.stdoutBuf = ''
    if (this.stderrBuf.length > MAX_STREAM_BUFFER) this.stderrBuf = ''

    for (const line of lines) {
      if (line.trim().length > 0) this.appendLog(line)
    }
  }

  private handleExit(code: number | null, signal: string | null): void {
    this.proc = null
    this.players.clear()
    this.stdoutBuf = ''
    this.stderrBuf = ''
    this.lastExit = { code, signal, at: Date.now() }
    const wasRequested = this.stopRequested
    this.stopRequested = false
    const clean = wasRequested || code === 0
    this.appendLog(
      `[Dashboard] เซิร์ฟเวอร์หยุดทำงานแล้ว${clean ? '' : ' อย่างผิดปกติ'} (exit ${code ?? signal})`
    )
    this.setStatus(clean ? 'stopped' : 'crashed')
    const waiters = this.exitWaiters.splice(0)
    for (const resolve of waiters) resolve()
  }

  private waitForExit(timeoutMs: number): Promise<boolean> {
    if (!this.proc) return Promise.resolve(true)
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs)
      this.exitWaiters.push(() => {
        clearTimeout(timer)
        resolve(true)
      })
    })
  }

  /** หยุดแบบุ่มุ่มสุภาพ: ส่งคำสั่ง stop ให้เซิร์ฟเวอร์เซฟโลก ถ้าเกินเวลาค่อยบังคับฆ่าโปรเซส */
  async stop(): Promise<void> {
    if (!this.proc) {
      if (this.status !== 'not_installed') this.setStatus('stopped')
      return
    }
    this.stopRequested = true
    this.setStatus('stopping')
    this.appendLog('[Dashboard] กำลังหยุดเซิร์ฟเวอร์ (ส่งคำสั่ง stop เพื่อบันทึกโลก)...')
    try {
      this.proc.stdin?.write('stop\n')
    } catch {
      // stdin ปิดไปแล้ว — รอ exit หรือ force kill
    }
    const exited = await this.waitForExit(60_000)
    if (!exited && this.proc) {
      this.appendLog('[Dashboard] หยุดไม่สำเร็จภายในเวลา — บังคับจบโปรเซส')
      try {
        this.proc.kill('SIGKILL')
      } catch {
        // ปิดไปแล้ว
      }
      await this.waitForExit(10_000)
    }
  }

  async restart(): Promise<void> {
    if (this.proc) await this.stop()
    this.start()
  }

  /** ใช้ตอนปิด Dashboard ทั้งระบบ */
  async shutdown(): Promise<void> {
    if (!this.proc) return
    this.stopRequested = true
    this.appendLog('[Dashboard] กำลังปิด Dashboard — หยุดเซิร์ฟเวอร์...')
    try {
      this.proc.stdin?.write('stop\n')
    } catch {
      // ปิดไปแล้ว
    }
    const exited = await this.waitForExit(20_000)
    if (!exited && this.proc) {
      try {
        this.proc.kill('SIGKILL')
      } catch {
        // ปิดไปแล้ว
      }
    }
  }

  /** ส่งคำสั่งเข้า stdin ของเซิร์ฟเวอร์ (คอนโซล) พร้อมบันทึกลงประวัติ */
  sendCommand(command: string, source: 'console' | 'api' = 'console'): void {
    const trimmed = command.trim()
    if (!trimmed) return
    // คอนโซลของ Bedrock ใช้คำสั่งไม่มีเครื่องหมาย "/" นำหน้า
    const normalized = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
    try {
      getDb()
        .sqlite.prepare('INSERT INTO command_history (command, source, created_at) VALUES (?, ?, ?)')
        .run(normalized, source, Date.now())
    } catch {
      // ประวัติพังไม่ต้องขัดขามการส่งคำสั่ง
    }
    if (!this.proc?.stdin) {
      this.appendLog(`[Dashboard] ไม่สามารถส่งคำสั่ง "${normalized}" — เซิร์ฟเวอร์ไม่ได้ทำงานอยู่`)
      throw new Error('เซิร์ฟเวอร์ไม่ได้ทำงานอยู่')
    }
    this.appendLog(`[Dashboard] > ${normalized}`)
    this.proc.stdin.write(normalized + '\n')
  }

  getRecentLogs(count = 300): string[] {
    if (this.logs.length <= count) return [...this.logs]
    return this.logs.slice(this.logs.length - count)
  }

  /** เรียกหลัง installer วางไฟล์ใหม่ (เช่นติดตั้งครั้งแรก) */
  onFilesChanged(): void {
    if (this.status === 'not_installed' && this.binExists()) {
      this.setStatus('stopped')
    }
  }

  getSnapshot(): StatusSnapshot {
    const worldName = getPropertyValue('level-name')
    const port = Number(getPropertyValue('server-port'))
    const maxPlayers = Number(getPropertyValue('max-players'))
    return {
      status: this.status,
      players: [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt),
      startedAt: this.startedAt,
      uptimeSec: this.startedAt ? Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000)) : null,
      pid: this.proc?.pid ?? null,
      version: getSetting('installedVersion'),
      worldName,
      serverPort: Number.isFinite(port) && port > 0 ? port : null,
      maxPlayers: Number.isFinite(maxPlayers) && maxPlayers > 0 ? maxPlayers : null,
      binExists: this.binExists(),
    }
  }
}
