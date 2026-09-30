#!/usr/bin/env node
/**
 * reset.mjs — BDS Dashboard Reset Script
 * รันได้ทั้ง Windows และ Linux:
 *   node scripts/reset.mjs          → แสดง menu เลือก
 *   node scripts/reset.mjs --all    → ลบทั้งหมด (data + server)
 *   node scripts/reset.mjs --data   → ลบเฉพาะบัญชีผู้ใช้ / sessions (data/)
 *   node scripts/reset.mjs --server → ลบเฉพาะ Bedrock Server + worlds (server_data/)
 *   node scripts/reset.mjs --world  → ลบเฉพาะ worlds/ (คง binary ไว้)
 *   node scripts/reset.mjs --yes    → ข้ามการยืนยัน (ใช้ร่วมกับ flag อื่น)
 */

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ─── อ่าน .env เพื่อหา custom DATA_DIR / BDS_DIR ─────────────────────────────
function loadEnv() {
  const envPath = path.join(ROOT, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=')
    if (!key?.trim() || line.trim().startsWith('#')) continue
    const val = rest.join('=').trim()
    if (val && !process.env[key.trim()]) process.env[key.trim()] = val
  }
}

loadEnv()

function resolveDir(envKey, fallback) {
  const val = process.env[envKey]?.trim()
  if (!val) return path.join(ROOT, fallback)
  return path.isAbsolute(val) ? val : path.join(ROOT, val)
}

