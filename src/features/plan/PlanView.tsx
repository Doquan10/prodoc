import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useQueueStore } from '../../store/useQueueStore'
import { usePlanStore } from '../../store/usePlanStore'
import { useToastStore } from '../../store/useToastStore'
import {
  todayStr, toDateStr, diffDays, fullDateLabel, relativeDayLabel,
  formatMinutes, MONTHS_LONG, WEEKDAYS_SHORT,
} from '../../utils/format'
import type { CuriosityItem } from '../../types'

// Tarihsiz görev havuzu için ayrılmış plan anahtarı (gerçek tarih değil)
const BACKLOG = 'backlog'
type DragPayload = { type: 'item' | 'task'; id: string }

function monthGrid(year: number, month0: number): string[] {
  const first = new Date(year, month0, 1)
  const mondayOffset = (first.getDay() + 6) % 7
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
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [inlineNote, setInlineNote] = useState('')
  const inlineNoteRef = useRef('')
  const inlineNoteTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const plans = usePlanStore(s => s.plans)
  const loadMonth = usePlanStore(s => s.loadMonth)
  const { getPlan, addToPlan, removeFromPlan, addMust, removeMust, toggleMust, moveMust } = usePlanStore()
  const showToast = useToastStore(s => s.show)

  const today = todayStr()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [viewDate, setViewDate] = useState(today)
  const [mustInput, setMustInput] = useState('')
  const [mustHour, setMustHour] = useState('')
  const [mustMin, setMustMin] = useState('00')
  const [mustMinutes, setMustMinutes] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [backlogInput, setBacklogInput] = useState('')
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const dragData = useRef<DragPayload | null>(null)

  const viewD = new Date(viewDate + 'T00:00:00')
  const year = viewD.getFullYear()
  const month0 = viewD.getMonth()
  const grid = monthGrid(year, month0)

  // Görünen ay değişince o ayın planlarını lazy çek (store zaten yüklüyse no-op)
  useEffect(() => {
    void loadMonth(year, month0 + 1)
  }, [year, month0, loadMonth])

  function planCount(dateStr: string): number {
    const p = plans[dateStr]
    if (!p) return 0
    return p.itemIds.length + p.mustItems.length
  }

  function shiftMonth(delta: number) {
    setViewDate(toDateStr(new Date(year, month0 + delta, 1)))
  }

  // ── Backlog + sürükle-bırak ─────────────────
  const backlogPlan = getPlan(BACKLOG)
  const backlogTasks = backlogPlan.mustItems
  const backlogItems = items
    .filter(i => ['inbox', 'refined', 'revisit'].includes(i.status))
    .sort((a, b) => b.priority - a.priority)

  function addBacklogTask() {
    if (!backlogInput.trim()) return
    addMust(BACKLOG, { text: backlogInput.trim() })
    setBacklogInput('')
  }

  function onDragStart(e: DragEvent, payload: DragPayload) {
    dragData.current = payload
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', payload.id)
  }

  const canDrop = (dateStr: string) => dateStr >= today

  function onDayDragOver(e: DragEvent, dateStr: string) {
    if (!dragData.current || !canDrop(dateStr)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverDate !== dateStr) setDragOverDate(dateStr)
  }

  function onDayDrop(e: DragEvent, dateStr: string) {
    e.preventDefault()
    const data = dragData.current
    dragData.current = null
    setDragOverDate(null)
    if (!data || !canDrop(dateStr)) return
    if (data.type === 'item') {
      addToPlan(dateStr, data.id)
      const it = getItem(data.id)
      if (it && it.status !== 'learned' && it.status !== 'in_progress') {
        updateItem(data.id, { status: 'scheduled', scheduledDate: dateStr })
      }
      showToast(`Konu ${relativeDayLabel(dateStr)} gününe planlandı`, 'success')
    } else {
      moveMust(BACKLOG, dateStr, data.id)
      showToast(`Görev ${relativeDayLabel(dateStr)} gününe taşındı`, 'success')
    }
  }

  function openDay(dateStr: string) {
    setSelectedDate(dateStr)
    setPickerOpen(false)
    setPickerSearch('')
    setMustInput('')
    setMustHour('')
    setMustMin('00')
    setMustMinutes('')
  }

  function closeModal() {
    clearTimeout(inlineNoteTimer.current)
    if (expandedItemId) {
      const it = getItem(expandedItemId)
      if (it && inlineNoteRef.current !== (it.notes ?? '')) {
        updateItem(expandedItemId, { notes: inlineNoteRef.current })
      }
    }
    setSelectedDate(null)
    setPickerOpen(false)
    setPickerSearch('')
    setExpandedItemId(null)
  }

  function jumpTo(dateStr: string) {
    if (!dateStr) return
    setViewDate(dateStr)
    openDay(dateStr)
  }

  function openInlineNote(item: CuriosityItem) {
    clearTimeout(inlineNoteTimer.current)
    if (expandedItemId && expandedItemId !== item.id) {
      const prev = getItem(expandedItemId)
      if (prev && inlineNoteRef.current !== (prev.notes ?? '')) {
        updateItem(expandedItemId, { notes: inlineNoteRef.current })
      }
    }
    setExpandedItemId(id => id === item.id ? null : item.id)
    setInlineNote(item.notes ?? '')
    inlineNoteRef.current = item.notes ?? ''
  }

  function handleInlineNote(value: string) {
    setInlineNote(value)
    inlineNoteRef.current = value
    clearTimeout(inlineNoteTimer.current)
    inlineNoteTimer.current = setTimeout(() => {
      if (expandedItemId) updateItem(expandedItemId, { notes: value })
    }, 600)
  }

  function addToDay(itemId: string) {
    if (!selectedDate) return
    addToPlan(selectedDate, itemId)
    const it = getItem(itemId)
    if (it && it.status !== 'learned' && it.status !== 'in_progress') {
      updateItem(itemId, { status: 'scheduled', scheduledDate: selectedDate })
    }
  }

  /** Konuyu günün planından çıkarır ve planlama izini de temizler (Queue'da "Planlandı" kalmasın). */
  function removeItemFromDay(item: CuriosityItem) {
    if (!selectedDate) return
    removeFromPlan(selectedDate, item.id)
    const changes: Partial<CuriosityItem> = {}
    if (item.status === 'scheduled') changes.status = 'refined'
    if (item.scheduledDate === selectedDate) changes.scheduledDate = undefined
    if (Object.keys(changes).length) updateItem(item.id, changes)
  }

  function submitMust() {
    if (!selectedDate || !mustInput.trim()) return
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

  // Modal içeriği
  const plan = selectedDate ? getPlan(selectedDate) : null
  const planItems = plan ? plan.itemIds.map(id => getItem(id)).filter(Boolean) as CuriosityItem[] : []
  const sortedMust = plan ? [...plan.mustItems].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1
    if (a.time && b.time) return a.time.localeCompare(b.time)
    if (a.time) return -1
    if (b.time) return 1
    return 0
  }) : []

  const isPast = selectedDate ? diffDays(today, selectedDate) < 0 : false

  const plannedIds = new Set(plan ? plan.itemIds : [])
  const pickerItems = items
    .filter(i => i.status !== 'learned' && !plannedIds.has(i.id))
    .filter(i => !pickerSearch ||
      i.question.toLowerCase().includes(pickerSearch.toLowerCase()) ||
      i.tags.some(t => t.toLowerCase().includes(pickerSearch.toLowerCase())))
    .sort((a, b) => b.priority - a.priority)

  return (
    <div className="view-container plan-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Planla</h1>
          <p className="view-subtitle">Konuları ve görevleri günlere sürükleyerek planla</p>
        </div>
        <input
          className="input plan-jump"
          type="date"
          value={selectedDate ?? today}
          onChange={e => jumpTo(e.target.value)}
          title="Bir tarihe atla"
        />
      </div>

      <div className="plan-layout">
        {/* Aylık takvim */}
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

        <div className="calendar-grid" onDragLeave={() => setDragOverDate(null)}>
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
              dragOverDate === dateStr ? 'drop-target' : '',
            ].filter(Boolean).join(' ')
            return (
              <button
                key={dateStr}
                className={cls}
                onClick={() => openDay(dateStr)}
                onDragOver={e => onDayDragOver(e, dateStr)}
                onDragLeave={() => setDragOverDate(d => (d === dateStr ? null : d))}
                onDrop={e => onDayDrop(e, dateStr)}
              >
                <span className="calendar-day-num">{d.getDate()}</span>
                {count > 0 && <span className="calendar-day-count">{count}</span>}
              </button>
            )
          })}
        </div>
        </div>

        {/* Sağ panel — bir güne sürüklenecek konular ve görevler */}
        <aside className="plan-backlog">
          <section className="backlog-section">
            <div className="backlog-head">
              <span className="backlog-title">🔍 Araştırılacak Konular</span>
              <span className="fin-count">{backlogItems.length}</span>
            </div>
            {backlogItems.length === 0 ? (
              <p className="backlog-empty">Planlanacak konu yok.</p>
            ) : (
              <div className="backlog-list">
                {backlogItems.map(i => (
                  <div
                    key={i.id}
                    className="backlog-card"
                    draggable
                    onDragStart={e => onDragStart(e, { type: 'item', id: i.id })}
                    onDragEnd={() => setDragOverDate(null)}
                  >
                    <span className="backlog-card-q">{i.question}</span>
                    <div className="backlog-card-meta">
                      {i.tags.slice(0, 2).map(t => <span key={t} className="badge badge-category">{t}</span>)}
                      {i.estimatedMinutes && <span className="badge badge-time">{formatMinutes(i.estimatedMinutes)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="backlog-section">
            <div className="backlog-head">
              <span className="backlog-title">✅ Yapılacaklar</span>
              <span className="fin-count">{backlogTasks.length}</span>
            </div>
            {backlogTasks.length > 0 && (
              <div className="backlog-list">
                {backlogTasks.map(t => (
                  <div
                    key={t.id}
                    className="backlog-card task"
                    draggable
                    onDragStart={e => onDragStart(e, { type: 'task', id: t.id })}
                    onDragEnd={() => setDragOverDate(null)}
                  >
                    <span className="backlog-card-q">{t.text}</span>
                    <button className="action-btn danger" onClick={() => removeMust(BACKLOG, t.id)}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="backlog-add">
              <input
                className="input"
                placeholder="Yeni görev…"
                value={backlogInput}
                onChange={e => setBacklogInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addBacklogTask() }}
              />
              <button className="btn btn-primary" onClick={addBacklogTask} disabled={!backlogInput.trim()}>+ Ekle</button>
            </div>
          </section>

          <p className="backlog-hint">Bir kartı takvimde bir güne sürükleyerek planla.</p>
        </aside>
      </div>

      {/* Gün modalı */}
      {selectedDate && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal day-modal">
            <div className="modal-header">
              <div>
                <span className="day-modal-title">{fullDateLabel(selectedDate)}</span>
                <span className="day-panel-relative" style={{ marginLeft: 10 }}>{relativeDayLabel(selectedDate)}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!isPast && (
                  <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setPickerOpen(o => !o)}>
                    {pickerOpen ? 'Kapat' : '+ Konu Ekle'}
                  </button>
                )}
                <button className="modal-close" onClick={closeModal}>×</button>
              </div>
            </div>

            <div className="day-modal-body">
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
                        <span className="day-picker-q">{i.question}</span>
                        <div className="day-picker-actions">
                          {i.tags.slice(0, 2).map(t => <span key={t} className="badge badge-category">{t}</span>)}
                          <button className="pick-btn" onClick={() => addToDay(i.id)}>+ Ekle</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Konular */}
              <div className="day-section">
                <span className="day-section-label">📚 KONULAR ({planItems.length})</span>
                {planItems.length === 0 && <p className="day-section-empty">Bu gün için konu eklenmemiş.</p>}
                {planItems.map(item => (
                  <div key={item.id} className="plan-row-group">
                    <div className="plan-row">
                      <div className="plan-row-main" onClick={() => openInlineNote(item)}>
                        <span className="plan-row-q">{item.question}</span>
                        {item.estimatedMinutes && <span className="badge badge-time">{formatMinutes(item.estimatedMinutes)}</span>}
                        {item.notes && <span className="plan-row-note-dot" title="Not var" />}
                      </div>
                      <button
                        className={`action-btn ${expandedItemId === item.id ? 'active' : ''}`}
                        title="Not al"
                        onClick={() => openInlineNote(item)}
                      >📝</button>
                      {!isPast && <button className="action-btn danger" onClick={() => removeItemFromDay(item)}>×</button>}
                    </div>
                    {expandedItemId === item.id && (
                      <textarea
                        className="input plan-inline-note"
                        placeholder="Bu konu hakkında notlar, sorular, kaynaklar..."
                        value={inlineNote}
                        onChange={e => handleInlineNote(e.target.value)}
                        rows={4}
                        autoFocus
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* MUST */}
              <div className="day-section">
                <span className="day-section-label">✅ YAPILACAKLAR ({plan?.mustItems.length ?? 0})</span>
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
                      placeholder="Görev ekle..."
                      value={mustInput}
                      onChange={e => setMustInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitMust() }}
                    />
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
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
