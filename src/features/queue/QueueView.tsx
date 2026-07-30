import { useState } from 'react'
import type { ItemStatus } from '../../types'
import { useQueueStore } from '../../store/useQueueStore'
import { useWritingStore } from '../../store/useWritingStore'
import { useUIStore } from '../../store/useUIStore'
import QueueItem from './QueueItem'

type Filter = 'all' | 'inbox' | 'scheduled' | 'learned'
type Sort = 'priority' | 'date' | 'duration'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Hepsi' },
  { value: 'inbox', label: 'Gelen' },
  { value: 'scheduled', label: 'Planlandı' },
  { value: 'learned', label: 'Öğrenildi' },
]

const FILTER_STATUSES: Record<Filter, ItemStatus[]> = {
  all: ['inbox', 'refined', 'scheduled', 'in_progress', 'learned', 'revisit'],
  inbox: ['inbox', 'refined'],
  scheduled: ['scheduled', 'in_progress'],
  learned: ['learned', 'revisit'],
}

export default function QueueView() {
  const items = useQueueStore(s => s.items)
  const categoryOptions = useWritingStore(s => s.categoryOptions)
  const openCapture = useUIStore(s => s.openCapture)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('priority')
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('')

  const categories = categoryOptions()

  // Tüm etiketleri kullanım sıklığına göre sırala
  const allTags = Array.from(
    items.reduce((acc, i) => {
      i.tags.forEach(t => acc.set(t, (acc.get(t) ?? 0) + 1))
      return acc
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]).map(([t]) => t)

  const statuses = FILTER_STATUSES[filter]

  const visible = items
    .filter(i => statuses.includes(i.status))
    .filter(i => !activeTag || i.tags.includes(activeTag))
    .filter(i => !activeCategory || i.categoryId === activeCategory)
    .filter(i => !search ||
      i.question.toLowerCase().includes(search.toLowerCase()) ||
      i.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      if (sort === 'priority') return b.priority - a.priority
      if (sort === 'duration') return (a.estimatedMinutes ?? 99) - (b.estimatedMinutes ?? 99)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const inboxCount = items.filter(i => i.status === 'inbox').length

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h1 className="view-title">Merak Kuyruğu</h1>
          <p className="view-subtitle">{items.length} merak · {inboxCount} gelen kutusunda</p>
        </div>
        <button className="btn btn-primary" onClick={openCapture}>+ Merak Ekle</button>
      </div>

      <div className="queue-toolbar">
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-tabs">
          {FILTERS.map(f => (
            <button
              key={f.value}
              className={`filter-tab ${filter === f.value ? 'active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {categories.length > 0 && (
          <select className="select-sm" value={activeCategory} onChange={e => setActiveCategory(e.target.value)}>
            <option value="">Tüm kategoriler</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.path}</option>)}
          </select>
        )}
        <select className="select-sm" value={sort} onChange={e => setSort(e.target.value as Sort)}>
          <option value="priority">Öncelik</option>
          <option value="date">Tarih</option>
          <option value="duration">Süre</option>
        </select>
      </div>

      {/* Etiket filtreleri */}
      {allTags.length > 0 && (
        <div className="tag-filter-row">
          {allTags.map(tag => (
            <button
              key={tag}
              className={`tag-chip ${activeTag === tag ? 'active' : ''}`}
              onClick={() => setActiveTag(t => t === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="queue-list">
        {visible.length === 0 ? (
          <div className="empty-state">
            {search || activeTag || activeCategory ? 'Eşleşen konu bulunamadı.' : 'Bu kategoride konu yok.'}
          </div>
        ) : (
          visible.map(item => <QueueItem key={item.id} item={item} />)
        )}
      </div>
    </div>
  )
}
