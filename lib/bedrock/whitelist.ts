import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { SERVER_DIR } from '../paths'
import { getRuntime } from './runtime'

export interface WhitelistEntry {
  name: string
  xuid?: string
  ignoresPlayerLimit?: boolean
}

function getWhitelistPaths(): string[] {
  return [
    path.join(SERVER_DIR, 'allowlist.json'),
    path.join(SERVER_DIR, 'whitelist.json'),
  ]
}

export async function readWhitelist(): Promise<WhitelistEntry[]> {
  const paths = getWhitelistPaths()
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        const raw = await fsp.readFile(p, 'utf-8')
        const parsed = JSON.parse(raw.trim() || '[]')
        if (Array.isArray(parsed)) {
          return parsed.map((item) => ({
            name: typeof item.name === 'string' ? item.name : String(item),
            xuid: typeof item.xuid === 'string' ? item.xuid : '',
            ignoresPlayerLimit: Boolean(item.ignoresPlayerLimit),
          }))
        }
      } catch {
        // continue
      }
    }
  }
  return []
}

export async function saveWhitelist(entries: WhitelistEntry[]): Promise<void> {
  await fsp.mkdir(SERVER_DIR, { recursive: true })
  const content = JSON.stringify(entries, null, 2)
  const paths = getWhitelistPaths()
  // เขียน allowlist.json (มาตรฐาน BDS สมัยใหม่)
  await fsp.writeFile(paths[0], content, 'utf-8')
  // ถ้ามี whitelist.json เดิมอยู่ด้วย ก็ซิงค์คู่กัน
  if (fs.existsSync(paths[1])) {
    await fsp.writeFile(paths[1], content, 'utf-8')
  }

  // ถ้าเซิร์ฟเวอร์กำลังรันอยู่ สั่ง reload ในคอนโซลทันที
  const manager = getRuntime().manager
  if (manager.isProcessActive()) {
    manager.sendCommand('allowlist reload')
    manager.sendCommand('whitelist reload')
  }
}

export async function addWhitelistPlayer(
  name: string,
  ignoresPlayerLimit = false
): Promise<WhitelistEntry[]> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('กรุณาระบุชื่อผู้เล่น (Gamertag)')

  const list = await readWhitelist()
  const exists = list.some((e) => e.name.toLowerCase() === trimmed.toLowerCase())
  if (exists) throw new Error(`ผู้เล่น "${trimmed}" มีอยู่ใน Whitelist แล้ว`)

  const updated: WhitelistEntry[] = [
    ...list,
    { name: trimmed, xuid: '', ignoresPlayerLimit },
  ]
  await saveWhitelist(updated)

  const manager = getRuntime().manager
  if (manager.isProcessActive()) {
    manager.sendCommand(`allowlist add "${trimmed}"`)
    manager.sendCommand(`whitelist add "${trimmed}"`)
  }

  return updated
}

export async function removeWhitelistPlayer(name: string): Promise<WhitelistEntry[]> {
  const trimmed = name.trim()
  const list = await readWhitelist()
  const updated = list.filter((e) => e.name.toLowerCase() !== trimmed.toLowerCase())
  await saveWhitelist(updated)

  const manager = getRuntime().manager
  if (manager.isProcessActive()) {
    manager.sendCommand(`allowlist remove "${trimmed}"`)
    manager.sendCommand(`whitelist remove "${trimmed}"`)
  }

  return updated
}
