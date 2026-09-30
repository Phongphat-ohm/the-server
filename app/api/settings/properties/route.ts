import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { getRuntime } from '@/lib/bedrock/runtime'
import { PROPERTY_FIELDS } from '@/lib/bedrock/propertiesMeta'
import {
  parsePropertiesFile,
  readServerProperties,
  updatePropertiesText,
  writeServerProperties,
} from '@/lib/bedrock/properties'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied
  const text = readServerProperties()
  if (text === null) return NextResponse.json({ installed: false })
  const { values } = parsePropertiesFile(text)
  return NextResponse.json({ installed: true, values })
}

export async function PUT(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  const original = readServerProperties()
  if (original === null) return jsonError(404, 'ยังไม่พบ server.properties — ติดตั้งเซิร์ฟเวอร์ก่อน')

  const body = (await req.json().catch(() => ({}))) as { updates?: unknown }
  if (!body.updates || typeof body.updates !== 'object') return jsonError(400, 'รูปแบบข้อมูลไม่ถูกต้อง')

  // ทำความสะอาดค่า: บังคับเป็นสตริงบรรทัดเดียว
  const clean: Record<string, string> = {}
  for (const [rawKey, rawValue] of Object.entries(body.updates as Record<string, unknown>)) {
    const key = rawKey.trim()
    if (!key) continue
    if (typeof rawValue === 'boolean') clean[key] = rawValue ? 'true' : 'false'
    else if (rawValue === null || rawValue === undefined) continue
    else clean[key] = String(rawValue).replace(/[\r\n]+/g, '')
  }

  // ตรวจค่าตัวเลขให้ตรงช่วงที่กำหนด
  for (const field of PROPERTY_FIELDS) {
    const value = clean[field.key]
    if (field.type === 'number' && value !== undefined) {
      const num = Number(value)
      if (!Number.isFinite(num) || (field.min !== undefined && num < field.min) || (field.max !== undefined && num > field.max)) {
        return jsonError(400, `ค่าของ "${field.label}" (${field.key}) ไม่ถูกต้อง`)
      }
    }
  }

  writeServerProperties(updatePropertiesText(original, clean))
  const running = ['starting', 'running', 'stopping'].includes(getRuntime().manager.status)
  return NextResponse.json({ ok: true, running, needsRestart: running })
}
