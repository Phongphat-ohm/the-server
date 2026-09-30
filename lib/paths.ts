import path from 'node:path'

export const PROJECT_ROOT = process.cwd()

function resolveDir(envValue: string | undefined, fallback: string): string {
  const value = envValue?.trim() || fallback
  return path.isAbsolute(value) ? value : path.join(PROJECT_ROOT, value)
}

/** โฟลเดอร์ข้อมูลของ Dashboard เอง (ฐานข้อมูล SQLite) */
export const DATA_DIR = resolveDir(process.env.DATA_DIR, 'data')
/** โฟลเดอร์ติดตั้ง Bedrock Dedicated Server */
export const SERVER_DIR = resolveDir(process.env.BDS_DIR, 'server_data')
/** ที่เก็บไฟล์ .zip ที่กำลังดาวน์โหลด */
export const DOWNLOADS_DIR = path.join(SERVER_DIR, '.downloads')
/** ที่แตกไฟล์ชั่วคราวก่อน merge ลง SERVER_DIR */
export const STAGING_DIR = path.join(SERVER_DIR, '.staging')

export const SERVER_BINARY = process.platform === 'win32' ? 'bedrock_server.exe' : 'bedrock_server'

export function serverBinaryPath(): string {
  return path.join(SERVER_DIR, SERVER_BINARY)
}

export function serverBinExists(): boolean {
  try {
    return require('node:fs').existsSync(serverBinaryPath())
  } catch {
    return false
  }
}
