import { useState } from 'react'
import { useQueueStore } from '../../store/useQueueStore'
import { useWritingStore } from '../../store/useWritingStore'
import { useUIStore } from '../../store/useUIStore'

export default function QuickCapture() {
  const { showCapture, closeCapture, selectItem } = useUIStore()
  const addItem = useQueueStore(s => s.addItem)
  const categoryOptions = useWritingStore(s => s.categoryOptions)
  const [question, setQuestion] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const categories = categoryOptions()
  const opts = () => (categoryId ? { categoryId } : undefined)

  function reset() {
    setQuestion('')
    setCategoryId('')
  }

  function save() {
    if (!question.trim()) return
    const id = addItem(question, opts())
    reset()
    closeCapture()
    selectItem(id)
  }

  function saveAndClose() {
    if (!question.trim()) return
    addItem(question, opts())
    reset()
    closeCapture()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveAndClose() }
    if (e.key === 'Escape') { reset(); closeCapture() }
  }

  if (!showCapture) return null

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { reset(); closeCapture() } }}>
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
        <div className="capture-category-row">
          <span className="capture-category-label">▸ Kategori</span>
          <select
            className="select-sm"
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
          >
            <option value="">{categories.length ? 'Kategorisiz' : 'Henüz kategori yok'}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.path}</option>)}
          </select>
        </div>
        <div className="capture-actions">
          <button className="btn btn-ghost" onClick={() => { reset(); closeCapture() }}>İptal</button>
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
