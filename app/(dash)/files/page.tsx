import type { Metadata } from 'next'
import FileManagerClient from '@/components/FileManagerClient'

export const metadata: Metadata = {
  title: 'จัดการไฟล์',
  description: 'จัดการไฟล์และแก้ไขคอนฟิกเซิร์ฟเวอร์ด้วย VS Code Editor ในตัว',
}

export default function FilesPage() {
  return <FileManagerClient />
}
