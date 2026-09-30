import os from 'node:os'
import { getSetting, setSetting } from '../db'
import { getPropertyValue } from './properties'
import type { ConnectionInfo } from '../types'

let cachedPublicIp: { ip: string | null; at: number } | null = null
const PUBLIC_IP_CACHE_MS = 5 * 60 * 1000 // 5 นาที

/** ดึงรายชื่อ IPv4 ในเครือข่ายภายในเครื่อง (LAN IPs) */
export function getLocalIps(): string[] {
  const interfaces = os.networkInterfaces()
  const ips: string[] = []
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal && net.address !== '127.0.0.1') {
        ips.push(net.address)
      }
    }
  }
  return ips.length > 0 ? ips : ['127.0.0.1']
}

/** ดึง Public IP ของเซิร์ฟเวอร์แบบ non-blocking พร้อมแคช 5 นาที */
export async function getPublicIp(): Promise<string | null> {
  if (cachedPublicIp && Date.now() - cachedPublicIp.at < PUBLIC_IP_CACHE_MS) {
    return cachedPublicIp.ip
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timer)
    if (res.ok) {
      const data = (await res.json()) as { ip?: string }
      const ip = data.ip?.trim() ?? null
      cachedPublicIp = { ip, at: Date.now() }
      return ip
    }
  } catch {
    // เน็ตเวิร์กไม่พร้อม หรือเรียกไม่ได้
  }
  return cachedPublicIp?.ip ?? null
}

/** อ่าน Custom Domain ที่แอดมินตั้งไว้ */
export function getCustomDomain(): string | null {
  const val = getSetting('custom_domain')?.trim()
  return val ? val : null
}

/** บันทึก Custom Domain / IP */
export function setCustomDomain(raw: string): string | null {
  let cleaned = raw.trim()
  // ตัดโปรโตคอล http:// หรือ https://
  cleaned = cleaned.replace(/^https?:\/\//i, '')
  // ตัด path หรือ query
  cleaned = cleaned.replace(/[/?#].*$/, '')
  // ตัด trailing slash
  cleaned = cleaned.replace(/\/+$/, '')
  // ตัด port ถ้าผู้ใช้พิมพ์มาด้วย (เช่น mc.server.com:19132)
  if (cleaned.includes(':') && !cleaned.includes(']')) {
    const parts = cleaned.split(':')
    cleaned = parts[0]
  }

  cleaned = cleaned.trim()
  setSetting('custom_domain', cleaned)
  return cleaned.length > 0 ? cleaned : null
}

/** รวบรวมข้อมูลทั้งหมดสำหรับการเชื่อมต่อเข้าเซิร์ฟเวอร์ */
export async function getConnectionInfo(): Promise<ConnectionInfo> {
  const domain = getCustomDomain()
  const localIps = getLocalIps()
  const publicIp = await getPublicIp()

  const rawPort = Number(getPropertyValue('server-port'))
  const serverPort = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 19132

  const rawPortV6 = Number(getPropertyValue('server-portv6'))
  const serverPortV6 = Number.isFinite(rawPortV6) && rawPortV6 > 0 ? rawPortV6 : 19133

  const serverName = getPropertyValue('server-name') || 'THE SERVER'

  // ลำดับความสำคัญของโฮสต์หลัก: Custom Domain > Public IP > Local LAN IP > 127.0.0.1
  const primaryHost = domain || publicIp || localIps[0] || '127.0.0.1'

  const quickJoinUrl = `minecraft://?addExternalServer=${encodeURIComponent(serverName)}|${primaryHost}:${serverPort}`

  return {
    domain,
    serverPort,
    serverPortV6,
    serverName,
    localIps,
    publicIp,
    primaryHost,
    quickJoinUrl,
  }
}
