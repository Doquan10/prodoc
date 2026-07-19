import { useState } from 'react'
import type { ItemStatus } from '../../types'
import { useQueueStore } from '../../store/useQueueStore'
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
  const openCapture = useUIStore(s => s.openCapture)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('priority')
  const [search, setSearch] = useState('')

  const statuses = FILTER_STATUSES[filter]

  const visible = items
    .filter(i => statuses.includes(i.status))
    .filter(i => !search || i.question.toLowerCase().includes(search.toLowerCase()) || (i.category ?? '').toLowerCase().includes(search.toLowerCase()))
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
          <h1 className="view-title">Curiosity Queue</h1>
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
        <select className="select-sm" value={sort} onChange={e => setSort(e.target.value as Sort)}>
          <option value="priority">Öncelik</option>
          <option value="date">Tarih</option>
          <option value="duration">Süre</option>
        </select>
      </div>

      <div className="queue-list">
        {visible.length === 0 ? (
          <div className="empty-state">
            {search ? 'Arama sonucu bulunamadı.' : 'Bu kategoride konu yok.'}
          </div>
        ) : (
          visible.map(item => <QueueItem key={item.id} item={item} />)
        )}
      </div>
    </div>
  )
}
