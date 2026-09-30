import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // โมดูล native / dynamic ที่ต้องไม่ถูก bundle ไปกับ server components
  serverExternalPackages: ['better-sqlite3', 'systeminformation'],
}

export default nextConfig
