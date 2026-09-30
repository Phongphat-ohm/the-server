import { spawn } from 'node:child_process'
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
const PRESERVE_FILES = new Set(['server.properties', 'whitelist.json', 'allowlist.json', 'permissions.json'])
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

function makeJob(version: string, freshInstall = false): InstallJob {
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
    freshInstall,
  }
}

/**
 * เริ่มงานติดตั้ง/อัปเดตแบบทำงานเบื้องหลัง แล้วคืนสถานะ job ล่าสุดทันที
 * progress ติดตามผ่าน GET /api/bedrock/install หรือ WebSocket (t:'install')
 */
export function startInstall(versionInput?: string, options?: { freshInstall?: boolean }): InstallJob {
  const runtime = getRuntime()
  if (runtime.currentJob && !isTerminalPhase(runtime.currentJob.phase)) {
    throw new Error('มีงานติดตั้งกำลังทำงานอยู่ — รอให้เสร็จก่อน')
  }
  if (runtime.manager.isProcessActive()) {
    throw new Error('กรุณาหยุดเซิร์ฟเวอร์ก่อนติดตั้งหรืออัปเดตเวอร์ชัน')
  }

  const requested = versionInput?.trim() || 'latest'
  const freshInstall = Boolean(options?.freshInstall)
  let job = makeJob(requested, freshInstall)
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
    const partPath = `${zipPath}.part`
    await fsp.mkdir(DOWNLOADS_DIR, { recursive: true })

    // ตรวจสอบว่ามีไฟล์ zip เดิมที่สมบูรณ์อยู่ในแคชหรือไม่
    let needDownload = true
    if (fs.existsSync(zipPath)) {
      try {
        const stat = await fsp.stat(zipPath)
        if (stat.size > 10 * 1024 * 1024) {
          const testZip = new AdmZip(zipPath)
          if (testZip.getEntries().length > 0) {
            needDownload = false
            job = { ...job, totalBytes: stat.size, receivedBytes: stat.size }
            emitJob(job)
            runtime.manager.appendLog(
              `[Dashboard] พบไฟล์ Bedrock Server ${version} ในแคช (ขนาด ${(stat.size / (1024 * 1024)).toFixed(1)} MB) — ข้ามการดาวน์โหลด`
            )
          }
        }
      } catch {
        needDownload = true
      }
    }

    if (needDownload) {
      runtime.manager.appendLog(`[Dashboard] กำลังดาวน์โหลด Bedrock Server เวอร์ชัน ${version}...`)
      const res = await fetch(url, {
        headers: { 'User-Agent': 'BDS-Dashboard/1.0 (+minecraft.net official downloads)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(20 * 60_000),
      })
      if (!res.ok || !res.body) {
        throw new Error(`ดาวน์โหลดล้มเหลว (HTTP ${res.status}) — ตรวจว่าเวอร์ชัน ${version} มีจริงหรือไม่`)
      }
      const total = Number(res.headers.get('content-length') ?? 0) || null
      job = { ...job, totalBytes: total }
      emitJob(job)

      await fsp.rm(partPath, { force: true }).catch(() => undefined)
      let received = 0
      let lastEmit = 0
      const out = fs.createWriteStream(partPath)
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
            if (Date.now() - lastEmit > 150) {
              lastEmit = Date.now()
              job = { ...job, receivedBytes: received }
              emitJob(job)
            }
          }
          await new Promise<void>((resolve) => out.end(resolve))
        })(),
        writeError,
      ])
      await fsp.rename(partPath, zipPath)
      job = { ...job, receivedBytes: received }
      emitJob(job)
    }

    // 3) แตกไฟล์ลงพื้นที่ staging (พร้อมคำนวณและรายงานความคืบหน้าแบบ Real-time %)
    const staging = path.join(STAGING_DIR, job.id)
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => undefined)
    await fsp.mkdir(staging, { recursive: true })

    let totalFiles = 100
    try {
      const z = new AdmZip(zipPath)
      const count = z.getEntries().filter((e) => !e.isDirectory).length
      if (count > 0) totalFiles = count
    } catch {}

    job = {
      ...job,
      phase: 'extracting',
      extractProgress: { extracted: 0, total: totalFiles, percent: 0 },
    }
    emitJob(job)

    let lastExtractEmit = 0
    await extractServerZip(zipPath, staging, (extracted, total) => {
      const pct = total > 0 ? Math.min(100, Math.round((extracted / total) * 100)) : 0
      const now = Date.now()
      if (now - lastExtractEmit > 150 || extracted >= total) {
        lastExtractEmit = now
        job = {
          ...job,
          extractProgress: { extracted, total, percent: pct },
        }
        emitJob(job)
      }
    })

    // 4) ติดตั้งลง SERVER_DIR
    job = { ...job, phase: 'merging' }
    emitJob(job)

    if (!fs.existsSync(staging)) {
      throw new Error(`ไม่พบโฟลเดอร์สำหรับติดตั้งไฟล์: ${staging}`)
    }

    if (job.freshInstall) {
      if (fs.existsSync(SERVER_DIR)) {
        const existing = await fsp.readdir(SERVER_DIR).catch(() => [])
        await Promise.all(
          existing
            .filter((item) => item !== '.staging' && item !== '.downloads')
            .map((item) =>
              fsp.rm(path.join(SERVER_DIR, item), { recursive: true, force: true }).catch(() => undefined)
            )
        )
      } else {
        await fsp.mkdir(SERVER_DIR, { recursive: true })
      }
      const entries = await fsp.readdir(staging, { withFileTypes: true })
      await Promise.all(
        entries.map((entry) =>
          fsp.cp(path.join(staging, entry.name), path.join(SERVER_DIR, entry.name), { recursive: true })
        )
      )
    } else {
      await mergeInstallIntoServerDir(staging)
    }

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

    // เก็บกวาด staging
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => undefined)
    await fsp.rm(partPath, { force: true }).catch(() => undefined)

    job = { ...job, phase: 'done', finishedAt: Date.now() }
    emitJob(job)
    runtime.manager.onFilesChanged()
    runtime.manager.appendLog(
      job.freshInstall
        ? `[Dashboard] ติดตั้ง Bedrock Server ใหม่สะอาดหมดจด (Fresh Reinstall) เวอร์ชัน ${version} เรียบร้อยแล้ว`
        : `[Dashboard] ติดตั้ง/อัปเดต Bedrock Server เวอร์ชัน ${version} เรียบร้อยแล้ว`
    )
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
  await Promise.all(
    entries.map(async (entry) => {
      const src = path.join(staging, entry.name)
      const dst = path.join(SERVER_DIR, entry.name)
      if (entry.isFile() && PRESERVE_FILES.has(entry.name) && fs.existsSync(dst)) return
      if (entry.isDirectory() && PACK_DIRS.has(entry.name)) {
        await mergePackDir(src, dst)
        return
      }
      await fsp.rm(dst, { recursive: true, force: true }).catch(() => undefined)
      await fsp.cp(src, dst, { recursive: true })
    })
  )
}

