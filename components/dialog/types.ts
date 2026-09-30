import type { ReactNode } from 'react'

export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'question' | 'danger'

export interface AlertOptions {
  title?: string
  message: ReactNode | string
  type?: 'info' | 'success' | 'warning' | 'error'
  confirmText?: string
}

export interface ConfirmOptions {
  title?: string
  message: ReactNode | string
  type?: 'warning' | 'danger' | 'info' | 'question'
  confirmText?: string
  cancelText?: string
  isDanger?: boolean
}

export interface PromptOptions {
  title: string
  message?: ReactNode | string
  defaultValue?: string
  placeholder?: string
  inputType?: 'text' | 'password' | 'number'
  confirmText?: string
  cancelText?: string
  validate?: (value: string) => string | null | undefined | boolean
}

export interface ToastOptions {
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  duration?: number
}

export interface DialogContextType {
  alert: (optionsOrMessage: AlertOptions | string, title?: string) => Promise<void>
  confirm: (optionsOrMessage: ConfirmOptions | string, title?: string) => Promise<boolean>
  prompt: (options: PromptOptions) => Promise<string | null>
  toast: (optionsOrMessage: ToastOptions | string, type?: ToastOptions['type']) => void
}
