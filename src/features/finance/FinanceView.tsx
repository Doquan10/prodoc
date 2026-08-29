import { useFinanceStore, type FinanceTab } from '../../store/useFinanceStore'
import { useAuthStore } from '../../store/useAuthStore'
import Button from '../../common/Button'
import FinanceDashboard from './FinanceDashboard'
import FinanceCredits from './FinanceCredits'
import FinanceExpenses from './FinanceExpenses'

const TABS: { id: FinanceTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'credits', label: 'Krediler' },
  { id: 'expenses', label: 'Harcamalar' },
]

export default function FinanceView() {
  const auth = useAuthStore(s => s.auth)
  const tab = useFinanceStore(s => s.tab)
  const setTab = useFinanceStore(s => s.setTab)
  const dashLoading = useFinanceStore(s => s.loading)
  const creditsLoading = useFinanceStore(s => s.creditsLoading)
  const expensesLoading = useFinanceStore(s => s.expensesLoading)
  const fetchDashboard = useFinanceStore(s => s.fetchDashboard)
  const fetchCredits = useFinanceStore(s => s.fetchCredits)
  const fetchExpenses = useFinanceStore(s => s.fetchExpenses)
  const logout = useAuthStore(s => s.logout)
  const hideAmounts = useFinanceStore(s => s.hideAmounts)
  const toggleHideAmounts = useFinanceStore(s => s.toggleHideAmounts)

  const refreshing =
    tab === 'dashboard' ? dashLoading : tab === 'credits' ? creditsLoading : expensesLoading
  const refresh = () => {
    if (tab === 'dashboard') void fetchDashboard()
    else if (tab === 'credits') void fetchCredits()
    else void fetchExpenses()
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h1 className="view-title">Finans</h1>
          <p className="view-subtitle">Hoş geldin, {auth?.fullname}</p>
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

      {tab === 'dashboard' ? (
        <FinanceDashboard />
      ) : tab === 'credits' ? (
        <FinanceCredits />
      ) : (
        <FinanceExpenses />
      )}
    </div>
  )
}
