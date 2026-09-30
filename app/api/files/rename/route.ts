import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { renameItem } from '@/lib/bedrock/fileManager'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  try {
    const body = (await req.json()) as { oldPath?: string; newName?: string }
    if (!body.oldPath || !body.newName) {
      return jsonError(400, 'กรุณาระบุ oldPath และ newName')
    }

    const result = await renameItem(body.oldPath, body.newName)
    return NextResponse.json(result)
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : String(err))
  }
}
