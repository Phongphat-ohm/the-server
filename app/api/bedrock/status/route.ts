import { NextResponse, type NextRequest } from 'next/server'
import { guard } from '@/lib/apiHelpers'
import { getRuntime } from '@/lib/bedrock/runtime'
import { getQuickMachineStats } from '@/lib/system/specs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied
  const runtime = getRuntime()
  const machine = await getQuickMachineStats().catch(() => null)
  return NextResponse.json({ ...runtime.manager.getSnapshot(), machine, job: runtime.currentJob })
}
