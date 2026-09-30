'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  XCircle,
  X,
} from 'lucide-react'
import type {
  AlertOptions,
  ConfirmOptions,
  DialogContextType,
  DialogType,
  PromptOptions,
  ToastOptions,
} from './types'

type ModalState =
  | {
      id: string
      kind: 'alert'
      options: AlertOptions
      resolve: () => void
    }
  | {
      id: string
      kind: 'confirm'
      options: ConfirmOptions
      resolve: (value: boolean) => void
    }
  | {
      id: string
      kind: 'prompt'
      options: PromptOptions
      resolve: (value: string | null) => void
    }

interface ToastItem {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

const DialogContext = createContext<DialogContextType | null>(null)

// Imperative singleton for calling dialog outside React components if needed
let globalDialogHandler: DialogContextType | null = null

export const dialog: DialogContextType = {
  alert: (opts, title) => {
    if (!globalDialogHandler) {
      console.warn('DialogProvider is not yet mounted')
      return Promise.resolve()
    }
    return globalDialogHandler.alert(opts, title)
  },
  confirm: (opts, title) => {
    if (!globalDialogHandler) {
      console.warn('DialogProvider is not yet mounted')
      return Promise.resolve(false)
    }
    return globalDialogHandler.confirm(opts, title)
  },
  prompt: (opts) => {
    if (!globalDialogHandler) {
      console.warn('DialogProvider is not yet mounted')
      return Promise.resolve(null)
    }
    return globalDialogHandler.prompt(opts)
  },
  toast: (opts, type) => {
    if (!globalDialogHandler) {
      console.warn('DialogProvider is not yet mounted')
      return
    }
    globalDialogHandler.toast(opts, type)
  },
}

export function useDialog(): DialogContextType {
  const ctx = useContext(DialogContext)
  if (!ctx) {
    throw new Error('useDialog must be used within a DialogProvider')
  }
  return ctx
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null)
  const [promptValue, setPromptValue] = useState('')
  const [promptError, setPromptError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const promptInputRef = useRef<HTMLInputElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  // ── Alert ─────────────────────────────────────────────────────────────
  const alert = useCallback(
    (optionsOrMessage: AlertOptions | string, title?: string): Promise<void> => {
      const options: AlertOptions =
        typeof optionsOrMessage === 'string'
          ? { title: title ?? 'การแจ้งเตือน', message: optionsOrMessage, type: 'info' }
          : { ...optionsOrMessage, title: optionsOrMessage.title ?? title ?? 'การแจ้งเตือน' }

      return new Promise<void>((resolve) => {
        setModal({
          id: Math.random().toString(36).substring(2),
          kind: 'alert',
          options,
          resolve,
        })
      })
    },
    []
  )

  // ── Confirm ───────────────────────────────────────────────────────────
  const confirm = useCallback(
    (optionsOrMessage: ConfirmOptions | string, title?: string): Promise<boolean> => {
      const options: ConfirmOptions =
        typeof optionsOrMessage === 'string'
          ? { title: title ?? 'ยืนยันการดำเนินการ', message: optionsOrMessage, type: 'warning' }
          : { ...optionsOrMessage, title: optionsOrMessage.title ?? title ?? 'ยืนยันการดำเนินการ' }

      return new Promise<boolean>((resolve) => {
        setModal({
          id: Math.random().toString(36).substring(2),
          kind: 'confirm',
          options,
          resolve,
        })
      })
    },
    []
  )

  // ── Prompt ────────────────────────────────────────────────────────────
  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    setPromptValue(options.defaultValue ?? '')
    setPromptError(null)

    return new Promise<string | null>((resolve) => {
      setModal({
        id: Math.random().toString(36).substring(2),
        kind: 'prompt',
        options,
        resolve,
      })
    })
  }, [])

  // ── Toast ─────────────────────────────────────────────────────────────
  const toast = useCallback(
    (optionsOrMessage: ToastOptions | string, type?: ToastOptions['type']) => {
      const opts: ToastOptions =
        typeof optionsOrMessage === 'string'
          ? { message: optionsOrMessage, type: type ?? 'info' }
          : optionsOrMessage

      const id = Math.random().toString(36).substring(2)
      const newItem: ToastItem = {
        id,
        message: opts.message,
        type: opts.type ?? 'info',
      }
      setToasts((prev) => [...prev, newItem])

      const duration = opts.duration ?? 3500
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    },
    []
  )

  // Register global singleton
  useEffect(() => {
    globalDialogHandler = { alert, confirm, prompt, toast }
    return () => {
      globalDialogHandler = null
    }
  }, [alert, confirm, prompt, toast])

  // Intercept window native dialogs for 100% safety
  useEffect(() => {
    if (typeof window === 'undefined') return
    const originalAlert = window.alert
    const originalConfirm = window.confirm
    const originalPrompt = window.prompt

    window.alert = (msg?: unknown) => {
      void alert(String(msg ?? ''))
    }
    window.confirm = (msg?: unknown) => {
      console.warn('Native window.confirm() was intercepted. Use `await dialog.confirm(...)` instead.')
      void confirm(String(msg ?? ''))
      return false
    }
    window.prompt = (msg?: unknown, defaultVal?: unknown) => {
      console.warn('Native window.prompt() was intercepted. Use `await dialog.prompt(...)` instead.')
      void prompt({
        title: 'ระบุข้อมูล',
        message: String(msg ?? ''),
        defaultValue: String(defaultVal ?? ''),
      })
      return null
    }

    return () => {
      window.alert = originalAlert
      window.confirm = originalConfirm
      window.prompt = originalPrompt
    }
  }, [alert, confirm, prompt])

  // Focus effect when modal opens
  useEffect(() => {
    if (!modal) return
    if (modal.kind === 'prompt') {
      setTimeout(() => promptInputRef.current?.focus(), 50)
    } else {
      setTimeout(() => confirmBtnRef.current?.focus(), 50)
    }
  }, [modal])

  // Close handlers
  const handleDismiss = () => {
    if (!modal) return
    if (modal.kind === 'alert') {
      modal.resolve()
    } else if (modal.kind === 'confirm') {
      modal.resolve(false)
    } else if (modal.kind === 'prompt') {
      modal.resolve(null)
    }
    setModal(null)
  }

  const handleConfirm = () => {
    if (!modal) return
    if (modal.kind === 'alert') {
      modal.resolve()
      setModal(null)
    } else if (modal.kind === 'confirm') {
      modal.resolve(true)
      setModal(null)
    } else if (modal.kind === 'prompt') {
      if (modal.options.validate) {
        const valRes = modal.options.validate(promptValue)
        if (typeof valRes === 'string' && valRes.trim()) {
          setPromptError(valRes)
          return
        }
        if (valRes === false) {
          setPromptError('ข้อมูลไม่ถูกต้อง')
          return
        }
      }
      modal.resolve(promptValue)
      setModal(null)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!modal) return
      if (e.key === 'Escape') {
        e.preventDefault()
        handleDismiss()
      } else if (e.key === 'Enter' && modal.kind !== 'prompt') {
        e.preventDefault()
        handleConfirm()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modal, promptValue])

  // Icon renderer
  const renderIcon = (type?: DialogType, isDanger?: boolean) => {
    if (isDanger || type === 'danger' || type === 'error') {
      return (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 ring-8 ring-rose-500/10 shadow-[0_0_24px_rgba(244,63,94,0.25)]">
          <AlertTriangle size={28} className="animate-pulse" />
        </div>
      )
    }
    if (type === 'success') {
      return (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-8 ring-emerald-500/10 shadow-[0_0_24px_rgba(16,185,129,0.25)]">
          <CheckCircle2 size={28} />
        </div>
      )
    }
    if (type === 'warning') {
      return (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 ring-8 ring-amber-500/10 shadow-[0_0_24px_rgba(245,158,11,0.25)]">
          <AlertTriangle size={28} />
        </div>
      )
    }
    if (type === 'question') {
      return (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400 ring-8 ring-sky-500/10 shadow-[0_0_24px_rgba(14,165,233,0.25)]">
          <HelpCircle size={28} />
        </div>
      )
    }
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ts-primary-container)]/30 text-[var(--ts-primary)] ring-8 ring-[var(--ts-primary)]/10 shadow-[0_0_24px_rgba(143,205,255,0.2)]">
        <Info size={28} />
      </div>
    )
  }

  const contextValue: DialogContextType = {
    alert,
    confirm,
    prompt,
    toast,
  }

  return (
    <DialogContext.Provider value={contextValue}>
      {children}

      {/* ── SweetAlert-style Modal ───────────────────────────── */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleDismiss}
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
            />

            {/* Modal Dialog Card */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] p-6 shadow-2xl space-y-5"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={handleDismiss}
                className="absolute top-4 right-4 rounded-xl p-1.5 text-[var(--ts-on-surface-variant)] transition-all hover:bg-[var(--ts-surface-highest)] hover:text-[var(--ts-on-surface)]"
              >
                <X size={18} />
              </button>

              {/* Icon & Title */}
              <div className="flex flex-col items-center text-center space-y-3 pt-2">
                {modal.kind === 'alert' && renderIcon(modal.options.type)}
                {modal.kind === 'confirm' && renderIcon(modal.options.type, modal.options.isDanger)}
                {modal.kind === 'prompt' && renderIcon('question')}

                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold tracking-tight text-[var(--ts-on-surface)]">
                    {modal.options.title}
                  </h3>
                  {modal.options.message && (
                    <div className="text-xs sm:text-sm text-[var(--ts-on-surface-variant)] leading-relaxed max-h-48 overflow-y-auto px-2">
                      {modal.options.message}
                    </div>
                  )}
                </div>
              </div>

              {/* Prompt Input Field */}
              {modal.kind === 'prompt' && (
                <div className="space-y-2 pt-1">
                  <input
                    ref={promptInputRef}
                    type={modal.options.inputType ?? 'text'}
                    value={promptValue}
                    placeholder={modal.options.placeholder ?? 'พิมพ์ข้อความที่นี่...'}
                    onChange={(e) => {
                      setPromptValue(e.target.value)
                      if (promptError) setPromptError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleConfirm()
                      }
                    }}
                    className={`input w-full text-sm py-2.5 px-3.5 rounded-xl border ${
                      promptError
                        ? 'border-rose-500 bg-rose-500/10 focus:ring-rose-500/40'
                        : 'border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)]'
                    }`}
                  />
                  {promptError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-medium text-rose-400 px-1"
                    >
                      {promptError}
                    </motion.p>
                  )}
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center gap-2.5 pt-2">
                {modal.kind !== 'alert' && (
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="btn flex-1 py-2.5 rounded-xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] text-xs font-semibold text-[var(--ts-on-surface)] transition-all hover:bg-[var(--ts-surface-high)]"
                  >
                    {modal.kind === 'confirm'
                      ? modal.options.cancelText ?? 'ยกเลิก'
                      : modal.options.cancelText ?? 'ยกเลิก'}
                  </button>
                )}

                <button
                  ref={confirmBtnRef}
                  type="button"
                  onClick={handleConfirm}
                  className={`btn flex-1 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-all ${
                    modal.kind === 'confirm' && modal.options.isDanger
                      ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-600/30'
                      : 'btn-primary'
                  }`}
                >
                  {modal.kind === 'alert'
                    ? modal.options.confirmText ?? 'ตกลง'
                    : modal.kind === 'confirm'
                      ? modal.options.confirmText ?? 'ยืนยัน'
                      : modal.options.confirmText ?? 'บันทึก'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Toast Notifications ───────────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-[10000] flex flex-col gap-2.5 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={`pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md text-xs sm:text-sm font-medium ${
                t.type === 'success'
                  ? 'border-emerald-500/40 bg-emerald-950/80 text-emerald-200 shadow-emerald-950/40'
                  : t.type === 'error'
                    ? 'border-rose-500/40 bg-rose-950/80 text-rose-200 shadow-rose-950/40'
                    : t.type === 'warning'
                      ? 'border-amber-500/40 bg-amber-950/80 text-amber-200 shadow-amber-950/40'
                      : 'border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] text-[var(--ts-on-surface)] shadow-black/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {t.type === 'success' && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
                {t.type === 'error' && <XCircle size={16} className="text-rose-400 shrink-0" />}
                {t.type === 'warning' && <AlertTriangle size={16} className="text-amber-400 shrink-0" />}
                {t.type === 'info' && <Info size={16} className="text-[var(--ts-primary)] shrink-0" />}
                <span>{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="p-1 opacity-70 hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </DialogContext.Provider>
  )
}
