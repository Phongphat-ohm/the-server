'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  UserPlus,
  ShieldCheck,
  Shield,
  KeyRound,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  UserCheck,
  Calendar,
  User,
  Lock,
} from 'lucide-react'

import type { UserRole, UserSummary } from '@/lib/session'

interface UsersResponse {
  users?: UserSummary[]
  error?: string
}

export default function UsersClient({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ username: '', password: '', role: 'operator' as UserRole })
  const [submittingAdd, setSubmittingAdd] = useState(false)

  // Reset Password Modal State
  const [resetTarget, setResetTarget] = useState<UserSummary | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [submittingReset, setSubmittingReset] = useState(false)

  // Delete User Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<UserSummary | null>(null)
  const [submittingDelete, setSubmittingDelete] = useState(false)

  // Role Change Busy State
  const [changingRoleId, setChangingRoleId] = useState<number | null>(null)

  const showSuccessMsg = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3500)
  }

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/users', { cache: 'no-store' })
      const body = (await res.json()) as UsersResponse
      if (!res.ok) {
        setError(body.error ?? 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ')
        return
      }
      setUsers(body.users ?? [])
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingAdd(true)
    setError(null)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'สร้างผู้ใช้ไม่สำเร็จ')
        return
      }
      showSuccessMsg(`เพิ่มผู้ใช้ "${addForm.username}" สำเร็จ`)
      setShowAddModal(false)
      setAddForm({ username: '', password: '', role: 'operator' })
      await loadUsers()
    } catch {
      setError('เชื่อมต่อไม่ได้')
    } finally {
      setSubmittingAdd(false)
    }
  }

  const handleRoleChange = async (userId: number, role: UserRole) => {
    setChangingRoleId(userId)
    setError(null)
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: userId, role }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'เปลี่ยนบทบาทไม่สำเร็จ')
        return
      }
      showSuccessMsg('อัปเดตบทบาทผู้ใช้สำเร็จ')
      await loadUsers()
    } catch {
      setError('เชื่อมต่อไม่ได้')
    } finally {
      setChangingRoleId(null)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetTarget) return
    setSubmittingReset(true)
    setError(null)
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: resetTarget.id, newPassword }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'รีเซ็ตรหัสผ่านไม่สำเร็จ')
        return
      }
      showSuccessMsg(`รีเซ็ตรหัสผ่านของ "${resetTarget.username}" เรียบร้อยแล้ว`)
      setResetTarget(null)
      setNewPassword('')
    } catch {
      setError('เชื่อมต่อไม่ได้')
    } finally {
      setSubmittingReset(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    setSubmittingDelete(true)
    setError(null)
    try {
      const res = await fetch(`/api/users?id=${deleteTarget.id}`, { method: 'DELETE' })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'ลบผู้ใช้ไม่สำเร็จ')
        return
      }
      showSuccessMsg(`ลบบัญชี "${deleteTarget.username}" เรียบร้อยแล้ว`)
      setDeleteTarget(null)
      await loadUsers()
    } catch {
      setError('เชื่อมต่อไม่ได้')
    } finally {
      setSubmittingDelete(false)
    }
  }

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) => u.username.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
    )
  }, [users, search])

  const adminCount = useMemo(() => users.filter((u) => u.role === 'admin').length, [users])

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp))
  }

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ts-on-surface)] flex items-center gap-2.5">
            <Users size={24} className="text-[var(--ts-primary)]" />
            <span>จัดการผู้ใช้งานและสิทธิ์ (Users & Roles)</span>
          </h1>
          <p className="text-xs text-[var(--ts-on-surface-variant)] mt-0.5">
            กำหนดบทบาทผู้ดูแลระบบ (Admin) และผู้ควบคุม (Operator) สำหรับเข้าถึงระบบ THE SERVER
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="p-2 rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface-variant)] hover:text-[var(--ts-on-surface)]"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary gap-2 text-xs font-semibold shadow-md"
          >
            <UserPlus size={15} />
            <span>เพิ่มผู้ใช้งานใหม่</span>
          </button>
        </div>
      </div>

      {/* ── Alerts ────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center justify-between gap-2.5 rounded-xl border border-[var(--ts-error)]/40 bg-[var(--ts-error-container)]/30 p-3.5 text-xs text-[#ffb4ab]">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-[var(--ts-error)]" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center justify-between gap-2.5 rounded-xl border border-[var(--ts-tertiary)]/40 bg-[var(--ts-tertiary-container)]/25 p-3.5 text-xs text-[var(--ts-tertiary)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{success}</span>
          </div>
          <button type="button" onClick={() => setSuccess(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Toolbar: Search & Summary ─────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex items-center flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ts-on-surface-variant)] z-10" />
          <input
            type="text"
            placeholder="ค้นหาชื่อผู้ใช้หรือบทบาท..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-has-left-icon text-xs py-2 rounded-xl w-full"
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>


        <div className="flex items-center gap-2 text-xs text-[var(--ts-on-surface-variant)]">
          <span className="badge border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] font-mono text-[11px]">
            ผู้ใช้ทั้งหมด: {users.length} คน
          </span>
          <span className="badge border-[var(--ts-primary)]/30 bg-[var(--ts-primary-container)]/20 text-[var(--ts-primary)] font-mono text-[11px]">
            Admin: {adminCount} คน
          </span>
        </div>
      </div>

      {/* ── Users Table Card ──────────────────────────────────── */}
      <div className="card overflow-hidden border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)]">
        {loading && users.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Loader2 size={24} className="animate-spin text-[var(--ts-primary)] mx-auto" />
            <p className="text-xs text-[var(--ts-on-surface-variant)]">กำลังโหลดรายชื่อผู้ใช้...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Users size={36} className="mx-auto text-[var(--ts-outline)] opacity-40" />
            <p className="text-sm font-bold text-[var(--ts-on-surface)]">ไม่พบรายชื่อผู้ใช้</p>
            <p className="text-xs text-[var(--ts-on-surface-variant)]">
              {search ? 'ลองเปลี่ยนคำค้นหา' : 'ยังไม่มีผู้ใช้อื่นในระบบ'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--ts-outline-variant)]/60 bg-[var(--ts-surface-low)] text-[var(--ts-on-surface-variant)] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">ผู้ใช้งาน</th>
                  <th className="py-3 px-4">บทบาท (Role)</th>
                  <th className="py-3 px-4">วันที่สร้างบัญชี</th>
                  <th className="py-3 px-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ts-outline-variant)]/40">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentUserId
                  const isChangingRole = changingRoleId === u.id
                  const isLastAdmin = u.role === 'admin' && adminCount <= 1

                  return (
                    <tr
                      key={u.id}
                      className="transition-colors hover:bg-[var(--ts-surface-high)]/40"
                    >
                      {/* Username */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold font-mono text-xs ${
                              u.role === 'admin'
                                ? 'bg-[var(--ts-primary-container)] text-[var(--ts-primary)]'
                                : 'bg-[var(--ts-surface-high)] text-[var(--ts-on-surface-variant)]'
                            }`}
                          >
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 font-bold text-sm text-[var(--ts-on-surface)]">
                              <span>{u.username}</span>
                              {isSelf && (
                                <span className="rounded-full bg-[var(--ts-tertiary-container)]/40 px-2 py-0.5 text-[10px] font-semibold text-[var(--ts-tertiary)] border border-[var(--ts-tertiary)]/40">
                                  คุณ (You)
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-[var(--ts-on-surface-variant)]">
                              ID: #{u.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role}
                            disabled={isChangingRole || (isSelf && isLastAdmin)}
                            onChange={(e) => void handleRoleChange(u.id, e.target.value as UserRole)}
                            className={`rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                              u.role === 'admin'
                                ? 'border-[var(--ts-primary)]/40 bg-[var(--ts-primary-container)]/25 text-[var(--ts-primary)]'
                                : 'border-[var(--ts-tertiary)]/40 bg-[var(--ts-tertiary-container)]/25 text-[var(--ts-tertiary)]'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={isSelf && isLastAdmin ? 'ไม่สามารถปลดตัวเองได้เนื่องจากเป็น Admin คนเดียว' : undefined}
                          >
                            <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                            <option value="operator">Operator (ผู้ควบคุม)</option>
                          </select>
                          {isChangingRole && <Loader2 size={13} className="animate-spin text-[var(--ts-primary)]" />}
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 text-[var(--ts-on-surface-variant)]">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="opacity-60" />
                          <span>{formatDate(u.createdAt)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => {
                              setResetTarget(u)
                              setNewPassword('')
                            }}
                            className="btn btn-sm gap-1.5 text-xs border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface)] hover:text-[var(--ts-primary)]"
                            title="รีเซ็ตรหัสผ่านใหม่"
                          >
                            <KeyRound size={13} />
                            <span className="hidden sm:inline">รีเซ็ตรหัสผ่าน</span>
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            disabled={isSelf || isLastAdmin}
                            onClick={() => setDeleteTarget(u)}
                            className="btn btn-sm text-xs border-[var(--ts-outline-variant)] bg-[var(--ts-surface-high)] text-[var(--ts-on-surface-variant)] hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                              isSelf
                                ? 'ไม่สามารถลบบัญชีของตนเองได้'
                                : isLastAdmin
                                  ? 'ไม่สามารถลบ Admin คนสุดท้ายได้'
                                  : 'ลบบัญชีผู้ใช้'
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add User Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--ts-outline-variant)]">
                <div className="flex items-center gap-2 text-[var(--ts-primary)]">
                  <UserPlus size={20} />
                  <h3 className="font-bold text-base text-[var(--ts-on-surface)]">
                    เพิ่มผู้ใช้งานใหม่
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg p-1 text-[var(--ts-on-surface-variant)] hover:bg-[var(--ts-surface-high)]"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                <div>
                  <label className="label">ชื่อผู้ใช้งาน (Username)</label>
                  <div className="relative flex items-center">
                    <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ts-on-surface-variant)] z-10" />
                    <input
                      type="text"
                      required
                      placeholder="เช่น bds_operator"
                      value={addForm.username}
                      onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                      className="input input-has-left-icon text-xs w-full"
                      style={{ paddingLeft: '2.5rem' }}
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-[var(--ts-on-surface-variant)] mt-1">
                    ความยาว 3-32 ตัวอักษร (a-z A-Z 0-9 _ . -)
                  </p>
                </div>

                <div>
                  <label className="label">รหัสผ่านเริ่มต้น (Password)</label>
                  <div className="relative flex items-center">
                    <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ts-on-surface-variant)] z-10" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="อย่างน้อย 8 ตัวอักษร"
                      value={addForm.password}
                      onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                      className="input input-has-left-icon text-xs w-full"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </div>
                </div>


                <div>
                  <label className="label">บทบาทและสิทธิ์ (Role)</label>
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <label
                      className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-all ${
                        addForm.role === 'operator'
                          ? 'border-[var(--ts-tertiary)] bg-[var(--ts-tertiary-container)]/20 ring-1 ring-[var(--ts-tertiary)]/40'
                          : 'border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--ts-tertiary)] flex items-center gap-1.5">
                          <UserCheck size={14} />
                          <span>Operator</span>
                        </span>
                        <input
                          type="radio"
                          name="new-role"
                          checked={addForm.role === 'operator'}
                          onChange={() => setAddForm({ ...addForm, role: 'operator' })}
                          className="accent-[var(--ts-tertiary)]"
                        />
                      </div>
                      <p className="text-[10px] text-[var(--ts-on-surface-variant)] leading-tight">
                        ควบคุมเซิร์ฟเวอร์ ดูคอนโซล จัดการไฟล์ & ส่วนเสริม
                      </p>
                    </label>

                    <label
                      className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-all ${
                        addForm.role === 'admin'
                          ? 'border-[var(--ts-primary)] bg-[var(--ts-primary-container)]/20 ring-1 ring-[var(--ts-primary)]/40'
                          : 'border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--ts-primary)] flex items-center gap-1.5">
                          <ShieldCheck size={14} />
                          <span>Admin</span>
                        </span>
                        <input
                          type="radio"
                          name="new-role"
                          checked={addForm.role === 'admin'}
                          onChange={() => setAddForm({ ...addForm, role: 'admin' })}
                          className="accent-[var(--ts-primary)]"
                        />
                      </div>
                      <p className="text-[10px] text-[var(--ts-on-surface-variant)] leading-tight">
                        สิทธิ์สูงสุด รวมถึงจัดการบัญชีผู้ใช้และติดตั้งเซิร์ฟเวอร์
                      </p>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--ts-outline-variant)]/60">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn btn-sm"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdd}
                    className="btn btn-sm btn-primary gap-1.5 font-semibold"
                  >
                    {submittingAdd ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                    <span>สร้างบัญชีผู้ใช้</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Reset Password Modal ───────────────────────────────── */}
      <AnimatePresence>
        {resetTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--ts-outline-variant)]">
                <div className="flex items-center gap-2 text-[var(--ts-primary)]">
                  <KeyRound size={18} />
                  <h3 className="font-bold text-base text-[var(--ts-on-surface)]">
                    รีเซ็ตรหัสผ่านสำหรับ &quot;{resetTarget.username}&quot;
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="rounded-lg p-1 text-[var(--ts-on-surface-variant)] hover:bg-[var(--ts-surface-high)]"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
                <div>
                  <label className="label">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</label>
                  <div className="relative flex items-center">
                    <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ts-on-surface-variant)] z-10" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="พิมพ์รหัสผ่านใหม่"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input input-has-left-icon text-xs w-full"
                      style={{ paddingLeft: '2.5rem' }}
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-[var(--ts-on-surface-variant)] mt-1">
                    หลังจากรีเซ็ต เซสชันที่ล็อกอินค้างไว้ของผู้ใช้นี้จะถูกยกเลิก และต้องเข้าสู่ระบบใหม่
                  </p>
                </div>


                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetTarget(null)}
                    className="btn btn-sm"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReset || newPassword.length < 8}
                    className="btn btn-sm btn-primary gap-1.5 font-semibold"
                  >
                    {submittingReset ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                    <span>บันทึกรหัสผ่านใหม่</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete User Confirmation Modal ────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-rose-500/50 bg-[var(--ts-surface-container)] p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--ts-outline-variant)]">
                <div className="flex items-center gap-2 text-rose-400">
                  <Trash2 size={18} />
                  <h3 className="font-bold text-base text-[var(--ts-on-surface)]">
                    ยืนยันการลบบัญชีผู้ใช้
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="rounded-lg p-1 text-[var(--ts-on-surface-variant)] hover:bg-[var(--ts-surface-high)]"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-[var(--ts-on-surface-variant)] leading-relaxed">
                คุณแน่ใจหรือไม่ว่าต้องการลบบัญชี{' '}
                <strong className="text-[var(--ts-on-surface)] font-bold">
                  &quot;{deleteTarget.username}&quot;
                </strong>{' '}
                ออกจากระบบ? การกระทำนี้ไม่สามารถย้อนกลับได้
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="btn btn-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={submittingDelete}
                  onClick={handleDeleteUser}
                  className="btn btn-sm border-rose-600 bg-rose-600 text-white hover:bg-rose-500"
                >
                  {submittingDelete ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  <span>ยืนยันลบผู้ใช้</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
