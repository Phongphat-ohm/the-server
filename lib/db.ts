import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { DATA_DIR, DOWNLOADS_DIR, SERVER_DIR, STAGING_DIR } from './paths'

export type AppDatabase = BetterSQLite3Database<typeof schema>

export interface DbBundle {
  sqlite: InstanceType<typeof Database>
  db: AppDatabase
}

const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS command_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'console',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

// ใช้ globalThis เพื่อให้ได้ instance เดียวกันแม้โมดูลนี้จะถูกโหลดหลายสำเนา
// (custom server + Next.js API routes แตกต่างกันในเชิง bundling)
const g = globalThis as unknown as { __bdsDb?: DbBundle }

function createBundle(): DbBundle {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const sqlite = new Database(path.join(DATA_DIR, 'dashboard.db'))
  sqlite.pragma('journal_mode = WAL')
  sqlite.exec(CREATE_TABLES)

  // Auto-migration: check if 'role' column exists in 'users'
  try {
    const cols = sqlite.pragma('table_info(users)') as Array<{ name: string }>
    if (!cols.some((c) => c.name === 'role')) {
      sqlite.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'")
    }
  } catch {
    // Ignore migration failure if already exists or during init
  }

  const db = drizzle(sqlite, { schema })
  return { sqlite, db }
}

export function getDb(): DbBundle {
  if (!g.__bdsDb) g.__bdsDb = createBundle()
  return g.__bdsDb
}

export function initDb(): void {
  getDb()
  for (const dir of [SERVER_DIR, DOWNLOADS_DIR, STAGING_DIR]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function getSetting(key: string): string | null {
  const row = getDb().sqlite.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  getDb()
    .sqlite.prepare(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .run(key, value)
}

/** ยังไม่มีแอดมินในระบบ → ต้องผ่าน First-Time Setup Wizard ก่อน */
export function needsSetup(): boolean {
  const row = getDb().sqlite.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }
  return row.c === 0
}
