import { useState } from 'react'
import { useQueueStore } from '../../store/useQueueStore'
import { useUIStore } from '../../store/useUIStore'

export default function QuickCapture() {
  const { showCapture, closeCapture, selectItem } = useUIStore()
  const addItem = useQueueStore(s => s.addItem)
  const [question, setQuestion] = useState('')

  function save() {
    if (!question.trim()) return
    const id = addItem(question)
    setQuestion('')
    closeCapture()
    selectItem(id)
  }

  function saveAndClose() {
    if (!question.trim()) return
    addItem(question)
    setQuestion('')
    closeCapture()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveAndClose() }
    if (e.key === 'Escape') { setQuestion(''); closeCapture() }
  }

  if (!showCapture) return null

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setQuestion(''); closeCapture() } }}>
      <div className="modal capture-modal">
        <div className="capture-header">
          <span className="capture-label">Neyi merak ediyorsun?</span>
          <kbd className="kbd">↵ kaydet</kbd>
        </div>
        <textarea
          className="capture-input"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKey}
          placeholder="How does CPU branch prediction work?"
          autoFocus
          rows={3}
        />
        <div className="capture-actions">
          <button className="btn btn-ghost" onClick={() => { setQuestion(''); closeCapture() }}>İptal</button>
          <button className="btn btn-ghost" onClick={save} disabled={!question.trim()}>
            + Detay Ekle
          </button>
          <button className="btn btn-primary" onClick={saveAndClose} disabled={!question.trim()}>
            Queue'ya Ekle
          </button>
        </div>
      </div>
    </div>
  )
}
