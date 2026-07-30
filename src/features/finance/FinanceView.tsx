import { useFinanceStore, type FinanceTab } from '../../store/useFinanceStore'
import Button from '../../common/Button'
import FinanceLogin from './FinanceLogin'
import FinanceDashboard from './FinanceDashboard'
import FinanceCredits from './FinanceCredits'

const TABS: { id: FinanceTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'credits', label: 'Krediler' },
]

export default function FinanceView() {
  const auth = useFinanceStore(s => s.auth)
  const tab = useFinanceStore(s => s.tab)
  const setTab = useFinanceStore(s => s.setTab)
  const dashLoading = useFinanceStore(s => s.loading)
  const creditsLoading = useFinanceStore(s => s.creditsLoading)
  const fetchDashboard = useFinanceStore(s => s.fetchDashboard)
  const fetchCredits = useFinanceStore(s => s.fetchCredits)
  const logout = useFinanceStore(s => s.logout)
  const hideAmounts = useFinanceStore(s => s.hideAmounts)
  const toggleHideAmounts = useFinanceStore(s => s.toggleHideAmounts)

  if (!auth) return <FinanceLogin />

  const refreshing = tab === 'dashboard' ? dashLoading : creditsLoading
  const refresh = () => {
    if (tab === 'dashboard') void fetchDashboard()
    else void fetchCredits()
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h1 className="view-title">Finans</h1>
          <p className="view-subtitle">Hoş geldin, {auth.fullname}</p>
        </div>
        <div className="finance-header-actions">
          <Button
            variant="ghost"
            onClick={toggleHideAmounts}
            title={hideAmounts ? 'Tutarları göster' : 'Tutarları gizle'}
          >
            👁 {hideAmounts ? 'Göster' : 'Gizle'}
          </Button>
          <Button variant="ghost" onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Yükleniyor…' : '↻ Yenile'}
          </Button>
          <Button variant="ghost" onClick={logout}>Çıkış</Button>
        </div>
      </div>

      <div className="fin-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`fin-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' ? <FinanceDashboard /> : <FinanceCredits />}
    </div>
  )
}
