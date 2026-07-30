import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useQueueStore } from '../../store/useQueueStore'
import { useUIStore } from '../../store/useUIStore'
import { useWritingStore } from '../../store/useWritingStore'
import { formatSeconds, formatMinutes } from '../../utils/format'

export default function FocusView() {
  const { active, pause, resume, logDistraction, abandon } = useSessionStore()
  const { items, updateItem } = useQueueStore()
  const { setView, openPostSession } = useUIStore()

  const [elapsed, setElapsed] = useState(0)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const notesRef = useRef(notes)
  const notesTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const item = active ? items.find(i => i.id === active.itemId) : undefined
  const isPaused = !!active?.pausedAt

  // Notes state'ini item yüklenince başlat
  useEffect(() => {
    if (item) {
      setNotes(item.notes ?? '')
      notesRef.current = item.notes ?? ''
    }
  }, [item?.id])

  // Timer — pause durumunda durdur
  useEffect(() => {
    if (!active || isPaused) return
    const tick = () => {
      const pausedMs = active.totalPausedMs
      setElapsed(Math.floor((Date.now() - new Date(active.startedAt).getTime() - pausedMs) / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [active, isPaused])

  // Unmount'ta bekleyen notu kaydet
  useEffect(() => () => {
    clearTimeout(notesTimer.current)
    if (item && notesRef.current !== (item.notes ?? '')) {
      updateItem(item.id, { notes: notesRef.current })
    }
  }, [item?.id])

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

  const totalSeconds = active.plannedMinutes * 60
  const remaining = totalSeconds - elapsed
  const isOvertime = remaining < 0
  const progress = Math.min(elapsed / totalSeconds, 1)

  function handleDistraction() {
    if (!isPaused) {
      logDistraction()
      pause()
    } else {
      resume()
    }
  }

  function handleDone() {
    clearTimeout(notesTimer.current)
    if (item && notesRef.current !== (item.notes ?? '')) {
      updateItem(item.id, { notes: notesRef.current })
    }
    if (isPaused) resume()
    openPostSession()
  }

  function handleAbandon() {
    if (!confirm('Seansı iptal etmek istiyor musun?')) return
    clearTimeout(notesTimer.current)
    if (item && notesRef.current !== (item.notes ?? '')) {
      updateItem(item.id, { notes: notesRef.current })
    }
    abandon()
    setView('today')
  }

  function handleOpenWriting() {
    if (!item) return
    // Konuya bağlı yazı varsa ona devam et, yoksa başlığı hazır yeni yazı aç.
    // Seans devam eder — global session bar üzerinden odağa dönülür.
    const store = useWritingStore.getState()
    const existing = store.getByItem(item.id)
    const id = existing.length > 0 ? existing[0].id : store.addWriting({ itemId: item.id, title: item.question })
    useUIStore.getState().openWriting(id)
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    notesRef.current = value
    clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      if (item) updateItem(item.id, { notes: value })
    }, 600)
  }

  return (
    <div className="focus-view">
      <div className="focus-inner">
        {/* Header */}
        <div className="focus-top">
          <button className="btn btn-ghost focus-back" onClick={() => setView('today')}>← Bugün</button>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {active.distractionCount > 0 && (
              <span className="distraction-count">{active.distractionCount} dikkat dağılması</span>
            )}
            {isPaused && <span className="pause-badge">⏸ Duraklatıldı</span>}
          </div>
        </div>

        {/* Topic */}
        <div className="focus-topic">
          {item?.tags.map(t => <span key={t} className="badge badge-category">{t}</span>)}
          <h1 className="focus-question">{item?.question ?? '—'}</h1>
          {item?.estimatedMinutes && (
            <p className="focus-meta">Tahmini {formatMinutes(item.estimatedMinutes)} · Planlanan {formatMinutes(active.plannedMinutes)}</p>
          )}
        </div>

        {/* Timer */}
        <div className={`focus-timer ${isOvertime ? 'overtime' : ''} ${isPaused ? 'paused' : ''}`}>
          {formatSeconds(Math.abs(remaining))}
        </div>

        {/* Progress bar */}
        <div className="focus-progress-track">
          <div className="focus-progress-fill" style={{ width: `${progress * 100}%`, opacity: isPaused ? 0.4 : 1 }} />
        </div>

        {/* Notes toggle */}
        <div className="focus-notes-row">
          <button
            className="btn btn-ghost focus-notes-toggle"
            onClick={() => setShowNotes(v => !v)}
          >
            📝 {showNotes ? 'Notları Gizle' : 'Not Al'}
          </button>
          <button
            className="btn btn-ghost focus-notes-toggle"
            onClick={handleOpenWriting}
          >
            ✎ Blog Yazısı
          </button>
        </div>

        {showNotes && (
          <textarea
            className="input focus-notes-area"
            placeholder="Bu konuyla ilgili aklına gelenleri yaz..."
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            rows={4}
            autoFocus
          />
        )}

        {/* Actions */}
        <div className="focus-actions">
          <button
            className={`btn ${isPaused ? 'btn-primary' : 'btn-ghost'} distraction-btn`}
            onClick={handleDistraction}
          >
            {isPaused ? '▶ Devam Et' : '⚡ Dikkatim Dağıldı'}
          </button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-ghost" onClick={handleAbandon}>İptal</button>
            <button className="btn btn-primary" onClick={handleDone}>
              {isOvertime ? 'Tamamla (Uzadı)' : 'Bitti'}
            </button>
          </div>
        </div>

        {isOvertime && !isPaused && (
          <p className="focus-overtime-note">Süre doldu — ama seans devam ediyor. Bitirince "Tamamla" a bas.</p>
        )}
      </div>
    </div>
  )
}
