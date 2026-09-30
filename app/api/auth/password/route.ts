import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, guard, jsonError } from '@/lib/apiHelpers'
import { ValidationError, changePassword } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  const user = getAuthUser(req)
  if (!user) return jsonError(401, 'ต้องเข้าสู่ระบบก่อน')

  const body = (await req.json().catch(() => ({}))) as { currentPassword?: unknown; newPassword?: unknown }
  if (typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
    return jsonError(400, 'ข้อมูลไม่ครบถ้วน')
  }
  try {
    changePassword(user.id, body.currentPassword, body.newPassword)
  } catch (err) {
    if (err instanceof ValidationError) return jsonError(400, err.message)
    throw err
  }
  return NextResponse.json({ ok: true })
}
