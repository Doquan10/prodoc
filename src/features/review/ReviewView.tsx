import { useSessionStore } from '../../store/useSessionStore'
import { useQueueStore } from '../../store/useQueueStore'
import { formatMinutes } from '../../utils/format'

function last30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().split('T')[0]
  })
}

function last7Days(): string[] {
  return last30Days().slice(-7)
}

export default function ReviewView() {
  const history = useSessionStore(s => s.history)
  const items = useQueueStore(s => s.items)

  const days30 = last30Days()
  const days7 = last7Days()

  const weekSessions = history.filter(s => days7.some(d => s.startedAt.startsWith(d)))
  const weekMinutes = weekSessions.reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0)
  const weekCompleted = weekSessions.filter(s => s.outcome === 'learned').length
  const weekQuestions = weekSessions.reduce((sum, s) => sum + (s.newQuestions?.length ?? 0), 0)

  // Active days in last 30
  const activeDays = days30.filter(d => history.some(s => s.startedAt.startsWith(d))).length
  const consistency = Math.round((activeDays / 30) * 100)

  // Category breakdown (last 30 days)
  const sessions30 = history.filter(s => days30.some(d => s.startedAt.startsWith(d)))
  const categoryMinutes: Record<string, number> = {}
  sessions30.forEach(s => {
    const item = items.find(i => i.id === s.itemId)
    const cat = item?.category ?? 'Diğer'
    categoryMinutes[cat] = (categoryMinutes[cat] ?? 0) + (s.actualMinutes ?? 0)
  })
  const categoryList = Object.entries(categoryMinutes).sort((a, b) => b[1] - a[1])
  const maxCatMin = categoryList[0]?.[1] ?? 1

  // Daily activity for last 30 (for mini chart)
  const dailyMin: Record<string, number> = {}
  sessions30.forEach(s => {
    const d = s.startedAt.split('T')[0]
    dailyMin[d] = (dailyMin[d] ?? 0) + (s.actualMinutes ?? 0)
  })
  const maxDaily = Math.max(...Object.values(dailyMin), 1)

  // Recently learned
  const recentLearned = history
    .filter(s => s.outcome === 'learned' && s.learningNote)
    .slice(0, 5)

  if (history.length === 0) {
    return (
      <div className="view-container">
        <div className="view-header">
          <h1 className="view-title">Haftalık Değerlendirme</h1>
        </div>
        <div className="empty-state" style={{ marginTop: 60 }}>
          İlk odak seansını tamamladıktan sonra istatistikler burada görünecek.
        </div>
      </div>
    )
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <h1 className="view-title">Haftalık Değerlendirme</h1>
        <p className="view-subtitle">Son 7 gün</p>
      </div>

      {/* This week stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{weekSessions.length}</span>
          <span className="stat-label">Seans</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{formatMinutes(weekMinutes)}</span>
          <span className="stat-label">Odak Süresi</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{weekCompleted}</span>
          <span className="stat-label">Öğrenildi</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{weekQuestions}</span>
          <span className="stat-label">Yeni Soru</span>
        </div>
      </div>

      {/* Consistency */}
      <div className="review-section">
        <div className="review-section-header">
          <span className="review-section-title">Tutarlılık (son 30 gün)</span>
          <span className="consistency-badge">{activeDays}/30 gün · %{consistency}</span>
        </div>
        <div className="day-chart">
          {days30.map(d => {
            const mins = dailyMin[d] ?? 0
            const height = mins > 0 ? Math.max((mins / maxDaily) * 48, 6) : 3
            const isToday = d === new Date().toISOString().split('T')[0]
            return (
              <div key={d} className="day-bar-wrapper" title={`${d}: ${formatMinutes(mins)}`}>
                <div
                  className={`day-bar ${mins > 0 ? 'active' : ''} ${isToday ? 'today' : ''}`}
                  style={{ height }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Category breakdown */}
      {categoryList.length > 0 && (
        <div className="review-section">
          <span className="review-section-title">Kategori Dağılımı</span>
          <div className="category-bars">
            {categoryList.map(([cat, mins]) => (
              <div key={cat} className="category-bar-row">
                <span className="category-bar-label">{cat}</span>
                <div className="category-bar-track">
                  <div
                    className="category-bar-fill"
                    style={{ width: `${(mins / maxCatMin) * 100}%` }}
                  />
                </div>
                <span className="category-bar-value">{formatMinutes(mins)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent learning notes */}
      {recentLearned.length > 0 && (
        <div className="review-section">
          <span className="review-section-title">Son Öğrenme Notları</span>
          {recentLearned.map(s => {
            const item = items.find(i => i.id === s.itemId)
            return (
              <div key={s.id} className="learned-note-card">
                <p className="learned-note-question">{item?.question}</p>
                <p className="learned-note-text">"{s.learningNote}"</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Queue health */}
      <div className="review-section">
        <span className="review-section-title">Queue Durumu</span>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="stat-card">
            <span className="stat-value">{items.filter(i => i.status === 'inbox').length}</span>
            <span className="stat-label">Gelen Kutusunda</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{items.filter(i => i.status === 'learned').length}</span>
            <span className="stat-label">Öğrenildi</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{items.filter(i => i.status === 'revisit').length}</span>
            <span className="stat-label">Tekrar Bakılacak</span>
          </div>
        </div>
      </div>
    </div>
  )
}
