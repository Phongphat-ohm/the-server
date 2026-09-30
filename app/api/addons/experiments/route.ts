import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { checkWorldExperiments, enableWorldExperimentsSync } from '@/lib/bedrock/levelEditor'
import { autoConfigureAddonsAndWorld, listAddons } from '@/lib/bedrock/addonManager'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  const exp = checkWorldExperiments()
  return NextResponse.json({
    experiments: exp,
  })
}

export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  try {
    const configResult = autoConfigureAddonsAndWorld()
    const addonList = await listAddons()
    return NextResponse.json({
      success: true,
      configResult,
      ...addonList,
    })

  } catch (err) {
    return jsonError(500, err instanceof Error ? err.message : 'เปิดใช้งานการทดลองไม่สำเร็จ')
  }
}
