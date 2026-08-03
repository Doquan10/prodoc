import { useEffect, useRef, useState } from 'react'
import type { Difficulty, ItemStatus } from '../../types'
import { useQueueStore } from '../../store/useQueueStore'
import { useSessionStore } from '../../store/useSessionStore'
import { usePlanStore } from '../../store/usePlanStore'
import { useUIStore } from '../../store/useUIStore'
import { useWritingStore } from '../../store/useWritingStore'
import { difficultyLabel, formatMinutes, todayStr, formatDate, relativeDayLabel, dayOf } from '../../utils/format'
import QueueItem from './QueueItem'
import RichTextEditor from '../writings/RichTextEditor'

const DURATIONS = [10, 25, 45, 90]
const DIFFICULTIES: Difficulty[] = ['light', 'medium', 'deep']
const SUGGESTED_TAGS = ['Yazılım', 'Veritabanı', 'Ağ', 'Donanım', 'Dağıtık Sistemler', 'Fizik', 'Mühendislik', 'Matematik', 'OOP', 'Algoritmalar', 'Diğer']

interface Props {
  itemId: string
}

export default function ItemDetail({ itemId }: Props) {
  const { selectItem, setView, closePostSession, openWriting } = useUIStore()
  const { getItem, updateItem, deleteItem, getChildren, addItem } = useQueueStore()
  const startSession = useSessionStore(s => s.start)
  const { addToPlan, removeFromPlan } = usePlanStore()
  const allWritings = useWritingStore(s => s.writings)
  const addWriting = useWritingStore(s => s.addWriting)
  const categoryOptions = useWritingStore(s => s.categoryOptions)

  const item = getItem(itemId)
  const [editing, setEditing] = useState(false)
  const [draftQuestion, setDraftQuestion] = useState(item?.question ?? '')
  const [tagInput, setTagInput] = useState('')
  const [sessionMinutes, setSessionMinutes] = useState(item?.estimatedMinutes ?? 25)
  const [newChildQ, setNewChildQ] = useState('')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [notesSaved, setNotesSaved] = useState(true)
  const [scheduleDate, setScheduleDate] = useState(item?.scheduledDate ?? todayStr())

  const notesRef = useRef(notes)
  const notesTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  function commitNotes(value: string) {
    if (value === (useQueueStore.getState().getItem(itemId)?.notes ?? '')) return
    updateItem(itemId, { notes: value })
  }

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
  const writings = allWritings.filter(w => w.itemId === itemId)
  const categories = categoryOptions()

  function goToWriting(id: string) {
    flushNotes()
    selectItem(null)
    openWriting(id)
  }

  function saveQuestion() {
    if (!draftQuestion.trim()) return
    updateItem(itemId, { question: draftQuestion })
    setEditing(false)
  }

  function cancelEdit() {
    setDraftQuestion(item?.question ?? '')
    setEditing(false)
  }

  function setDuration(d: number) {
    setSessionMinutes(d)
    updateItem(itemId, { estimatedMinutes: d })
  }

  function startFocus() {
    updateItem(itemId, { status: 'in_progress' })
    startSession(itemId, sessionMinutes)
    selectItem(null)
    setView('focus')
  }

  function addChild() {
    if (!newChildQ.trim()) return
    addItem(newChildQ, { parentId: itemId, tags: item?.tags ?? [] })
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
            <>
              <textarea
                className="input item-detail-question-edit"
                value={draftQuestion}
                onChange={e => setDraftQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveQuestion() }}
                rows={3}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={cancelEdit}>İptal</button>
                <button className="btn btn-primary" onClick={saveQuestion}>Kaydet</button>
              </div>
            </>
          ) : (
            <h2 className="item-detail-question" onDoubleClick={() => { setDraftQuestion(item.question); setEditing(true) }}>
              {item.question}
            </h2>
          )}

          {/* Meta row — her değişiklik anında kaydedilir */}
          <div className="detail-meta-row">
            <select
              className="select-sm"
              value={item.status}
              onChange={e => updateItem(itemId, { status: e.target.value as ItemStatus })}
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <select
              className="select-sm"
              value={item.difficulty ?? ''}
              onChange={e => updateItem(itemId, { difficulty: e.target.value as Difficulty || undefined })}
            >
              <option value="">Zorluk</option>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{difficultyLabel(d)}</option>)}
            </select>

            <select
              className="select-sm"
              value={item.estimatedMinutes ?? ''}
              onChange={e => {
                const mins = e.target.value ? parseInt(e.target.value) : undefined
                updateItem(itemId, { estimatedMinutes: mins })
                setSessionMinutes(mins ?? 25)
              }}
            >
              <option value="">Süre</option>
              {DURATIONS.map(d => <option key={d} value={d}>{formatMinutes(d)}</option>)}
            </select>
          </div>

          {/* Kategori — bilgi ağacındaki yeri */}
          <div className="detail-section">
            <span className="detail-label">Kategori</span>
            <select
              className="select-sm"
              style={{ width: '100%' }}
              value={item.categoryId ?? ''}
              onChange={e => updateItem(itemId, { categoryId: e.target.value || undefined })}
            >
              <option value="">{categories.length ? 'Kategorisiz' : 'Henüz kategori yok — Yazılarım’dan oluştur'}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.path}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div className="detail-section">
            <span className="detail-label">Etiketler</span>
            <div className="tag-editor">
              {item.tags.map(t => (
                <span key={t} className="tag-chip active">
                  {t}
                  <button
                    className="tag-chip-remove"
                    onClick={() => updateItem(itemId, { tags: item.tags.filter(x => x !== t) })}
                  >×</button>
                </span>
              ))}
              <input
                className="tag-input"
                placeholder="Etiket ekle…"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    const t = tagInput.trim()
                    if (!item.tags.includes(t)) updateItem(itemId, { tags: [...item.tags, t] })
                    setTagInput('')
                  }
                }}
                list={`tag-suggestions-${itemId}`}
              />
              <datalist id={`tag-suggestions-${itemId}`}>
                {SUGGESTED_TAGS.filter(t => !item.tags.includes(t)).map(t => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Plana Ekle (sol) + Öncelik (sağ) tek satırda */}
          <div className="detail-schedule-priority">
            {/* Schedule */}
            <div className="detail-section detail-schedule">
              <span className="detail-label">Plana Ekle · {relativeDayLabel(scheduleDate)}</span>
              <div className="schedule-row">
                <input
                  className="input select-sm"
                  type="date"
                  value={scheduleDate}
                  min={todayStr()}
                  onChange={e => setScheduleDate(e.target.value || todayStr())}
                />
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => {
                  // Bir konu tek bir güne planlanır — başka güne taşınıyorsa eski günün planından çıkar
                  if (item.scheduledDate && item.scheduledDate !== scheduleDate) removeFromPlan(item.scheduledDate, itemId)
                  addToPlan(scheduleDate, itemId)
                  updateItem(itemId, { status: 'scheduled', scheduledDate: scheduleDate })
                }}>
                  + Plana Ekle
                </button>
              </div>
            </div>

            {/* Priority */}
            <div className="detail-section">
              <span className="detail-label">Öncelik</span>
              <div className="priority-selector">
                {[1, 2, 3, 4, 5].map(p => (
                  <button
                    key={p}
                    className={`priority-btn ${(item.priority ?? 3) >= p ? 'active' : ''}`}
                    onClick={() => updateItem(itemId, { priority: p })}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Araştırma notları */}
          <div className="detail-section">
            <div className="notes-header">
              <span className="detail-label">Araştırma Notlarım</span>
              <span className={`notes-status ${notesSaved ? '' : 'pending'}`}>
                {notesSaved ? (notes ? 'kaydedildi ✓' : '') : 'yazılıyor…'}
              </span>
            </div>
            <RichTextEditor
              value={item.notes ?? ''}
              onChange={handleNotesChange}
              onBlur={flushNotes}
              placeholder={'Öğrendiklerin, kaynaklar, kod parçaları…  "/" ile başlık, liste, yapılacak ekle'}
              ceClassName="writing-content-input notes-ce"
            />
          </div>

          {/* Blog yazıları */}
          <div className="detail-section">
            <div className="notes-header">
              <span className="detail-label">Yazılarım {writings.length > 0 && `(${writings.length})`}</span>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: '2px 10px' }}
                onClick={() => goToWriting(addWriting({ itemId, title: item.question }))}
              >
                + Yazı Yaz
              </button>
            </div>
            {writings.length > 0 && (
              <div className="detail-writing-list">
                {writings.map(w => (
                  <button key={w.id} className="detail-writing-row" onClick={() => goToWriting(w.id)}>
                    <span className="detail-writing-title">✎ {w.title.trim() || 'Başlıksız'}</span>
                    <span className="detail-writing-date">{formatDate(dayOf(w.updatedAt))}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Aklıma gelen sorular */}
          <div className="detail-section">
            <div className="notes-header">
              <span className="detail-label">Aklıma Gelen Sorular {children.length > 0 && `(${children.length})`}</span>
              <span className="notes-status">Enter ile ekle</span>
            </div>
            <div className="child-input-row">
              <input
                className="input"
                placeholder="Bu konuyu araştırırken merak ettiklerim..."
                value={newChildQ}
                onChange={e => setNewChildQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addChild()}
              />
              <button className="btn btn-ghost" onClick={addChild} disabled={!newChildQ.trim()}>+</button>
            </div>
            {children.length > 0 && (
              <div className="child-list">
                {children.map(c => <QueueItem key={c.id} item={c} showStatus={false} />)}
              </div>
            )}
          </div>

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
                  onClick={() => setDuration(d)}
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
