import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { createItem } from '@/lib/bedrock/fileManager'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  try {
    const body = (await req.json()) as { parentPath?: string; name?: string; isDirectory?: boolean }
    if (!body.name) {
      return jsonError(400, 'กรุณาระบุชื่อไฟล์หรือโฟลเดอร์')
    }

    const result = await createItem(body.parentPath ?? '', body.name, !!body.isDirectory)
    return NextResponse.json(result)
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : String(err))
  }
}
