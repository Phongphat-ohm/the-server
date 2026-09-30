import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { fetchAvailableVersions } from '@/lib/bedrock/versions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied
  try {
    const { latest, versions } = await fetchAvailableVersions()
    return NextResponse.json({ latest, versions })
  } catch (err) {
    return jsonError(502, err instanceof Error ? err.message : 'ดึงรายการเวอร์ชันไม่สำเร็จ')
  }
}
