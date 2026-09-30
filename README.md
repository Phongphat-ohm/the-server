# 🟩 Minecraft Bedrock Dedicated Server Dashboard

แดชบอร์ดจัดการ **Minecraft Bedrock Dedicated Server (BDS)** แบบ Single Service — Next.js (App Router) + Custom Node.js Server ที่รัน **HTTP + WebSocket ใน process เดียวกัน** พร้อมควบคุม subprocess ของเซิร์ฟเวอร์เกมได้ทั้งหมดผ่านเว็บเบราว์เซอร์

รองรับทั้ง **Windows และ Linux** ด้วยการแยกการทำงานอัตโนมัติตาม `process.platform`

---

## ✨ คุณสมบัติ

| ระบบ | รายละเอียด |
| --- | --- |
| 🩺 **Hardware Pre-flight Check** | ตรวจ CPU / RAM / ดิสก์ / OS ผ่าน `systeminformation` พร้อม **Compatibility Score (0–100)** และประมาณการจำนวนผู้เล่นสูงสุดที่เครื่องรับไหว |
| ⬇️ **Auto Installer** | เลือกเวอร์ชัน (Latest อัตโนมัติ หรือระบุเอง) → ดาวน์โหลด `.zip` ทางการจาก Mojang → แตกไฟล์ → merge ลง `server_data/` โดย **ไม่ทับ** `server.properties`, `worlds/`, `whitelist.json`, `permissions.json` และ addons ที่ติดตั้งไว้ |
| 🖥️ **Live Console** | สตรีม stdout/stderr แบบ real-time ผ่าน WebSocket ไปแสดงบน **xterm.js** + ช่องพิมพ์คำสั่ง (`op`, `say`, `gamerule`, …) เข้า `process.stdin` พร้อมประวัติคำสั่งจากฐานข้อมูล |
| ⏯️ **Lifecycle Control** | Start / Stop (แบบ graceful — ส่งคำสั่ง `stop` ให้เซิร์ฟเวอร์เซฟโลกก่อนเสมอ) / Restart |
| ⚙️ **Settings GUI** | แก้ `server.properties` ผ่านฟอร์ม (ชื่อเซิร์ฟเวอร์, พอร์ต, Game Mode, Max Players, Cheats, Difficulty ฯลฯ) — บันทึกโดยคงคอมเมนต์/คีย์อื่นในไฟล์เดิมไว้ |
| 🧩 **Addon Manager** | ลากวาง `.mcaddon` / `.mcpack` / `.zip` → แตกไฟล์ → อ่าน `manifest.json` → แยกไป `resource_packs/` หรือ `behavior_packs/` → เขียน `world_resource_packs.json` / `world_behavior_packs.json` เปิดใช้กับโลกปัจจุบันอัตโนมัติ |
| 👥 **Player Tracking** | ตรวจจับผู้เล่นเข้า/ออกจาก log แล้วแสดงรายชื่อออนไลน์บน Dashboard |
| 🔐 **Auth + Setup Wizard** | First-Time Setup Wizard (ตรวจสเปก → สร้างแอดมิน → ติดตั้งเซิร์ฟเวอร์), Session-based auth (scrypt + SQLite), ป้องกัน CSRF ด้วย SameSite + Origin check |

---

## 🧱 Tech Stack

- **Next.js 15 (App Router)** + React 19 + TypeScript + Tailwind CSS 4
- **Custom Server (`server.ts`)** — `node:http` + Next.js request handler + `ws` WebSocket Server ใน process เดียว
- **SQLite** ผ่าน `better-sqlite3` + **Drizzle ORM** (สร้างตารางอัตโนมัติเมื่อเปิดโปรแกรม — ไม่ต้อง migrate ก็รันได้)
- **@xterm/xterm** + **@xterm/addon-fit** สำหรับ Terminal UI
- **systeminformation** สำหรับข้อมูลฮาร์ดแวร์แบบ cross-platform
- **adm-zip** สำหรับแตกไฟล์ server และ addons (pure JS ไม่ต้องพึ่งโปรแกรมภายนอก)

---

## 🚀 การติดตั้งและใช้งาน

### สิ่งที่ต้องมี

- **Node.js 20 หรือใหม่กว่า** (แนะนำ LTS ล่าสุด) — ตรวจด้วย `node -v`
- อินเทอร์เน็ตสำหรับดาวน์โหลด Bedrock Server (~100 MB ต่อครั้ง)

### ขั้นตอน

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. (ทางเลือก) ตั้งค่าพอร์ต — สำเนา .env.example เป็น .env แล้วแก้ได้
cp .env.example .env

# 3.A รันโหมดพัฒนา
npm run dev

# 3.B หรือรันโหมด production (แนะนำสำหรับใช้งานจริง)
npm run build
npm start
```

เปิดเบราว์เซอร์ไปที่ `http://localhost:3000` (หรือพอร์ตที่ตั้งไว้)

