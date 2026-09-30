import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { DOWNLOADS_DIR, SERVER_DIR, STAGING_DIR } from '../paths'
import { getSetting, setSetting } from '../db'
import { getRuntime } from './runtime'
import { buildDownloadUrl, fetchAvailableVersions, platformUrlOf } from './versions'
import type { InstallJob, InstallPhase } from '../types'

// ไฟล์เหล่านี้จะไม่ถูกเขียนทับเมื่ออัปเดตเวอร์ชัน (ค่าที่ผู้ใช้ตั้งไว้เดิม)
const PRESERVE_FILES = new Set(['server.properties', 'whitelist.json', 'permissions.json'])
// โฟลเดอร์ pack จาก zip ทางการ — merge เฉพาะรายการที่มีใน zip ใหม่ ไม่ลบของผู้ใช้
const PACK_DIRS = new Set(['resource_packs', 'behavior_packs'])

function isTerminalPhase(phase: InstallPhase): boolean {
  return phase === 'done' || phase === 'error'
}

export function getCurrentJob(): InstallJob | null {
  return getRuntime().currentJob
}

function emitJob(job: InstallJob): void {
  const runtime = getRuntime()
  runtime.currentJob = job
  runtime.broadcast({ t: 'install', job })
}

function makeJob(version: string): InstallJob {
  return {
    id: crypto.randomUUID(),
    version,
    url: '',
    phase: 'resolving',
    receivedBytes: 0,
    totalBytes: null,
    error: null,
    startedAt: Date.now(),
    finishedAt: null,
  }
}

/**
 * เริ่มงานติดตั้ง/อัปเดตแบบทำงานเบื้องหลัง แล้วคืนสถานะ job ล่าสุดทันที
 * progress ติดตามผ่าน GET /api/bedrock/install หรือ WebSocket (t:'install')
 */
export function startInstall(versionInput?: string): InstallJob {
  const runtime = getRuntime()
  if (runtime.currentJob && !isTerminalPhase(runtime.currentJob.phase)) {
    throw new Error('มีงานติดตั้งกำลังทำงานอยู่ — รอให้เสร็จก่อน')
  }
  if (runtime.manager.isProcessActive()) {
    throw new Error('กรุณาหยุดเซิร์ฟเวอร์ก่อนติดตั้งหรืออัปเดตเวอร์ชัน')
  }

  const requested = versionInput?.trim() || 'latest'
  let job = makeJob(requested)
  emitJob(job)

  void runInstall(job).catch((err: unknown) => {
    // กันช่องโหว่สุดท้าย — error ควรถูกจับใน runInstall แล้ว
    emitJob({ ...job, phase: 'error', error: String(err), finishedAt: Date.now() })
  })
  return job
}

