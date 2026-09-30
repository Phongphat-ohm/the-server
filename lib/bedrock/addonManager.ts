import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { SERVER_DIR } from '../paths'
import { getPropertyValue } from './properties'

// จัดการ Addons: .mcaddon / .mcpack / .zip
// - ตรวจ manifest.json หา uuid/version/modules
// - แยก resource ↔ behavior จาก modules[].type
// - เปิดใช้งานด้วยการเขียน world_resource_packs.json / world_behavior_packs.json ของโลกปัจจุบัน

export type PackType = 'resource' | 'behavior'

export interface AddonInfo {
  type: PackType
  dirName: string
  name: string
  description: string
  uuid: string
  version: number[]
  active: boolean
  builtin: boolean
  error?: string | null
}

export interface InstallAddonResult {
  file: string
  packs: AddonInfo[]
  warnings: string[]
}

interface ManifestHeader {
  name?: string
  description?: string
  uuid?: string
  version?: number[] | { major: number; minor: number; patch: number }
  min_engine_version?: number[]
}

interface Manifest {
  header?: ManifestHeader
  modules?: Array<{ type?: string }>
}

interface PackCandidate {
  manifest: Manifest
  zip: AdmZip
  prefix: string
  fallbackName: string
}

const WORLD_PACK_FILES: Record<PackType, string> = {
  resource: 'world_resource_packs.json',
  behavior: 'world_behavior_packs.json',
}

