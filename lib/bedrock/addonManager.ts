import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { SERVER_DIR } from '../paths'
import { getSetting } from '../db'
import { getPropertyValue, setPropertyValue, getWorldName, getWorldDir } from './properties'
import { enableWorldExperimentsSync, checkWorldExperiments } from './levelEditor'

export { getWorldName, getWorldDir }


// จัดการ Addons: .mcaddon / .mcpack / .zip
// - ตรวจ manifest.json หา uuid/version/modules
// - แยก resource ↔ behavior จาก modules[].type
// - ตรวจสอบ min_engine_version เทียบกับเวอร์ชันเซิร์ฟเวอร์
// - ตรวจสอบความเข้ากันได้ของ dependencies ระหว่าง BP และ RP
// - เปิดใช้งานด้วยการเขียน world_resource_packs.json / world_behavior_packs.json ของโลกปัจจุบัน

export type PackType = 'resource' | 'behavior'
export type PackSource = 'builtin' | 'custom'

export interface AddonDependency {
  uuid: string
  version?: number[]
}

export interface AddonInfo {
  type: PackType
  dirName: string
  name: string
  description: string
  uuid: string
  version: number[]
  active: boolean
  builtin: boolean
  /** 'builtin' = ติดมากับ BDS/เกม | 'custom' = ผู้ใช้ติดตั้งเอง */
  packSource: PackSource
  minEngineVersion?: number[] | null
  compatibilityStatus: 'compatible' | 'warning' | 'unknown'
  compatibilityNote: string | null
  dependencies?: AddonDependency[]
  dependencyWarnings?: string[]
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
  min_engine_version?: number[] | { major: number; minor: number; patch: number }
}

