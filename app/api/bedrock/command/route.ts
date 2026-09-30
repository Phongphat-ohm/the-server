import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { getRuntime } from '@/lib/bedrock/runtime'

export const dynamic = 'force-dynamic'

/** ทางเลือกแทนการส่งคำสั่งผ่าน WebSocket (ใช้เมื่อ WS ไม่พร้อม) */
export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied
  const body = (await req.json().catch(() => ({}))) as { command?: unknown }
  if (typeof body.command !== 'string' || !body.command.trim()) {
    return jsonError(400, 'ต้องระบุ command')
  }
  try {
    getRuntime().manager.sendCommand(body.command, 'api')
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'ส่งคำสั่งไม่สำเร็จ')
  }
  return NextResponse.json({ ok: true })
}
