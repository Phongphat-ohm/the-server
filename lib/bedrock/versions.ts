// ดึงรายการเวอร์ชัน Bedrock Dedicated Server จากหลายแหล่งตามลำดับความน่าเชื่อถือ:
// 1) API ทางการของ Mojang (endpoint เดียวกับที่หน้า minecraft.net ใช้) — ใช้ระบุ "เวอร์ชันล่าสุด"
// 2) คลังประวัติเวอร์ชันสาธารณะ kittizz/bedrock-server-downloads — รายการ build เก่าครบ
// 3) สแกน HTML ของหน้าดาวน์โหลด (ทางสำรองสุดท้าย)
// การดาวน์โหลดทุกกรณีชี้ไปที่ www.minecraft.net/bedrockdedicatedserver ของ Mojang เองเสมอ

export const DOWNLOAD_PAGE_URL = 'https://www.minecraft.net/en-us/download/server/bedrock/'
export const DOWNLOAD_LINKS_API =
  'https://net-secondary.web.minecraft-services.net/api/v1.0/download/links?application=MinecraftNet'
export const VERSION_HISTORY_URL =
  'https://raw.githubusercontent.com/kittizz/bedrock-server-downloads/main/bedrock-server-downloads.json'
export const USER_AGENT = 'BDS-Dashboard/1.0 (+minecraft.net official downloads)'

export interface VersionInfo {
  version: string
  winUrl: string | null
  linuxUrl: string | null
}

const CACHE_MS = 5 * 60 * 1000
let cache: { at: number; data: VersionInfo[] } | null = null

export function platformUrlOf(v: VersionInfo): string | null {
  return process.platform === 'win32' ? v.winUrl : v.linuxUrl
}

/** สร้าง URL ดาวน์โหลดจากเลขเวอร์ชัน เช่น 1.21.93.01 (รูปแบบทางการ ใช้ได้ทุกเวอร์ชันที่เคยเผยแพร่) */
export function buildDownloadUrl(version: string): string {
  const segment = process.platform === 'win32' ? 'bin-win' : 'bin-linux'
  return `https://www.minecraft.net/bedrockdedicatedserver/${segment}/bedrock-server-${version}.zip`
}

function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0
    const dbv = pb[i] ?? 0
    if (da !== dbv) return dbv - da
  }
  return 0
}

function upsert(map: Map<string, VersionInfo>, version: string): VersionInfo {
  let item = map.get(version)
  if (!item) {
    item = { version, winUrl: null, linuxUrl: null }
    map.set(version, item)
  }
  return item
}

/** แหล่งที่ 1: API ทางการ — บอก release ล่าสุดแม่นยำที่สุด (คัด preview ออก) */
async function fetchFromLinksApi(): Promise<Map<string, VersionInfo>> {
  const res = await fetch(DOWNLOAD_LINKS_API, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`API ของ Mojang ตอบกลับด้วยสถานะ ${res.status}`)
  const body = (await res.json()) as {
    result?: { links?: Array<{ downloadType?: string; downloadUrl?: string }> }
  }
  const map = new Map<string, VersionInfo>()
  for (const link of body.result?.links ?? []) {
    if (link.downloadType !== 'serverBedrockWindows' && link.downloadType !== 'serverBedrockLinux') continue
    const match = /bedrock-server-(\d+(?:\.\d+){2,3})\.zip$/.exec(link.downloadUrl ?? '')
    if (!match || !link.downloadUrl) continue
    const item = upsert(map, match[1])
    if (link.downloadType === 'serverBedrockWindows') item.winUrl = link.downloadUrl
    else item.linuxUrl = link.downloadUrl
  }
  if (map.size === 0) throw new Error('API ของ Mojang ไม่มีลิงก์ release')
  return map
}

