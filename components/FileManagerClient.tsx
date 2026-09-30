'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Folder,
  FolderPlus,
  File,
  FileText,
  FileCode,
  FileCog,
  Upload,
  RefreshCw,
  Trash2,
  Edit3,
  Download,
  Save,
  X,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  HardDrive,
  FilePlus,
  Sparkles,
} from 'lucide-react'

// Dynamically import Monaco Editor to ensure it only loads on the client
const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[var(--ts-surface-lowest)] text-xs text-[var(--ts-on-surface-variant)] space-x-2">
      <Loader2 size={18} className="animate-spin text-[var(--ts-primary)]" />
      <span>กำลังโหลด Monaco Editor...</span>
    </div>
  ),
})

interface FileItem {
  name: string
  path: string
  isDirectory: boolean
  size: number
  updatedAt: number
  isEditable: boolean
  extension: string
}

interface ActiveFile {
  path: string
  name: string
  content: string
  originalContent: string
  size: number
  language: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('th-TH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getFileIcon(item: FileItem) {
  if (item.isDirectory) {
    return <Folder size={17} className="text-[var(--ts-primary)] shrink-0" />
  }
  const ext = item.extension.toLowerCase()
  if (['.json', '.js', '.ts', '.mjs', '.html', '.css', '.yml', '.yaml', '.mcfunction'].includes(ext)) {
    return <FileCode size={17} className="text-[var(--ts-tertiary)] shrink-0" />
  }
  if (['.properties', '.ini', '.cfg', '.conf'].includes(ext)) {
    return <FileCog size={17} className="text-amber-400 shrink-0" />
  }
  if (['.txt', '.md', '.log'].includes(ext)) {
    return <FileText size={17} className="text-[var(--ts-on-surface-variant)] shrink-0" />
  }
  return <File size={17} className="text-slate-400 shrink-0" />
}

export default function FileManagerClient() {
  const [currentPath, setCurrentPath] = useState<string>('')
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ label: string; path: string }>>([])
  const [items, setItems] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Active Editor State
  const [activeFile, setActiveFile] = useState<ActiveFile | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Drag & Drop / Upload State
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modals
  const [modalType, setModalType] = useState<'create-file' | 'create-folder' | 'rename' | 'delete' | null>(null)
  const [modalTarget, setModalTarget] = useState<FileItem | null>(null)
  const [modalInput, setModalInput] = useState('')
  const [modalBusy, setModalBusy] = useState(false)

  // Load Directory
  const currentPathRef = useRef('')
  currentPathRef.current = currentPath

