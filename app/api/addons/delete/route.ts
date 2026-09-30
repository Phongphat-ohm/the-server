import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { deleteAddon, listAddons, type PackType } from '@/lib/bedrock/addonManager'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  const body = (await req.json().catch(() => ({}))) as { dirName?: unknown; type?: unknown }
  if (typeof body.dirName !== 'string' || (body.type !== 'resource' && body.type !== 'behavior')) {
    return jsonError(400, 'ข้อมูลไม่ถูกต้อง')
  }
  try {
    await deleteAddon(body.dirName, body.type as PackType)
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
  }
  return NextResponse.json(await listAddons())
}
