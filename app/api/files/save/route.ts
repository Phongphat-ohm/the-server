import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { writeFile } from '@/lib/bedrock/fileManager'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  try {
    const body = (await req.json()) as { path?: string; content?: string }
    if (!body.path || typeof body.content !== 'string') {
      return jsonError(400, 'ข้อมูลไม่ครบถ้วน (ต้องการ path และ content)')
    }

    const result = await writeFile(body.path, body.content)
    return NextResponse.json(result)
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : String(err))
  }
}
