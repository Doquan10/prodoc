import { useState, type CSSProperties } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useQueueStore } from '../../store/useQueueStore'
import { formatMinutes, addDays, dayOf, todayStr } from '../../utils/format'
import type { FocusSession } from '../../types'

type Period = 'daily' | 'weekly' | 'monthly'

const PERIODS: { value: Period; label: string; days: number; vsLabel: string }[] = [
  { value: 'daily', label: 'Günlük', days: 1, vsLabel: 'düne göre' },
  { value: 'weekly', label: 'Haftalık', days: 7, vsLabel: 'geçen haftaya göre' },
  { value: 'monthly', label: 'Aylık', days: 30, vsLabel: 'geçen aya göre' },
]

const WEEKDAY_MINI = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']

/** Kategori çubukları için ayırt edici renk paleti (koyu temaya uygun). */
const CAT_COLORS = ['#4d78f5', '#2ea043', '#d29922', '#a371f7', '#f778ba', '#3fb0d0', '#e5534b']

/** `count` günlük pencere. shift=0 güncel dönem, shift=1 bir önceki eşdeğer dönem. */
function windowDays(count: number, shift: number): string[] {
  const today = todayStr()
  const end = -count * shift
  const start = end - (count - 1)
  const days: string[] = []
  for (let off = start; off <= end; off++) days.push(addDays(today, off))
  return days
}

interface PeriodStats {
  sessions: FocusSession[]
  count: number
  minutes: number
  learned: number
  questions: number
}

function computeStats(history: FocusSession[], days: string[]): PeriodStats {
  const set = new Set(days)
  const sessions = history.filter(s => set.has(dayOf(s.startedAt)))
  return {
    sessions,
    count: sessions.length,
    minutes: sessions.reduce((a, s) => a + (s.actualMinutes ?? 0), 0),
    learned: sessions.filter(s => s.outcome === 'learned').length,
    questions: sessions.reduce((a, s) => a + (s.newQuestions?.length ?? 0), 0),
  }
}

/** Önceki döneme göre yüzde değişim (null = kıyas yapılamıyor). */
function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? null : 100
  return Math.round(((cur - prev) / prev) * 100)
}

function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  const d = pctDelta(cur, prev)
  if (d === null) return null
  const dir = d > 0 ? 'up' : d < 0 ? 'down' : 'flat'
  const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '＝'
  return <span className={`stat-delta ${dir}`}>{arrow} %{Math.abs(d)}</span>
}

