'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Tag,
  Search,
  ChevronDown,
  Check,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  X,
} from 'lucide-react'

interface VersionAutoCompleteProps {
  value: string
  onChange: (version: string) => void
  versions: string[]
  latestVersion?: string | null
  disabled?: boolean
  placeholder?: string
}

export default function VersionAutoComplete({
  value,
  onChange,
  versions,
  latestVersion,
  disabled = false,
  placeholder = 'เลือกหรือค้นหาเวอร์ชัน เช่น 1.26.52.3',
}: VersionAutoCompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState(value)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Sync external value with local search state
  useEffect(() => {
    setSearch(value)
  }, [value])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter versions based on search query
  const filteredVersions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return versions
    return versions.filter((v) => v.toLowerCase().includes(q))
  }, [versions, search])

  // Top quick suggestions (top 4 latest releases)
  const quickVersions = useMemo(() => {
    return versions.slice(0, 4)
  }, [versions])

  // Check if current value matches an official version
  const isOfficial = useMemo(() => {
    return versions.includes(value.trim())
  }, [versions, value])

  const handleSelect = (ver: string) => {
    onChange(ver)
    setSearch(ver)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setHighlightedIndex(0)
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredVersions.length - 1 ? prev + 1 : 0
        )
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setHighlightedIndex(filteredVersions.length - 1)
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredVersions.length - 1
        )
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (isOpen && highlightedIndex >= 0 && filteredVersions[highlightedIndex]) {
        handleSelect(filteredVersions[highlightedIndex])
      } else if (isOpen && filteredVersions.length > 0) {
        handleSelect(filteredVersions[0])
      } else {
        setIsOpen(false)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li')
      const target = items[highlightedIndex]
      if (target) {
        target.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex])

  return (
    <div ref={containerRef} className="relative w-full space-y-2">
      {/* ── Input Box ─────────────────────────────────────────── */}
      <div
        className={`relative flex items-center rounded-xl border bg-[var(--ts-surface-low)] transition-all ${
          disabled
            ? 'opacity-60 cursor-not-allowed border-[var(--ts-outline-variant)]'
            : isOpen
              ? 'border-[var(--ts-primary)] ring-2 ring-[var(--ts-primary)]/20 bg-[var(--ts-surface-container)]'
              : 'border-[var(--ts-outline-variant)] hover:border-[var(--ts-outline)]'
        }`}
      >
        <div className="pl-3 text-[var(--ts-primary)] pointer-events-none">
          <Tag size={15} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={search}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            if (!disabled) setIsOpen(true)
          }}
          onChange={(e) => {
            const val = e.target.value
            setSearch(val)
            onChange(val)
            setIsOpen(true)
            setHighlightedIndex(0)
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent py-2 px-2.5 text-xs font-mono font-medium text-[var(--ts-on-surface)] placeholder-[var(--ts-on-surface-variant)]/60 focus:outline-none"
        />

        <div className="flex items-center gap-1 pr-2">
          {search && !disabled && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                onChange('')
                inputRef.current?.focus()
              }}
              className="p-1 rounded-lg text-[var(--ts-on-surface-variant)] hover:bg-[var(--ts-surface-high)] hover:text-[var(--ts-on-surface)] transition-colors"
            >
              <X size={13} />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                setIsOpen((prev) => !prev)
                inputRef.current?.focus()
              }
            }}
            className="p-1 rounded-lg text-[var(--ts-on-surface-variant)] hover:bg-[var(--ts-surface-high)] hover:text-[var(--ts-on-surface)] transition-colors"
          >
            <ChevronDown
              size={15}
              className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* ── Status Indicator Under Input ────────────────────── */}
      {value.trim() && (
        <div className="flex items-center gap-1.5 text-[11px] px-1">
          {isOfficial ? (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 size={13} />
              <span>เวอร์ชันทางการที่ผ่านการรับรองจาก Mojang</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <AlertCircle size={13} />
              <span>ระบุเวอร์ชันเอง (อาจไม่มีไฟล์ดาวน์โหลดหากพิมพ์ผิด)</span>
            </span>
          )}
        </div>
      )}

      {/* ── Quick Release Chips ──────────────────────────────── */}
      {quickVersions.length > 0 && !disabled && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] text-[var(--ts-on-surface-variant)] uppercase font-semibold tracking-wider mr-0.5">
            แนะนำ:
          </span>
          {quickVersions.map((ver) => {
            const isSelected = value === ver
            const isLatest = ver === latestVersion
            return (
              <button
                key={ver}
                type="button"
                onClick={() => handleSelect(ver)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
                  isSelected
                    ? 'bg-[var(--ts-primary)] text-[var(--ts-on-primary)] font-bold shadow-md shadow-[var(--ts-primary)]/20'
                    : 'border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-low)] text-[var(--ts-on-surface)] hover:border-[var(--ts-primary)]/50 hover:bg-[var(--ts-surface-high)]'
                }`}
              >
                {isLatest && <Sparkles size={11} className={isSelected ? 'text-[var(--ts-on-primary)]' : 'text-[var(--ts-primary)]'} />}
                <span>v{ver}</span>
                {isLatest && (
                  <span className={`text-[9px] px-1 rounded ${isSelected ? 'bg-black/20 text-white' : 'bg-[var(--ts-primary)]/20 text-[var(--ts-primary)]'}`}>
                    ล่าสุด
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── AutoComplete Dropdown Menu ───────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-[var(--ts-outline-variant)] bg-[var(--ts-surface-container)] shadow-2xl backdrop-blur-md"
          >
            {/* Dropdown Header */}
            <div className="flex items-center justify-between border-b border-[var(--ts-outline-variant)]/60 px-3.5 py-2 text-[11px] text-[var(--ts-on-surface-variant)]">
              <span className="flex items-center gap-1.5 font-semibold">
                <Search size={12} className="text-[var(--ts-primary)]" />
                <span>เวอร์ชันทางการทั้งหมด ({versions.length} เวอร์ชัน)</span>
              </span>
              <span>เลือกจากรายการเพื่อป้องกันพิมพ์ผิด</span>
            </div>

            {/* Scrollable Version List */}
            <ul
              ref={listRef}
              className="max-h-56 overflow-y-auto p-1.5 divide-y divide-[var(--ts-outline-variant)]/30"
            >
              {filteredVersions.length === 0 ? (
                <div className="py-6 text-center space-y-1">
                  <p className="text-xs text-[var(--ts-on-surface-variant)]">
                    ไม่พบเวอร์ชันที่ตรงกับ &ldquo;{search}&rdquo;
                  </p>
                  <p className="text-[11px] text-[var(--ts-on-surface-variant)]/60">
                    ลองพิมพ์เลขเวอร์ชันหลัก เช่น 1.26 หรือ 1.21
                  </p>
                </div>
              ) : (
                filteredVersions.map((ver, idx) => {
                  const isSelected = value === ver
                  const isLatest = ver === latestVersion
                  const isHighlighted = idx === highlightedIndex

                  return (
                    <li
                      key={ver}
                      onClick={() => handleSelect(ver)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`flex cursor-pointer items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                        isHighlighted
                          ? 'bg-[var(--ts-primary)]/15 text-[var(--ts-primary)]'
                          : isSelected
                            ? 'bg-[var(--ts-primary-container)]/30 text-[var(--ts-on-surface)]'
                            : 'text-[var(--ts-on-surface)] hover:bg-[var(--ts-surface-high)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">v{ver}</span>
                        {isLatest && (
                          <span className="badge border-amber-500/40 bg-amber-500/15 text-amber-300 font-sans text-[10px] py-0.5 px-1.5">
                            ⭐ เวอร์ชันล่าสุด
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-1 text-[var(--ts-primary)] font-semibold text-[11px]">
                          <Check size={14} />
                          <span>เลือกอยู่</span>
                        </div>
                      )}
                    </li>
                  )
                })
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
