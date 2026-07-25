import { useState } from 'react'
import { useQueueStore } from '../../store/useQueueStore'
import { usePlanStore } from '../../store/usePlanStore'
import { useUIStore } from '../../store/useUIStore'
import {
  todayStr, toDateStr, diffDays, fullDateLabel, relativeDayLabel,
  formatMinutes, MONTHS_LONG, WEEKDAYS_SHORT,
} from '../../utils/format'
import type { CuriosityItem } from '../../types'

/** Pazartesi'den başlayan 6x7'lik ay ızgarasının gün dizisi. */
function monthGrid(year: number, month0: number): string[] {
  const first = new Date(year, month0, 1)
  const mondayOffset = (first.getDay() + 6) % 7 // Pzt=0
  const start = new Date(year, month0, 1 - mondayOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toDateStr(d)
  })
}

export default function PlanView() {
  const items = useQueueStore(s => s.items)
  const getItem = useQueueStore(s => s.getItem)
  const updateItem = useQueueStore(s => s.updateItem)
  const plans = usePlanStore(s => s.plans)
  const { getPlan, addToLearn, addToExplore, removeFromPlan, addMust, removeMust, toggleMust } = usePlanStore()
  const { selectItem } = useUIStore()

  const today = todayStr()
  const [selectedDate, setSelectedDate] = useState(today)
  const [viewDate, setViewDate] = useState(today) // ızgarada görünen ay
  const [mustInput, setMustInput] = useState('')
  const [mustHour, setMustHour] = useState('') // '' = saat yok, yoksa '00'..'23'
  const [mustMin, setMustMin] = useState('00')
  const [mustMinutes, setMustMinutes] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

  const viewD = new Date(viewDate + 'T00:00:00')
  const year = viewD.getFullYear()
  const month0 = viewD.getMonth()
  const grid = monthGrid(year, month0)

  const plan = getPlan(selectedDate)
  const learnItems = plan.learnItemIds.map(id => getItem(id)).filter(Boolean) as CuriosityItem[]
  const exploreItems = plan.exploreItemIds.map(id => getItem(id)).filter(Boolean) as CuriosityItem[]

  function planCount(dateStr: string): number {
    const p = plans[dateStr]
    if (!p) return 0
    return p.learnItemIds.length + p.exploreItemIds.length + p.mustItems.length
  }

  function shiftMonth(delta: number) {
    setViewDate(toDateStr(new Date(year, month0 + delta, 1)))
  }

  function pickDay(dateStr: string) {
    setSelectedDate(dateStr)
    setPickerOpen(false)
    setPickerSearch('')
  }

  function jumpTo(dateStr: string) {
    if (!dateStr) return
    setSelectedDate(dateStr)
    setViewDate(dateStr)
  }

  function addToDay(itemId: string, kind: 'learn' | 'explore') {
    if (kind === 'learn') addToLearn(selectedDate, itemId)
    else addToExplore(selectedDate, itemId)
    const it = getItem(itemId)
    // Öğrenilmiş / devam eden konunun durumunu bozma; sadece planlanacak olanları işaretle.
    if (it && it.status !== 'learned' && it.status !== 'in_progress') {
      updateItem(itemId, { status: 'scheduled', scheduledDate: selectedDate })
    }
  }

  function submitMust() {
    if (!mustInput.trim()) return
    addMust(selectedDate, {
      text: mustInput.trim(),
      time: mustHour ? `${mustHour}:${mustMin}` : undefined,
      minutes: mustMinutes ? parseInt(mustMinutes) : undefined,
    })
    setMustInput('')
    setMustHour('')
    setMustMin('00')
    setMustMinutes('')
  }

  // Tamamlanmamışlar üstte (saatliler saate göre), tamamlananlar en altta.
  const sortedMust = [...plan.mustItems].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1
    if (a.time && b.time) return a.time.localeCompare(b.time)
    if (a.time) return -1
    if (b.time) return 1
    return 0
  })

  const plannedIds = new Set([...plan.learnItemIds, ...plan.exploreItemIds])
  const pickerItems = items
    .filter(i => i.status !== 'learned' && !plannedIds.has(i.id))
    .filter(i => !pickerSearch ||
      i.question.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      (i.category ?? '').toLowerCase().includes(pickerSearch.toLowerCase()))
    .sort((a, b) => b.priority - a.priority)

  const selDiff = diffDays(today, selectedDate)
  const isPast = selDiff < 0

  return (
    <div className="view-container plan-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Takvim</h1>
          <p className="view-subtitle">Günlerini önceden planla</p>
        </div>
        <input
          className="input plan-jump"
          type="date"
          value={selectedDate}
          onChange={e => jumpTo(e.target.value)}
          title="Bir tarihe atla"
        />
      </div>

      <div className="plan-layout">
      {/* Takvim */}
      <div className="calendar-card">
        <div className="calendar-nav">
          <button className="btn btn-ghost cal-arrow" onClick={() => shiftMonth(-1)}>‹</button>
          <span className="calendar-month-label">{MONTHS_LONG[month0]} {year}</span>
          <button className="btn btn-ghost cal-arrow" onClick={() => shiftMonth(1)}>›</button>
          <button className="btn btn-ghost cal-today-btn" onClick={() => jumpTo(today)}>Bugün</button>
        </div>

        <div className="calendar-weekdays">
          {WEEKDAYS_SHORT.map(w => <span key={w} className="calendar-weekday">{w}</span>)}
        </div>

        <div className="calendar-grid">
          {grid.map(dateStr => {
            const d = new Date(dateStr + 'T00:00:00')
            const inMonth = d.getMonth() === month0
            const count = planCount(dateStr)
            const cls = [
              'calendar-day',
              inMonth ? '' : 'other-month',
              dateStr === today ? 'today' : '',
              dateStr === selectedDate ? 'selected' : '',
              dateStr < today ? 'past' : '',
            ].filter(Boolean).join(' ')
            return (
              <button key={dateStr} className={cls} onClick={() => pickDay(dateStr)}>
                <span className="calendar-day-num">{d.getDate()}</span>
                {count > 0 && <span className="calendar-day-badge">{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Seçili gün paneli */}
      <div className="day-panel">
        <div className="day-panel-header">
          <div>
            <h2 className="day-panel-title">{fullDateLabel(selectedDate)}</h2>
            <span className="day-panel-relative">{relativeDayLabel(selectedDate)}</span>
          </div>
          {!isPast && (
            <button className="btn btn-primary" onClick={() => setPickerOpen(o => !o)}>
              {pickerOpen ? 'Kapat' : '+ Konu Ekle'}
            </button>
          )}
        </div>

        {isPast && (
          <p className="day-panel-note">Geçmiş bir gün — sadece görüntülüyorsun.</p>
        )}

        {/* Konu seçici */}
        {pickerOpen && (
          <div className="day-picker">
            <input
              className="input"
              placeholder="Queue'da ara..."
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              autoFocus
            />
            <div className="day-picker-list">
              {pickerItems.length === 0 ? (
                <p className="empty-state" style={{ padding: '10px 0' }}>Eklenecek uygun konu yok.</p>
              ) : pickerItems.slice(0, 30).map(i => (
                <div key={i.id} className="day-picker-item">
                  <span className="day-picker-q" onClick={() => selectItem(i.id)}>{i.question}</span>
                  <div className="day-picker-actions">
                    {i.category && <span className="badge badge-category">{i.category}</span>}
                    <button className="pick-btn" title="Bugün Öğren'e ekle" onClick={() => addToDay(i.id, 'learn')}>📚</button>
                    <button className="pick-btn" title="Keşfet'e ekle" onClick={() => addToDay(i.id, 'explore')}>🔭</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEARN */}
        <div className="day-section">
          <span className="day-section-label">📚 ÖĞREN ({learnItems.length})</span>
          {learnItems.length === 0 && <p className="day-section-empty">Bu gün için öğrenilecek konu yok.</p>}
          {learnItems.map(item => (
            <div key={item.id} className="plan-row">
              <div className="plan-row-main" onClick={() => selectItem(item.id)}>
                <span className="plan-row-q">{item.question}</span>
                {item.estimatedMinutes && <span className="badge badge-time">{formatMinutes(item.estimatedMinutes)}</span>}
              </div>
              {!isPast && <button className="action-btn danger" onClick={() => removeFromPlan(selectedDate, item.id)}>×</button>}
            </div>
          ))}
        </div>

        {/* EXPLORE */}
        <div className="day-section">
          <span className="day-section-label">🔭 KEŞFET ({exploreItems.length})</span>
          {exploreItems.length === 0 && <p className="day-section-empty">Bu gün için keşfedilecek konu yok.</p>}
          {exploreItems.map(item => (
            <div key={item.id} className="plan-row">
              <div className="plan-row-main" onClick={() => selectItem(item.id)}>
                <span className="plan-row-q">{item.question}</span>
                {item.estimatedMinutes && <span className="badge badge-time">{formatMinutes(item.estimatedMinutes)}</span>}
              </div>
              {!isPast && <button className="action-btn danger" onClick={() => removeFromPlan(selectedDate, item.id)}>×</button>}
            </div>
          ))}
        </div>

        {/* MUST */}
        <div className="day-section">
          <span className="day-section-label">✅ YAPILACAKLAR ({plan.mustItems.length})</span>
          {sortedMust.map(m => (
            <div key={m.id} className={`must-item${m.done ? ' done' : ''}`}>
              <button
                className={`task-check${m.done ? ' checked' : ''}`}
                onClick={() => toggleMust(selectedDate, m.id)}
                disabled={isPast}
                aria-label={m.done ? 'Geri al' : 'Tamamla'}
              >
                {m.done ? '✓' : ''}
              </button>
              <div className="must-item-main">
                {m.time && <span className="must-time">{m.time}</span>}
                <span className="must-text">{m.text}</span>
                {m.minutes && <span className="badge badge-time">{formatMinutes(m.minutes)}</span>}
              </div>
              {!isPast && <button className="action-btn danger" onClick={() => removeMust(selectedDate, m.id)}>×</button>}
            </div>
          ))}
          {!isPast && (
            <div className="must-form">
              <input
                className="input must-form-text"
                placeholder="Görev (ör. Kitap Oku)..."
                value={mustInput}
                onChange={e => setMustInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitMust() }}
              />
              {/* 24 saatlik saat:dakika — cihaz yerelinden bağımsız, AM/PM yok */}
              <div className="must-time-select" title="Saat (24 saat)">
                <select
                  className="select-sm"
                  value={mustHour}
                  onChange={e => setMustHour(e.target.value)}
                  aria-label="Saat"
                >
                  <option value="">--</option>
                  {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')).map(h =>
                    <option key={h} value={h}>{h}</option>
                  )}
                </select>
                <span className="must-time-colon">:</span>
                <select
                  className="select-sm"
                  value={mustMin}
                  onChange={e => setMustMin(e.target.value)}
                  disabled={!mustHour}
                  aria-label="Dakika"
                >
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m =>
                    <option key={m} value={m}>{m}</option>
                  )}
                </select>
              </div>
              <select
                className="select-sm must-form-dur"
                value={mustMinutes}
                onChange={e => setMustMinutes(e.target.value)}
                title="Süre"
              >
                <option value="">Süre</option>
                {[10, 15, 30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{formatMinutes(m)}</option>)}
              </select>
              <button className="btn btn-primary must-form-add" onClick={submitMust} disabled={!mustInput.trim()}>Ekle</button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
