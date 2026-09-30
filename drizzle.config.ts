import { defineConfig } from 'drizzle-kit'

// ใช้สำหรับพัฒนาเท่านั้น (optional) — ขณะรันงานจริงระบบจะสร้างตารางให้อัตโนมัติ
// คำสั่ง: npx drizzle-kit push
export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: './data/dashboard.db',
  },
})
