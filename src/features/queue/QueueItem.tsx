import type { CuriosityItem } from '../../types'
import { difficultyLabel, formatMinutes } from '../../utils/format'
import { useUIStore } from '../../store/useUIStore'

const DIFF_CLASS: Record<string, string> = {
  light: 'badge-light',
  medium: 'badge-medium',
  deep: 'badge-deep',
}

const STATUS_CLASS: Record<string, string> = {
  inbox: 'badge-status-inbox',
  refined: 'badge-status-refined',
  scheduled: 'badge-status-scheduled',
  in_progress: 'badge-status-inprogress',
  learned: 'badge-status-learned',
  revisit: 'badge-status-revisit',
}

const STATUS_LABEL: Record<string, string> = {
  inbox: 'Gelen',
  refined: 'Rafine',
  scheduled: 'Planlandı',
  in_progress: 'Devam',
  learned: 'Öğrenildi',
  revisit: 'Tekrar',
}

interface Props {
  item: CuriosityItem
  showStatus?: boolean
}

export default function QueueItem({ item, showStatus = true }: Props) {
  const selectItem = useUIStore(s => s.selectItem)

  return (
    <div className="queue-item" onClick={() => selectItem(item.id)}>
      <div className="queue-item-main">
        <p className="queue-item-question">{item.question}</p>
        <div className="queue-item-meta">
          {item.category && <span className="badge badge-category">{item.category}</span>}
          {item.difficulty && (
            <span className={`badge ${DIFF_CLASS[item.difficulty]}`}>
              {difficultyLabel(item.difficulty)}
            </span>
          )}
          {item.estimatedMinutes && (
            <span className="badge badge-time">{formatMinutes(item.estimatedMinutes)}</span>
          )}
          {showStatus && (
            <span className={`badge ${STATUS_CLASS[item.status]}`}>
              {STATUS_LABEL[item.status]}
            </span>
          )}
        </div>
      </div>
      <div className="queue-item-priority">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`priority-dot ${i < item.priority ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  )
}
