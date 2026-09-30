import os from 'node:os'
import path from 'node:path'
import si from 'systeminformation'
import { SERVER_DIR } from '../paths'

// ตรวจสอบความพร้อมของฮาร์ดแวร์ + คำนวณ Compatibility Score

const GB = 1024 ** 3

function gb(bytes: number): number {
  return Math.round((bytes / GB) * 10) / 10
}

export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface SpecCheck {
  id: string
  label: string
  value: string
  status: CheckStatus
  note: string
}

export interface SystemSpecs {
  platform: string
  platformLabel: string
  os: string
  kernel: string
  arch: string
  nodeVersion: string
  cpu: { brand: string; cores: number; physicalCores: number; speedGhz: number }
  mem: { totalGb: number; freeGb: number }
  disk: { mount: string; totalGb: number; freeGb: number } | null
  checks: SpecCheck[]
  score: number
  grade: string
  recommendedPlayers: number
  fetchedAt: number
}

type FsList = Awaited<ReturnType<typeof si.fsSize>>

function pickDisk(fsList: FsList, cwd: string): FsList[number] | null {
  if (!fsList.length) return null
  if (process.platform === 'win32') {
    const drive = cwd.slice(0, 2).toLowerCase()
    return fsList.find((d) => d.mount.toLowerCase().replace(/\\+$/, '') === drive) ?? null
  }
  const matches = fsList
    .filter((d) => cwd === d.mount || cwd.startsWith(d.mount.endsWith('/') ? d.mount : d.mount + '/'))
    .sort((a, b) => b.mount.length - a.mount.length)
  return matches[0] ?? fsList[0]
}

// In-memory cache สำหรับฮาร์ดแวร์ที่ไม่เคยเปลี่ยน (CPU, OS Info, Static specs)
interface StaticHardware {
  cpu: { brand: string; cores: number; physicalCores: number; speedGhz: number }
  osInfo: { distro: string; release: string; kernel: string }
}
let cachedHardware: StaticHardware | null = null
let cachedFsList: { data: FsList; at: number } | null = null
const FS_CACHE_TTL = 30_000 // แคชข้อมูลดิสก์ 30 วินาทีเพื่อไม่ต้องรัน WMI บ่อยๆ

async function getOrFetchHardware(): Promise<StaticHardware> {
  if (cachedHardware) return cachedHardware

  try {
    const [cpu, osInfo] = await Promise.race([
      Promise.all([si.cpu(), si.osInfo()]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('si timeout')), 2500)),
    ])
    cachedHardware = {
      cpu: {
        brand: `${cpu.manufacturer ?? ''} ${cpu.brand ?? ''}`.trim() || os.cpus()[0]?.model || 'Generic CPU',
        cores: cpu.cores || os.cpus().length || 1,
        physicalCores: cpu.physicalCores || Math.max(1, Math.floor(os.cpus().length / 2)),
        speedGhz: Math.round((cpu.speed || (os.cpus()[0]?.speed ? os.cpus()[0].speed / 1000 : 2.0)) * 10) / 10,
      },
      osInfo: {
        distro: osInfo.distro || os.type(),
        release: osInfo.release || os.release(),
        kernel: osInfo.kernel || os.version(),
      },
    }
  } catch {
    // Fallback ทันทีด้วย native node:os (0 ms) เมื่อ systeminformation ตอบช้าหรือค้าง
    const cpus = os.cpus()
    cachedHardware = {
      cpu: {
        brand: cpus[0]?.model || 'Standard CPU',
        cores: cpus.length || 1,
        physicalCores: Math.max(1, Math.floor(cpus.length / 2)),
        speedGhz: Math.round(((cpus[0]?.speed ?? 2000) / 1000) * 10) / 10,
      },
      osInfo: {
        distro: process.platform === 'win32' ? 'Windows' : os.type(),
        release: os.release(),
        kernel: os.version(),
      },
    }
  }

  return cachedHardware
}

