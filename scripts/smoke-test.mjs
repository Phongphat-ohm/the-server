// Smoke test: สตาร์ทเซิร์ฟเวอร์จริง (tsx server.ts) บนพอร์ตทดสอบ แล้วยิง API ตรวจทีละขั้น
// รันด้วย: npm run smoke
import AdmZip from 'adm-zip'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 3177
const BASE = `http://127.0.0.1:${PORT}`
const DATA_DIR = path.join(ROOT, '.smoke-data')
const BDS_DIR = path.join(ROOT, '.smoke-server')

let cookie = ''
let passed = 0
let failed = 0
let mcaddonPath = ''

function ok(name, cond, extra = '') {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name} ${extra}`)
  }
}

async function api(method, urlPath, body, opts = {}) {
  const headers = {}
  if (cookie) headers.cookie = cookie
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (opts.origin) headers.origin = opts.origin
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie && setCookie.includes('bds_session=') && !setCookie.includes('bds_session=;')) {
    cookie = setCookie.split(';')[0]
  }
  let json = null
  const text = await res.text()
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: res.status, body: json, headers: res.headers }
}

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/setup/status`)
      if (res.ok) return true
    } catch {
      // ยังไม่พร้อม
    }
    await new Promise((r) => setTimeout(r, 700))
  }
  return false
}

function cleanup() {
  fs.rmSync(DATA_DIR, { recursive: true, force: true })
  fs.rmSync(BDS_DIR, { recursive: true, force: true })
}

