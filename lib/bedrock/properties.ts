import fs from 'node:fs'
import path from 'node:path'
import { SERVER_DIR } from '../paths'

// อ่าน/เขียนไฟล์ server.properties โดยคงคอมเมนต์และลำดับคีย์เดิมไว้

export const SERVER_PROPERTIES_PATH = path.join(SERVER_DIR, 'server.properties')

export interface ParsedProperties {
  lines: string[]
  values: Record<string, string>
}

export function parsePropertiesFile(text: string): ParsedProperties {
  const lines = text.split(/\r?\n/)
  const values: Record<string, string> = {}
  for (const raw of lines) {
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    values[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return { lines, values }
}

/** อัปเดตค่าในข้อความ .properties เดิม โดยไม่ทำลายคอมเมนต์/ลำดับ และเพิ่มคีย์ใหม่ต่อท้าย */
export function updatePropertiesText(original: string, updates: Record<string, string>): string {
  const parsed = parsePropertiesFile(original)
  const seen = new Set<string>()
  const outLines = parsed.lines.map((raw) => {
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) return raw
    const eq = trimmed.indexOf('=')
    if (eq <= 0) return raw
    const key = trimmed.slice(0, eq).trim()
    if (key in updates) {
      seen.add(key)
      return `${key}=${updates[key]}`
    }
    return raw
  })
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) outLines.push(`${key}=${value}`)
  }
  // ตัดบรรทัดว่างท้ายไฟล์ซ้ำซ้อนออก แล้วปิดท้ายด้วยบรรทัดใหม่บรรทัดเดียว
  while (outLines.length > 0 && outLines[outLines.length - 1].trim() === '') outLines.pop()
  return outLines.join('\n') + '\n'
}

export function readServerProperties(): string | null {
  try {
    return fs.readFileSync(SERVER_PROPERTIES_PATH, 'utf8')
  } catch {
    return null
  }
}

export function writeServerProperties(text: string): void {
  fs.mkdirSync(SERVER_DIR, { recursive: true })
  fs.writeFileSync(SERVER_PROPERTIES_PATH, text.endsWith('\n') ? text : text + '\n', 'utf8')
}

export function getPropertyValue(key: string, fallback: string | null = null): string | null {
  const text = readServerProperties()
  if (text === null) return fallback
  const { values } = parsePropertiesFile(text)
  const value = values[key]
  return value === undefined || value === '' ? fallback : value
}
