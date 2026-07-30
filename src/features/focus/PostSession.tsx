import { useState } from 'react'
import type { SessionOutcome } from '../../types'
import { useSessionStore } from '../../store/useSessionStore'
import { useQueueStore } from '../../store/useQueueStore'
import { useUIStore } from '../../store/useUIStore'
import { todayStr } from '../../utils/format'

const OUTCOMES: { value: SessionOutcome; label: string; desc: string; emoji: string }[] = [
  { value: 'learned', label: 'Anladım', desc: 'Konuyu açıklayabilirim', emoji: '✓' },
  { value: 'partial', label: 'Kısmen anladım', desc: 'Hâlâ eksik noktalar var', emoji: '◑' },
  { value: 'questions_appeared', label: 'Yeni sorular çıktı', desc: 'Anlayışım derinleşti', emoji: '?' },
  { value: 'stuck', label: 'Takıldım', desc: 'İlerleyemedim', emoji: '✗' },
]

export default function PostSession() {
  const { active, complete } = useSessionStore()
  const { getItem, updateItem, addItem } = useQueueStore()
  const { setView, closePostSession } = useUIStore()

  const [outcome, setOutcome] = useState<SessionOutcome | null>(null)
  const [note, setNote] = useState('')
  const [newQ, setNewQ] = useState('')
  const [newQuestions, setNewQuestions] = useState<string[]>([])

  const item = active ? getItem(active.itemId) : null

  function addNewQuestion() {
    if (!newQ.trim()) return
    setNewQuestions(qs => [...qs, newQ.trim()])
    setNewQ('')
  }

  function handleSave() {
    if (!outcome || !active) return

    // Add child questions to queue
    newQuestions.forEach(q => {
      addItem(q, { parentId: active.itemId, tags: item?.tags ?? [] })
    })

    // Update item status
    if (outcome === 'learned') {
      updateItem(active.itemId, { status: 'learned', learnedAt: todayStr() })
    } else if (outcome === 'stuck') {
      updateItem(active.itemId, { status: 'revisit' })
    } else {
      updateItem(active.itemId, { status: 'refined' })
    }

    complete(outcome, note.trim() || undefined, newQuestions.length ? newQuestions : undefined)
    closePostSession()
    setView('today')
  }

  if (!active || !item) return null

  return (
    <div className="post-session">
      <div className="post-session-inner">
        <h2 className="post-session-title">Seans bitti. Nasıl gitti?</h2>
        <p className="post-session-topic">{item.question}</p>

        {/* Outcome */}
        <div className="outcome-grid">
          {OUTCOMES.map(o => (
            <button
              key={o.value}
              className={`outcome-btn ${outcome === o.value ? 'selected' : ''}`}
              onClick={() => setOutcome(o.value)}
            >
              <span className="outcome-emoji">{o.emoji}</span>
              <span className="outcome-label">{o.label}</span>
              <span className="outcome-desc">{o.desc}</span>
            </button>
          ))}
        </div>

        {/* Learning note */}
        <div className="post-section">
          <label className="input-label">Ne öğrendim? (opsiyonel · 1–3 cümle)</label>
          <textarea
            className="input"
            rows={3}
            placeholder="Bu konuyu kendi kelimelerinle açıkla..."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        {/* New questions */}
        <div className="post-section">
          <label className="input-label">Bu konudan doğan yeni sorular</label>
          {newQuestions.map((q, i) => (
            <div key={i} className="new-question-chip">
              <span>{q}</span>
              <button onClick={() => setNewQuestions(qs => qs.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Yeni soru... (Enter)"
              value={newQ}
              onChange={e => setNewQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNewQuestion()}
            />
            <button className="btn btn-ghost" onClick={addNewQuestion}>Ekle</button>
          </div>
          {newQuestions.length > 0 && (
            <p className="detail-meta-note" style={{ marginTop: 6 }}>
              {newQuestions.length} yeni soru Queue'ya eklenecek
            </p>
          )}
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 8 }}
          onClick={handleSave}
          disabled={!outcome}
        >
          Kaydet ve Bitir
        </button>
      </div>
    </div>
  )
}
