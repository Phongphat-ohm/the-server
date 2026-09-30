import { NextResponse, type NextRequest } from 'next/server'
import { guard } from '@/lib/apiHelpers'
import { listAddons } from '@/lib/bedrock/addonManager'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied
  const data = await listAddons()
  return NextResponse.json(data)
}
