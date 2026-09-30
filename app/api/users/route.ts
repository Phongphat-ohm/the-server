import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, guardAdmin, jsonError } from '@/lib/apiHelpers'
import {
  adminResetPassword,
  createUser,
  deleteUser,
  listUsers,
  updateUserRole,
  ValidationError,
  type UserRole,
} from '@/lib/session'

export const dynamic = 'force-dynamic'

/** ดึงรายชื่อผู้ใช้ทั้งหมด (Admin Only) */
export async function GET(req: NextRequest) {
  const denied = guardAdmin(req)
  if (denied) return denied

  try {
    const users = listUsers()
    return NextResponse.json({ users })
  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการดึงรายชื่อผู้ใช้')
  }
}

/** สร้างผู้ใช้งานใหม่ (Admin Only) */
export async function POST(req: NextRequest) {
  const denied = guardAdmin(req)
  if (denied) return denied

  try {
    const body = (await req.json()) as { username?: string; password?: string; role?: string }
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const role: UserRole = body.role === 'operator' ? 'operator' : 'admin'

    if (!username || !password) {
      return jsonError(400, 'กรุณาระบุชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน')
    }

    const created = createUser(username, password, role)
    return NextResponse.json({ user: created }, { status: 201 })
  } catch (err) {
    const status = err instanceof ValidationError ? 400 : 500
    return jsonError(status, err instanceof Error ? err.message : 'สร้างผู้ใช้ไม่สำเร็จ')
  }
}

/** อัปเดตบทบาทหรือรีเซ็ตรหัสผ่านของผู้ใช้ (Admin Only) */
export async function PATCH(req: NextRequest) {
  const denied = guardAdmin(req)
  if (denied) return denied

  const currentUser = getAuthUser(req)
  if (!currentUser) return jsonError(401, 'ต้องเข้าสู่ระบบก่อน')

  try {
    const body = (await req.json()) as {
      id?: number
      role?: string
      newPassword?: string
    }
    const id = Number(body.id)
    if (!id) return jsonError(400, 'ต้องระบุ ID ผู้ใช้')

    // อัปเดตบทบาท
    if (body.role !== undefined) {
      const role: UserRole = body.role === 'operator' ? 'operator' : 'admin'
      updateUserRole(id, role, currentUser.id)
    }

    // รีเซ็ตรหัสผ่าน
    if (body.newPassword !== undefined) {
      adminResetPassword(id, body.newPassword)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const status = err instanceof ValidationError ? 400 : 500
    return jsonError(status, err instanceof Error ? err.message : 'อัปเดตข้อมูลผู้ใช้ไม่สำเร็จ')
  }
}

/** ลบบัญชีผู้ใช้ (Admin Only) */
export async function DELETE(req: NextRequest) {
  const denied = guardAdmin(req)
  if (denied) return denied

  const currentUser = getAuthUser(req)
  if (!currentUser) return jsonError(401, 'ต้องเข้าสู่ระบบก่อน')

  try {
    const { searchParams } = new URL(req.url)
    const id = Number(searchParams.get('id'))
    if (!id) return jsonError(400, 'ต้องระบุ ID ผู้ใช้ที่ต้องการลบ')

    deleteUser(id, currentUser.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const status = err instanceof ValidationError ? 400 : 500
    return jsonError(status, err instanceof Error ? err.message : 'ลบผู้ใช้ไม่สำเร็จ')
  }
}
