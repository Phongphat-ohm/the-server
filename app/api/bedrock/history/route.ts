import { NextResponse, type NextRequest } from 'next/server'
import { desc } from 'drizzle-orm'
import { guard } from '@/lib/apiHelpers'
import { getDb } from '@/lib/db'
import { commandHistory } from '@/lib/schema'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied
  const url = new URL(req.url)
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 30) || 30))
  const rows = await getDb()
    .db.select({ command: commandHistory.command, createdAt: commandHistory.createdAt })
    .from(commandHistory)
    .orderBy(desc(commandHistory.id))
    .limit(limit)
  return NextResponse.json({ history: rows })
}
