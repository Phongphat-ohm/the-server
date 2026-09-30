import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { SERVER_DIR } from '../paths'

export interface FileItem {
  name: string
  path: string // relative to SERVER_DIR, using forward slashes
  isDirectory: boolean
  size: number
  updatedAt: number
  isEditable: boolean
  extension: string
}

const EDITABLE_EXTENSIONS = new Set([
  '.json',
  '.properties',
  '.txt',
  '.mcfunction',
  '.js',
  '.mjs',
  '.ts',
  '.wlist',
  '.html',
  '.css',
  '.yml',
  '.yaml',
  '.ini',
  '.sh',
  '.bat',
  '.cmd',
  '.md',
  '.log',
  '.conf',
  '.cfg',
])

const MAX_EDITABLE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export function resolveSafePath(subpath: string = ''): string {
  const normalizedBase = path.resolve(SERVER_DIR)
  // Clean leading slashes and normalize
  const cleanSub = subpath.replace(/^(\/|\\)+/, '').replace(/\\/g, '/')
  const resolved = path.resolve(normalizedBase, cleanSub)

  if (!resolved.startsWith(normalizedBase)) {
    throw new Error('การเข้าถึงถูกปฏิเสธ: เส้นทางอยู่นอกโฟลเดอร์เซิร์ฟเวอร์ (Path Traversal)')
  }
  return resolved
}

export function toRelativePath(absolutePath: string): string {
  const normalizedBase = path.resolve(SERVER_DIR)
  const rel = path.relative(normalizedBase, absolutePath).replace(/\\/g, '/')
  return rel === '' ? '/' : rel
}

export function detectMonacoLanguage(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  switch (ext) {
    case '.json':
    case '.wlist':
      return 'json'
    case '.properties':
    case '.cfg':
    case '.conf':
      return 'ini'
    case '.js':
    case '.mjs':
      return 'javascript'
    case '.ts':
      return 'typescript'
    case '.html':
      return 'html'
    case '.css':
      return 'css'
    case '.yml':
    case '.yaml':
      return 'yaml'
    case '.sh':
    case '.mcfunction':
      return 'shell'
    case '.bat':
    case '.cmd':
      return 'bat'
    case '.md':
      return 'markdown'
    default:
      return 'plaintext'
  }
}

export async function listDirectory(subpath: string = ''): Promise<{
  currentPath: string
  breadcrumbs: Array<{ label: string; path: string }>
  items: FileItem[]
}> {
  await fsp.mkdir(SERVER_DIR, { recursive: true })
  const targetDir = resolveSafePath(subpath)

  if (!fs.existsSync(targetDir)) {
    throw new Error(`ไม่พบโฟลเดอร์ "${subpath}"`)
  }

  const stat = await fsp.stat(targetDir)
  if (!stat.isDirectory()) {
    throw new Error(`เส้นทาง "${subpath}" ไม่ใช่โฟลเดอร์`)
  }

  const entries = await fsp.readdir(targetDir, { withFileTypes: true })
  const items: FileItem[] = (
    await Promise.all(
      entries.map(async (entry) => {
        try {
          const fullPath = path.join(targetDir, entry.name)
          const isDirectory = entry.isDirectory()
          const ext = path.extname(entry.name).toLowerCase()
          const isEditable = !isDirectory && EDITABLE_EXTENSIONS.has(ext)
          let size = 0
          let updatedAt = Date.now()
          try {
            const entryStat = await fsp.stat(fullPath)
            size = entryStat.size
            updatedAt = entryStat.mtimeMs
          } catch {
            // ข้ามหรือใช้ค่าเริ่มต้นหากอ่าน stat ไม่ได้
          }

          return {
            name: entry.name,
            path: toRelativePath(fullPath),
            isDirectory,
            size,
            updatedAt,
            isEditable,
            extension: ext,
          } satisfies FileItem
        } catch {
          return null
        }
      })
    )
  ).filter((i): i is FileItem => i !== null)

  // จัดเรียง: โฟลเดอร์ขึ้นก่อน แล้วตามด้วยไฟล์ตามลำดับตัวอักษร
  items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name, 'th')
  })

  // สร้าง Breadcrumbs
  const rel = toRelativePath(targetDir)
  const segments = rel === '/' ? [] : rel.split('/').filter(Boolean)
  const breadcrumbs: Array<{ label: string; path: string }> = [
    { label: 'server_data', path: '/' },
  ]

  let accum = ''
  for (const seg of segments) {
    accum = accum ? `${accum}/${seg}` : seg
    breadcrumbs.push({ label: seg, path: accum })
  }

  return {
    currentPath: rel,
    breadcrumbs,
    items,
  }
}

