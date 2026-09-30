import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, sameOrigin } from '@/lib/apiHelpers'
import { authenticate, createSession, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/session'
import { needsSetup } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'Origin ไม่ถูกต้อง')
  if (needsSetup()) return jsonError(400, 'ระบบยังไม่มีบัญชีแอดมิน — กรุณาตั้งค่าผ่านหน้า /setup ก่อน')

  const body = (await req.json().catch(() => ({}))) as { username?: unknown; password?: unknown }
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || !password) return jsonError(400, 'กรอกชื่อผู้ใช้และรหัสผ่านให้ครบ')

  const user = authenticate(username, password)
  if (!user) return jsonError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')

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
