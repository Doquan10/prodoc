import { useUIStore } from './store/useUIStore'
import { useSessionStore } from './store/useSessionStore'
import TodayView from './features/today/TodayView'
import QueueView from './features/queue/QueueView'
import PlanView from './features/plan/PlanView'
import FocusView from './features/focus/FocusView'
import PomodoroView from './features/pomodoro/PomodoroView'
import PostSession from './features/focus/PostSession'
import ReviewView from './features/review/ReviewView'
import QuickCapture from './features/capture/QuickCapture'
import ItemDetail from './features/queue/ItemDetail'

const NAV: { view: import('./types').View; label: string; icon: string }[] = [
  { view: 'today', label: 'Bugün',        icon: '☀' },
  { view: 'queue', label: 'Queue',         icon: '◈' },
  { view: 'plan',  label: 'Takvim',        icon: '▦' },
  { view: 'focus', label: 'Odak',          icon: '●' },
  { view: 'pomodoro', label: 'Pomodoro',   icon: '◔' },
  { view: 'review', label: 'Değerlendirme', icon: '◎' },
]

export default function App() {
  const { view, setView, selectedItemId, showCapture, showPostSession } = useUIStore()
  const activeSession = useSessionStore(s => s.active)

  const showFocusIndicator = activeSession && view !== 'focus'

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
          ) : (
            <ReviewView />
          )}
        </main>
      </div>

      {/* Global modals */}
      {showCapture && <QuickCapture />}
      {/* key: konu değişince taslak/not state'i sıfırlansın, öncekine sızmasın */}
      {selectedItemId && <ItemDetail key={selectedItemId} itemId={selectedItemId} />}
    </div>
  )
}
