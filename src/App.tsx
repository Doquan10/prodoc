import { useUIStore } from './store/useUIStore'
import { useSessionStore } from './store/useSessionStore'
import { useQueueStore } from './store/useQueueStore'
import { usePlanStore } from './store/usePlanStore'
import { useWritingStore } from './store/useWritingStore'
import { usePomodoroStore } from './store/usePomodoroStore'
import { useSettingsStore } from './store/useSettingsStore'
import TodayView from './features/today/TodayView'
import QueueView from './features/queue/QueueView'
import PlanView from './features/plan/PlanView'
import FocusView from './features/focus/FocusView'
import PomodoroView from './features/pomodoro/PomodoroView'
import PostSession from './features/focus/PostSession'
import ReviewView from './features/review/ReviewView'
import WritingsView from './features/writings/WritingsView'
import FinanceView from './features/finance/FinanceView'
import QuickCapture from './features/capture/QuickCapture'
import ItemDetail from './features/queue/ItemDetail'
import Toasts from './common/Toasts'

const NAV: { view: import('./types').View; label: string; icon: string }[] = [
  { view: 'today', label: 'Bugün',        icon: '☀' },
  { view: 'queue', label: 'Queue',         icon: '◈' },
  { view: 'plan',  label: 'Takvim',        icon: '▦' },
  { view: 'focus', label: 'Odak',          icon: '●' },
  { view: 'pomodoro', label: 'Pomodoro',   icon: '◔' },
  { view: 'writings', label: 'Yazılarım',  icon: '✎' },
  { view: 'review', label: 'Değerlendirme', icon: '◎' },
]

export default function App() {
  const { view, setView, selectedItemId, showCapture, showPostSession } = useUIStore()
  const activeSession = useSessionStore(s => s.active)

  // Tüm store'lar mock API'den hydrate olana dek bekle — gerçek backend'de de
  // aynı yükleme kapısı gerekecek
  const queueReady = useQueueStore(s => s.hydrated)
  const sessionReady = useSessionStore(s => s.hydrated)
  const planReady = usePlanStore(s => s.hydrated)
  const writingsReady = useWritingStore(s => s.hydrated)
  const pomodoroReady = usePomodoroStore(s => s.hydrated)
  const settingsReady = useSettingsStore(s => s.hydrated)
  const ready = queueReady && sessionReady && planReady && writingsReady && pomodoroReady && settingsReady

  const showFocusIndicator = activeSession && view !== 'focus'

  if (!ready) {
    return (
      <div className="app-loading">
        <span className="app-loading-logo">PLOS</span>
        <span className="app-loading-text">veriler yükleniyor…</span>
      </div>
    )
  }

  return (
    <div className="shell">
      {/* Sidebar */}
      <nav className="sidebar">
        <span className="sidebar-logo">PLOS</span>

        <div className="sidebar-nav">
          {NAV.map(n => (
            <button
              key={n.view}
              className={`sidebar-item${view === n.view ? ' active' : ''}`}
              onClick={() => setView(n.view)}
            >
              <span className="sidebar-item-icon">{n.icon}</span>
              {n.label}
              {n.view === 'focus' && activeSession && (
                <span className="sidebar-session-dot" />
              )}
            </button>
          ))}

          {/* Ayrı modüller — öğrenme akışının dışında */}
          <div className="sidebar-divider" />
          <button
            className={`sidebar-item${view === 'finance' ? ' active' : ''}`}
            onClick={() => setView('finance')}
          >
            <span className="sidebar-item-icon">₺</span>
            Finans
          </button>
        </div>

        <div className="sidebar-footer">
          <button
            className="sidebar-capture-btn"
            onClick={() => useUIStore.getState().openCapture()}
          >
            + Merak Ekle
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="content-shell">
        {showFocusIndicator && (
          <div className="global-session-bar" onClick={() => setView('focus')}>
            <span className="session-banner-dot" />
            Seans devam ediyor — odak görünümüne dön
            <span style={{ marginLeft: 'auto' }}>→</span>
          </div>
        )}

        <main className="main">
          {showPostSession ? (
            <PostSession />
          ) : view === 'today' ? (
            <TodayView />
          ) : view === 'queue' ? (
            <QueueView />
          ) : view === 'plan' ? (
            <PlanView />
          ) : view === 'focus' ? (
            <FocusView />
          ) : view === 'pomodoro' ? (
            <PomodoroView />
          ) : view === 'writings' ? (
            <WritingsView />
          ) : view === 'finance' ? (
            <FinanceView />
          ) : (
            <ReviewView />
          )}
        </main>
      </div>

      {/* Global modals */}
      {showCapture && <QuickCapture />}
      {/* key: konu değişince taslak/not state'i sıfırlansın, öncekine sızmasın */}
      {selectedItemId && <ItemDetail key={selectedItemId} itemId={selectedItemId} />}
      <Toasts />
    </div>
  )
}
