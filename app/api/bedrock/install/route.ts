import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { getCurrentJob, startInstall } from '@/lib/bedrock/installer'

export const dynamic = 'force-dynamic'

/** เริ่มงานติดตั้ง/อัปเดต (ทำงานเบื้องหลัง) — คืน job ปัจจุบันทันที */
export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  const body = (await req.json().catch(() => ({}))) as { version?: unknown }
  const version = typeof body.version === 'string' && body.version.trim() ? body.version.trim() : 'latest'
  try {
    const job = startInstall(version)
    return NextResponse.json({ job })
  } catch (err) {
    return jsonError(409, err instanceof Error ? err.message : 'เริ่มติดตั้งไม่สำเร็จ')
  }
}

/** ติดตามความคืบหน้างานติดตั้งล่าสุด */
export async function GET(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied
  return NextResponse.json({ job: getCurrentJob() })
}
