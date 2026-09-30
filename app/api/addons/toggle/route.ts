import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { listAddons, setAddonActive, type PackType } from '@/lib/bedrock/addonManager'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  const body = (await req.json().catch(() => ({}))) as {
    dirName?: unknown
    type?: unknown
    active?: unknown
  }
  if (typeof body.dirName !== 'string' || (body.type !== 'resource' && body.type !== 'behavior') || typeof body.active !== 'boolean') {
    return jsonError(400, 'ข้อมูลไม่ถูกต้อง')
  }
  try {
    await setAddonActive(body.dirName, body.type as PackType, body.active)
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'เปลี่ยนสถานะไม่สำเร็จ')
  }
  return NextResponse.json(await listAddons())
}
