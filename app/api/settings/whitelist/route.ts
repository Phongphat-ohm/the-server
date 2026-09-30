import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import {
  readWhitelist,
  addWhitelistPlayer,
  removeWhitelistPlayer,
} from '@/lib/bedrock/whitelist'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  try {
    const entries = await readWhitelist()
    return NextResponse.json({ entries })
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : 'อ่านรายชื่อ Whitelist ไม่สำเร็จ')
  }
}

export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown
    ignoresPlayerLimit?: unknown
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return jsonError(400, 'กรุณาระบุชื่อผู้เล่น (Gamertag)')

  try {
    const entries = await addWhitelistPlayer(name, Boolean(body.ignoresPlayerLimit))
    return NextResponse.json({ ok: true, entries })
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'เพิ่มผู้เล่นเข้า Whitelist ไม่สำเร็จ')
  }
}

export async function DELETE(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')?.trim()
  if (!name) return jsonError(400, 'กรุณาระบุชื่อผู้เล่นที่ต้องการลบ')

  try {
    const entries = await removeWhitelistPlayer(name)
    return NextResponse.json({ ok: true, entries })
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'ลบผู้เล่นออกจาก Whitelist ไม่สำเร็จ')
  }
}
