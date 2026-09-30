import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { needsSetup } from './db'
import { SESSION_COOKIE, validateSessionToken, type SessionUser } from './session'

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export function getAuthUser(req: NextRequest): SessionUser | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  return validateSessionToken(token)
}

/** ป้องกัน CSRF อย่างง่าย: ถ้ามี Origin header ต้องตรงกับ Host เดียวกัน */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    const parsed = new URL(origin)
    return parsed.host === req.headers.get('host')
  } catch {
    return false
  }
}

/**
 * ตรวจสอบสิทธิ์ก่อนเข้าใช้ API
 * - คืน null = ผ่าน
 * - คืน NextResponse = ให้ return ทันที
 * opts.allowDuringSetup: อนุญาตให้ใช้ได้ระหว่างยังไม่มีแอดมิน (First-Time Setup)
 */
export function guard(
  req: NextRequest,
  opts: { allowDuringSetup?: boolean } = {}
): NextResponse | null {
  const user = getAuthUser(req)
  if (!user) {
    if (opts.allowDuringSetup && needsSetup()) return null
    return jsonError(401, 'ต้องเข้าสู่ระบบก่อน')
  }
  if (!sameOrigin(req)) return jsonError(403, 'Origin ไม่ถูกต้อง')
  return null
}

/**
 * ตรวจสอบสิทธิ์เฉพาะผู้ดูแลระบบ (Admin Only)
 */
export function guardAdmin(req: NextRequest): NextResponse | null {
  const denied = guard(req)
  if (denied) return denied

  const user = getAuthUser(req)
  if (user?.role !== 'admin') {
    return jsonError(403, 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์เข้าถึง')
  }
  return null
}
