import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { getSystemSpecs } from '@/lib/system/specs'

export const dynamic = 'force-dynamic'

// เปิดให้ใช้ได้ทั้งช่วง Setup Wizard (ยังไม่มีแอดมิน) และหลังล็อกอิน
export async function GET(req: NextRequest) {
  const denied = guard(req, { allowDuringSetup: true })
  if (denied) return denied
  try {
    const specs = await getSystemSpecs()
    return NextResponse.json(specs)
  } catch (err) {
    return jsonError(500, `รวบรวมข้อมูลระบบไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`)
  }
}