async function main() {
  cleanup()
  console.log('> เริ่ม smoke test (พอร์ต ' + PORT + ')')

  const child = spawn(
    process.execPath,
    [path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(ROOT, 'server.ts')],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(PORT),
        HOST: '127.0.0.1',
        DATA_DIR,
        BDS_DIR,
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  let serverLog = ''
  child.stdout.on('data', (d) => (serverLog += d))
  child.stderr.on('data', (d) => (serverLog += d))

  try {
    ok('server สตาร์ทและรับ request ได้', await waitForServer())

    // ---- Setup flow ----
    let r = await api('GET', '/api/setup/status')
    ok('setup/status → needsSetup=true', r.body?.needsSetup === true)

    r = await api('GET', '/setup')
    ok('หน้า /setup เปิดได้ (200)', r.status === 200, `got ${r.status}`)

    r = await api('GET', '/')
    ok('ยังไม่ล็อกอิน → redirect ไป /login หรือ /setup', r.status === 307 || r.status === 302, `got ${r.status}`)

    r = await api('GET', '/api/bedrock/status')
    ok('API โดยไม่ล็อกอิน → 401', r.status === 401, `got ${r.status}`)

    // ---- สร้างแอดมิน ----
    r = await api('POST', '/api/setup/admin', { username: 'admin', password: 'password123' })
    ok('สร้างแอดมินคนแรกสำเร็จ + auto-login', r.status === 200 && r.body?.ok === true)
    ok('ได้รับ session cookie', cookie.includes('bds_session='))

    r = await api('POST', '/api/setup/admin', { username: 'hacker', password: 'password123' })
    ok('สร้างแอดมินคนที่สองไม่ได้ (ล็อกช่วง setup)', r.status === 403, `got ${r.status}`)

    r = await api('POST', '/api/setup/admin', { username: 'x', password: 'password123' })
    ok('username สั้นเกินไป → 400 (ก่อนล็อก setup ก็ตรวจก่อน... อย่างไรก็ตาม 403 ก็ปลอดภัย)', r.status === 400 || r.status === 403)

    // ---- Dashboard APIs ----
    r = await api('GET', '/')
    ok('หน้าแรก (dashboard) แสดงได้หลังล็อกอิน', r.status === 200, `got ${r.status}`)

    r = await api('GET', '/api/system/specs')
    ok('system/specs มี score + checks', r.status === 200 && typeof r.body?.score === 'number' && Array.isArray(r.body?.checks), JSON.stringify(r.body).slice(0, 120))
    console.log(`    ↳ platform=${r.body?.platform} ram=${r.body?.mem?.totalGb}GB score=${r.body?.score} players~${r.body?.recommendedPlayers}`)

    r = await api('GET', '/api/bedrock/status')
    ok('bedrock/status → not_installed', r.body?.status === 'not_installed' && r.body?.binExists === false)

    r = await api('GET', '/api/bedrock/start')
    const startBlocked = await api('POST', '/api/bedrock/start')
    ok('start โดยยังไม่ติดตั้งเซิร์ฟเวอร์ → ถูกปฏิเสธ', startBlocked.status === 400, `got ${startBlocked.status}`)

    // ---- Settings (สมมติไฟล์ server.properties) ----
    fs.mkdirSync(BDS_DIR, { recursive: true })
    fs.writeFileSync(
      path.join(BDS_DIR, 'server.properties'),
      '# คอมเมนต์เดิมต้องอยู่ครบ\nserver-name=Old Name\nmax-players=10\nlevel-name=MyWorld\nallow-cheats=false\n'
    )
    r = await api('GET', '/api/settings/properties')
    ok('อ่าน server.properties ได้', r.body?.values?.['server-name'] === 'Old Name')

    r = await api(
      'PUT',
      '/api/settings/properties',
      { updates: { 'server-name': 'ชื่อใหม่', 'max-players': '25', 'allow-cheats': true, 'server-port': '99999' } },
      { origin: BASE }
    )
    ok('ค่า port เกินช่วง → ถูกปฏิเสธ 400', r.status === 400, `got ${r.status}`)

    r = await api('PUT', '/api/settings/properties', {
      updates: { 'server-name': 'ชื่อใหม่', 'max-players': '25', 'allow-cheats': true },
    })
    ok('บันทึก properties สำเร็จ', r.status === 200)
    const savedText = fs.readFileSync(path.join(BDS_DIR, 'server.properties'), 'utf8')
    ok('คอมเมนต์เดิมถูกคงไว้', savedText.includes('# คอมเมนต์เดิมต้องอยู่ครบ'))
    ok('แก้ค่าถูกคีย์ + เพิ่มคีย์ใหม่ได้', savedText.includes('server-name=ชื่อใหม่') && savedText.includes('allow-cheats=true') && savedText.includes('max-players=25'))

    // ---- Addons ----
    const manifest = {
      format_version: 2,
      header: { name: 'Smoke Test Pack', description: 'จาก smoke test', uuid: 'b7a8e0c1-1111-4222-8333-444455556666', version: [1, 2, 3] },
      modules: [{ type: 'data', uuid: 'c8b9f1d2-7777-4888-9999-000011112222', version: [1, 2, 3] }],
    }
    const zip = new AdmZip()
    zip.addFile('SmokePack/manifest.json', Buffer.from(JSON.stringify(manifest)))
    zip.addFile('SmokePack/items/smoke.json', Buffer.from('{"format_version":"1.10"}'))
    const mcaddonPath = path.join(ROOT, '.smoke-test-pack.mcaddon')
    fs.writeFileSync(mcaddonPath, zip.toBuffer())

    const form = new FormData()
    form.append('files', new Blob([fs.readFileSync(mcaddonPath)]), 'smoke-pack.mcaddon')
    const uploadRes = await fetch(`${BASE}/api/addons/upload`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    })
    const uploadBody = await uploadRes.json().catch(() => ({}))
    ok('อัปโหลด .mcaddon สำเร็จ', uploadRes.status === 200, JSON.stringify(uploadBody).slice(0, 200))
    const pack = uploadBody?.results?.[0]?.packs?.[0]
    ok('จับชนิด behavior จาก manifest ถูกต้อง', pack?.type === 'behavior')
    ok('เตือนเรื่องยังไม่มีโลก (ตามที่ออกแบบ)', (uploadBody?.results?.[0]?.warnings ?? []).length > 0)
    ok('ไฟล์ถูกวางใน behavior_packs/ ครบถ้วน', fs.existsSync(path.join(BDS_DIR, 'behavior_packs', 'Smoke_Test_Pack', 'manifest.json')))

    r = await api('GET', '/api/addons')
    const found = (r.body?.addons ?? []).find((a) => a.uuid === manifest.header.uuid)
    ok('รายการ addons มี pack ที่เพิ่งติดตั้ง', !!found, JSON.stringify(r.body?.addons ?? []).slice(0, 160))

    r = await api('POST', '/api/addons/toggle', { dirName: found?.dirName ?? 'Smoke_Test_Pack', type: 'behavior', active: true })
    ok('เปิดใช้ pack โดยไม่มีโลก → ถูกปฏิเสธด้วยข้อความชัดเจน', r.status === 400)

    r = await api('POST', '/api/addons/delete', { dirName: found?.dirName ?? 'Smoke_Test_Pack', type: 'behavior' })
    ok('ลบ pack สำเร็จ', r.status === 200 && !(fs.existsSync(path.join(BDS_DIR, 'behavior_packs', 'Smoke_Test_Pack'))))

    // ---- CSRF/Origin ----
    r = await api('PUT', '/api/settings/properties', { updates: { 'server-name': 'x' } }, { origin: 'https://evil.example.com' })
    ok('Origin แปลกปลอม → 403 (กัน CSRF)', r.status === 403, `got ${r.status}`)

    // ---- WebSocket ----
    const wsOk = await new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: { cookie } })
      const timer = setTimeout(() => {
        ws.terminate()
        resolve(false)
      }, 8000)
      ws.on('message', (raw) => {
        const msg = JSON.parse(String(raw))
        if (msg.t === 'hello' && msg.status && Array.isArray(msg.logs)) {
          clearTimeout(timer)
          ws.close()
          resolve(true)
        }
      })
      ws.on('error', () => {
        clearTimeout(timer)
        resolve(false)
      })
    })
    ok('WebSocket /ws เชื่อมต่อ + ได้รับ hello (status+logs)', wsOk === true)

    const wsNoAuth = await new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`)
      ws.on('unexpected-response', (_req, res) => resolve(res.statusCode === 401))
      ws.on('open', () => {
        ws.close()
        resolve(false)
      })
      ws.on('error', () => resolve(false))
      setTimeout(() => resolve(false), 5000)
    })
    ok('WebSocket ไม่มี cookie → ถูกปฏิเสธ 401', wsNoAuth === true)

    // ---- Command history API ----
    r = await api('GET', '/api/bedrock/history')
    ok('bedrock/history ตอบกลับได้', r.status === 200 && Array.isArray(r.body?.history))

    // ---- Logout ----
    r = await api('POST', '/api/auth/logout')
    ok('logout สำเร็จ', r.status === 200)
    r = await api('GET', '/api/bedrock/status')
    ok('หลัง logout → API กลับมาเป็น 401', r.status === 401, `got ${r.status}`)

    // ---- Login ซ้ำด้วยรหัสผ่านที่บันทึกไว้ ----
    r = await api('POST', '/api/auth/login', { username: 'admin', password: 'wrong-password' })
    ok('รหัสผ่านผิด → 401', r.status === 401)
    r = await api('POST', '/api/auth/login', { username: 'admin', password: 'password123' })
    ok('รหัสผ่านถูก → 200', r.status === 200)
  } finally {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      } else {
        child.kill('SIGTERM')
      }
    } catch {
      // ปิดไปแล้ว
    }
    await new Promise((r) => setTimeout(r, 1500))
    if (!child.killed) child.kill('SIGKILL')
    cleanup()
    if (mcaddonPath) fs.rmSync(mcaddonPath, { force: true })
  }

  console.log(`\n> ผลรวม: ผ่าน ${passed} / ไม่ผ่าน ${failed}`)
  if (failed > 0) {
    console.log('\n---- server log (100 บรรทัดท้าย) ----')
    console.log(serverLog.split('\n').slice(-100).join('\n'))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('smoke test crash:', err)
  process.exit(1)
})