export default function ReviewView() {
  const history = useSessionStore(s => s.history)
  const items = useQueueStore(s => s.items)
  const [period, setPeriod] = useState<Period>('weekly')

  const cfg = PERIODS.find(p => p.value === period)!
  const curDays = windowDays(cfg.days, 0)
  const cur = computeStats(history, curDays)
  const prev = computeStats(history, windowDays(cfg.days, 1))

  // Günlük aktivite (grafik + tutarlılık için)
  const dailyMin: Record<string, number> = {}
  cur.sessions.forEach(s => {
    const d = dayOf(s.startedAt)
    dailyMin[d] = (dailyMin[d] ?? 0) + (s.actualMinutes ?? 0)
  })
  const maxDaily = Math.max(...Object.values(dailyMin), 1)
  const activeDays = curDays.filter(d => (dailyMin[d] ?? 0) > 0).length

  // Kategori dağılımı (seçili dönem)
  const categoryMinutes: Record<string, number> = {}
  cur.sessions.forEach(s => {
    const item = items.find(i => i.id === s.itemId)
    const tags = item?.tags.length ? item.tags : ['Diğer']
    tags.forEach(t => {
      categoryMinutes[t] = (categoryMinutes[t] ?? 0) + (s.actualMinutes ?? 0)
    })
  })
  const categoryList = Object.entries(categoryMinutes).sort((a, b) => b[1] - a[1])
  const maxCatMin = categoryList[0]?.[1] ?? 1
  const catTotal = categoryList.reduce((a, [, m]) => a + m, 0)

  // Öğrenme notları (seçili dönem)
  const learnedNotes = cur.sessions
    .filter(s => s.outcome === 'learned' && s.learningNote)
    .slice(0, 5)

  const avgPerActiveDay = activeDays > 0 ? Math.round(cur.minutes / activeDays) : 0

  if (history.length === 0) {
    return (
      <div className="view-container">
        <div className="view-header">
          <h1 className="view-title">Değerlendirme</h1>
        </div>
        <div className="empty-state" style={{ marginTop: 60 }}>
          İlk odak seansını tamamladıktan sonra istatistikler burada görünecek.
        </div>
      </div>
    )
  }

  return (
    <div className="view-container">
      <div className="view-header review-header-row">
        <div>
          <h1 className="view-title">Değerlendirme</h1>
          <p className="view-subtitle">Verimliliğini dönemlere göre ölç</p>
        </div>
        <div className="filter-tabs">
          {PERIODS.map(p => (
            <button
              key={p.value}
              className={`filter-tab ${period === p.value ? 'active' : ''}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Özet + önceki döneme göre değişim */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{formatMinutes(cur.minutes)}</span>
          <span className="stat-label">Odak Süresi</span>
          <DeltaBadge cur={cur.minutes} prev={prev.minutes} />
        </div>
        <div className="stat-card">
          <span className="stat-value">{cur.count}</span>
          <span className="stat-label">Seans</span>
          <DeltaBadge cur={cur.count} prev={prev.count} />
        </div>
        <div className="stat-card">
          <span className="stat-value">{cur.learned}</span>
          <span className="stat-label">Öğrenildi</span>
          <DeltaBadge cur={cur.learned} prev={prev.learned} />
        </div>
        <div className="stat-card">
          <span className="stat-value">{cur.questions}</span>
          <span className="stat-label">Yeni Soru</span>
          <DeltaBadge cur={cur.questions} prev={prev.questions} />
        </div>
      </div>
      <p className="review-vs-hint">Değişim {cfg.vsLabel}</p>

      {/* Dönem grafiği */}
      {period === 'daily' ? (
        <div className="review-section">
          <div className="review-section-header">
            <span className="review-section-title">Bugünkü Seanslar</span>
            {cur.count > 0 && <span className="consistency-badge">{cur.count} seans · {formatMinutes(cur.minutes)}</span>}
          </div>
          {cur.sessions.length === 0 ? (
            <p className="day-section-empty">Bugün henüz seans yok. Bir odak seansı başlat!</p>
          ) : (
            <div className="session-log">
              {cur.sessions.map(s => {
                const item = items.find(i => i.id === s.itemId)
                const time = new Date(s.startedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={s.id} className="session-log-row">
                    <span className="session-log-time">{time}</span>
                    <span className="session-log-q">{item?.question ?? '—'}</span>
                    <span className={`session-log-outcome outcome-${s.outcome ?? 'none'}`}>
                      {formatMinutes(s.actualMinutes ?? 0)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="review-section">
          <div className="review-section-header">
            <span className="review-section-title">Günlük Aktivite</span>
            <span className="consistency-badge">
              {activeDays}/{cfg.days} gün aktif{avgPerActiveDay > 0 ? ` · ort. ${formatMinutes(avgPerActiveDay)}` : ''}
            </span>
          </div>
          <div className={`day-chart ${period === 'weekly' ? 'day-chart-labeled' : ''}`}>
            {curDays.map(d => {
              const mins = dailyMin[d] ?? 0
              const height = mins > 0 ? Math.max((mins / maxDaily) * 48, 6) : 3
              const isToday = d === todayStr()
              return (
                <div key={d} className="day-bar-wrapper" title={`${d}: ${formatMinutes(mins)}`}>
                  <div className={`day-bar ${mins > 0 ? 'active' : ''} ${isToday ? 'today' : ''}`} style={{ height }} />
                  {period === 'weekly' && (
                    <span className="day-bar-label">{WEEKDAY_MINI[new Date(d + 'T00:00:00').getDay()]}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Kategori dağılımı */}
      {categoryList.length > 0 && (
        <div className="review-section">
          <div className="review-section-header">
            <span className="review-section-title">Kategori Dağılımı</span>
            <span className="review-tally">{categoryList.length} kategori · {formatMinutes(catTotal)}</span>
          </div>
          <div className="category-bars">
            {categoryList.map(([cat, mins], i) => {
              const pct = catTotal > 0 ? Math.round((mins / catTotal) * 100) : 0
              const color = CAT_COLORS[i % CAT_COLORS.length]
              return (
                <div key={cat} className="category-bar-row" style={{ ['--cat-color' as string]: color } as CSSProperties}>
                  <span className="category-bar-label">
                    <span className="category-dot" />
                    <span className="category-name">{cat}</span>
                  </span>
                  <div className="category-bar-track">
                    <div className="category-bar-fill" style={{ width: `${(mins / maxCatMin) * 100}%` }} />
                  </div>
                  <span className="category-bar-value">
                    {formatMinutes(mins)}<span className="category-bar-pct">%{pct}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Öğrenme notları */}
      {learnedNotes.length > 0 && (
        <div className="review-section">
          <span className="review-section-title">Öğrenme Notları</span>
          {learnedNotes.map(s => {
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

      {/* Queue durumu (anlık) */}
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
