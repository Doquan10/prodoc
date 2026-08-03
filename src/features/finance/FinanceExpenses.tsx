import { useEffect, useState } from 'react'
import { useFinanceStore } from '../../store/useFinanceStore'
import Button from '../../common/Button'
import ExpenseFormModal from './ExpenseFormModal'
import { money } from './finFormat'
import type { Expense, ExpenseDayGroup } from '../../types/finance'

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

// Filtre için son birkaç yıl (içinde bulunulan yıldan geriye)
const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

function formatDayHeader(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })
}

function ExpenseRow({ e, hidden }: { e: Expense; hidden: boolean }) {
  const source = e.creditCardName || e.categoryName || '—'
  return (
    <div className="fin-row">
      <span className="fin-avatar">{(e.name || '?').charAt(0).toUpperCase()}</span>
      <div className="fin-row-info">
        <span className="fin-row-name">{e.name}</span>
        <span className="fin-row-sub">
          {source}{e.description ? ` · ${e.description}` : ''}
        </span>
      </div>
      <div className="fin-row-right">
        <span className="fin-row-amount">{money(e.amount, hidden)}</span>
      </div>
    </div>
  )
}

function DayGroup({ group, hidden }: { group: ExpenseDayGroup; hidden: boolean }) {
  const total = group.expenses.reduce((a, e) => a + e.amount, 0)
  return (
    <section className="fin-card">
      <div className="fin-card-head">
        <span className="fin-card-title">{formatDayHeader(group.expenseDate)}</span>
        <span className="fin-count">{money(total, hidden)}</span>
      </div>
      <div className="fin-list">
        {group.expenses.map(e => (
          <ExpenseRow key={e.id} e={e} hidden={hidden} />
        ))}
      </div>
    </section>
  )
}

export default function FinanceExpenses() {
  const expenses = useFinanceStore(s => s.expenses)
  const loading = useFinanceStore(s => s.expensesLoading)
  const error = useFinanceStore(s => s.expensesError)
  const categories = useFinanceStore(s => s.categories)
  const filter = useFinanceStore(s => s.expenseFilter)
  const fetchExpenses = useFinanceStore(s => s.fetchExpenses)
  const fetchCategories = useFinanceStore(s => s.fetchCategories)
  const setExpenseFilter = useFinanceStore(s => s.setExpenseFilter)
  const hide = useFinanceStore(s => s.hideAmounts)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    void fetchCategories()
    void fetchExpenses()
  }, [fetchCategories, fetchExpenses])

  const groups = expenses?.expensesDayGroup ?? []
  const count = groups.reduce((a, g) => a + g.expenses.length, 0)

  return (
    <>
      {error && (
        <div className="finance-error-box">
          {error}
          <Button variant="ghost" onClick={() => void fetchExpenses()}>Tekrar dene</Button>
        </div>
      )}

      <div className="fin-credits-toolbar">
        <div className="fin-expense-filters">
          <select
            className="select-sm"
            value={filter.categoryId ?? ''}
            onChange={e =>
              setExpenseFilter({ categoryId: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">Tüm kategoriler</option>
            {(categories ?? []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            className="select-sm"
            value={filter.month ?? ''}
            onChange={e =>
              setExpenseFilter({ month: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">Tüm aylar</option>
            {MONTHS_TR.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>

          <select
            className="select-sm"
            value={filter.year ?? ''}
            onChange={e =>
              setExpenseFilter({ year: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">Tüm yıllar</option>
            {YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="fin-expense-toolbar-right">
          {expenses && <span className="fin-count">{count} harcama</span>}
          <Button onClick={() => setShowForm(true)}>+ Harcama Ekle</Button>
        </div>
      </div>

      {!expenses && loading && (
        <>
          <div className="fin-skel" style={{ height: 64 }} />
          <div className="fin-skel" style={{ height: 150 }} />
          <div className="fin-skel" style={{ height: 150 }} />
        </>
      )}

      {expenses && (
        <>
          <div className="fin-mini-grid">
            <div className="fin-mini">
              <span className="fin-mini-label">Toplam Harcama</span>
              <span className="fin-mini-value">{money(expenses.totalExpense, hide)}</span>
            </div>
            <div className="fin-mini">
              <span className="fin-mini-label">Harcama Sayısı</span>
              <span className="fin-mini-value">{count}</span>
            </div>
            <div className="fin-mini">
              <span className="fin-mini-label">Gün</span>
              <span className="fin-mini-value">{groups.length}</span>
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="fin-card">
              <p className="fin-empty">Bu filtreye uyan harcama yok.</p>
            </div>
          ) : (
            groups.map(g => <DayGroup key={g.expenseDate} group={g} hidden={hide} />)
          )}
        </>
      )}

      {showForm && <ExpenseFormModal onClose={() => setShowForm(false)} />}
    </>
  )
}