interface Manifest {
  header?: ManifestHeader
  modules?: Array<{ type?: string }>
  dependencies?: Array<{ uuid?: string; version?: number[] | string }>
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
  // ครอบคลุม: vanilla*, chemistry*, experimental*, education*, editor, server_*, vanilla_base
  return /^(vanilla|chemistry|experimental|education|editor|server_|vanilla_base)/i.test(dirName)
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

export function packTypeOf(
  manifest: Manifest,
  hintContext?: { name?: string; prefix?: string; entries?: string[] }
): PackType | null {
  const types = (manifest.modules ?? []).map((m) => String(m.type ?? '').toLowerCase())

  // 1. ตรวจสอบ modules[].type ตามมาตรฐาน Minecraft Bedrock
  // Resource Pack: resources, client_data, interface, skin_pack
  if (
    types.some(
      (t) =>
        t.includes('resource') ||
        t.includes('client_data') ||
        t.includes('interface') ||
        t.includes('skin')
    )
  ) {
    return 'resource'
  }

  // Behavior Pack: data, behavior, script (JavaScript/TypeScript Script API), gametest, world_template
  if (
    types.some(
      (t) =>
        t.includes('data') ||
        t.includes('behavior') ||
        t.includes('script') ||
        t.includes('gametest') ||
        t.includes('world_template')
    )
  ) {
    return 'behavior'
  }

  // 2. Fallback: ตรวจสอบจากชื่อหรือ path ของโฟลเดอร์ (เช่น bp/ หรือ rp/)
  const nameStr = `${manifest.header?.name ?? ''} ${hintContext?.name ?? ''} ${hintContext?.prefix ?? ''}`.toLowerCase()
  if (/(^|[\W_])(bp|behavior|behaviors)([\W_]|$)/i.test(nameStr)) return 'behavior'
  if (/(^|[\W_])(rp|resource|resources|texture|textures)([\W_]|$)/i.test(nameStr)) return 'resource'

  // 3. Fallback: ตรวจสอบจากโครงสร้างไฟล์ข้างใน pack
  if (hintContext?.entries && hintContext.entries.length > 0) {
    const entryLower = hintContext.entries.map((e) => e.toLowerCase())
    if (
      entryLower.some(
        (e) =>
          e.includes('scripts/') ||
          e.includes('entities/') ||
          e.includes('functions/') ||
          e.includes('recipes/')
      )
    ) {
      return 'behavior'
    }
    if (
      entryLower.some(
        (e) =>
          e.includes('textures/') ||
          e.includes('ui/') ||
          e.includes('font/') ||
          e.includes('sounds/')
      )
    ) {
      return 'resource'
    }
  }

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

export function checkVersionCompatibility(
  minEngineVersion: number[] | null | undefined,
  serverVersionStr: string | null
): {
  status: 'compatible' | 'warning' | 'unknown'
  note: string
} {
  if (!minEngineVersion || minEngineVersion.length === 0 || minEngineVersion.every((v) => v === 0)) {
    return { status: 'unknown', note: 'ไม่ระบุ min_engine_version' }
  }

  const minStr = `v${minEngineVersion.join('.')}`
  if (!serverVersionStr) {
    return { status: 'unknown', note: `ต้องการ ${minStr}+` }
  }

  // Parse server version (e.g. "1.26.52.3" -> [1, 26, 52])
  const serverParts = serverVersionStr.split('.').map((p) => Number(p) || 0)

  const maxLen = Math.max(minEngineVersion.length, Math.min(3, serverParts.length))
  for (let i = 0; i < maxLen; i++) {
    const s = serverParts[i] ?? 0
    const m = minEngineVersion[i] ?? 0
    if (s > m) {
      return {
        status: 'compatible',
        note: `เข้ากันได้ (เซิร์ฟเวอร์ v${serverVersionStr} ≥ ${minStr})`,
      }
    }
    if (s < m) {
      return {
        status: 'warning',
        note: `ต้องการ ${minStr}+ (เซิร์ฟเวอร์คือ v${serverVersionStr})`,
      }
    }
  }

  return {
    status: 'compatible',
    note: `ตรงรุ่นพอดี (${minStr})`,
  }
}

export interface AddonsListResult {
  worldName: string | null
  worldExists: boolean
  serverVersion: string | null
  texturepackRequired: boolean
  experiments: {
    available: boolean
    enabled: boolean
    flags: Record<string, boolean>
  }
  addons: AddonInfo[]
  counts: {
    all: number
    custom: number
    builtin: number
    behavior: number
    resource: number
  }
}

let addonsCache: { at: number; data: AddonsListResult } | null = null
const ADDONS_CACHE_TTL = 3000

export function invalidateAddonsCache(): void {
  addonsCache = null
}

export async function listAddons(): Promise<AddonsListResult> {
  if (addonsCache && Date.now() - addonsCache.at < ADDONS_CACHE_TTL) {
    return addonsCache.data
  }

  const worldName = getWorldName()
  const worldDir = worldName ? path.join(SERVER_DIR, 'worlds', worldName) : null
  const worldExists = !!worldDir && fs.existsSync(worldDir)
  const serverVersion = getSetting('installedVersion') ?? null

  // อ่าน world packs ทั้ง 2 ประเภทพร้อมกัน (parallel)
  const activeMap = new Map<string, boolean>()
  if (worldExists && worldDir) {
    const [rpEntries, bpEntries] = await Promise.all([
      Promise.resolve(readWorldPacks(worldDir, 'resource')),
      Promise.resolve(readWorldPacks(worldDir, 'behavior')),
    ])
    for (const e of rpEntries) activeMap.set(`resource:${e.pack_id}`, true)
    for (const e of bpEntries) activeMap.set(`behavior:${e.pack_id}`, true)
  }

  // อ่านโฟลเดอร์ resource_packs และ behavior_packs พร้อมกัน (parallel readdir)
  const [rpDirs, bpDirs] = await Promise.all([
    fsp.readdir(packDirFor('resource'), { withFileTypes: true }).catch(() => [] as import('fs').Dirent[]),
    fsp.readdir(packDirFor('behavior'), { withFileTypes: true }).catch(() => [] as import('fs').Dirent[]),
  ])

  type DirWork = { type: PackType; entry: import('fs').Dirent }
  const workList: DirWork[] = [
    ...rpDirs.filter((e) => e.isDirectory()).map((e) => ({ type: 'resource' as PackType, entry: e })),
    ...bpDirs.filter((e) => e.isDirectory()).map((e) => ({ type: 'behavior' as PackType, entry: e })),
  ]

  // อ่าน manifest ทั้งหมดพร้อมกัน (Promise.all) — เร็วกว่า sequential อย่างมากเมื่อมี 100+ packs
  const addons: AddonInfo[] = await Promise.all(
    workList.map(async ({ type, entry }) => {
      const root = packDirFor(type)
      const manifestPath = path.join(root, entry.name, 'manifest.json')
      const builtin = isBuiltinDir(entry.name)
      const packSource: PackSource = builtin ? 'builtin' : 'custom'

      if (!fs.existsSync(manifestPath)) {
        return {
          type,
          dirName: entry.name,
          name: entry.name,
          description: '',
          uuid: '',
          version: [0, 0, 0] as number[],
          active: false,
          builtin,
          packSource,
          compatibilityStatus: 'unknown' as const,
          compatibilityNote: null,
          error: 'ไม่พบ manifest.json',
        } satisfies AddonInfo
      }

      let manifestBuf: Buffer
      try {
        manifestBuf = await fsp.readFile(manifestPath)
      } catch {
        return {
          type,
          dirName: entry.name,
          name: entry.name,
          description: '',
          uuid: '',
          version: [0, 0, 0] as number[],
          active: false,
          builtin,
          packSource,
          compatibilityStatus: 'unknown' as const,
          compatibilityNote: null,
          error: 'อ่าน manifest.json ไม่สำเร็จ',
        } satisfies AddonInfo
      }

      const manifest = readManifestBuffer(manifestBuf)
      const header = manifest?.header

      if (!header?.uuid) {
        return {
          type,
          dirName: entry.name,
          name: header?.name ?? entry.name,
          description: header?.description ?? '',
          uuid: '',
          version: normalizeVersion(header?.version),
          active: false,
          builtin,
          packSource,
          compatibilityStatus: 'unknown' as const,
          compatibilityNote: null,
          error: 'manifest.json ไม่ถูกต้อง (ไม่มี header.uuid)',
        } satisfies AddonInfo
      }

      const minEngine = header.min_engine_version ? normalizeVersion(header.min_engine_version) : null
      const comp = checkVersionCompatibility(minEngine, serverVersion)

      const deps: AddonDependency[] = (manifest?.dependencies ?? [])
        .filter((d) => !!d.uuid)
        .map((d) => ({
          uuid: String(d.uuid),
          version: Array.isArray(d.version) ? normalizeVersion(d.version) : undefined,
        }))

      return {
        type,
        dirName: entry.name,
        name: header.name ?? entry.name,
        description: header.description ?? '',
        uuid: header.uuid,
        version: normalizeVersion(header.version),
        active: activeMap.get(`${type}:${header.uuid}`) ?? false,
        builtin,
        packSource,
        minEngineVersion: minEngine,
        compatibilityStatus: comp.status,
        compatibilityNote: comp.note,
        dependencies: deps,
        dependencyWarnings: [],
      } satisfies AddonInfo
    })
  )

  // Cross-reference dependencies
  const uuidMap = new Map<string, AddonInfo>()
  for (const a of addons) {
    if (a.uuid) uuidMap.set(a.uuid, a)
  }

  for (const addon of addons) {
    const warnings: string[] = []
    if (addon.dependencies && addon.dependencies.length > 0) {
      for (const dep of addon.dependencies) {
        const target = uuidMap.get(dep.uuid)
        if (!target) {
          warnings.push(`ต้องใช้แพ็กคู่ (UUID: ${dep.uuid.slice(0, 8)}...) ซึ่งยังไม่ได้ติดตั้ง`)
        } else if (addon.active && !target.active) {
          warnings.push(
            `ต้องเปิดใช้งานคู่กับ "${target.name}" (${target.type === 'resource' ? 'Resource Pack' : 'Behavior Pack'})`
          )
        }
      }
    }
    addon.dependencyWarnings = warnings
  }

  addons.sort((a, b) => {
    // Custom packs ขึ้นก่อน builtin เสมอ
    if (a.packSource !== b.packSource) return a.packSource === 'custom' ? -1 : 1
    return a.name.localeCompare(b.name, 'th')
  })

  const experiments = checkWorldExperiments()
  const texturepackRequired = getPropertyValue('texturepack-required') === 'true'

  const counts = {
    all: addons.length,
    custom: addons.filter((a) => a.packSource === 'custom').length,
    builtin: addons.filter((a) => a.packSource === 'builtin').length,
    behavior: addons.filter((a) => a.type === 'behavior').length,
    resource: addons.filter((a) => a.type === 'resource').length,
  }

  const result = { worldName, worldExists, serverVersion, texturepackRequired, experiments, addons, counts }
  addonsCache = { at: Date.now(), data: result }
  return result
}



/**
 * ค้นหา EOCD signature PK\x05\x06 และตัด trailing bytes ส่วนเกินที่ทำให้ adm-zip ล้มเหลว
 */
function sanitizeZipBuffer(b: Buffer): Buffer | null {
  for (let i = b.length - 22; i >= 0; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) {
      const commentLen = b.readUInt16LE(i + 20)
      const expectedEnd = i + 22 + commentLen
      if (expectedEnd <= b.length) {
        return b.subarray(0, expectedEnd)
      }
    }
  }
  return null
}

/**
 * เปิด ZIP archive อย่างปลอดภัยและยืดหยุ่น รองรับไฟล์ที่มี trailing data หรือ padding
 */
function safeOpenZip(buf: Buffer, contextName = 'ไฟล์'): AdmZip {
  if (!buf || buf.length < 22) {
    throw new Error(`${contextName} ไม่มีข้อมูลหรือมีขนาดเล็กเกินกว่าโครงสร้าง ZIP (${buf ? buf.length : 0} bytes)`)
  }

  // 1. ลองเปิดแบบปกติ
  try {
    const zip = new AdmZip(buf)
    zip.getEntries()
    return zip
  } catch (firstErr) {
    // 2. ลองตัด trailing data ส่วนเกินออก (หลาย addon ที่ดาวน์โหลดมามี padding หรือ signature ท้ายไฟล์)
    const sanitized = sanitizeZipBuffer(buf)
    if (sanitized && sanitized.length !== buf.length) {
      try {
        const zip = new AdmZip(sanitized)
        zip.getEntries()
        return zip
      } catch {
        // continue
      }
    }

    // 3. ลองหา PK\x03\x04 ที่อาจถูกขึ้นต้นด้วย metadata/SFX stub
    const firstPk = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    if (firstPk > 0) {
      try {
        const sliced = buf.subarray(firstPk)
        const zip = new AdmZip(sliced)
        zip.getEntries()
        return zip
      } catch {
        // continue
      }
    }

    // ตรวจสอบ Magic bytes ที่ไม่ใช่ ZIP เพื่อแจ้งผู้ใช้ให้เข้าใจง่าย
    if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      throw new Error(`"${contextName}" เป็นไฟล์ GZIP (.gz) ไม่ใช่ไฟล์ ZIP Archive ปกติ`)
    }
    if (buf.length >= 6 && buf.toString('ascii', 0, 6) === '7z\xbc\xaf\x27\x1c') {
      throw new Error(`"${contextName}" เป็นไฟล์บีบอัด 7-Zip (.7z) กรุณาบันทึกเป็น .zip, .mcpack หรือ .mcaddon`)
    }
    if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'Rar!') {
      throw new Error(`"${contextName}" เป็นไฟล์บีบอัด RAR (.rar) กรุณาบันทึกเป็น .zip, .mcpack หรือ .mcaddon`)
    }

