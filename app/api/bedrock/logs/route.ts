import { NextResponse, type NextRequest } from 'next/server'
import { guard } from '@/lib/apiHelpers'
import { getRuntime } from '@/lib/bedrock/runtime'

export const dynamic = 'force-dynamic'

/** log ย้อนหลัง (สำรองเมื่อไม่ได้ใช้ WebSocket) */
export async function GET(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied
  const url = new URL(req.url)
  const count = Math.min(2000, Math.max(1, Number(url.searchParams.get('count') ?? 500) || 500))
  return NextResponse.json({ logs: getRuntime().manager.getRecentLogs(count) })
}
