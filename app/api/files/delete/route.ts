import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { deleteItem } from '@/lib/bedrock/fileManager'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  try {
    const body = (await req.json()) as { path?: string }
    if (!body.path) {
      return jsonError(400, 'กรุณาระบุพาธที่ต้องการลบ')
    }

    await deleteItem(body.path)
    return NextResponse.json({ success: true })
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : String(err))
  }
}
