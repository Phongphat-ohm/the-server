import fs from 'node:fs'
import path from 'node:path'
import { getWorldDir } from './properties'

export const BEDROCK_EXPERIMENTS = [
  'experiments_ever_used',
  'saved_with_toggled_experiments',
  'gametest',
  'upcoming_creator_features',
  'experimental_custom_biomes',
  'data_driven_items',
  'experimental_molang_features',
  'villager_trades_rebalance',
  'cameras',
] as const

/**
 * ตรวจสอบและเปิดใช้งาน Experimental Gameplay ทั้งหมดใน level.dat ของโลกปัจจุบัน (แบบ Sync)
 */
export function enableWorldExperimentsSync(customWorldDir?: string): {
  success: boolean
  message: string
  enabledFlags: string[]
} {
  const worldDir = customWorldDir ?? getWorldDir()
  if (!worldDir) {
    throw new Error('ยังไม่พบโฟลเดอร์โลก — กรุณาเริ่มเซิร์ฟเวอร์ครั้งแรกก่อนเปิดการทดลอง')
  }

  const levelDatPath = path.join(worldDir, 'level.dat')
  if (!fs.existsSync(levelDatPath)) {
    throw new Error('ไม่พบไฟล์ level.dat ในโฟลเดอร์โลก')
  }

  const buf = fs.readFileSync(levelDatPath)
  if (buf.length < 8) {
    throw new Error('ไฟล์ level.dat มีขนาดเล็กเกินไปหรือเสียหาย')
  }

  const headerVersion = buf.readUInt32LE(0)
  const payloadLen = buf.readUInt32LE(4)

  // สำรองไฟล์เดิมไว้เพื่อความปลอดภัย
  try {
    fs.copyFileSync(levelDatPath, path.join(worldDir, 'level.dat.bak'))
  } catch {
    // ละเว้นหากสำรองไม่ได้
  }

  // ค้นหา TAG_Compound ของ "experiments"
  // Format: 0x0A (TAG_Compound), 0x0B 0x00 (length 11), "experiments"
  const needle = Buffer.from([0x0a, 0x0b, 0x00, ...Buffer.from('experiments', 'utf8')])
  const expIdx = buf.indexOf(needle)

  let newBuf: Buffer

  if (expIdx !== -1) {
    // กรณีมี compound "experiments" อยู่แล้ว: ค้นหาจุดสิ้นสุดเดิม (0x00 TAG_End)
    const compoundContentStart = expIdx + needle.length
    let p = compoundContentStart
    while (p < buf.length) {
      const tagType = buf[p]
      if (tagType === 0x00) break // TAG_End
      p++
      const nameLen = buf.readUInt16LE(p)
      p += 2 + nameLen
      if (tagType === 0x01) p += 1 // Byte
      else if (tagType === 0x02) p += 2 // Short
      else if (tagType === 0x03) p += 4 // Int
      else break
    }

    const compoundEnd = p

    // สร้างเนื้อหาใหม่ของ experiments โดยเปิด flag ทุกตัวเป็น 1
    const chunks: Buffer[] = []
    for (const flag of BEDROCK_EXPERIMENTS) {
      const nameBuf = Buffer.from(flag, 'utf8')
      const tag = Buffer.alloc(1 + 2 + nameBuf.length + 1)
      tag[0] = 0x01 // TAG_Byte
      tag.writeUInt16LE(nameBuf.length, 1)
      nameBuf.copy(tag, 3)
      tag[3 + nameBuf.length] = 0x01 // Value = 1
      chunks.push(tag)
    }
    chunks.push(Buffer.from([0x00])) // TAG_End

    const newCompoundContent = Buffer.concat(chunks)
    const before = buf.subarray(0, compoundContentStart)
    const after = buf.subarray(compoundEnd + 1)
    const newPayload = Buffer.concat([before.subarray(8), newCompoundContent, after])

    newBuf = Buffer.alloc(8 + newPayload.length)
    newBuf.writeUInt32LE(headerVersion, 0)
    newBuf.writeUInt32LE(newPayload.length, 4)
    newPayload.copy(newBuf, 8)
  } else {
    // กรณีที่ยังไม่มี experiments compound: แทรกไว้ก่อน TAG_End สุดท้ายของ Root compound
    // Root compound starts at byte 8 (0x0A 0x00 0x00), closes at the very end with 0x00
    let lastZero = buf.length - 1
    while (lastZero > 8 && buf[lastZero] !== 0x00) lastZero--

    const chunks: Buffer[] = [needle]
    for (const flag of BEDROCK_EXPERIMENTS) {
      const nameBuf = Buffer.from(flag, 'utf8')
      const tag = Buffer.alloc(1 + 2 + nameBuf.length + 1)
      tag[0] = 0x01
      tag.writeUInt16LE(nameBuf.length, 1)
      nameBuf.copy(tag, 3)
      tag[3 + nameBuf.length] = 0x01
      chunks.push(tag)
    }
    chunks.push(Buffer.from([0x00])) // End of experiments compound
    chunks.push(Buffer.from([0x00])) // End of root compound

    const inserted = Buffer.concat(chunks)
    const before = buf.subarray(8, lastZero)
    const newPayload = Buffer.concat([before, inserted])

    newBuf = Buffer.alloc(8 + newPayload.length)
    newBuf.writeUInt32LE(headerVersion, 0)
    newBuf.writeUInt32LE(newPayload.length, 4)
    newPayload.copy(newBuf, 8)
  }

  fs.writeFileSync(levelDatPath, newBuf)

  // อัปเดต level.dat_old ด้วยถ้ามี
  const levelDatOldPath = path.join(worldDir, 'level.dat_old')
  if (fs.existsSync(levelDatOldPath)) {
    try {
      fs.copyFileSync(levelDatPath, levelDatOldPath)
    } catch {
      // ละเว้นหากสำเนาไม่ได้
    }
  }

  return {
    success: true,
    message: 'เปิดใช้งานการทดลอง (Experimental Gameplay) ทั้งหมดในโลกเรียบร้อยแล้ว',
    enabledFlags: [...BEDROCK_EXPERIMENTS],
  }
}

