import { useState } from 'react'
import { useQueueStore } from '../../store/useQueueStore'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlanStore } from '../../store/usePlanStore'
import { useUIStore } from '../../store/useUIStore'
import { suggestItems } from '../../utils/scheduling'
import { todayStr, formatMinutes } from '../../utils/format'
import QueueItem from '../queue/QueueItem'
import type { CuriosityItem } from '../../types'

const DURATIONS = [10, 25, 45, 90]

const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

export default function TodayView() {
  const items = useQueueStore(s => s.items)
  const getItem = useQueueStore(s => s.getItem)
  const updateItem = useQueueStore(s => s.updateItem)
  const { active: activeSession, start: startSession } = useSessionStore()
  const { todayPlan, addMust, removeMust } = usePlanStore()
  const { setView, selectItem, openCapture } = useUIStore()

  const [duration, setDuration] = useState(25)
  const [suggestionIdx, setSuggestionIdx] = useState(0)
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [mustInput, setMustInput] = useState('')

  const today = todayStr()
  const plan = todayPlan()
  const now = new Date()
  const dateLabel = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`

  const todaySessions = useSessionStore(s => s.history).filter(s => s.startedAt.startsWith(today))
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

  function handleAddMust(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && mustInput.trim()) {
      addMust(today, mustInput.trim())
      setMustInput('')
    }
  }

  const learnItems = plan.learnItemIds.map(id => getItem(id)).filter(Boolean) as CuriosityItem[]
  const exploreItems = plan.exploreItemIds.map(id => getItem(id)).filter(Boolean) as CuriosityItem[]

  return (
    <div className="view-container">
      {/* Header */}
      <div className="today-header">
        <div>
          <h1 className="view-title">{dateLabel}</h1>
          {totalLearnedMin > 0 && (
            <p className="view-subtitle">🎯 Bugün {formatMinutes(totalLearnedMin)} öğrenildi · {todaySessions.length} seans</p>
          )}
        </div>
        <button className="btn btn-primary" onClick={openCapture}>+ Merak Et</button>
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

      {/* MUST items */}
      <div className="today-section">
        <span className="today-section-label">✅ YAPILACAKLAR</span>
        {plan.mustItems.map((m, i) => (
          <div key={i} className="must-item">
            <span>{m}</span>
            <button className="action-btn danger" onClick={() => removeMust(today, i)}>×</button>
          </div>
        ))}
        <input
          className="input"
          placeholder="Yapılacak ekle (Enter)..."
          value={mustInput}
          onChange={e => setMustInput(e.target.value)}
          onKeyDown={handleAddMust}
        />
      </div>
    </div>
  )
}