  const loadDirectory = useCallback(async (subpath?: string) => {
    const targetPath = subpath !== undefined ? subpath : currentPathRef.current
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/files/list?path=${encodeURIComponent(targetPath)}`, { cache: 'no-store' })
      const body = (await res.json()) as {
        currentPath?: string
        breadcrumbs?: Array<{ label: string; path: string }>
        items?: FileItem[]
        error?: string
      }
      if (!res.ok) {
        setError(body.error ?? 'ไม่สามารถโหลดรายชื่อไฟล์ได้')
        return
      }
      const newPath = body.currentPath ?? ''
      setCurrentPath(newPath)
      currentPathRef.current = newPath
      setBreadcrumbs(body.breadcrumbs ?? [])
      setItems(body.items ?? [])
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDirectory('')
  }, [loadDirectory])

  // Open & Read File
  const openFile = async (item: FileItem) => {
    if (!item.isEditable) {
      setError(`ไฟล์ประเภท ${item.extension || 'binary'} ไม่สามารถเปิดด้วย Text Editor ได้`)
      return
    }
    setFileLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(item.path)}`, { cache: 'no-store' })
      const body = (await res.json()) as {
        path?: string
        name?: string
        content?: string
        size?: number
        language?: string
        error?: string
      }
      if (!res.ok) {
        setError(body.error ?? 'เปิดไฟล์ไม่สำเร็จ')
        return
      }
      setActiveFile({
        path: body.path ?? item.path,
        name: body.name ?? item.name,
        content: body.content ?? '',
        originalContent: body.content ?? '',
        size: body.size ?? item.size,
        language: body.language ?? 'plaintext',
      })
    } catch {
      setError('เปิดไฟล์ไม่สำเร็จ')
    } finally {
      setFileLoading(false)
    }
  }

  // Save Active File
  const saveFile = async () => {
    if (!activeFile) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/files/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: activeFile.path, content: activeFile.content }),
      })
      const body = (await res.json()) as { success?: boolean; size?: number; error?: string }
      if (!res.ok) {
        setError(body.error ?? 'บันทึกไฟล์ไม่สำเร็จ')
        return
      }
      setActiveFile((prev) =>
        prev
          ? {
              ...prev,
              originalContent: prev.content,
              size: body.size ?? prev.size,
            }
          : null
      )
      setSuccess('บันทึกไฟล์สำเร็จแล้ว')
      setTimeout(() => setSuccess(null), 3000)
      void loadDirectory()
    } catch {
      setError('เกิดข้อผิดพลาดในการบันทึกไฟล์')
    } finally {
      setSaving(false)
    }
  }

  // Keyboard shortcut Ctrl+S / Cmd+S for saving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (activeFile) {
          e.preventDefault()
          void saveFile()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeFile, saveFile])

  // Handle Upload
  const handleUploadFiles = async (files: FileList | File[], overwrite: boolean = false) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('parentPath', currentPath)
      formData.append('overwrite', overwrite ? 'true' : 'false')
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i])
      }

      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      })
      const body = (await res.json()) as {
        success?: boolean
        uploaded?: Array<{ name: string; overwritten: boolean }>
        errors?: Array<{ name: string; error: string }>
        error?: string
      }

      if (!res.ok) {
        setError(body.error ?? 'อัปโหลดไฟล์ไม่สำเร็จ')
        return
      }

      if (body.errors && body.errors.length > 0) {
        setError(`อัปโหลดบางไฟล์ไม่สำเร็จ: ${body.errors.map((e) => `${e.name} (${e.error})`).join(', ')}`)
      } else {
        setSuccess(`อัปโหลดสำเร็จแล้ว ${body.uploaded?.length ?? 1} ไฟล์`)
        setTimeout(() => setSuccess(null), 3000)
      }
      void loadDirectory()
    } catch {
      setError('เกิดข้อผิดพลาดในการอัปโหลด')
    } finally {
      setUploading(false)
    }
  }

  // Modal Actions (Create / Rename / Delete)
  const submitModal = async () => {
    setModalBusy(true)
    setError(null)
    try {
      if (modalType === 'create-file' || modalType === 'create-folder') {
        const isDir = modalType === 'create-folder'
        const res = await fetch('/api/files/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ parentPath: currentPath, name: modalInput.trim(), isDirectory: isDir }),
        })
        const body = (await res.json()) as { path?: string; error?: string }
        if (!res.ok) throw new Error(body.error ?? 'สร้างไม่สำเร็จ')
        setSuccess(`สร้าง${isDir ? 'โฟลเดอร์' : 'ไฟล์'} "${modalInput}" สำเร็จ`)
      } else if (modalType === 'rename' && modalTarget) {
        const res = await fetch('/api/files/rename', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ oldPath: modalTarget.path, newName: modalInput.trim() }),
        })
        const body = (await res.json()) as { path?: string; error?: string }
        if (!res.ok) throw new Error(body.error ?? 'เปลี่ยนชื่อไม่สำเร็จ')
        setSuccess(`เปลี่ยนชื่อเป็น "${modalInput}" สำเร็จ`)
      } else if (modalType === 'delete' && modalTarget) {
        const res = await fetch('/api/files/delete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path: modalTarget.path }),
        })
        const body = (await res.json()) as { success?: boolean; error?: string }
        if (!res.ok) throw new Error(body.error ?? 'ลบไม่สำเร็จ')
        if (activeFile && activeFile.path === modalTarget.path) {
          setActiveFile(null)
        }
        setSuccess(`ลบ "${modalTarget.name}" สำเร็จ`)
      }

      setModalType(null)
      setTimeout(() => setSuccess(null), 3000)
      void loadDirectory()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setModalBusy(false)
    }
  }

  const isModified = activeFile && activeFile.content !== activeFile.originalContent

  return (
    <div className="space-y-4">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ts-on-surface)] flex items-center gap-2.5">
            <HardDrive size={24} className="text-[var(--ts-primary)]" />
            <span>จัดการไฟล์เซิร์ฟเวอร์</span>
          </h1>
          <p className="text-xs text-[var(--ts-on-surface-variant)] mt-0.5">
            เรียกดู แก้ไขคอนฟิกด้วย VS Code Editor และอัปโหลดไฟล์เข้าสู่ server_data ได้โดยตรง
          </p>
        </div>
      </div>

      {/* ── Status Alerts ─────────────────────────────────────── */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-[var(--ts-error)]/40 bg-[var(--ts-error-container)]/30 p-3 text-xs text-[#ffb4ab]"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-[var(--ts-error)]" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:opacity-80">
            <X size={14} />
          </button>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-[var(--ts-tertiary)]/40 bg-[var(--ts-tertiary-container)]/25 p-3 text-xs text-[var(--ts-tertiary)]"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="p-1 hover:opacity-80">
            <X size={14} />
          </button>
        </motion.div>
      )}

      {/* ── Main Split View ───────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-12 h-[calc(100dvh-140px)] min-h-[580px] max-h-[850px]">
        {/* ── Left Pane: File Tree Explorer (5 cols) ─────────── */}
        <div
          className={`card lg:col-span-5 flex flex-col h-full overflow-hidden border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] transition-all ${
            isDragging ? 'ring-2 ring-[var(--ts-primary)] bg-[var(--ts-primary-container)]/10' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              void handleUploadFiles(e.dataTransfer.files)
            }
          }}
        >
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setModalType('create-file')
                  setModalInput('')
                }}
                className="btn btn-sm text-xs gap-1 border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface)]"
                title="สร้างไฟล์ใหม่"
              >
                <FilePlus size={14} />
                <span>ไฟล์</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalType('create-folder')
                  setModalInput('')
                }}
                className="btn btn-sm text-xs gap-1 border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface)]"
                title="สร้างโฟลเดอร์ใหม่"
              >
                <FolderPlus size={14} />
                <span>โฟลเดอร์</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn btn-sm text-xs gap-1 border-[var(--ts-primary)]/40 bg-[var(--ts-primary-container)]/30 text-[var(--ts-primary)]"
                title="อัปโหลดไฟล์"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <span>อัปโหลด</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void handleUploadFiles(e.target.files)
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => void loadDirectory()}
              disabled={loading}
              className="p-1.5 rounded-lg text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)] hover:bg-[var(--ts-surface-high)]"
              title="รีเฟรช"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Breadcrumbs Path Navigation */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-dim)] text-xs overflow-x-auto whitespace-nowrap shrink-0">
            {breadcrumbs.map((b, idx) => (
              <div key={b.path} className="flex items-center gap-1">
                {idx > 0 && <ChevronRight size={13} className="text-[var(--ts-outline)] shrink-0" />}
                <button
                  type="button"
                  onClick={() => void loadDirectory(b.path === '/' ? '' : b.path)}
                  className={`font-mono transition-colors hover:text-[var(--ts-primary)] ${
                    idx === breadcrumbs.length - 1
                      ? 'font-bold text-[var(--ts-on-surface)]'
                      : 'text-[var(--ts-on-surface-variant)]'
                  }`}
                >
                  {b.label}
                </button>
              </div>
            ))}
          </div>

          {/* Drag & Drop Hint Overlay */}
          {isDragging && (
            <div className="p-4 text-center border-b border-dashed border-[var(--ts-primary)] bg-[var(--ts-primary-container)]/20 text-xs font-semibold text-[var(--ts-primary)] flex items-center justify-center gap-2 shrink-0">
              <Upload size={16} />
              <span>ปล่อยไฟล์ที่นี่เพื่ออัปโหลดลงในโฟลเดอร์นี้</span>
            </div>
          )}

          {/* File List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--ts-outline-variant)]/40 p-1.5 min-h-0">
            {/* Go Up Parent Button */}
            {currentPath && currentPath !== '/' && (
              <button
                type="button"
                onClick={() => {
                  const parts = currentPath.split('/').filter(Boolean)
                  parts.pop()
                  const parent = parts.join('/')
                  void loadDirectory(parent)
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-[var(--ts-primary)] hover:bg-[var(--ts-surface-high)]/60 font-semibold w-full text-left transition-colors"
              >
                <Folder size={17} className="shrink-0" />
                <span>.. (กลับโฟลเดอร์แม่)</span>
              </button>
            )}

            {loading ? (
              <div className="py-20 text-center space-y-2">
                <Loader2 size={22} className="animate-spin text-[var(--ts-primary)] mx-auto" />
                <p className="text-xs text-[var(--ts-on-surface-variant)]">กำลังอ่านรายชื่อไฟล์...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="py-20 text-center space-y-2">
                <Folder size={32} className="mx-auto text-[var(--ts-outline)] opacity-50" />
                <p className="text-xs text-[var(--ts-on-surface-variant)]">โฟลเดอร์นี้ยังว่างเปล่า</p>
                <p className="text-[11px] text-[var(--ts-outline)]">
                  ลากไฟล์มาวาง หรือกดปุ่ม &quot;อัปโหลด&quot; ด้านบน
                </p>
              </div>
            ) : (
              items.map((item) => {
                const isCurrentActive = activeFile && activeFile.path === item.path
                return (
                  <div
                    key={item.path}
                    className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${
                      isCurrentActive
                        ? 'bg-[var(--ts-primary-container)]/30 border border-[var(--ts-primary)]/40'
                        : 'hover:bg-[var(--ts-surface-high)]/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (item.isDirectory) {
                          void loadDirectory(item.path)
                        } else {
                          void openFile(item)
                        }
                      }}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      {getFileIcon(item)}
                      <span
                        className={`truncate font-medium ${
                          isCurrentActive ? 'text-[var(--ts-primary)] font-bold' : 'text-[var(--ts-on-surface)]'
                        }`}
                      >
                        {item.name}
                      </span>
                    </button>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-mono text-[var(--ts-on-surface-variant)] hidden sm:inline-block">
                        {item.isDirectory ? 'โฟลเดอร์' : formatBytes(item.size)}
                      </span>

                      {/* Quick Item Actions */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            setModalType('rename')
                            setModalTarget(item)
                            setModalInput(item.name)
                          }}
                          className="p-1 rounded text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)] hover:bg-[var(--ts-surface-highest)]"
                          title="เปลี่ยนชื่อ"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModalType('delete')
                            setModalTarget(item)
                          }}
                          className="p-1 rounded text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-error)] hover:bg-[var(--ts-surface-highest)]"
                          title="ลบ"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Right Pane: Monaco Editor (7 cols) ─────────────── */}
        <div className="card lg:col-span-7 flex flex-col h-full overflow-hidden border-[var(--ts-outline-variant)] bg-[var(--ts-surface-lowest)] min-h-[500px]">
          {activeFile ? (
            <>
              {/* Editor Header Bar */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--ts-outline-variant)] bg-[var(--ts-surface-dim)] shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode size={16} className="text-[var(--ts-primary)] shrink-0" />
                  <span className="font-mono text-xs font-bold text-[var(--ts-on-surface)] truncate">
                    {activeFile.name}
                  </span>
                  {isModified && (
                    <span className="flex h-2 w-2 rounded-full bg-amber-400 shrink-0" title="ยังไม่บันทึก" />
                  )}
                  <span className="badge text-[10px] py-0.5 px-2 border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] text-[var(--ts-on-surface-variant)] uppercase font-mono hidden sm:inline-block">
                    {activeFile.language}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--ts-outline)] hidden md:inline-block">
                    {formatBytes(activeFile.size)}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void saveFile()}
                    disabled={saving || !isModified}
                    className={`btn btn-sm text-xs gap-1.5 px-3 ${
                      isModified
                        ? 'btn-primary'
                        : 'border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface-variant)]'
                    }`}
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    <span>{saving ? 'กำลังบันทึก...' : 'บันทึก (Ctrl+S)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFile(null)}
                    className="p-1.5 rounded-lg text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)] hover:bg-[var(--ts-surface-high)]"
                    title="ปิดตัวแก้ไข"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Monaco Code Editor */}
              <div className="flex-1 relative min-h-0 h-full overflow-hidden">
                {fileLoading ? (
                  <div className="flex h-full w-full items-center justify-center space-x-2 text-xs text-[var(--ts-on-surface-variant)]">
                    <Loader2 size={18} className="animate-spin text-[var(--ts-primary)]" />
                    <span>กำลังโหลดเนื้อหาไฟล์...</span>
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    language={activeFile.language}
                    value={activeFile.content}
                    onChange={(val) => {
                      setActiveFile((prev) => (prev ? { ...prev, content: val ?? '' } : null))
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                      lineNumbers: 'on',
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            /* Empty State: VS Code branding & Keyboard hints */
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--ts-surface-high)] text-[var(--ts-primary)] shadow-md">
                <FileCode size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[var(--ts-on-surface)]">
                  เลือกไฟล์เพื่อเริ่มต้นแก้ไข
                </h3>
                <p className="text-xs text-[var(--ts-on-surface-variant)] max-w-sm">
                  คลิกที่ไฟล์ข้อความจากรายการด้านซ้าย (เช่น <code className="font-mono text-[var(--ts-primary)]">server.properties</code>, <code className="font-mono text-[var(--ts-primary)]">whitelist.json</code>) เพื่อเปิดแก้ไขด้วย Monaco Editor
                </p>
              </div>

              <div className="rounded-xl border border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] p-3.5 text-xs text-left space-y-2 max-w-xs w-full">
                <div className="font-bold text-[var(--ts-on-surface)] flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[var(--ts-tertiary)]" />
                  <span>คีย์ลัดที่รองรับ</span>
                </div>
                <div className="flex justify-between font-mono text-[11px] text-[var(--ts-on-surface-variant)]">
                  <span>บันทึกไฟล์:</span>
                  <span className="font-bold text-[var(--ts-primary)]">Ctrl + S</span>
                </div>
                <div className="flex justify-between font-mono text-[11px] text-[var(--ts-on-surface-variant)]">
                  <span>ค้นหาข้อความ:</span>
                  <span className="font-bold text-[var(--ts-primary)]">Ctrl + F</span>
                </div>
                <div className="flex justify-between font-mono text-[11px] text-[var(--ts-on-surface-variant)]">
                  <span>แทนที่ข้อความ:</span>
                  <span className="font-bold text-[var(--ts-primary)]">Ctrl + H</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals (Create / Rename / Delete) ─────────────────── */}
      <AnimatePresence>
        {modalType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => !modalBusy && setModalType(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-2xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] p-6 shadow-2xl space-y-4"
            >
              <div>
                <h3 className="text-base font-bold text-[var(--ts-on-surface)]">
                  {modalType === 'create-file' && 'สร้างไฟล์ใหม่'}
                  {modalType === 'create-folder' && 'สร้างโฟลเดอร์ใหม่'}
                  {modalType === 'rename' && `เปลี่ยนชื่อ "${modalTarget?.name}"`}
                  {modalType === 'delete' && `ยืนยันการลบ "${modalTarget?.name}"`}
                </h3>
                <p className="text-xs text-[var(--ts-on-surface-variant)] mt-1">
                  {modalType === 'delete'
                    ? 'การลบไฟล์หรือโฟลเดอร์นี้จะไม่สามารถกู้คืนได้ คุณแน่ใจหรือไม่?'
                    : `ตำแหน่ง: /${currentPath || 'server_data'}`}
                </p>
              </div>

              {modalType !== 'delete' && (
                <div>
                  <input
                    type="text"
                    value={modalInput}
                    onChange={(e) => setModalInput(e.target.value)}
                    placeholder={
                      modalType === 'create-file'
                        ? 'เช่น test.json หรือ custom.properties'
                        : modalType === 'create-folder'
                          ? 'เช่น my_scripts'
                          : 'ระบุชื่อใหม่'
                    }
                    className="input text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitModal()
                    }}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ts-outline-variant)]/60">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  disabled={modalBusy}
                  className="btn btn-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => void submitModal()}
                  disabled={modalBusy || (modalType !== 'delete' && !modalInput.trim())}
                  className={`btn btn-sm ${modalType === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                >
                  {modalBusy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : modalType === 'delete' ? (
                    'ลบทันที'
                  ) : (
                    'ตกลง'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