export async function getSystemSpecs(): Promise<SystemSpecs> {
  const cwd = path.resolve(SERVER_DIR)
  const hardware = await getOrFetchHardware()

  // ดึงข้อมูลดิสก์พร้อมแคช 30 วิ (WMI ดิสก์บน Windows ช้ามาก 2-4 วินาที)
  let fsList: FsList = []
  if (cachedFsList && Date.now() - cachedFsList.at < FS_CACHE_TTL) {
    fsList = cachedFsList.data
  } else {
    try {
      fsList = await Promise.race([
        si.fsSize(),
        new Promise<FsList>((_, reject) => setTimeout(() => reject(new Error('fsSize timeout')), 2000)),
      ])
      cachedFsList = { data: fsList, at: Date.now() }
    } catch {
      fsList = cachedFsList?.data ?? []
    }
  }

  const diskInfo = pickDisk(fsList, cwd)
  // ใช้ native os module สำหรับหน่วยความจำ (0 ms)
  const totalGb = gb(os.totalmem())
  const freeGb = gb(os.freemem())
  const diskFreeGb = diskInfo ? gb(diskInfo.available) : 0

  const checks: SpecCheck[] = []
  let score = 0

  const platformOk = process.platform === 'win32' || process.platform === 'linux'
  checks.push({
    id: 'os',
    label: 'ระบบปฏิบัติการ',
    value: `${hardware.osInfo.distro} (${process.platform})`,
    status: platformOk ? 'pass' : process.platform === 'darwin' ? 'warn' : 'fail',
    note: platformOk
      ? 'Mojang เผยแพร่ไบนารีอย่างเป็นทางการ'
      : process.platform === 'darwin'
        ? 'ไม่มีไบนารีสำหรับ macOS — ต้องรันผ่านชั้นจำลองเอง'
        : 'แพลตฟอร์มนี้ไม่ได้รับการรองรับ',
  })
  score += platformOk ? 10 : process.platform === 'darwin' ? 5 : 0

  const cores = hardware.cpu.cores
  const coresOk = cores >= 4
  const coresWarn = cores >= 2
  checks.push({
    id: 'cpu',
    label: 'CPU (จำนวน Core)',
    value: `${cores} threads / ${hardware.cpu.physicalCores} cores${hardware.cpu.speedGhz ? ` @ ${hardware.cpu.speedGhz} GHz` : ''}`,
    status: coresOk ? 'pass' : coresWarn ? 'warn' : 'fail',
    note: coresOk ? 'เหมาะกับผู้เล่นหลายคนพร้อมกัน' : coresWarn ? 'ใช้ได้กับเซิร์ฟเวอร์ขนาดเล็ก' : 'น้อยเกินไปสำหรับเซิร์ฟเวอร์เกม',
  })
  score += coresOk ? 20 : coresWarn ? 12 : 0

  const ramOk = totalGb >= 4
  const ramWarn = totalGb >= 2
  checks.push({
    id: 'ram',
    label: 'RAM ทั้งหมด',
    value: `${totalGb} GB`,
    status: ramOk ? 'pass' : ramWarn ? 'warn' : 'fail',
    note: ramOk ? 'ตรงตามคำแนะนำ (4 GB ขึ้นไป)' : ramWarn ? 'ผ่านเกณฑ์ขั้นต่ำ 2 GB — เหมาะกับผู้เล่นไม่กี่คน' : 'ต่ำกว่าขั้นต่ำ 2 GB ที่ Bedrock ต้องการ',
  })
  score += ramOk ? 30 : ramWarn ? 18 : 0

  const freeOk = freeGb >= 1.5
  const freeWarn = freeGb >= 0.8
  checks.push({
    id: 'ram-free',
    label: 'RAM ว่าง ณ ตอนนี้',
    value: `${freeGb} GB`,
    status: freeOk ? 'pass' : freeWarn ? 'warn' : 'fail',
    note: freeOk ? 'เพียงพอสำหรับเซิร์ฟเวอร์ + Dashboard' : freeWarn ? 'เหลือน้อย — แนะนำปิดโปรแกรมอื่นก่อน' : 'เหลือน้อยเกินไป ควรปิดโปรแกรมอื่นก่อนเริ่มเซิร์ฟเวอร์',
  })
  score += freeOk ? 20 : freeWarn ? 12 : 0

  const diskOk = diskFreeGb >= 3
  const diskWarn = diskFreeGb >= 1
  checks.push({
    id: 'disk',
    label: 'พื้นที่ว่างบนดิสก์',
    value: diskInfo ? `${diskFreeGb} GB ว่าง / ${gb(diskInfo.size)} GB (${diskInfo.mount || 'n/a'})` : 'ตรวจไม่ได้',
    status: diskInfo ? (diskOk ? 'pass' : diskWarn ? 'warn' : 'fail') : 'warn',
    note: 'ตัวเซิร์ฟเวอร์ใช้ราว 1 GB บวกพื้นที่สำหรับโลกและ addons',
  })
  score += !diskInfo ? 10 : diskOk ? 20 : diskWarn ? 12 : 0

  score = Math.max(0, Math.min(100, score))

  const recommendedPlayers =
    totalGb < 2 || freeGb < 0.3
      ? 0
      : Math.max(2, Math.min(40, Math.floor(Math.min(freeGb, totalGb * 0.75) * 8)))

  const grade =
    score >= 85
      ? 'ยอดเยี่ยม — เหมาะกับเซิร์ฟเวอร์สาธารณะ'
      : score >= 65
        ? 'ดี — เหมาะกับเพื่อนฝูงเล่นด้วยกัน'
        : score >= 45
          ? 'พอใช้ — เหมาะกับผู้เล่นไม่กี่คน'
          : 'ไม่เพียงพอ — ควรเพิ่ม RAM ก่อนตั้งเซิร์ฟเวอร์'

  return {
    platform: process.platform,
    platformLabel:
      process.platform === 'win32' ? 'Windows' : process.platform === 'linux' ? 'Linux' : process.platform,
    os: `${hardware.osInfo.distro} ${hardware.osInfo.release}`.trim(),
    kernel: hardware.osInfo.kernel,
    arch: process.arch,
    nodeVersion: process.version,
    cpu: hardware.cpu,
    mem: { totalGb, freeGb },
    disk: diskInfo ? { mount: diskInfo.mount, totalGb: gb(diskInfo.size), freeGb: diskFreeGb } : null,
    checks,
    score,
    grade,
    recommendedPlayers,
    fetchedAt: Date.now(),
  }
}

