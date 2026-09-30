import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // framer-motion v11 ส่ง pre-built CJS/ESM มาพร้อมแล้ว ไม่ต้อง transpile ซ้ำ
  // การเพิ่ม transpilePackages ทำให้ Next.js compile TypeScript source ของมันใหม่ทั้งหมด → ช้ามาก
  // โมดูล native / dynamic ที่ต้องไม่ถูก bundle ไปกับ server components
  serverExternalPackages: ['better-sqlite3', 'systeminformation', 'adm-zip'],
  typescript: {
    // ข้าม type checking ซ้ำซ้อนตอน build เพื่อเพิ่มความเร็วอย่างมาก
    // (สามารถรันแยกผ่าน `npm run typecheck` ที่เร็วและมี incremental cache)
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
  experimental: {
    // ลด bundle size: Next.js จะ tree-shake imports จาก package เหล่านี้ได้ดีขึ้น
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
}

export default nextConfig
