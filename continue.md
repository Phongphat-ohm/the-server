# 📋 สถานะงาน — BDS Dashboard (อัปเดตล่าสุด)

โปรเจกต์ **Minecraft Bedrock Dedicated Server Dashboard** ที่ `D:\.PHONGPHAT\the-server`

---

## ✅ ที่ทำเสร็จแล้ว

1. **สร้างโครงสร้าง + โค้ดครบทั้งโปรเจกต์ (~60 ไฟล์)** ตามสเปกทุกข้อ
   - `server.ts` — Custom Server: Next.js handler + WebSocket (`ws`) + graceful shutdown ใน process เดียว
   - `lib/bedrock/processManager.ts` — spawn/stop/restart + stdin คำสั่ง + log ring buffer + ตรวจจับผู้เล่นจาก log
   - `lib/bedrock/installer.ts` — ดาวน์โหลด/แตกไฟล์/merge (คง `server.properties`, `worlds/`, whitelist, permissions และ pack ของผู้ใช้ไว้) + chmod Linux
   - `lib/bedrock/addonManager.ts` — แตก `.mcaddon/.mcpack/.zip`, อ่าน manifest, แยก resource/behavior, เขียน `world_*_packs.json`
   - `lib/system/specs.ts` — ตรวจสเปก + Compatibility Score
   - UI ครบ: Setup Wizard, Login, Dashboard, Console (xterm.js), Settings (GUI แก้ server.properties), Addons (drag-and-drop), System
   - Auth: SQLite + Drizzle ORM, scrypt, session cookie, กัน CSRF ด้วย Origin check
2. **`npm install` สำเร็จ** (อนุมัติ install scripts ของ better-sqlite3/esbuild แล้ว + rebuild แล้ว)
3. **Typecheck (`npx tsc --noEmit`) ผ่าน 0 error**
4. **`npm run build` ผ่าน** — ทุก route (หน้าเว็บ 7 + API 20) คอมไพล์สำเร็จ
5. **Smoke test ผ่าน 33/33** — `npm run smoke` (สคริปต์ `scripts/smoke-test.mjs` ยิง API จริง: setup, auth, properties, addon upload/toggle/delete, WebSocket hello/401, CSRF, logout/login)
6. **ทดสอบ UI ในเบราว์เซอร์ผ่านแล้วบางส่วน**: Setup Wizard ขั้น 1 (แสดงสเปกจริง: i3-10110U, RAM 7.8GB, ดิสก์ D: 600GB, Score 92/100) และขั้น 2 (สร้างบัญชีแอดมินสำเร็จ ไปถึงขั้น 3 ติดตั้งเซิร์ฟเวอร์)
7. **แก้ระบบหาเวอร์ชันสำเร็จ** (เดิม parse หน้า HTML ไม่เจอเพราะ Mojang โหลดลิงก์ด้วย JS):
   `lib/bedrock/versions.ts` ใหม่ใช้ 3 แหล่งเรียงตามลำดับ —
   - **API ทางการขอ Mojang**: `https://net-secondary.web.minecraft-services.net/api/v1.0/download/links?application=MinecraftNet` (ทดสอบแล้วได้ release ล่าสุด `1.26.52.3`, คัด preview ออก)
   - **คลังประวัติเวอร์ชัน**: `https://raw.githubusercontent.com/kittizz/bedrock-server-downloads/main/bedrock-server-downloads.json` (มี build เก่าครบ — ตามที่ผู้ใช้แนะนำ)
   - **สแกนหน้า HTML** (สำรองสุดท้าย)
   - พบและแก้แล้วว่า path Linux ที่ถูกต้องคือ `bin-linux` (ไม่ใช่ `bin-x64`) + rebuild ผ่าน

---

## ⚠️ ปัญหาล่าสุดที่ต้องแก้ต่อ (ทำตรงนี้ก่อน)

**เซิร์ฟเวอร์ทดสอบพอร์ต 3177 ตายหลังพิมพ์ banner** — log (`.smoke-server.log`) มี banner "เปิดใช้งานที่ http://127.0.0.1:3177" แต่ `netstat` ไม่พบ process ฟังพอร์ต และ `curl` ติด connection refused ไม่มี error ใน log

สงสัยว่า background process ถูก kill ตอน shell ปิดลง (แบบเดียวกับที่เคยรันได้) วิธีแก้/ทดสอบ:

