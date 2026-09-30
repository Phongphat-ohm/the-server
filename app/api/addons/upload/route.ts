import { NextResponse, type NextRequest } from 'next/server'
import { guard } from '@/lib/apiHelpers'
import { installAddonFromFile, type InstallAddonResult } from '@/lib/bedrock/addonManager'
import { getRuntime } from '@/lib/bedrock/runtime'

export const dynamic = 'force-dynamic'

/** รับไฟล์ .mcaddon / .mcpack / .zip (multipart) แล้วติดตั้งให้อัตโนมัติ */
export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'อ่านไฟล์ที่อัปโหลดไม่สำเร็จ' }, { status: 400 })
  }
  const files = form.getAll('files').filter((entry): entry is File => entry instanceof File)
  if (files.length === 0) return NextResponse.json({ error: 'ไม่พบไฟล์ที่อัปโหลด' }, { status: 400 })

  const results: Array<InstallAddonResult | { file: string; error: string }> = []
  for (const file of files) {
    if (!/\.(mcaddon|mcpack|zip)$/i.test(file.name)) {
      results.push({ file: file.name, error: 'ชนิดไฟล์ไม่รองรับ (รองรับ .mcaddon / .mcpack / .zip)' })
      continue
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      results.push(await installAddonFromFile(buffer, file.name))
    } catch (err) {
      results.push({ file: file.name, error: err instanceof Error ? err.message : String(err) })
    }
  }
  getRuntime().manager.appendLog(`[Dashboard] ติดตั้ง addons: ${files.length} ไฟล์`)
  return NextResponse.json({ results })
}