    throw new Error(`รูปแบบไฟล์บีบอัดไม่ถูกต้อง หรือไฟล์เสียหาย (${firstErr instanceof Error ? firstErr.message : String(firstErr)})`)
  }
}

/** ค้นหา "pack" ทั้งหมดในไฟล์ที่อัปโหลด: manifest ในทุกระดับโฟลเดอร์ หรือ zip ซ้อน (.mcaddon) */
function findPackCandidates(buf: Buffer, warnings: string[]): PackCandidate[] {
  const zip = safeOpenZip(buf)
  const out: PackCandidate[] = []

  // 1. ค้นหา manifest.json ในทุกระดับโฟลเดอร์ของ zip หลัก
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    const nameLower = entry.entryName.toLowerCase().replace(/\\/g, '/')
    if (nameLower === 'manifest.json' || nameLower.endsWith('/manifest.json')) {
      const slashIdx = entry.entryName.lastIndexOf('/')
      const prefix = slashIdx >= 0 ? entry.entryName.slice(0, slashIdx + 1) : ''
      const manifest = readManifestBuffer(entry.getData())
      if (manifest?.header?.uuid) {
        const fallback = prefix.replace(/\/$/, '').split('/').pop() || 'pack'
        out.push({ manifest, zip, prefix, fallbackName: fallback })
      }
    }
  }

  // 2. .mcaddon บางไฟล์บรรจุ .mcpack/.zip ซ้อนอยู่ข้างใน
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    if (!/\.(zip|mcpack)$/i.test(entry.entryName)) continue
    try {
      const innerBuf = entry.getData()
      const inner = safeOpenZip(innerBuf, entry.entryName)
      for (const innerEntry of inner.getEntries()) {
        if (innerEntry.isDirectory) continue
        const innerNameLower = innerEntry.entryName.toLowerCase().replace(/\\/g, '/')
        if (innerNameLower === 'manifest.json' || innerNameLower.endsWith('/manifest.json')) {
          const slashIdx = innerEntry.entryName.lastIndexOf('/')
          const prefix = slashIdx >= 0 ? innerEntry.entryName.slice(0, slashIdx + 1) : ''
          const manifest = readManifestBuffer(innerEntry.getData())
          if (manifest?.header?.uuid) {
            const fallback =
              prefix.replace(/\/$/, '').split('/').pop() ||
              path.basename(entry.entryName).replace(/\.[^.]+$/, '') ||
              'pack'
            out.push({ manifest, zip: inner, prefix, fallbackName: fallback })
          }
        }
      }
    } catch (innerErr) {
      warnings.push(`ตรวจสอบแพ็กย่อย "${entry.entryName}" ไม่สำเร็จ (${innerErr instanceof Error ? innerErr.message : String(innerErr)})`)
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
    const type = packTypeOf(cand.manifest, {
      name: cand.fallbackName,
      prefix: cand.prefix,
      entries: cand.zip.getEntries().map((e) => e.entryName),
    })
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
      if (cand.prefix && !entry.entryName.startsWith(cand.prefix)) continue
      const rel = cand.prefix ? entry.entryName.slice(cand.prefix.length) : entry.entryName
      if (!rel || rel.startsWith('..')) continue
      const outPath = path.join(target, rel)
      if (!path.normalize(outPath).startsWith(normalizedTarget)) continue // กัน path traversal
      await fsp.mkdir(path.dirname(outPath), { recursive: true })
      await fsp.writeFile(outPath, entry.getData())
    }
    const minEngine = header.min_engine_version ? normalizeVersion(header.min_engine_version) : null
    const serverVersion = getSetting('installedVersion') ?? null
    const comp = checkVersionCompatibility(minEngine, serverVersion)

    packs.push({
      type,
      dirName,
      name: header.name ?? dirName,
      description: header.description ?? '',
      uuid: header.uuid!,
      version: normalizeVersion(header.version),
      active: false,
      builtin: false,
      packSource: 'custom',
      minEngineVersion: minEngine,
      compatibilityStatus: comp.status,
      compatibilityNote: comp.note,
      dependencies: [],
      dependencyWarnings: [],
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
  invalidateAddonsCache()
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

  // ซิงค์การตั้งค่าแพ็ก, บังคับโหลด texture pack, และเปิดการทดลอง (experiments) อัตโนมัติ
  invalidateAddonsCache()
  try {
    autoConfigureAddonsAndWorld()
  } catch (err) {
    console.warn('[addonManager] autoConfigureAddonsAndWorld warning:', err)
  }
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

  // ซิงค์ valid_known_packs.json หลังลบ
  invalidateAddonsCache()
  try {
    autoConfigureAddonsAndWorld()
  } catch (err) {
    console.warn('[addonManager] autoConfigureAddonsAndWorld warning:', err)
  }
}

/**
 * สแกน resource_packs และ behavior_packs ทั้งหมด แล้วสร้าง server_data/valid_known_packs.json
 * ซึ่งจำเป็นสำหรับ Bedrock Dedicated Server ในการตรวจจับและส่งแพ็กให้กับ client ที่เชื่อมต่อเข้ามา
 */
export function syncValidKnownPacks(): number {
  const packs: Array<{
    file_system: string
    path: string
    uuid: string
    version: string
  }> = []

  for (const type of ['resource', 'behavior'] as PackType[]) {
    const root = packDirFor(type)
    if (!fs.existsSync(root)) continue
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const manifestPath = path.join(root, entry.name, 'manifest.json')
        if (!fs.existsSync(manifestPath)) continue
        try {
          const manifest = readManifestBuffer(fs.readFileSync(manifestPath))
          const header = manifest?.header
          if (!header?.uuid) continue
          const versionArr = normalizeVersion(header.version)
          packs.push({
            file_system: 'RawPath',
            path: `${type === 'resource' ? 'resource_packs' : 'behavior_packs'}/${entry.name}`,
            uuid: header.uuid,
            version: versionArr.join('.'),
          })
        } catch {
          // ละเว้น pack ที่อ่าน manifest ไม่สำเร็จ
        }
      }
    } catch {
      // ละเว้นหากโฟลเดอร์ไม่สามารถอ่านได้
    }
  }

  const targetPath = path.join(SERVER_DIR, 'valid_known_packs.json')
  fs.writeFileSync(targetPath, JSON.stringify(packs, null, 2) + '\n', 'utf8')
  return packs.length
}

