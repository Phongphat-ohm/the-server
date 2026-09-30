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

export async function getSystemSpecs(): Promise<SystemSpecs> {
  const cwd = path.resolve(SERVER_DIR)
  const [cpu, mem, osInfo, fsList] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.osInfo(),
    si.fsSize().catch(() => [] as FsList),
  ])
  const diskInfo = pickDisk(fsList, cwd)
  const totalGb = gb(mem.total)
  const freeGb = gb(mem.available)
  const diskFreeGb = diskInfo ? gb(diskInfo.available) : 0

  const checks: SpecCheck[] = []
  let score = 0

  const platformOk = process.platform === 'win32' || process.platform === 'linux'
  checks.push({
    id: 'os',
    label: 'ระบบปฏิบัติการ',
    value: `${osInfo.distro || process.platform} (${process.platform})`,
    status: platformOk ? 'pass' : process.platform === 'darwin' ? 'warn' : 'fail',
    note: platformOk
      ? 'Mojang เผยแพร่ไบนารีอย่างเป็นทางการ'
      : process.platform === 'darwin'
        ? 'ไม่มีไบนารีสำหรับ macOS — ต้องรันผ่านชั้นจำลองเอง'
        : 'แพลตฟอร์มนี้ไม่ได้รับการรองรับ',
  })
  score += platformOk ? 10 : process.platform === 'darwin' ? 5 : 0

  const cores = cpu.cores ?? 1
  const coresOk = cores >= 4
  const coresWarn = cores >= 2
  checks.push({
    id: 'cpu',
    label: ' CPU (จำนวน Core)',
    value: `${cores} threads / ${cpu.physicalCores ?? '?'} cores${cpu.speed ? ` @ ${cpu.speed} GHz` : ''}`,
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
    os: `${osInfo.distro} ${osInfo.release ?? ''}`.trim(),
    kernel: osInfo.kernel ?? '',
    arch: process.arch,
    nodeVersion: process.version,
    cpu: {
      brand: `${cpu.manufacturer ?? ''} ${cpu.brand ?? ''}`.trim(),
      cores,
      physicalCores: cpu.physicalCores ?? cores,
      speedGhz: Math.round((cpu.speed ?? 0) * 10) / 10,
    },
    mem: { totalGb, freeGb },
    disk: diskInfo ? { mount: diskInfo.mount, totalGb: gb(diskInfo.size), freeGb: diskFreeGb } : null,
    checks,
    score,
    grade,
    recommendedPlayers,
    fetchedAt: Date.now(),
  }
}

export async function getQuickMachineStats(): Promise<{
  cpuLoadPct: number | null
  memTotalGb: number | null
  memFreeGb: number | null
}> {
  const [load, mem] = await Promise.all([si.currentLoad(), si.mem()])
  return {
    cpuLoadPct: Math.round(load.currentLoad * 10) / 10,
    memTotalGb: gb(mem.total),
    memFreeGb: gb(mem.available),
  }
}