> **ครั้งแรกที่เปิดใช้งาน** ระบบจะพาเข้า **Setup Wizard** อัตโนมัติ: ตรวจสเปกเครื่อง → สร้างบัญชีแอดมิน → เลือกเวอร์ชันแล้วติดตั้ง Bedrock Server → เข้าสู่แดชบอร์ด

### พอร์ตที่เกี่ยวข้อง

| พอร์ต | โปรโตคอล | ใช้ทำอะไร |
| --- | --- | --- |
| `3000` (ปรับได้ที่ `PORT`) | TCP (HTTP + WS) | Dashboard |
| `19132` | UDP | เกม Bedrock (IPv4) — ปรับที่หน้าตั้งค่า |
| `19133` | UDP | เกม Bedrock (IPv6) |

---

## 📁 โครงสร้างโปรเจกต์

```
the-server/
├── server.ts                    # Custom Server: Next.js + WebSocket + graceful shutdown
├── lib/
│   ├── bedrock/
│   │   ├── processManager.ts    # spawn/stop/restart + stdin คำสั่ง + log buffer + player tracking
│   │   ├── installer.ts         # ดาวน์โหลด + แตกไฟล์ + merge (คง worlds/properties ไว้) + chmod Linux
│   │   ├── addonManager.ts      # แตก pack, อ่าน manifest, activate ลง world_*.json
│   │   ├── properties.ts        # parse/เขียน server.properties แบบคงรูปเดิม
│   │   ├── propertiesMeta.ts    # metadata ของฟอร์มตั้งค่า GUI
│   │   ├── versions.ts          # ดึงเวอร์ชันจาก 3 แหล่ง (ดูด้านล่าง)
│   │   └── runtime.ts           # singleton บน globalThis (ให้ server.ts กับ API ใช้ instance เดียวกัน)
│   ├── system/specs.ts          # ข้อมูลฮาร์ดแวร์ + Compatibility Score
│   ├── db.ts / schema.ts        # SQLite + Drizzle (สร้างตารางอัตโนมัติ)
│   ├── session.ts / auth.ts     # scrypt hash + session + ตัวช่วย RSC
│   └── apiHelpers.ts            # guard auth/origin สำหรับ API routes
├── app/
│   ├── (dash)/                  # โซนที่ต้องล็อกอิน: ภาพรวม, คอนโซล, ตั้งค่า, addons, ระบบ
│   ├── login/ , setup/          # ล็อกอิน + Setup Wizard
│   └── api/                     # REST API ทั้งหมด
├── components/                  # UI (Terminal xterm, InstallPanel, DashboardClient ฯลฯ)
├── server_data/                 # (เกิดตอนรัน) ตัว Bedrock Server + worlds + packs
└── data/                        # (เกิดตอนรัน) SQLite dashboard.db
```

---

## 🌐 WebSocket Protocol (`/ws`)

ต้องแนบ session cookie (`bds_session`) ตอนเชื่อมต่อ ไม่งั้นจะได้ `401`

**เซิร์ฟเวอร์ → ไคลเอนต์**

| ข้อความ | ความหมาย |
| --- | --- |
| `{ t:'hello', status, logs, job }` | สถานะปัจจุบัน + log ย้อนหลัง 300 บรรทัด + งานติดตั้ง (ถ้ามี) |
| `{ t:'log', lines:[...] }` | log ใหม่จาก stdout/stderr |
| `{ t:'status', status }` | สถานะ/ผู้เล่นออนไลน์เปลี่ยน |
| `{ t:'install', job }` | ความคืบหน้าการติดตั้งเวอร์ชัน |

**ไคลเอนต์ → เซิร์ฟเวอร์**

| ข้อความ | ความหมาย |
| --- | --- |
| `{ t:'input', command:'list' }` | ส่งคำสั่งเข้า stdin ของเซิร์ฟเวอร์ |
| `{ t:'ping' }` | heartbeat |

---

## 🔌 REST API (ต้องล็อกอิน ยกเว้นที่ระบุ)

