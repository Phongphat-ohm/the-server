import { NextResponse, type NextRequest } from 'next/server'
import { guard, guardAdmin, jsonError } from '@/lib/apiHelpers'
import { getConnectionInfo, setCustomDomain } from '@/lib/bedrock/connection'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  try {
    const info = await getConnectionInfo()
    return NextResponse.json(info)
  } catch (err) {
    return jsonError(500, `ไม่สามารถดึงข้อมูลการเชื่อมต่อ: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function POST(req: NextRequest) {
  const denied = guardAdmin(req)
  if (denied) return denied

  try {
    const body = (await req.json().catch(() => ({}))) as { domain?: unknown }
    if (typeof body.domain !== 'string' && body.domain !== null && body.domain !== undefined) {
      return jsonError(400, 'ข้อมูล domain ไม่ถูกต้อง')
    }

    const domainInput = typeof body.domain === 'string' ? body.domain : ''
    setCustomDomain(domainInput)

    const updated = await getConnectionInfo()
    return NextResponse.json({
      ok: true,
      message: domainInput.trim() ? `ตั้งค่า Domain สำหรับเข้าเล่นเป็น "${updated.domain}" เรียบร้อยแล้ว` : 'ลบการตั้งค่า Domain เรียบร้อยแล้ว (จะใช้ IP อัตโนมัติ)',
      connection: updated,
    })
  } catch (err) {
    return jsonError(500, `บันทึก Domain ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`)
  }
}
