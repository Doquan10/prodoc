import { useEffect, useState } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useQueueStore } from '../../store/useQueueStore'
import { useUIStore } from '../../store/useUIStore'
import { formatSeconds, formatMinutes } from '../../utils/format'

export default function FocusView() {
  const { active, logDistraction, abandon } = useSessionStore()
  const getItem = useQueueStore(s => s.getItem)
  const { setView, openPostSession } = useUIStore()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active) return
    const tick = () => {
      setElapsed(Math.floor((Date.now() - new Date(active.startedAt).getTime()) / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [active])

  if (!active) {
    return (
      <div className="view-container">
        <div className="empty-state" style={{ marginTop: 80 }}>
          <p>Aktif seans yok.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setView('today')}>
            Bugüne Dön
          </button>
        </div>
      </div>
    )
  }

  const item = getItem(active.itemId)
  const totalSeconds = active.plannedMinutes * 60
  const remaining = totalSeconds - elapsed
  const isOvertime = remaining < 0
  const progress = Math.min(elapsed / totalSeconds, 1)

  function handleDone() {
    openPostSession()
  }

  function handleAbandon() {
    if (!confirm('Seansı iptal etmek istiyor musun?')) return
    abandon()
    setView('today')
  }

  return (
    <div className="focus-view">
      <div className="focus-inner">
        {/* Header */}
        <div className="focus-top">
          <button className="btn btn-ghost focus-back" onClick={() => setView('today')}>← Bugün</button>
          {active.distractionCount > 0 && (
            <span className="distraction-count">{active.distractionCount} dikkat dağılması</span>
          )}
        </div>

        {/* Topic */}
        <div className="focus-topic">
          {item?.category && <span className="badge badge-category">{item.category}</span>}
          <h1 className="focus-question">{item?.question ?? '—'}</h1>
          {item?.estimatedMinutes && (
            <p className="focus-meta">Tahmini {formatMinutes(item.estimatedMinutes)} · Planlanan {formatMinutes(active.plannedMinutes)}</p>
          )}
        </div>

        {/* Timer */}
        <div className={`focus-timer ${isOvertime ? 'overtime' : ''}`}>
          {isOvertime ? formatSeconds(remaining) : formatSeconds(remaining)}
        </div>

        {/* Progress bar */}
        <div className="focus-progress-track">
          <div className="focus-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>

        {/* Actions */}
        <div className="focus-actions">
          <button
            className="btn btn-ghost distraction-btn"
            onClick={logDistraction}
            title="Dikkatim dağıldı"
          >
            ⚡ Dikkatim Dağıldı
          </button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-ghost" onClick={handleAbandon}>İptal</button>
            <button className="btn btn-primary" onClick={handleDone}>
              {isOvertime ? 'Tamamla (Uzadı)' : 'Bitti'}
            </button>
          </div>
        </div>

        {/* Motivational note when overtime */}
        {isOvertime && (
          <p className="focus-overtime-note">Süre doldu — ama seans devam ediyor. Bitirince "Tamamla" a bas.</p>
        )}
      </div>
    </div>
  )
}
