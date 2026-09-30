import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, sameOrigin } from '@/lib/apiHelpers'
import { SESSION_COOKIE, SESSION_TTL_MS, ValidationError, createAdmin, createSession } from '@/lib/session'
import { needsSetup } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** สร้างแอดมินคนแรก — เปิดใช้ได้เฉพาะเมื่อยังไม่มีผู้ใช้ในระบบ และล็อกอินให้อัตโนมัติทันที */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'Origin ไม่ถูกต้อง')
  if (!needsSetup()) return jsonError(403, 'ระบบมีบัญชีแอดมินแล้ว')

  const body = (await req.json().catch(() => ({}))) as { username?: unknown; password?: unknown }
  if (typeof body.username !== 'string' || typeof body.password !== 'string') {
    return jsonError(400, 'ข้อมูลไม่ครบถ้วน')
  }
  let user
  try {
    user = createAdmin(body.username, body.password)
  } catch (err) {
    if (err instanceof ValidationError) return jsonError(400, err.message)
    throw err
  }
  const { token } = createSession(user.id)
  const res = NextResponse.json({ ok: true, user: { username: user.username } })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })
  return res
}