/**
 * ตรวจสอบและเปิดใช้งาน Experimental Gameplay ทั้งหมดใน level.dat ของโลกปัจจุบัน
 */
export async function enableWorldExperiments(customWorldDir?: string): Promise<{
  success: boolean
  message: string
  enabledFlags: string[]
}> {
  return enableWorldExperimentsSync(customWorldDir)
}

/**
 * ตรวจสอบสถานะการทดลองใน level.dat
 */
export function checkWorldExperiments(): {
  available: boolean
  enabled: boolean
  flags: Record<string, boolean>
} {
  const worldDir = getWorldDir()
  if (!worldDir) return { available: false, enabled: false, flags: {} }

  const levelDatPath = path.join(worldDir, 'level.dat')
  if (!fs.existsSync(levelDatPath)) return { available: false, enabled: false, flags: {} }

  try {
    const buf = fs.readFileSync(levelDatPath)
    const needle = Buffer.from([0x0a, 0x0b, 0x00, ...Buffer.from('experiments', 'utf8')])
    const expIdx = buf.indexOf(needle)
    if (expIdx === -1) {
      return { available: true, enabled: false, flags: {} }
    }

    const flags: Record<string, boolean> = {}
    const compoundContentStart = expIdx + needle.length
    let p = compoundContentStart
    while (p < buf.length) {
      const tagType = buf[p]
      if (tagType === 0x00) break
      p++
      const nameLen = buf.readUInt16LE(p)
      const name = buf.toString('utf8', p + 2, p + 2 + nameLen)
      p += 2 + nameLen
      if (tagType === 0x01) {
        flags[name] = buf[p] === 1
        p += 1
      } else if (tagType === 0x02) p += 2
      else if (tagType === 0x03) p += 4
      else break
    }

    const enabled = Boolean(flags.experiments_ever_used && (flags.upcoming_creator_features || flags.gametest))
    return { available: true, enabled, flags }
  } catch {
    return { available: true, enabled: false, flags: {} }
  }
}