export async function readFile(subpath: string): Promise<{
  path: string
  name: string
  content: string
  size: number
  language: string
}> {
  const filePath = resolveSafePath(subpath)
  if (!fs.existsSync(filePath)) {
    throw new Error(`ไม่พบไฟล์ "${subpath}"`)
  }

  const stat = await fsp.stat(filePath)
  if (stat.isDirectory()) {
    throw new Error('ไม่สามารถเปิดโฟลเดอร์เป็นข้อความได้')
  }

  if (stat.size > MAX_EDITABLE_SIZE_BYTES) {
    throw new Error(`ไฟล์มีขนาดใหญ่เกินไป (${(stat.size / 1024 / 1024).toFixed(2)} MB) ขีดจำกัดสำหรับ Text Editor คือ 5 MB`)
  }

  const content = await fsp.readFile(filePath, 'utf8')
  const filename = path.basename(filePath)

  return {
    path: toRelativePath(filePath),
    name: filename,
    content,
    size: stat.size,
    language: detectMonacoLanguage(filename),
  }
}

export async function writeFile(subpath: string, content: string): Promise<{ success: boolean; size: number }> {
  const filePath = resolveSafePath(subpath)
  await fsp.mkdir(path.dirname(filePath), { recursive: true })
  await fsp.writeFile(filePath, content, 'utf8')
  const stat = await fsp.stat(filePath)
  return { success: true, size: stat.size }
}

export async function createItem(
  parentPath: string,
  name: string,
  isDirectory: boolean
): Promise<{ path: string }> {
  if (!name || /[\\/<>:"|?*]/.test(name) || name.includes('..')) {
    throw new Error('ชื่อไฟล์หรือโฟลเดอร์มีอักขระที่ไม่ถูกต้อง')
  }

  const parent = resolveSafePath(parentPath)
  const target = path.join(parent, name)
  resolveSafePath(toRelativePath(target)) // double check path traversal

  if (fs.existsSync(target)) {
    throw new Error(`มี "${name}" อยู่ในโฟลเดอร์นี้แล้ว`)
  }

  if (isDirectory) {
    await fsp.mkdir(target, { recursive: true })
  } else {
    await fsp.mkdir(parent, { recursive: true })
    await fsp.writeFile(target, '', 'utf8')
  }

  return { path: toRelativePath(target) }
}

export async function deleteItem(subpath: string): Promise<void> {
  const target = resolveSafePath(subpath)
  const normalizedBase = path.resolve(SERVER_DIR)

  if (target === normalizedBase) {
    throw new Error('ไม่สามารถลบโฟลเดอร์ราก (server_data) ได้')
  }

  if (!fs.existsSync(target)) {
    throw new Error('ไม่พบไฟล์หรือโฟลเดอร์ที่ต้องการลบ')
  }

  await fsp.rm(target, { recursive: true, force: true })
}

export async function renameItem(oldSubpath: string, newName: string): Promise<{ path: string }> {
  if (!newName || /[\\/<>:"|?*]/.test(newName) || newName.includes('..')) {
    throw new Error('ชื่อใหม่มีอักขระที่ไม่ถูกต้อง')
  }

  const source = resolveSafePath(oldSubpath)
  const normalizedBase = path.resolve(SERVER_DIR)

  if (source === normalizedBase) {
    throw new Error('ไม่สามารถเปลี่ยนชื่อโฟลเดอร์รากได้')
  }

  if (!fs.existsSync(source)) {
    throw new Error('ไม่พบไฟล์หรือโฟลเดอร์ต้นทาง')
  }

  const targetDir = path.dirname(source)
  const target = path.join(targetDir, newName)
  resolveSafePath(toRelativePath(target))

  if (fs.existsSync(target)) {
    throw new Error(`ชื่อ "${newName}" มีอยู่แล้วในโฟลเดอร์เดียวกัน`)
  }

  await fsp.rename(source, target)
  return { path: toRelativePath(target) }
}

export async function saveUploadedFile(
  parentPath: string,
  filename: string,
  buffer: Buffer,
  overwrite: boolean = false
): Promise<{ path: string; overwritten: boolean }> {
  if (!filename || /[\\/<>:"|?*]/.test(filename) || filename.includes('..')) {
    throw new Error('ชื่อไฟล์ที่อัปโหลดไม่ถูกต้อง')
  }

  const parent = resolveSafePath(parentPath)
  const target = path.join(parent, filename)
  resolveSafePath(toRelativePath(target))

  const exists = fs.existsSync(target)
  if (exists && !overwrite) {
    throw new Error(`มีไฟล์ชื่อ "${filename}" อยู่แล้ว (ต้องการเขียนทับหรือไม่)`)
  }

  await fsp.mkdir(parent, { recursive: true })
  await fsp.writeFile(target, buffer)

  return { path: toRelativePath(target), overwritten: exists }
}
