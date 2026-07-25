import { useEffect, useRef, useState } from 'react'
import type { CuriosityItem, Difficulty, ItemStatus } from '../../types'
import { useQueueStore } from '../../store/useQueueStore'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlanStore } from '../../store/usePlanStore'
import { useUIStore } from '../../store/useUIStore'
import { difficultyLabel, formatMinutes, todayStr, formatDate, relativeDayLabel } from '../../utils/format'
import QueueItem from './QueueItem'

const DURATIONS = [10, 25, 45, 90]
const DIFFICULTIES: Difficulty[] = ['light', 'medium', 'deep']
const CATEGORIES = ['Yazılım', 'Veritabanı', 'Ağ', 'Donanım', 'Dağıtık Sistemler', 'Fizik', 'Mühendislik', 'Matematik', 'Diğer']

interface Props {
  itemId: string
}

export default function ItemDetail({ itemId }: Props) {
  const { selectItem, setView, closePostSession } = useUIStore()
  const { getItem, updateItem, deleteItem, getChildren, addItem } = useQueueStore()
  const startSession = useSessionStore(s => s.start)
  const { addToLearn, addToExplore } = usePlanStore()

  const item = getItem(itemId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<CuriosityItem>>({})
  const [sessionMinutes, setSessionMinutes] = useState(item?.estimatedMinutes ?? 25)
  const [newChildQ, setNewChildQ] = useState('')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [notesSaved, setNotesSaved] = useState(true)
  const [scheduleDate, setScheduleDate] = useState(item?.scheduledDate ?? todayStr())

  const notesRef = useRef(notes)
  const notesTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  /** Store'daki değerden farklıysa yazar. getState() ile okunur ki bayat kapanış olmasın. */
  function commitNotes(value: string) {
    if (value === (useQueueStore.getState().getItem(itemId)?.notes ?? '')) return
    updateItem(itemId, { notes: value })
  }

  // Yazma durduktan 600ms sonra otomatik kayıt.
  function handleNotesChange(value: string) {
    setNotes(value)
    setNotesSaved(false)
    notesRef.current = value
    clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      commitNotes(value)
      setNotesSaved(true)
    }, 600)
  }

  function flushNotes() {
    clearTimeout(notesTimer.current)
    commitNotes(notesRef.current)
    setNotesSaved(true)
  }

  // Bekleyen değişiklik varken modal kapanırsa kaybolmasın diye son değeri yaz.
  useEffect(() => () => {
    clearTimeout(notesTimer.current)
    const latest = notesRef.current
    if (latest !== (useQueueStore.getState().getItem(itemId)?.notes ?? '')) {
      updateItem(itemId, { notes: latest })
    }
  }, [itemId, updateItem])

  if (!item) return null

  const children = getChildren(itemId)
  const parent = item.parentId ? getItem(item.parentId) : undefined
  const merged = { ...item, ...draft }

  function save() {
    updateItem(itemId, draft)
    setDraft({})
    setEditing(false)
  }

  function startFocus() {
    updateItem(itemId, { status: 'in_progress' })
    startSession(itemId, sessionMinutes)
    selectItem(null)
    setView('focus')
  }

  function addChild() {
    if (!newChildQ.trim()) return
    addItem(newChildQ, { parentId: itemId, category: item?.category })
    setNewChildQ('')
  }

  function handleDelete() {
    if (!confirm('Bu konuyu silmek istiyor musun?')) return
    deleteItem(itemId)
    selectItem(null)
  }

  const STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
    { value: 'inbox', label: 'Gelen Kutusu' },
    { value: 'refined', label: 'Rafine' },
    { value: 'scheduled', label: 'Planlandı' },
    { value: 'learned', label: 'Öğrenildi' },
    { value: 'revisit', label: 'Tekrar Bak' },
  ]

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { selectItem(null); closePostSession() } }}>
      <div className="modal item-detail-modal">
        <div className="modal-header">
          <div className="item-detail-breadcrumb">
            {parent && <span className="breadcrumb-parent" onClick={() => selectItem(parent.id)}>{parent.question.slice(0, 40)}…</span>}
            {parent && <span className="breadcrumb-sep">›</span>}
            <span>Konu Detayı</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={handleDelete}>Sil</button>
            <button className="modal-close" onClick={() => selectItem(null)}>×</button>
          </div>
        </div>

        <div className="item-detail-body">
          {/* Question */}
          {editing ? (
            <textarea
              className="input item-detail-question-edit"
              value={(draft.question ?? item.question)}
              onChange={e => setDraft(d => ({ ...d, question: e.target.value }))}
              rows={3}
              autoFocus
            />
          ) : (
            <h2 className="item-detail-question" onDoubleClick={() => setEditing(true)}>
              {item.question}
            </h2>
          )}

          {/* Meta row */}
          <div className="detail-meta-row">
            <select
              className="select-sm"
              value={merged.status}
              onChange={e => { updateItem(itemId, { status: e.target.value as ItemStatus }); setDraft(d => ({ ...d, status: e.target.value as ItemStatus })) }}
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <select
              className="select-sm"
              value={merged.difficulty ?? ''}
              onChange={e => setDraft(d => ({ ...d, difficulty: e.target.value as Difficulty || undefined }))}
            >
              <option value="">Zorluk</option>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{difficultyLabel(d)}</option>)}
            </select>

            <select
              className="select-sm"
              value={merged.category ?? ''}
              onChange={e => setDraft(d => ({ ...d, category: e.target.value || undefined }))}
            >
              <option value="">Kategori</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              className="select-sm"
              value={merged.estimatedMinutes ?? ''}
              onChange={e => setDraft(d => ({ ...d, estimatedMinutes: e.target.value ? parseInt(e.target.value) : undefined }))}
            >
              <option value="">Süre</option>
              {DURATIONS.map(d => <option key={d} value={d}>{formatMinutes(d)}</option>)}
            </select>
          </div>

          {/* Priority */}
          <div className="detail-section">
            <span className="detail-label">Öncelik</span>
            <div className="priority-selector">
              {[1, 2, 3, 4, 5].map(p => (
                <button
                  key={p}
                  className={`priority-btn ${(merged.priority ?? 3) >= p ? 'active' : ''}`}
                  onClick={() => { updateItem(itemId, { priority: p }); setDraft(d => ({ ...d, priority: p })) }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="detail-section">
            <span className="detail-label">Plana Ekle · {relativeDayLabel(scheduleDate)}</span>
            <div className="schedule-row">
              <input
                className="input select-sm"
                type="date"
                value={scheduleDate}
                min={todayStr()}
                onChange={e => setScheduleDate(e.target.value || todayStr())}
              />
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { addToLearn(scheduleDate, itemId); updateItem(itemId, { status: 'scheduled', scheduledDate: scheduleDate }) }}>
                📚 Öğren
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { addToExplore(scheduleDate, itemId); updateItem(itemId, { status: 'scheduled', scheduledDate: scheduleDate }) }}>
                🔭 Keşfet
              </button>
            </div>
          </div>

          {editing && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => { setDraft({}); setEditing(false) }}>İptal</button>
              <button className="btn btn-primary" onClick={save}>Kaydet</button>
            </div>
          )}

          {/* Kendi araştırma notları */}
          <div className="detail-section">
            <div className="notes-header">
              <span className="detail-label">Araştırma Notlarım</span>
              <span className={`notes-status ${notesSaved ? '' : 'pending'}`}>
                {notesSaved ? (notes ? 'kaydedildi ✓' : '') : 'yazılıyor…'}
              </span>
            </div>
            <textarea
              className="input notes-textarea"
              placeholder="Bu konuda öğrendiklerin, kaynaklar, kod parçaları, aklında kalan sorular..."
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              onBlur={flushNotes}
              rows={8}
            />
          </div>

          {/* Research tree — children */}
          <div className="detail-section">
            <span className="detail-label">Alt Sorular ({children.length})</span>
            {children.map(c => <QueueItem key={c.id} item={c} showStatus={false} />)}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="Bu konudan doğan yeni soru..."
                value={newChildQ}
                onChange={e => setNewChildQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addChild()}
              />
              <button className="btn btn-ghost" onClick={addChild}>Ekle</button>
            </div>
          </div>

          {/* Scheduled date display */}
          {item.scheduledDate && (
            <p className="detail-meta-note">📅 {formatDate(item.scheduledDate)} için planlandı</p>
          )}
          {item.learnedAt && (
            <p className="detail-meta-note">✓ {formatDate(item.learnedAt)} tarihinde öğrenildi</p>
          )}
        </div>

        {/* Start session footer */}
        {item.status !== 'learned' && (
          <div className="item-detail-footer">
            <div className="session-duration-selector">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  className={`duration-btn ${sessionMinutes === d ? 'active' : ''}`}
                  onClick={() => setSessionMinutes(d)}
                >
                  {formatMinutes(d)}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={startFocus}>
              ▶ Odaklanmaya Başla
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
