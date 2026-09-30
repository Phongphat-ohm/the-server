import crypto from 'node:crypto'
import { getDb } from './db'

// การจัดการบัญชี + session — ใช้ได้ทั้งใน custom server และ Next.js API routes
// (แยกจาก lib/auth.ts เพื่อไม่ดึง next/headers เข้ามาในบริบทของ custom server)

export const SESSION_COOKIE = 'bds_session'
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type UserRole = 'admin' | 'operator'

export interface SessionUser {
  id: number
  username: string
  role: UserRole
}

export interface UserSummary {
  id: number
  username: string
  role: UserRole
  createdAt: number
}

export class ValidationError extends Error {}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${derived}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, expectedHex] = parts
  const expected = Buffer.from(expectedHex, 'hex')
  const candidate = crypto.scryptSync(password, salt, expected.length)
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}

export function validateUsername(username: string): string | null {
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return 'ชื่อผู้ใช้ต้องเป็นตัวอักษร a-z A-Z 0-9 _ . - ยาว 3-32 ตัวอักษร'
  }
  return null
}

export function validatePassword(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร'
  }
  return null
}

export function createAdmin(username: string, password: string): SessionUser {
  return createUser(username, password, 'admin')
}

export function createUser(username: string, password: string, role: UserRole = 'operator'): SessionUser {
  const usernameError = validateUsername(username)
  if (usernameError) throw new ValidationError(usernameError)
  const passwordError = validatePassword(password)
  if (passwordError) throw new ValidationError(passwordError)

  const { sqlite } = getDb()
  const existing = sqlite.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) {
    throw new ValidationError(`ชื่อผู้ใช้ "${username}" มีอยู่ในระบบแล้ว`)
  }

  const info = sqlite
    .prepare('INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)')
    .run(username, hashPassword(password), role, Date.now())
  return { id: Number(info.lastInsertRowid), username, role }
}

export function authenticate(username: string, password: string): SessionUser | null {
  const row = getDb().sqlite
    .prepare('SELECT id, username, password_hash, role FROM users WHERE username = ?')
    .get(username) as { id: number; username: string; password_hash: string; role?: string } | undefined
  if (!row) return null
  if (!verifyPassword(password, row.password_hash)) return null
  const role: UserRole = row.role === 'operator' ? 'operator' : 'admin'
  return { id: row.id, username: row.username, role }
}

export function createSession(userId: number): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(32).toString('hex')
  const now = Date.now()
  const expiresAt = now + SESSION_TTL_MS
  const { sqlite } = getDb()
  sqlite.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now)
  sqlite.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    token,
    userId,
    now,
    expiresAt
  )
  return { token, expiresAt }
}

export function validateSessionToken(token: string): SessionUser | null {
  const { sqlite } = getDb()
  const row = sqlite
    .prepare(
      'SELECT s.token, s.expires_at, u.id, u.username, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
    )
    .get(token) as
    | { token: string; expires_at: number; id: number; username: string; role?: string }
    | undefined
  if (!row) return null
  if (row.expires_at < Date.now()) {
    sqlite.prepare('DELETE FROM sessions WHERE token = ?').run(row.token)
    return null
  }
  const role: UserRole = row.role === 'operator' ? 'operator' : 'admin'
  return { id: row.id, username: row.username, role }
}

export function deleteSession(token: string): void {
  try {
    getDb().sqlite.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  } catch {
    // ลบไม่ได้ก็ถือว่าเสร็จ (cookie ถูกลบทิ้งฝั่ง client อยู่ดี)
  }
}

export function changePassword(userId: number, currentPassword: string, newPassword: string): void {
  const { sqlite } = getDb()
  const row = sqlite.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as
    | { password_hash: string }
    | undefined
  if (!row || !verifyPassword(currentPassword, row.password_hash)) {
    throw new ValidationError('รหัสผ่านปัจจุบันไม่ถูกต้อง')
  }
  const passwordError = validatePassword(newPassword)
  if (passwordError) throw new ValidationError(passwordError)
  sqlite.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), userId)
}

/** ดึงรายชื่อผู้ใช้ทั้งหมด (Admin Only) */
export function listUsers(): UserSummary[] {
  const { sqlite } = getDb()
  const rows = sqlite
    .prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC')
    .all() as Array<{ id: number; username: string; role?: string; created_at: number }>

  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    role: (r.role === 'operator' ? 'operator' : 'admin') as UserRole,
    createdAt: r.created_at,
  }))
}

/** อัปเดตสิทธิ์/บทบาทของผู้ใช้ */
export function updateUserRole(userId: number, role: UserRole, currentAdminId: number): void {
  const { sqlite } = getDb()
  const target = sqlite.prepare('SELECT id, role FROM users WHERE id = ?').get(userId) as
    | { id: number; role?: string }
    | undefined
  if (!target) throw new ValidationError('ไม่พบบัญชีผู้ใช้ที่ต้องการแก้ไข')

  // หากเป็นตัวเอง และจะปลดตัวเองจาก admin ให้เช็คว่ามี admin คนอื่นเหลือไหม
  if (userId === currentAdminId && role !== 'admin') {
    const adminCount = sqlite.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get() as { c: number }
    if (adminCount.c <= 1) {
      throw new ValidationError('ไม่สามารถเปลี่ยนบทบาทของตนเองได้ เนื่องจากไม่มีผู้ดูแลระบบ (Admin) อื่นเหลืออยู่ในระบบ')
    }
  }

  sqlite.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId)
}

/** รีเซ็ตรหัสผ่านโดย Admin โดยตรง */
export function adminResetPassword(userId: number, newPassword: string): void {
  const passwordError = validatePassword(newPassword)
  if (passwordError) throw new ValidationError(passwordError)
  const { sqlite } = getDb()
  const target = sqlite.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!target) throw new ValidationError('ไม่พบบัญชีผู้ใช้ที่ต้องการรีเซ็ตรหัสผ่าน')

  sqlite.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), userId)
  // ลบ session ของผู้ใช้นี้เพื่อให้ล็อกอินใหม่
  sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
}

/** ลบบัญชีผู้ใช้ */
export function deleteUser(userId: number, currentAdminId: number): void {
  if (userId === currentAdminId) {
    throw new ValidationError('ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้')
  }
  const { sqlite } = getDb()
  const target = sqlite.prepare('SELECT id, role FROM users WHERE id = ?').get(userId) as
    | { id: number; role?: string }
    | undefined
  if (!target) throw new ValidationError('ไม่พบบัญชีผู้ใช้ที่ต้องการลบ')

  if (target.role === 'admin') {
    const adminCount = sqlite.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get() as { c: number }
    if (adminCount.c <= 1) {
      throw new ValidationError('ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายของระบบได้')
    }
  }

  sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  sqlite.prepare('DELETE FROM users WHERE id = ?').run(userId)
}
