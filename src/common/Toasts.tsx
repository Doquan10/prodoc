import { useToastStore } from '../store/useToastStore'

const ICONS = { success: '✓', error: '✕', info: 'ℹ' } as const

export default function Toasts() {
  const toasts = useToastStore(s => s.toasts)
  const dismiss = useToastStore(s => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => dismiss(t.id)}>
          <span className="toast-icon">{ICONS[t.type]}</span>
          {t.message}
        </div>
      ))}
    </div>
  )
}
