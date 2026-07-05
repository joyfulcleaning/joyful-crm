'use client'

export default function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      background: 'rgba(248, 113, 113, 0.12)', border: '1px solid rgba(248, 113, 113, 0.4)',
      color: '#f87171', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 14,
    }}>
      <span>⚠️ {message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'transparent', border: '1px solid #f87171', color: '#f87171',
            borderRadius: 6, padding: '4px 10px', fontSize: 13, cursor: 'pointer', flexShrink: 0,
          }}
        >
          Reintentar
        </button>
      )}
    </div>
  )
}