/**
 * ตรวจสอบ world_resource_packs.json หากมี resource pack ใช้งานอยู่
 * ให้ตั้งค่า texturepack-required=true ใน server.properties เพื่อบังคับให้ client ดาวน์โหลด texture pack
 */
export function syncTexturepackRequired(): boolean {
  const worldDir = getWorldDir()
  if (!worldDir) return false
  const activeRp = readWorldPacks(worldDir, 'resource')
  if (activeRp.length > 0) {
    const current = getPropertyValue('texturepack-required')
    if (current !== 'true') {
      setPropertyValue('texturepack-required', 'true')
      return true
    }
  }
  return false
}

/**
 * รวมการตั้งค่าอัตโนมัติของ Addons และ World:
 * 1. ซิงค์ valid_known_packs.json ให้ BDS รู้จักแพ็กทั้งหมด
 * 2. บังคับ texturepack-required=true เมื่อมี Resource Pack ใช้งาน เพื่อป้องกันบั๊ก UI/Texture ในเกม
 * 3. เปิดใช้งาน Experimental Gameplay ทุกฟีเจอร์ใน level.dat ของโลกปัจจุบันอัตโนมัติ
 */
export function autoConfigureAddonsAndWorld(): {
  validKnownPacksCount: number
  texturepackRequired: boolean
  experimentsEnabled: boolean
} {
  const validKnownPacksCount = syncValidKnownPacks()
  syncTexturepackRequired()
  const texturepackRequired = getPropertyValue('texturepack-required') === 'true'

  let experimentsEnabled = false
  const worldDir = getWorldDir()
  if (worldDir && fs.existsSync(path.join(worldDir, 'level.dat'))) {
    try {
      enableWorldExperimentsSync(worldDir)
      experimentsEnabled = true
    } catch (err) {
      console.warn('[AddonManager] Failed to auto-enable experiments:', err)
    }
  }

  return {
    validKnownPacksCount,
    texturepackRequired,
    experimentsEnabled,
  }
}