async function runInstall(job: InstallJob): Promise<void> {
  const runtime = getRuntime()
  try {
    // 1) หา URL ของเวอร์ชันที่ต้องการ
    let url: string
    let version: string
    if (job.version === 'latest') {
      const { latest, versions } = await fetchAvailableVersions()
      const chosen = versions.find((v) => v.version === latest) ?? versions[0]
      if (!chosen) throw new Error('ไม่สามารถตรวจสอบเวอร์ชันล่าสุดจาก minecraft.net ได้ — ลองระบุเลขเวอร์ชันเอง')
      url = platformUrlOf(chosen) ?? buildDownloadUrl(chosen.version)
      version = chosen.version
    } else {
      version = job.version
      url = buildDownloadUrl(version)
    }
    job = { ...job, version, url, phase: 'downloading', totalBytes: null, receivedBytes: 0 }
    emitJob(job)

    // 2) ดาวน์โหลด .zip จากเซิร์ฟเวอร์ของ Mojang
    const zipPath = path.join(DOWNLOADS_DIR, `bedrock-server-${version}.zip`)
    await fsp.mkdir(DOWNLOADS_DIR, { recursive: true })
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BDS-Dashboard/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20 * 60_000),
    })
    if (!res.ok || !res.body) throw new Error(`ดาวน์โหลดล้มเหลว (HTTP ${res.status}) — ตรวจว่าเวอร์ชัน ${version} มีจริงหรือไม่`)
    const total = Number(res.headers.get('content-length') ?? 0) || null
    job = { ...job, totalBytes: total }
    emitJob(job)

    let received = 0
    let lastEmit = 0
    const out = fs.createWriteStream(zipPath)
    const writeError: Promise<never> = new Promise((_resolve, reject) => {
      out.on('error', reject)
    })
    const body = res.body as unknown as AsyncIterable<Uint8Array>
    await Promise.race([
      (async () => {
        for await (const chunk of body) {
          if (!out.write(Buffer.from(chunk))) {
            await new Promise<void>((resolve) => out.once('drain', resolve))
          }
          received += chunk.byteLength
          if (Date.now() - lastEmit > 300) {
            lastEmit = Date.now()
            job = { ...job, receivedBytes: received }
            emitJob(job)
          }
        }
        await new Promise<void>((resolve) => out.end(resolve))
      })(),
      writeError,
    ])
    job = { ...job, receivedBytes: received, phase: 'extracting' }
    emitJob(job)

    // 3) แตกไฟล์ลงพื้นที่ staging
    const staging = path.join(STAGING_DIR, job.id)
    await fsp.rm(staging, { recursive: true, force: true })
    const zip = new AdmZip(zipPath)
    await new Promise<void>((resolve, reject) => {
      zip.extractAllToAsync(staging, true, true, (err) => (err ? reject(err) : resolve()))
    })

    // 4) merge ลง SERVER_DIR โดยคง server.properties / worlds / whitelist / permissions
    job = { ...job, phase: 'merging' }
    emitJob(job)
    await mergeInstallIntoServerDir(staging)

    // 5) จัดสิทธิ์ + บันทึกเวอร์ชัน
    job = { ...job, phase: 'finalizing' }
    emitJob(job)
    if (process.platform !== 'win32') {
      await fsp.chmod(path.join(SERVER_DIR, 'bedrock_server'), 0o755).catch(() => undefined)
    }
    setSetting('installedVersion', version)
    try {
      const history = JSON.parse(getSetting('installHistory') ?? '[]') as Array<{ version: string; at: number }>
      history.unshift({ version, at: Date.now() })
      setSetting('installHistory', JSON.stringify(history.slice(0, 20)))
    } catch {
      setSetting('installHistory', JSON.stringify([{ version, at: Date.now() }]))
    }

    // เก็บกวาด
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => undefined)
    await fsp.rm(zipPath, { force: true }).catch(() => undefined)

    job = { ...job, phase: 'done', finishedAt: Date.now() }
    emitJob(job)
    runtime.manager.onFilesChanged()
    runtime.manager.appendLog(`[Dashboard] ติดตั้ง Bedrock Server เวอร์ชัน ${version} เรียบร้อยแล้ว`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    job = { ...job, phase: 'error', error: message, finishedAt: Date.now() }
    emitJob(job)
    getRuntime().manager.appendLog(`[Dashboard] การติดตั้งล้มเหลว: ${message}`)
  }
}

/**
 * คัดลอกทุกอย่างจาก staging ไป SERVER_DIR:
 * - ไฟล์ที่ต้องคงไว้ (มีอยู่แล้วในปลายทาง) จะข้าม
 * - worlds/ ไม่มีใน zip จึงไม่ถูกแตะอยู่แล้ว
 * - resource_packs/behavior_packs จะ merge ทีละรายการ (ทับของเดิมที่ชื่อเดียวกัน แต่ไม่ลบ pack ที่ผู้ใช้ติดตั้งเพิ่ม)
 */
async function mergeInstallIntoServerDir(staging: string): Promise<void> {
  await fsp.mkdir(SERVER_DIR, { recursive: true })
  const entries = await fsp.readdir(staging, { withFileTypes: true })
  for (const entry of entries) {
    const src = path.join(staging, entry.name)
    const dst = path.join(SERVER_DIR, entry.name)
    if (entry.isFile() && PRESERVE_FILES.has(entry.name) && fs.existsSync(dst)) continue
    if (entry.isDirectory() && PACK_DIRS.has(entry.name)) {
      await mergePackDir(src, dst)
      continue
    }
    await fsp.rm(dst, { recursive: true, force: true })
    await fsp.cp(src, dst, { recursive: true })
  }
}

async function mergePackDir(src: string, dst: string): Promise<void> {
  await fsp.mkdir(dst, { recursive: true })
  const children = await fsp.readdir(src, { withFileTypes: true })
  for (const child of children) {
    const childSrc = path.join(src, child.name)
    const childDst = path.join(dst, child.name)
    await fsp.rm(childDst, { recursive: true, force: true })
    await fsp.cp(childSrc, childDst, { recursive: true })
  }
}