/** แหล่งที่ 2: คลังประวัติเวอร์ชัน (มี build เก่าครบทุกเวอร์ชัน) */
async function fetchFromHistoryRepo(): Promise<Map<string, VersionInfo>> {
  const res = await fetch(VERSION_HISTORY_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`คลังประวัติเวอร์ชันตอบกลับด้วยสถานะ ${res.status}`)
  const body = (await res.json()) as {
    release?: Record<string, { windows?: { url?: string }; linux?: { url?: string } }>
  }
  const map = new Map<string, VersionInfo>()
  for (const entry of Object.values(body.release ?? {})) {
    const urls = [entry.windows?.url, entry.linux?.url]
    for (const url of urls) {
      const match = /bedrock-server-(\d+(?:\.\d+){2,3})\.zip$/.exec(url ?? '')
      if (!match || !url) continue
      const item = upsert(map, match[1])
      if (url.includes('bin-win')) item.winUrl = item.winUrl ?? url
      else if (url.includes('bin-linux')) item.linuxUrl = item.linuxUrl ?? url
    }
  }
  if (map.size === 0) throw new Error('คลังประวัติเวอร์ชันไม่มีข้อมูล release')
  return map
}

/** แหล่งที่ 3 (สำรองสุดท้าย): สแกนหน้าดาวน์โหลด */
async function fetchFromDownloadPage(): Promise<Map<string, VersionInfo>> {
  const res = await fetch(DOWNLOAD_PAGE_URL, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(20_000),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`เปิดหน้าดาวน์โหลดของ minecraft.net ไม่ได้ (HTTP ${res.status})`)
  const html = await res.text()
  const map = new Map<string, VersionInfo>()
  const re = /https:\/\/[^"'\s\\<>]+?bedrock-server-(\d+(?:\.\d+){2,3})\.zip/g
  for (const match of html.matchAll(re)) {
    const url = match[0]
    const item = upsert(map, match[1])
    if (/bin-win/.test(url)) item.winUrl = item.winUrl ?? url
    else if (/bin-linux/.test(url)) item.linuxUrl = item.linuxUrl ?? url
    else if (process.platform === 'win32') item.winUrl = item.winUrl ?? url
    else item.linuxUrl = item.linuxUrl ?? url
  }
  if (map.size === 0) throw new Error('ไม่พบลิงก์ดาวน์โหลดในหน้าเว็บ')
  return map
}

async function trySources(): Promise<Map<string, VersionInfo>> {
  // รวมทุกแหล่งที่ตอบมาได้: ลิงก์จะถูกเติมเฉพาะช่องที่ยังว่าง (แหล่งแรกมีสิทธิ์ก่อน)
  const merged = new Map<string, VersionInfo>()
  const errors: string[] = []
  for (const source of [fetchFromLinksApi, fetchFromHistoryRepo, fetchFromDownloadPage]) {
    try {
      const map = await source()
      for (const [version, info] of map) {
        const item = upsert(merged, version)
        item.winUrl = item.winUrl ?? info.winUrl
        item.linuxUrl = item.linuxUrl ?? info.linuxUrl
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }
  if (merged.size === 0) throw new Error(errors.join(' | ') || 'ไม่สามารถดึงรายการเวอร์ชันได้จากทุกแหล่ง')
  return merged
}

export async function fetchAvailableVersions(): Promise<{ latest: string | null; versions: VersionInfo[] }> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return { latest: cache.data[0]?.version ?? null, versions: cache.data }
  }
  const merged = await trySources()
  // เติมช่อง URL ของ platform ปัจจุบันด้วยรูปแบบทางการ (กันพลาดจากแหล่งใดแหล่งหนึ่ง)
  for (const item of merged.values()) {
    if (process.platform === 'win32' && !item.winUrl) item.winUrl = buildDownloadUrl(item.version)
    if (process.platform !== 'win32' && !item.linuxUrl) item.linuxUrl = buildDownloadUrl(item.version)
  }
  const versions = [...merged.values()].sort((a, b) => compareVersionsDesc(a.version, b.version)).slice(0, 100)
  cache = { at: Date.now(), data: versions }
  return { latest: versions[0]?.version ?? null, versions }
}
