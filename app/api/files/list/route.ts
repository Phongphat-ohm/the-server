import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { listDirectory } from '@/lib/bedrock/fileManager'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  const subpath = req.nextUrl.searchParams.get('path') ?? ''
  try {
    const data = await listDirectory(subpath)
    return NextResponse.json(data)
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : String(err))
  }
}
