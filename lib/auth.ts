import { cookies } from 'next/headers'
import { SESSION_COOKIE, validateSessionToken, type SessionUser } from './session'

// ตัวช่วยสำหรับ React Server Components

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  return validateSessionToken(token)
}