function isBuiltinDir(dirName: string): boolean {
  return /^(vanilla|chemistry|experimental|education)/i.test(dirName)
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function readManifestBuffer(data: Buffer): Manifest | null {
  try {
    return JSON.parse(stripBom(data.toString('utf8'))) as Manifest
  } catch {
    return null
  }
}

function normalizeVersion(
  version: number[] | { major: number; minor: number; patch: number } | undefined
): number[] {
  if (Array.isArray(version)) return version.map((n) => Number(n) || 0)
  if (version && typeof version === 'object') {
    return [Number(version.major) || 0, Number(version.minor) || 0, Number(version.patch) || 0]
  }
  return [0, 0, 0]
}

function packTypeOf(manifest: Manifest): PackType | null {
  const types = (manifest.modules ?? []).map((m) => String(m.type ?? '').toLowerCase())
  if (types.some((t) => t.includes('resource'))) return 'resource'
  if (types.some((t) => t.includes('data') || t.includes('behavior'))) return 'behavior'
  return null
}

function sanitizeDirName(name: string): string {
  const cleaned = name
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
  return cleaned || 'pack'
}

function packDirFor(type: PackType): string {
  return path.join(SERVER_DIR, type === 'resource' ? 'resource_packs' : 'behavior_packs')
}

export function getWorldName(): string | null {
  return getPropertyValue('level-name')
}

export function getWorldDir(): string | null {
  const worldName = getWorldName()
  if (!worldName) return null
  const dir = path.join(SERVER_DIR, 'worlds', worldName)
  return fs.existsSync(dir) ? dir : null
}

function readUuidOf(manifestPath: string): string | null {
  try {
    const manifest = readManifestBuffer(fs.readFileSync(manifestPath))
    return manifest?.header?.uuid ?? null
  } catch {
    return null
  }
}

interface WorldPackEntry {
  pack_id: string
  version: number[]
}

function readWorldPacks(worldDir: string, type: PackType): WorldPackEntry[] {
  try {
    const raw = fs.readFileSync(path.join(worldDir, WORLD_PACK_FILES[type]), 'utf8')
    const parsed = JSON.parse(stripBom(raw))
    return Array.isArray(parsed) ? (parsed as WorldPackEntry[]) : []
  } catch {
    return []
  }
}

function writeWorldPacks(worldDir: string, type: PackType, packs: WorldPackEntry[]): void {
  fs.writeFileSync(path.join(worldDir, WORLD_PACK_FILES[type]), JSON.stringify(packs, null, 2) + '\n', 'utf8')
}

export async function listAddons(): Promise<{
  worldName: string | null
  worldExists: boolean
  addons: AddonInfo[]
}> {
  const worldName = getWorldName()
  const worldDir = worldName ? path.join(SERVER_DIR, 'worlds', worldName) : null
  const worldExists = !!worldDir && fs.existsSync(worldDir)

  const active = new Map<string, boolean>()
  if (worldExists && worldDir) {
    for (const type of ['resource', 'behavior'] as PackType[]) {
      for (const entry of readWorldPacks(worldDir, type)) {
        active.set(`${type}:${entry.pack_id}`, true)
      }
    }
  }

  const addons: AddonInfo[] = []
  for (const type of ['resource', 'behavior'] as PackType[]) {
    const root = packDirFor(type)
    if (!fs.existsSync(root)) continue
    const entries = await fsp.readdir(root, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const manifestPath = path.join(root, entry.name, 'manifest.json')
      if (!fs.existsSync(manifestPath)) {
        addons.push({
          type, dirName: entry.name, name: entry.name, description: '', uuid: '', version: [0, 0, 0],
          active: false, builtin: isBuiltinDir(entry.name), error: 'ไม่พบ manifest.json',
        })
        continue
      }
      const manifest = readManifestBuffer(await fsp.readFile(manifestPath))
      const header = manifest?.header
      if (!header?.uuid) {
        addons.push({
          type, dirName: entry.name, name: header?.name ?? entry.name, description: header?.description ?? '',
          uuid: '', version: normalizeVersion(header?.version), active: false,
          builtin: isBuiltinDir(entry.name), error: 'manifest.json ไม่ถูกต้อง (ไม่มี header.uuid)',
        })
        continue
      }
      addons.push({
        type,
        dirName: entry.name,
        name: header.name ?? entry.name,
        description: header.description ?? '',
        uuid: header.uuid,
        version: normalizeVersion(header.version),
        active: active.get(`${type}:${header.uuid}`) ?? false,
        builtin: isBuiltinDir(entry.name),
      })
    }
  }
  addons.sort((a, b) => a.name.localeCompare(b.name, 'th'))
  return { worldName, worldExists, addons }
}

function topDirsOf(zip: AdmZip): string[] {
  const dirs = new Set<string>()
  for (const entry of zip.getEntries()) {
    const slash = entry.entryName.indexOf('/')
    if (slash > 0) dirs.add(entry.entryName.slice(0, slash))
  }
  return [...dirs]
}

/** ค้นหา "pack" ทั้งหมดในไฟล์ที่อัปโหลด: manifest ที่รูท (.mcpack), โฟลเดอร์ย่อย หรือ zip ซ้อน (.mcaddon) */
function findPackCandidates(buf: Buffer, warnings: string[]): PackCandidate[] {
  const zip = new AdmZip(buf)
  const out: PackCandidate[] = []

  const rootManifest = zip.getEntry('manifest.json')
  if (rootManifest) {
    const manifest = readManifestBuffer(rootManifest.getData())
    if (manifest?.header?.uuid) {
      out.push({ manifest, zip, prefix: '', fallbackName: 'pack' })
      return out
    }
  }

  for (const dir of topDirsOf(zip)) {
    const entry = zip.getEntry(`${dir}/manifest.json`)
    if (!entry) continue
    const manifest = readManifestBuffer(entry.getData())
    if (manifest?.header?.uuid) out.push({ manifest, zip, prefix: `${dir}/`, fallbackName: dir })
  }

  // .mcaddon บางไฟล์บรรจุ .mcpack/.zip ซ้อนอยู่ข้างใน
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    if (!/\.(zip|mcpack)$/i.test(entry.entryName)) continue
    try {
      const inner = new AdmZip(entry.getData())
      const innerRoot = inner.getEntry('manifest.json')
      if (innerRoot) {
        const manifest = readManifestBuffer(innerRoot.getData())
        if (manifest?.header?.uuid) {
          out.push({
            manifest,
            zip: inner,
            prefix: '',
            fallbackName: path.basename(entry.entryName).replace(/\.[^.]+$/, '') || 'pack',
          })
          continue
        }
      }
      for (const dir of topDirsOf(inner)) {
        const m = inner.getEntry(`${dir}/manifest.json`)
        if (!m) continue
        const manifest = readManifestBuffer(m.getData())
        if (manifest?.header?.uuid) {
          out.push({ manifest, zip: inner, prefix: `${dir}/`, fallbackName: dir })
        }
      }
    } catch {
      warnings.push(`แตกไฟล์ย่อย ${entry.entryName} ไม่สำเร็จ — ข้าม`)
    }
  }

  // ตัดรายการซ้ำตาม uuid
  const seen = new Set<string>()
  return out.filter((cand) => {
    const key = cand.manifest.header?.uuid ?? ''
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function installAddonFromFile(buf: Buffer, filename: string): Promise<InstallAddonResult> {
  const warnings: string[] = []
  const packs: AddonInfo[] = []
  const candidates = findPackCandidates(buf, warnings)
  if (candidates.length === 0) {
    throw new Error(`ไม่พบ pack ที่ตรวจสอบได้ใน "${filename}" (ต้องมี manifest.json ที่ถูกต้อง)`)
  }

  for (const cand of candidates) {
    const type = packTypeOf(cand.manifest)
    const header = cand.manifest.header!
    if (!type) {
      warnings.push(`"${header.name ?? cand.fallbackName}": ไม่รู้จักชนิดของ pack (modules.type) — ข้าม`)
      continue
    }
    const base = sanitizeDirName(header.name || cand.fallbackName)
    const targetRoot = packDirFor(type)
    let dirName = base
    if (isBuiltinDir(dirName)) dirName = `${dirName}_custom`
    let target = path.join(targetRoot, dirName)
    const existingUuid = readUuidOf(path.join(target, 'manifest.json'))
    if (existingUuid && existingUuid !== header.uuid) {
      dirName = `${base}_${(header.uuid ?? '').slice(0, 8)}`
      target = path.join(targetRoot, dirName)
    }

    await fsp.rm(target, { recursive: true, force: true })
    await fsp.mkdir(target, { recursive: true })
    const normalizedTarget = path.normalize(target)
    for (const entry of cand.zip.getEntries()) {
      if (entry.isDirectory) continue
      const rel = cand.prefix ? entry.entryName.slice(cand.prefix.length) : entry.entryName
      if (!rel || rel.startsWith('..')) continue
      const outPath = path.join(target, rel)
      if (!path.normalize(outPath).startsWith(normalizedTarget)) continue // กัน path traversal
      await fsp.mkdir(path.dirname(outPath), { recursive: true })
      await fsp.writeFile(outPath, entry.getData())
    }
    packs.push({
      type,
      dirName,
      name: header.name ?? dirName,
      description: header.description ?? '',
      uuid: header.uuid!,
      version: normalizeVersion(header.version),
      active: false,
      builtin: false,
    })
  }

  // เปิดใช้งานอัตโนมัติกับโลกปัจจุบัน
  const worldDir = getWorldDir()
  if (!worldDir) {
    warnings.push('ติดตั้ง pack เรียบร้อย แต่ยังเปิดใช้งานอัตโนมัติไม่ได้เพราะยังไม่พบโลก (world) — เริ่มเซิร์ฟเวอร์ครั้งแรกก่อน แล้วมาเปิดใช้ในหน้านี้')
  } else {
    for (const pack of packs) {
      try {
        await setAddonActive(pack.dirName, pack.type, true)
        pack.active = true
      } catch (err) {
        warnings.push(`เปิดใช้งาน "${pack.name}" ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }
  return { file: filename, packs, warnings }
}

function assertSafeDirName(dirName: string): void {
  if (!/^[^/\\]+$/.test(dirName)) throw new Error('ชื่อโฟลเดอร์ pack ไม่ถูกต้อง')
}

export async function setAddonActive(dirName: string, type: PackType, active: boolean): Promise<void> {
  assertSafeDirName(dirName)
  const worldDir = getWorldDir()
  if (!worldDir) throw new Error('ยังไม่พบโลกปัจจุบัน — เริ่มเซิร์ฟเวอร์ครั้งแรกเพื่อสร้างโลกก่อน')
  const manifestPath = path.join(packDirFor(type), dirName, 'manifest.json')
  if (!fs.existsSync(manifestPath)) throw new Error(`ไม่พบ pack "${dirName}"`)
  const manifest = readManifestBuffer(await fsp.readFile(manifestPath))
  const header = manifest?.header
  if (!header?.uuid) throw new Error('manifest.json ของ pack นี้ไม่ถูกต้อง')

  let entries = readWorldPacks(worldDir, type)
  if (active) {
    if (!entries.some((e) => e.pack_id === header.uuid)) {
      entries.push({ pack_id: header.uuid, version: normalizeVersion(header.version) })
    }
  } else {
    entries = entries.filter((e) => e.pack_id !== header.uuid)
  }
  writeWorldPacks(worldDir, type, entries)
}

export async function deleteAddon(dirName: string, type: PackType): Promise<void> {
  assertSafeDirName(dirName)
  if (isBuiltinDir(dirName)) throw new Error('pack ที่มาพร้อมเซิร์ฟเวอร์ (vanilla) ลบไม่ได้')
  const worldDir = getWorldDir()
  if (worldDir) {
    try {
      await setAddonActive(dirName, type, false)
    } catch {
      // ถ้าปิดใช้งานไม่ได้ (เช่น manifest เสีย) ก็ดำเนินการลบต่อ
    }
  }
  const target = path.join(packDirFor(type), dirName)
  const normalizedRoot = path.normalize(packDirFor(type))
  if (!path.normalize(target).startsWith(normalizedRoot)) throw new Error('เส้นทางไม่ถูกต้อง')
  await fsp.rm(target, { recursive: true, force: true })
}