// คำนวณ CPU load แบบ native โดยใช้ os.cpus() (เร็วระดับ 0.01ms ไม่ต้องรัน WMI หรือ spawn process)
let prevIdle = 0
let prevTotal = 0
let cachedCpuLoad = 0

function sampleCpuLoad(): number {
  const cpus = os.cpus()
  let idle = 0
  let total = 0
  for (const c of cpus) {
    idle += c.times.idle
    total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq
  }
  if (prevTotal === 0) {
    prevIdle = idle
    prevTotal = total
    return 0
  }
  const diffIdle = idle - prevIdle
  const diffTotal = total - prevTotal
  prevIdle = idle
  prevTotal = total
  if (diffTotal <= 0) return cachedCpuLoad
  const pct = Math.round((1 - diffIdle / diffTotal) * 1000) / 10
  cachedCpuLoad = Math.max(0, Math.min(100, pct))
  return cachedCpuLoad
}

export async function getQuickMachineStats(): Promise<{
  cpuLoadPct: number | null
  memTotalGb: number | null
  memFreeGb: number | null
}> {
  // ใช้ native node:os ทั้งหมด: ตอบกลับทันทีใน 0.01ms!
  return {
    cpuLoadPct: sampleCpuLoad(),
    memTotalGb: gb(os.totalmem()),
    memFreeGb: gb(os.freemem()),
  }
}
