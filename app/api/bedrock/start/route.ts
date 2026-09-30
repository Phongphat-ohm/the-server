import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { getRuntime } from '@/lib/bedrock/runtime'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied
  try {
    getRuntime().manager.start()
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'เริ่มเซิร์ฟเวอร์ไม่สำเร็จ')
  }
  return NextResponse.json(getRuntime().manager.getSnapshot())
}