async function mergePackDir(src: string, dst: string): Promise<void> {
  await fsp.mkdir(dst, { recursive: true })
  const children = await fsp.readdir(src, { withFileTypes: true })
  await Promise.all(
    children.map(async (child) => {
      const childSrc = path.join(src, child.name)
      const childDst = path.join(dst, child.name)
      await fsp.rm(childDst, { recursive: true, force: true }).catch(() => undefined)
      await fsp.cp(childSrc, childDst, { recursive: true })
    })
  )
}

/**
 * แตกไฟล์ zip ของ Bedrock Server อย่างรวดเร็วและปลอดภัย:
 * 1. ใช้ native `tar -xf` (มีใน Windows 10/11 และ Linux) ซึ่งแตกไฟล์ 100MB เสร็จใน ~1-2 วินาที และไม่บล็อก Node event loop
 * 2. สำรองบน Windows ด้วย PowerShell Expand-Archive
 * 3. Fallback ด้วย AdmZip แบบ Synchronous entry-by-entry ป้องกัน callback drop bug
 */
async function extractServerZip(
  zipPath: string,
  targetDir: string,
  onProgress?: (extracted: number, total: number) => void
): Promise<void> {
  await fsp.mkdir(targetDir, { recursive: true })

  let totalFiles = 100
  try {
    const probe = new AdmZip(zipPath)
    const count = probe.getEntries().filter((e) => !e.isDirectory).length
    if (count > 0) totalFiles = count
  } catch {}

  // วิธีที่ 1: Native tar (เร็ว และรายงาน verbose progress ทาง stderr)
  const tarOk = await new Promise<boolean>((resolve) => {
    let extractedCount = 0
    const proc = spawn('tar', ['-xvf', zipPath, '-C', targetDir], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    const timer = setTimeout(() => {
      try { proc.kill() } catch {}
      resolve(false)
    }, 60_000)

    proc.stderr?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split(/\r?\n/).filter((l) => l.trim().length > 0)
      if (lines.length > 0) {
        extractedCount += lines.length
        onProgress?.(Math.min(extractedCount, totalFiles), totalFiles)
      }
    })

    proc.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        onProgress?.(totalFiles, totalFiles)
        resolve(true)
      } else {
        resolve(false)
      }
    })
  })

  if (tarOk) return

  // วิธีที่ 2: PowerShell Expand-Archive (สำหรับ Windows กรณีไม่มี tar)
  if (process.platform === 'win32') {
    const psOk = await new Promise<boolean>((resolve) => {
      const ps = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`
      ], { stdio: 'ignore' })
      const timer = setTimeout(() => {
        try { ps.kill() } catch {}
        resolve(false)
      }, 90_000)
      ps.on('error', () => {
        clearTimeout(timer)
        resolve(false)
      })
      ps.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) {
          onProgress?.(totalFiles, totalFiles)
          resolve(true)
        } else {
          resolve(false)
        }
      })
    })

    if (psOk) return
  }

  // วิธีที่ 3: Fallback ด้วย AdmZip แบบแยกไฟล์ พร้อม progress ละเอียด
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries().filter((e) => !e.isDirectory)
  const total = entries.length || totalFiles
  let extracted = 0

  for (const entry of entries) {
    const dest = path.join(targetDir, entry.entryName)
    await fsp.mkdir(path.dirname(dest), { recursive: true })
    await fsp.writeFile(dest, entry.getData())
    extracted++
    onProgress?.(extracted, total)
  }
}