```bash
cd D:/.PHONGPHAT/the-server
# ลบของเดิมก่อน
rm -rf .smoke-data .smoke-server .smoke-server.log .smoke-cookie
# รันแบบ run_in_background (แยกคำสั่งเดี่ยว ๆ อย่าต่อด้วย && กับคำสั่งอื่น)
NODE_ENV=production PORT=3177 HOST=127.0.0.1 DATA_DIR=.smoke-data BDS_DIR=.smoke-server NEXT_TELEMETRY_DISABLED=1 node node_modules/tsx/dist/cli.mjs server.ts
# ตรวจสอบในอีก call: curl -s http://127.0.0.1:3177/api/setup/status
```

ถ้ายังตาย: ลองรัน foreground ดู stderr เต็ม ๆ หรือลอง `HOST=0.0.0.0`

---

## 📝 งานที่เหลือ (เรียงตามลำดับ)

1. **ตรวจ versions API** หลังเซิร์ฟเวอร์กลับมา: ล็อกอิน (admin/testpass123 ถ้ายังใช้ .smoke-data เดิม ไม่งั้นสร้างใหม่ผ่าน wizard) แล้ว `GET /api/bedrock/versions` — คาดหวัง: `latest=1.26.52.3` (ไม่มี preview 1.26.60.28) + มีรายการเวอร์ชันเก่าจาก mirror เพียบ
2. **ทดสอบติดตั้งจริง**: `POST /api/bedrock/install` body `{"version":"latest"}` → poll `GET /api/bedrock/install` จน phase=done (ไฟล์ ~130MB) → ตรวจ `.smoke-server/` มี `bedrock_server.exe`, `server.properties`, `resource_packs/` ฯลฯ
3. **ทดสอบ lifecycle จริง**: `POST /api/bedrock/start` → รอ 10 วิ → `POST /api/bedrock/command` `{"command":"list"}` → `GET /api/bedrock/logs` ดู output → `POST /api/bedrock/stop` → ตรวจ status=stopped และ `.smoke-server/worlds/Bedrock level/` ถูกสร้าง
4. **ทดสอบ UI ต่อในเบราว์เซอร์** (แท็บเปิดค้างไว้ที่ /setup อยู่แล้ว): Dashboard (ปุ่ม start/stop, InstallPanel, ผู้เล่นออนไลน์), คอนโซล xterm + พิมพ์คำสั่ง, หน้าตั้งค่าบันทึก + แบนเนอร์ "ต้องรีสตาร์ท", หน้า addons ลากวาง + toggle + ลบ (ไฟล์ทดสอบ: สร้าง .mcaddon ด้วย adm-zip แบบใน `scripts/smoke-test.mjs`)
5. **ทดสอบอัปเดตเวอร์ชันไม่ทับของเดิม**: แก้ `server.properties` (เปลี่ยน server-name) + สร้าง world แล้ว install ซ้ำ → ตรวจว่าค่าและ `worlds/` ยังอยู่
6. **อัปเดต README**: เพิ่มแหล่งเวอร์ชัน 3 แหล่ง + ตัวอย่างผลลัพธ์
7. **ทำความสะอาดก่อนส่งมอบ**: `rm -rf .smoke-data .smoke-server .smoke-server.log .smoke-cookie .smoke-test-pack.mcaddon` (เก็บ `node_modules/` กับ `.next/` ไว้) → ผู้ใช้จะเห็น Setup Wizard ตอนเปิดครั้งแรก

---

## 🔑 ข้อมูลการทดสอบ

- บัญชีทดสอบ (ใน `.smoke-data` ปัจจุบัน ถ้ายังไม่ลบ): `admin` / `testpass123`
- สคริปต์ทดสอบรวม: `npm run smoke` (สร้าง/ลบข้อมูลทดสอบเอง ไม่ทำลายของจริง)
- เบราว์เซอร์ทดสอบ: แท็บ in-app browser เปิดที่ `http://127.0.0.1:3177/setup` อยู่

## 📌 หมายเหตุเชิงเทคนิคที่ควรรู้

- Runtime singleton อยู่บน `globalThis` (`lib/bedrock/runtime.ts`) เพื่อให้ `server.ts` กับ Next.js API routes (คนละ module graph) ใช้ process manager ตัวเดียวกัน — อย่าเปลี่ยนโครงสร้างนี้
- ระบบไม่ยอมให้ติดตั้ง/อัปเดตขณะเซิร์ฟเวอร์กำลังรัน (ต้อง stop ก่อน)
- Linux: spawn ตั้ง `LD_LIBRARY_PATH` ชี้โฟลเดอร์เซิร์ฟเวอร์ให้อัตโนมัติ; Windows: ใช้ `bedrock_server.exe` + `windowsHide`
