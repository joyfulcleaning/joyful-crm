'use client'

import { AlertTriangle } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export default function ConfirmModal({
  open, title, message, confirmLabel = 'Delete', onConfirm, onCancel, danger = true
}: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/75" onClick={onCancel} />
      <div className="relative bg-[#161922] border border-[#2a2f3d] rounded-2xl w-full max-w-sm p-6 shadow-[0_32px_100px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: danger ? 'rgba(248,113,113,0.15)' : 'rgba(79,142,247,0.15)' }}>
            <AlertTriangle size={18} color={danger ? '#f87171' : '#4f8ef7'} />
          </div>
          <div className="text-sm font-bold text-[#e8eaf0]">{title}</div>
        </div>
        <p className="text-xs text-[#9ca3af] leading-relaxed mb-6 whitespace-pre-line">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#2a2f3d] text-[#9ca3af] hover:text-[#e8eaf0] hover:border-[#4f8ef7] transition-all">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition-all"
            style={{ background: danger ? '#f87171' : '#4f8ef7' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}