const DATA_DIR   = resolveDir('DATA_DIR', 'data')
const SERVER_DIR = resolveDir('BDS_DIR', 'server_data')
const WORLD_DIR  = path.join(SERVER_DIR, 'worlds')

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BOLD  = (s) => `\x1b[1m${s}\x1b[0m`
const RED   = (s) => `\x1b[31m${s}\x1b[0m`
const YELLOW= (s) => `\x1b[33m${s}\x1b[0m`
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`
const CYAN  = (s) => `\x1b[36m${s}\x1b[0m`
const DIM   = (s) => `\x1b[2m${s}\x1b[0m`

function rmrf(target) {
  if (!fs.existsSync(target)) {
    console.log(DIM(`  ข้าม: ${target} (ไม่พบ)`))
    return
  }
  fs.rmSync(target, { recursive: true, force: true })
  console.log(GREEN(`  ✓ ลบแล้ว: ${target}`))
}

function sizeOf(dir) {
  if (!fs.existsSync(dir)) return DIM('(ไม่มีโฟลเดอร์)')
  let total = 0
  function walk(p) {
    try {
      const stat = fs.statSync(p)
      if (stat.isDirectory()) {
        for (const f of fs.readdirSync(p)) walk(path.join(p, f))
      } else {
        total += stat.size
      }
    } catch {}
  }
  walk(dir)
  if (total === 0) return DIM('(ว่างเปล่า)')
  if (total < 1024 * 1024) return CYAN(`${(total / 1024).toFixed(1)} KB`)
  if (total < 1024 ** 3)   return CYAN(`${(total / 1024 ** 2).toFixed(1)} MB`)
  return CYAN(`${(total / 1024 ** 3).toFixed(2)} GB`)
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()) }))
}

// ─── Targets ─────────────────────────────────────────────────────────────────
const TARGETS = {
  all: {
    label: `ลบทั้งหมด  ${DIM('(บัญชีผู้ใช้ + Bedrock Server + worlds)')}`,
    dirs: [DATA_DIR, SERVER_DIR],
    warning: 'จะลบ บัญชีผู้ใช้ทั้งหมด + เซิร์ฟเวอร์ + โลกทั้งหมด',
  },
  data: {
    label: `ลบบัญชีผู้ใช้  ${DIM('(data/ → SQLite dashboard.db, sessions)')}`,
    dirs: [DATA_DIR],
    warning: 'จะลบ บัญชี admin และ sessions ทั้งหมด (เซิร์ฟเวอร์ยังอยู่)',
  },
  server: {
    label: `ลบ Bedrock Server  ${DIM('(server_data/ → binary + worlds + packs)')}`,
    dirs: [SERVER_DIR],
    warning: 'จะลบ ตัวเซิร์ฟเวอร์ + โลก + addons ทั้งหมด',
  },
  world: {
    label: `ลบเฉพาะ Worlds  ${DIM('(server_data/worlds/)')}`,
    dirs: [WORLD_DIR],
    warning: 'จะลบ โลก Minecraft ทั้งหมด (binary และ addons ยังอยู่)',
  },
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const skipConfirm = args.includes('--yes') || args.includes('-y')

  console.log()
  console.log(BOLD('═══════════════════════════════════════'))
  console.log(BOLD(' 🔄  BDS Dashboard — Reset Tool'))
  console.log(BOLD('═══════════════════════════════════════'))
  console.log(DIM(`  ROOT     : ${ROOT}`))
  console.log(DIM(`  data/    : ${DATA_DIR}  ${sizeOf(DATA_DIR)}`))
  console.log(DIM(`  server/  : ${SERVER_DIR}  ${sizeOf(SERVER_DIR)}`))
  console.log()

  // ─── กำหนด mode จาก flag ────────────────────────────────────────────────
  let mode = null
  for (const flag of ['--all', '--data', '--server', '--world']) {
    if (args.includes(flag)) { mode = flag.slice(2); break }
  }

  // ─── ถ้าไม่มี flag → แสดง menu ─────────────────────────────────────────
  if (!mode) {
    console.log(BOLD('เลือกสิ่งที่ต้องการ reset:'))
    console.log()
    const keys = Object.keys(TARGETS)
    keys.forEach((k, i) => console.log(`  ${BOLD(`[${i + 1}]`)} ${TARGETS[k].label}`))
    console.log(`  ${BOLD('[0]')} ยกเลิก`)
    console.log()

    const answer = await ask('กรุณาพิมพ์หมายเลข: ')
    const idx = parseInt(answer, 10)
    if (!idx || idx < 1 || idx > keys.length) {
      console.log(YELLOW('\n⚠ ยกเลิกการ reset\n'))
      process.exit(0)
    }
    mode = keys[idx - 1]
  }

  const target = TARGETS[mode]
  if (!target) {
    console.error(RED(`\nFlag ไม่ถูกต้อง: --${mode}\nใช้ได้: --all | --data | --server | --world\n`))
    process.exit(1)
  }

  // ─── แสดง warning + ยืนยัน ──────────────────────────────────────────────
  console.log()
  console.log(RED(BOLD(`⚠  คำเตือน: ${target.warning}`)))
  console.log(DIM('  โฟลเดอร์ที่จะถูกลบ:'))
  target.dirs.forEach((d) => console.log(DIM(`    • ${d}`)))
  console.log()

  if (!skipConfirm) {
    const confirm = await ask(YELLOW(`พิมพ์ "reset" เพื่อยืนยัน หรือ Enter เพื่อยกเลิก: `))
    if (confirm.toLowerCase() !== 'reset') {
      console.log(YELLOW('\n⚠ ยกเลิกการ reset\n'))
      process.exit(0)
    }
  }

  // ─── ลบจริง ─────────────────────────────────────────────────────────────
  console.log()
  console.log(BOLD('กำลังลบ...'))
  for (const dir of target.dirs) rmrf(dir)

  console.log()
  console.log(GREEN(BOLD('✅ Reset เสร็จสิ้น!')))
  console.log(DIM('   รัน "npm start" เพื่อเริ่มต้นใหม่ — Setup Wizard จะปรากฏอัตโนมัติ'))
  console.log()
}

main().catch((err) => {
  console.error(RED(`\nError: ${err.message}\n`))
  process.exit(1)
})
