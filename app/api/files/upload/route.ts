import { NextResponse, type NextRequest } from 'next/server'
import { guard, jsonError } from '@/lib/apiHelpers'
import { saveUploadedFile } from '@/lib/bedrock/fileManager'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const denied = guard(req)
  if (denied) return denied

  try {
    const formData = await req.formData()
    const parentPath = (formData.get('parentPath') as string) || ''
    const overwrite = formData.get('overwrite') === 'true'
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return jsonError(400, 'ไม่พบไฟล์ที่ต้องการอัปโหลด')
    }

    const uploaded: Array<{ name: string; path: string; overwritten: boolean }> = []
    const errors: Array<{ name: string; error: string }> = []

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const res = await saveUploadedFile(parentPath, file.name, buffer, overwrite)
        uploaded.push({ name: file.name, path: res.path, overwritten: res.overwritten })
      } catch (err) {
        errors.push({ name: file.name, error: err instanceof Error ? err.message : String(err) })
      }
    }

    return NextResponse.json({
      success: true,
      uploaded,
      errors,
    })
  } catch (err) {
    return jsonError(400, err instanceof Error ? err.message : String(err))
  }
}
