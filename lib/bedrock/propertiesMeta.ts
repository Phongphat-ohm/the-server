// ข้อมูลกำกับการแสดงผล/ตรวจสอบของแต่ละคีย์ใน server.properties (โมดูลบริสุทธิ์ ใช้ได้ทั้ง client/server)

export type PropertyFieldType = 'text' | 'number' | 'boolean' | 'select'

export interface PropertyFieldMeta {
  key: string
  label: string
  group: string
  type: PropertyFieldType
  options?: { value: string; label: string }[]
  hint?: string
  min?: number
  max?: number
}

export const PROPERTY_GROUP_ORDER = ['ทั่วไป', 'เครือข่าย', 'เกม', 'โลก']

export const PROPERTY_FIELDS: PropertyFieldMeta[] = [
  { key: 'server-name', label: 'ชื่อเซิร์ฟเวอร์', group: 'ทั่วไป', type: 'text', hint: 'ชื่อที่ผู้เล่นเห็นในรายการเซิร์ฟเวอร์' },
  { key: 'max-players', label: 'จำนวนผู้เล่นสูงสุด', group: 'ทั่วไป', type: 'number', min: 1, max: 200 },
  { key: 'server-port', label: 'พอร์ต (IPv4)', group: 'เครือข่าย', type: 'number', min: 1, max: 65535, hint: 'ค่าเริ่มต้น 19132 (UDP)' },
  { key: 'server-portv6', label: 'พอร์ต (IPv6)', group: 'เครือข่าย', type: 'number', min: 1, max: 65535, hint: 'ค่าเริ่มต้น 19133 (UDP)' },
  { key: 'online-mode', label: 'Online mode (Xbox Live)', group: 'เครือข่าย', type: 'boolean', hint: 'ปิดเพื่ออนุญาตผู้เล่นที่ไม่ได้ล็อกอิน Xbox Live' },
  { key: 'white-list', label: 'เปิดใช้ Whitelist', group: 'เครือข่าย', type: 'boolean' },
  {
    key: 'gamemode', label: 'โหมดเกมเริ่มต้น', group: 'เกม', type: 'select',
    options: [
      { value: 'survival', label: 'Survival (อยู่รอด)' },
      { value: 'creative', label: 'Creative (สร้างสรรค์)' },
      { value: 'adventure', label: 'Adventure (ผจญภัย)' },
    ],
  },
  {
    key: 'difficulty', label: 'ระดับความยาก', group: 'เกม', type: 'select',
    options: [
      { value: 'peaceful', label: 'Peaceful (สงบสุข)' },
      { value: 'easy', label: 'Easy (ง่าย)' },
      { value: 'normal', label: 'Normal (ปกติ)' },
      { value: 'hard', label: 'Hard (ยาก)' },
    ],
  },
  { key: 'allow-cheats', label: 'อนุญาตคำสั่ง (Cheats)', group: 'เกม', type: 'boolean', hint: 'เปิดเพื่อให้ใช้ /gamemode, /give ฯลฯ ได้' },
  { key: 'level-name', label: 'ชื่อโลก (World)', group: 'โลก', type: 'text', hint: 'ตำแหน่งโฟลเดอร์ worlds/<ชื่อโลก> — เปลี่ยนแล้วจะสร้างโลกใหม่' },
  { key: 'level-seed', label: 'Seed ของโลกใหม่', group: 'โลก', type: 'text', hint: 'มีผลเฉพาะเมื่อสร้างโลกใหม่เท่านั้น' },
  { key: 'view-distance', label: 'ระยะมองเห็น (chunks)', group: 'โลก', type: 'number', min: 4, max: 32, hint: 'ค่าสูงใช้ RAM/แบนด์วิดท์มากขึ้น' },
  { key: 'tick-distance', label: 'ระยับทำงานของ tick (chunks)', group: 'โลก', type: 'number', min: 4, max: 12 },
  { key: 'player-idle-timeout', label: 'ไล่ผู้เล่นที่ไม่ขยับ (นาที)', group: 'โลก', type: 'number', min: 0, max: 1000, hint: '0 = ปิดใช้งาน' },
  {
    key: 'default-player-permission-level', label: 'สิทธิ์เริ่มต้นของผู้เล่น', group: 'โลก', type: 'select',
    options: [
      { value: 'visitor', label: 'Visitor (เยี่ยมชม)' },
      { value: 'member', label: 'Member (สมาชิก)' },
      { value: 'operator', label: 'Operator (แอดมิน)' },
    ],
  },
  { key: 'texture-pack-required', label: 'บังคับใช้ทรัพยากรที่ติดตั้งไว้', group: 'โลก', type: 'boolean', hint: 'ผู้เล่นจะต้องยอมรับ texture pack ของเซิร์ฟเวอร์' },
]
