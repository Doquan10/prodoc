import { useState } from 'react'
import { useQueueStore } from '../../store/useQueueStore'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlanStore } from '../../store/usePlanStore'
import { useUIStore } from '../../store/useUIStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { suggestItems } from '../../utils/scheduling'
import { todayStr, formatMinutes, dayOf, DAYS_LONG, MONTHS_LONG } from '../../utils/format'
import QueueItem from '../queue/QueueItem'
import type { CuriosityItem } from '../../types'

const DURATIONS = [10, 25, 45, 90]
const GOAL_OPTIONS = [30, 60, 90, 120, 180]

function greeting(h: number): string {
  if (h < 6) return 'İyi geceler'
  if (h < 12) return 'Günaydın'
  if (h < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

function ProgressRing({ value, max, size = 56 }: { value: number; max: number; size?: number }) {
  const stroke = 5
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const reached = max > 0 && value >= max
  return (
    <svg width={size} height={size} className="progress-ring" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bd2)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={reached ? 'var(--ok)' : 'var(--ac)'} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="progress-ring-text">
        {reached ? '✓' : `%${Math.round(pct * 100)}`}
      </text>
    </svg>
  )
}

export default function TodayView() {
  const items = useQueueStore(s => s.items)
  const getItem = useQueueStore(s => s.getItem)
  const updateItem = useQueueStore(s => s.updateItem)
  const { active: activeSession, start: startSession } = useSessionStore()
  const { todayPlan, addMust, removeMust, toggleMust } = usePlanStore()
  const { setView, selectItem, openCapture } = useUIStore()
  const focusGoal = useSettingsStore(s => s.focusGoalMinutes)
  const setFocusGoal = useSettingsStore(s => s.setFocusGoal)

  const [duration, setDuration] = useState(25)
  const [suggestionIdx, setSuggestionIdx] = useState(0)
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [mustInput, setMustInput] = useState('')
  const [mustHour, setMustHour] = useState('') // '' = saat yok, yoksa '00'..'23'
  const [mustMin, setMustMin] = useState('00')
  const [mustMinutes, setMustMinutes] = useState('')

  const today = todayStr()
  const plan = todayPlan()
  const now = new Date()
  const dateLabel = `${DAYS_LONG[now.getDay()]}, ${now.getDate()} ${MONTHS_LONG[now.getMonth()]}`

  const todaySessions = useSessionStore(s => s.history).filter(s => dayOf(s.startedAt) === today)
  const totalLearnedMin = todaySessions.reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0)

  const suggestions = suggestItems(items, duration, 5)
  const suggestion = suggestions[suggestionIdx]

  function startSuggestion() {
    if (!suggestion) return
    updateItem(suggestion.id, { status: 'in_progress' })
    startSession(suggestion.id, duration)
    setShowSuggestion(false)
    setSuggestionIdx(0)
    setView('focus')
  }

  function startItem(item: CuriosityItem) {
    updateItem(item.id, { status: 'in_progress' })
    startSession(item.id, item.estimatedMinutes ?? 25)
    setView('focus')
  }

  function submitMust() {
    if (!mustInput.trim()) return
    addMust(today, {
      text: mustInput.trim(),
      time: mustHour ? `${mustHour}:${mustMin}` : undefined,
      minutes: mustMinutes ? parseInt(mustMinutes) : undefined,
    })
    setMustInput('')
    setMustHour('')
    setMustMin('00')
    setMustMinutes('')
  }

  // Ajanda: tamamlanmamışlar üstte (saatliler saate göre, saatsizler sonra),
  // tamamlananlar en altta.
  const orderedMust = [...plan.mustItems].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1
    if (a.time && b.time) return a.time.localeCompare(b.time)
    if (a.time) return -1
    if (b.time) return 1
    return 0
  })
  const taskCount = plan.mustItems.length
  const doneCount = plan.mustItems.filter(t => t.done).length

  const pad = (n: number) => String(n).padStart(2, '0')
  const nowHM = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  // Sıradaki: şu andan sonraki ilk tamamlanmamış saatli görev.
  const nextTask = orderedMust.find(t => !t.done && t.time && t.time >= nowHM)

  const learnItems = plan.learnItemIds.map(id => getItem(id)).filter(Boolean) as CuriosityItem[]
  const exploreItems = plan.exploreItemIds.map(id => getItem(id)).filter(Boolean) as CuriosityItem[]

  return (
    <div className="view-container">
      {/* Header */}
      <div className="today-header">
        <div>
          <h1 className="view-title">{greeting(now.getHours())}</h1>
          <p className="view-subtitle">{dateLabel}</p>
        </div>
        <button className="btn btn-primary" onClick={openCapture}>+ Merak Et</button>
      </div>

      {/* Özet şeridi */}
      <div className="today-summary">
        <div className="summary-ring-tile">
          <ProgressRing value={totalLearnedMin} max={focusGoal} />
          <div className="summary-ring-info">
            <div className="summary-ring-val">
              {formatMinutes(totalLearnedMin)}<span> / {formatMinutes(focusGoal)}</span>
            </div>
            <div className="summary-ring-sub">
              odak hedefi
              <select
                className="goal-select"
                value={focusGoal}
                onChange={e => setFocusGoal(parseInt(e.target.value))}
                aria-label="Günlük odak hedefi"
              >
                {GOAL_OPTIONS.map(g => <option key={g} value={g}>{formatMinutes(g)}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="summary-tile">
          <span className="summary-tile-val">{doneCount}<span className="summary-tile-sep">/{taskCount}</span></span>
          <span className="summary-tile-label">görev</span>
        </div>
        <div className="summary-tile">
          <span className="summary-tile-val">{todaySessions.length}</span>
          <span className="summary-tile-label">seans</span>
        </div>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <div className="session-banner" onClick={() => setView('focus')}>
          <span className="session-banner-dot" />
          <span>Seans devam ediyor · {getItem(activeSession.itemId)?.question.slice(0, 60)}…</span>
          <span className="session-banner-cta">Devam Et →</span>
        </div>
      )}

      {/* Give me something */}
      <div className="give-me-card">
        <div className="give-me-top">
          <span className="give-me-title">Ne öğrensem?</span>
          <div className="duration-tabs">
            {DURATIONS.map(d => (
              <button
                key={d}
                className={`duration-tab ${duration === d ? 'active' : ''}`}
                onClick={() => { setDuration(d); setSuggestionIdx(0); setShowSuggestion(false) }}
              >
                {formatMinutes(d)}
              </button>
            ))}
          </div>
        </div>

        {!showSuggestion ? (
          <button
            className="btn btn-primary give-me-btn"
            onClick={() => setShowSuggestion(true)}
            disabled={!suggestion}
          >
            {suggestion ? `🎲 ${formatMinutes(duration)} için öneri al` : 'Queue boş — önce merak ekle'}
          </button>
        ) : suggestion ? (
          <div className="suggestion-card">
            <p className="suggestion-question">{suggestion.question}</p>
            <div className="suggestion-meta">
              {suggestion.category && <span className="badge badge-category">{suggestion.category}</span>}
              {suggestion.estimatedMinutes && <span className="badge badge-time">{formatMinutes(suggestion.estimatedMinutes)}</span>}
            </div>
            <div className="suggestion-actions">
              <button className="btn btn-ghost" onClick={() => selectItem(suggestion.id)}>Detay</button>
              {suggestions.length > 1 && (
                <button className="btn btn-ghost" onClick={() => setSuggestionIdx(i => (i + 1) % suggestions.length)}>
                  Başka öner
                </button>
              )}
              <button className="btn btn-primary" onClick={startSuggestion}>▶ Başla</button>
            </div>
          </div>
        ) : (
          <p className="empty-state" style={{ padding: '12px 0' }}>Bu süre için uygun konu bulunamadı.</p>
        )}
      </div>

      {/* Today's LEARN plan */}
      {learnItems.length > 0 && (
        <div className="today-section">
          <span className="today-section-label">📚 BUGÜN ÖĞREN</span>
          {learnItems.map(item => (
            <div key={item.id} className="plan-item-row">
              <div style={{ flex: 1 }} onClick={() => selectItem(item.id)}>
                <QueueItem item={item} showStatus={false} />
              </div>
              {item.status !== 'learned' && (
                <button className="btn btn-ghost play-btn" onClick={() => startItem(item)}>▶</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Today's EXPLORE plan */}
      {exploreItems.length > 0 && (
        <div className="today-section">
          <span className="today-section-label">🔭 BUGÜN KEŞFET</span>
          {exploreItems.map(item => (
            <div key={item.id} className="plan-item-row">
              <div style={{ flex: 1 }} onClick={() => selectItem(item.id)}>
                <QueueItem item={item} showStatus={false} />
              </div>
              {item.status !== 'learned' && (
                <button className="btn btn-ghost play-btn" onClick={() => startItem(item)}>▶</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MUST items — ajanda */}
      <div className="today-section">
        <span className="today-section-label">
          ✅ YAPILACAKLAR{taskCount > 0 && ` · ${doneCount}/${taskCount}`}
        </span>
        {orderedMust.map(m => {
          const isNext = m.id === nextTask?.id
          const isOverdue = !m.done && !!m.time && m.time < nowHM
          return (
            <div key={m.id} className={`must-item${m.done ? ' done' : ''}${isNext ? ' next' : ''}`}>
              <button
                className={`task-check${m.done ? ' checked' : ''}`}
                onClick={() => toggleMust(today, m.id)}
                aria-label={m.done ? 'Geri al' : 'Tamamla'}
              >
                {m.done ? '✓' : ''}
              </button>
              <div className="must-item-main">
                {m.time && <span className={`must-time${isOverdue ? ' overdue' : ''}`}>{m.time}</span>}
                <span className="must-text">{m.text}</span>
                {m.minutes && <span className="badge badge-time">{formatMinutes(m.minutes)}</span>}
                {isNext && <span className="next-chip">Sıradaki</span>}
              </div>
              <button className="action-btn danger" onClick={() => removeMust(today, m.id)}>×</button>
            </div>
          )
        })}
        <div className="must-form">
          <input
            className="input must-form-text"
            placeholder="Görev (ör. benzin al)..."
            value={mustInput}
            onChange={e => setMustInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitMust() }}
          />
          {/* 24 saatlik saat:dakika — cihaz yerelinden bağımsız, AM/PM yok */}
          <div className="must-time-select" title="Saat (24 saat)">
            <select className="select-sm" value={mustHour} onChange={e => setMustHour(e.target.value)} aria-label="Saat">
              <option value="">--</option>
              {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')).map(h =>
                <option key={h} value={h}>{h}</option>
              )}
            </select>
            <span className="must-time-colon">:</span>
            <select className="select-sm" value={mustMin} onChange={e => setMustMin(e.target.value)} disabled={!mustHour} aria-label="Dakika">
              {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m =>
                <option key={m} value={m}>{m}</option>
              )}
            </select>
          </div>
          <select className="select-sm must-form-dur" value={mustMinutes} onChange={e => setMustMinutes(e.target.value)} title="Süre">
            <option value="">Süre</option>
            {[10, 15, 30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{formatMinutes(m)}</option>)}
          </select>
          <button className="btn btn-primary must-form-add" onClick={submitMust} disabled={!mustInput.trim()}>Ekle</button>
        </div>
      </div>
    </div>
  )
}