| Method | Path | หน้าที่ |
| --- | --- | --- |
| GET | `/api/setup/status` | ยังต้อง setup อยู่ไหม (public) |
| POST | `/api/setup/admin` | สร้างแอดมินคนแรก (เปิดช่วง setup อยู่เท่านั้น) |
| POST | `/api/auth/login` / `logout` / `password` | จัดการ session |
| GET | `/api/system/specs` | สเปกเครื่อง + score (เปิดช่วง setup ด้วย) |
| GET | `/api/bedrock/versions` | เวอร์ชันที่พบ (ดึงจาก 3 แหล่ง — ดูหัวข้อถัดไป) |
| POST/GET | `/api/bedrock/install` | เริ่มติดตั้ง / ดูความคืบหน้า |
| GET | `/api/bedrock/status` | snapshot สถานะ + ผู้เล่น + โหลดเครื่อง |
| POST | `/api/bedrock/start` / `stop` / `restart` | ควบคุม process |
| POST | `/api/bedrock/command` | ส่งคำสั่ง (สำรองของ WS) |
| GET | `/api/bedrock/history` / `logs` | ประวัติคำสั่ง / log ย้อนหลัง |
| GET/PUT | `/api/settings/properties` | อ่าน/บันทึก server.properties |
| GET | `/api/addons` | รายการ pack + สถานะเปิดใช้ |
| POST | `/api/addons/upload` | อัปโหลด `.mcaddon/.mcpack/.zip` (multipart `files`) |
| POST | `/api/addons/toggle` / `delete` | เปิด/ปิด/ลบ pack |

---

---

## 🌐 แหล่งดึงเวอร์ชัน (Version Sources)

ระบบดึงข้อมูลเวอร์ชัน Bedrock Server จาก **3 แหล่ง** เรียงตามลำดับความสำคัญ:

| ลำดับ | แหล่ง | รายละเอียด |
| --- | --- | --- |
| 1 | **Mojang API (ทางการ)** | `https://net-secondary.web.minecraft-services.net/api/v1.0/download/links?application=MinecraftNet` — ได้ release ล่าสุดทันที, กรอง preview ออกอัตโนมัติ |
| 2 | **Community Mirror** | `https://raw.githubusercontent.com/kittizz/bedrock-server-downloads/main/bedrock-server-downloads.json` — มี build เก่าครบย้อนหลัง |
| 3 | **HTML Scraping (สำรอง)** | สแกนหน้า `minecraft.net/en-us/download/server/bedrock` เป็น fallback สุดท้าย |

**ตัวอย่างผลลัพธ์ `GET /api/bedrock/versions`:**

```json
{
  "latest": "1.26.52.3",
  "preview": null,
  "versions": [
    {
      "version": "1.26.52.3",
      "winUrl": "https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.26.52.3.zip",
      "linuxUrl": "https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.26.52.3.zip"
    },
    { "version": "1.26.51.1", "winUrl": "...", "linuxUrl": "..." }
    // ... 63 versions รวม
  ]
}
```

---

## 🔄 การอัปเดตเวอร์ชันเซิร์ฟเวอร์

1. **หยุดเซิร์ฟเวอร์ก่อน** (ปุ่มหยุดบน Dashboard — ระบบไม่ยอมให้อัปเดตระหว่างรัน)
2. หน้าภาพรวม → ส่วนติดตั้ง → เลือกเวอร์ชันใหม่ → ติดตั้ง
3. ของเดิมที่ถูกคงไว้อัตโนมัติ: `server.properties`, `worlds/`, `whitelist.json`, `permissions.json`, addons ที่ติดตั้งเพิ่ม

> Linux: ระบบ `chmod +x bedrock_server` และตั้ง `LD_LIBRARY_PATH` ให้ตอน spawn อัตโนมัติ

---

## 🛠️ การแก้ปัญหาที่พบบ่อย

| อาการ | วิธีแก้ |
| --- | --- |
| `npm install` error เรื่อง `better-sqlite3` | ต้องใช้ Node 20+; Windows ที่ไม่มี prebuilt จะต้องติดตั้ง Visual Studio Build Tools ก่อน |
| เปิด Dashboard ไม่ได้ | เช็คพอร์ตซ้ำ — แก้ `PORT` ใน `.env` แล้วรันใหม่ |
| ดาวน์โหลดเวอร์ชันไม่ได้ | เครื่องอาจออฟไลน์ หรือ minecraft.net ระงับชั่วคราว — ลองระบุเลขเวอร์ชันเอง เช่น `1.21.93.01` |
| เพื่อนเข้าเซิร์ฟเวอร์ไม่ได้ | เปิดพอร์ต UDP 19132 ใน router/ไฟร์วอลล์ และดูว่าเครื่องเจ้าของอนุญาต `bedrock_server` ผ่าน Windows Firewall |
| addon ติดตั้งแล้วไม่ทำงาน | ต้องรีสตาร์ทเซิร์ฟเวอร์หลังเปิด/ปิด pack เสมอ |

---

## 📜 หมายเหตุ

- ไฟล์เกมทั้งหมดดาวน์โหลดจากเซิร์ฟเวอร์ทางการของ Mojang (`minecraft.net/bedrockdedicatedserver`) — โปรเจกต์นี้ไม่ได้แจกจ่ายไบนารีของ Mojang
- ข้อมูล Dashboard ทั้งหมดอยู่ใน `data/dashboard.db` และ `server_data/` (อยู่ใน `.gitignore` ทั้งคู่)
