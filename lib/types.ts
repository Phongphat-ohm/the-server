// ประเภท (types) ที่ใช้ร่วมกันทั้งฝั่งเซิร์ฟเวอร์และฝั่ง client — ห้าม import โมดูล Node ในไฟล์นี้

export type ServerStatus =
  | 'not_installed'
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'crashed'

export interface PlayerInfo {
  name: string
  xuid: string | null
  joinedAt: number
}

export interface StatusSnapshot {
  status: ServerStatus
  players: PlayerInfo[]
  startedAt: number | null
  uptimeSec: number | null
  pid: number | null
  version: string | null
  worldName: string | null
  serverPort: number | null
  maxPlayers: number | null
  binExists: boolean
}

export type InstallPhase =
  | 'resolving'
  | 'downloading'
  | 'extracting'
  | 'merging'
  | 'finalizing'
  | 'done'
  | 'error'

export interface InstallJob {
  id: string
  version: string
  url: string
  phase: InstallPhase
  receivedBytes: number
  totalBytes: number | null
  error: string | null
  startedAt: number
  finishedAt: number | null
}

export interface QuickMachineStats {
  cpuLoadPct: number | null
  memTotalGb: number | null
  memFreeGb: number | null
}

export type WsServerMessage =
  | { t: 'hello'; status: StatusSnapshot; logs: string[]; job: InstallJob | null }
  | { t: 'status'; status: StatusSnapshot }
  | { t: 'log'; lines: string[] }
  | { t: 'install'; job: InstallJob }
  | { t: 'error'; message: string }
  | { t: 'pong' }

export type WsClientMessage =
  | { t: 'input'; command: string }
  | { t: 'ping' }

export const ACTIVE_STATUSES: readonly ServerStatus[] = ['starting', 'running', 'stopping']

export function isServerActive(status: ServerStatus): boolean {
  return ACTIVE_STATUSES.includes(status)
}
