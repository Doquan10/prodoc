import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useFinanceStore } from '../../store/useFinanceStore'
import Button from '../../common/Button'
import Modal from '../../common/Modal'
import ExpenseFormModal, { type ExpensePreset } from './ExpenseFormModal'
import { money, avatarColor, COMPACT } from './finFormat'
import { toDateStr, todayStr, WEEKDAYS_SHORT } from '../../utils/format'
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

// ── Sık harcanan kalemler ─────────────────────────────────
interface FrequentItem {
  key: string
  name: string
  categoryId: number
  lastAmount: number
  count: number
  lastDate: string
}

/** Yüklü harcamaları isme göre gruplayıp sıklığa (kaç kez) göre en sık 8 kalemi döner. */
function frequentItems(groups: ExpenseDayGroup[]): FrequentItem[] {
  const map = new Map<string, FrequentItem>()
  for (const g of groups) {
    for (const e of g.expenses) {
      const key = e.name.trim().toLowerCase()
      if (!key) continue
      const prev = map.get(key)
      if (!prev) {
        map.set(key, {
          key, name: e.name.trim(), categoryId: e.categoryId,
          lastAmount: e.amount, count: 1, lastDate: e.expenseDate,
        })
      } else {
        prev.count++
        if (e.expenseDate > prev.lastDate) {
          prev.lastDate = e.expenseDate
          prev.lastAmount = e.amount
          prev.categoryId = e.categoryId
          prev.name = e.name.trim()
        }
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || (b.lastDate > a.lastDate ? 1 : -1))
    .slice(0, 8)
}

// ── Takvim ─────────────────────────────────────────────────
/** Ayı pazartesi başlangıçlı 6x7 ızgaraya açar (PlanView ile aynı mantık). */
function monthGrid(year: number, month0: number): string[] {
  const first = new Date(year, month0, 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(year, month0, 1 - mondayOffset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return toDateStr(d)
  })
}

function ExpenseCalendar({
  groups, year, month0, hidden, onDay,
}: {
  groups: ExpenseDayGroup[]
  year: number
  month0: number
  hidden: boolean
  onDay: (date: string) => void
}) {
  const totals = new Map<string, number>()
  for (const g of groups) {
    const key = g.expenseDate.slice(0, 10)
    const sum = g.expenses.reduce((a, e) => a + e.amount, 0)
    totals.set(key, (totals.get(key) ?? 0) + sum)
  }
  const grid = monthGrid(year, month0)
  const today = todayStr()

  return (
    <div className="fin-cal">
      <div className="fin-cal-weekdays">
        {WEEKDAYS_SHORT.map(w => <span key={w} className="fin-cal-weekday">{w}</span>)}
      </div>
      <div className="fin-cal-grid">
        {grid.map(dateStr => {
          const d = new Date(dateStr + 'T00:00:00')
          const inMonth = d.getMonth() === month0
          const total = totals.get(dateStr)
          const cls = [
            'fin-cal-day',
            inMonth ? '' : 'other-month',
            dateStr === today ? 'today' : '',
            total ? 'has' : '',
          ].filter(Boolean).join(' ')
          return (
            <button key={dateStr} className={cls} onClick={() => onDay(dateStr)}>
              <span className="fin-cal-day-num">{d.getDate()}</span>
              {total ? (
                <span className="fin-cal-day-total">{hidden ? '••' : `${COMPACT.format(total)} ₺`}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DayExpensesModal({
  date, groups, hidden, onClose, onAdd, onEdit,
}: {
  date: string
  groups: ExpenseDayGroup[]
  hidden: boolean
  onClose: () => void
  onAdd: (date: string) => void
  onEdit: (e: Expense) => void
}) {
  const group = groups.find(g => g.expenseDate.slice(0, 10) === date)
  const items = group?.expenses ?? []
  const total = items.reduce((a, e) => a + e.amount, 0)

  return (
    <Modal title={formatDayHeader(date)} onClose={onClose}>
      <div className="fin-day-modal">
        <div className="fin-card-head">
          <span className="fin-mini-label">{items.length} harcama</span>
          <span className="fin-count">{money(total, hidden)}</span>
        </div>
        {items.length === 0 ? (
          <p className="fin-empty">Bu gün harcama yok.</p>
        ) : (
          <div className="fin-list">
            {items.map(e => <ExpenseRow key={e.id} e={e} hidden={hidden} onEdit={onEdit} />)}
          </div>
        )}
        <div className="fin-form-actions">
          <Button onClick={() => onAdd(date)}>+ Bu güne harcama ekle</Button>
        </div>
      </div>
    </Modal>
  )
}

function ExpenseRow({ e, hidden, onEdit }: { e: Expense; hidden: boolean; onEdit: (e: Expense) => void }) {
  const deleteExpense = useFinanceStore(s => s.deleteExpense)
  const deleting = useFinanceStore(s => s.deletingExpenseId === e.id)
  const [confirm, setConfirm] = useState(false)
  const source = e.creditCardName || e.categoryName || '—'

  return (
    <div className="fin-row">
      <span className="fin-avatar" style={{ '--fin-avatar-c': avatarColor(e.categoryId) } as CSSProperties}>
        {(e.name || '?').charAt(0).toUpperCase()}
      </span>
      <div className="fin-row-info">
        <span className="fin-row-name">{e.name}</span>
        <span className="fin-row-sub">
          {source}{e.description ? ` · ${e.description}` : ''}
        </span>
      </div>
      <div className="fin-row-right">
        <span className="fin-row-amount">{money(e.amount, hidden)}</span>
        {deleting ? (
          <span className="fin-row-del-hint">Siliniyor…</span>
        ) : confirm ? (
          <div className="fin-row-del-confirm">
            <button
              className="fin-row-del confirm"
              onClick={() => void deleteExpense(e.id)}
              title="Silmeyi onayla"
            >
              Sil
            </button>
            <button
              className="fin-row-del cancel"
              onClick={() => setConfirm(false)}
              title="Vazgeç"
            >
              Vazgeç
            </button>
          </div>
        ) : (
          <>
            <button
              className="fin-row-del"
              onClick={() => onEdit(e)}
              title="Harcamayı düzenle"
              aria-label="Harcamayı düzenle"
            >
              ✏️
            </button>
            <button
              className="fin-row-del"
              onClick={() => setConfirm(true)}
              title="Harcamayı sil"
              aria-label="Harcamayı sil"
            >
              🗑
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function DayGroup({ group, hidden, onEdit }: { group: ExpenseDayGroup; hidden: boolean; onEdit: (e: Expense) => void }) {
  const total = group.expenses.reduce((a, e) => a + e.amount, 0)
  return (
    <section className="fin-card">
      <div className="fin-card-head">
        <span className="fin-card-title">{formatDayHeader(group.expenseDate)}</span>
        <span className="fin-count">{money(total, hidden)}</span>
      </div>
      <div className="fin-list">
        {group.expenses.map(e => (
          <ExpenseRow key={e.id} e={e} hidden={hidden} onEdit={onEdit} />
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
  const [editing, setEditing] = useState<Expense | null>(null)
  const [presetForm, setPresetForm] = useState<ExpensePreset | null>(null)
  const [mode, setMode] = useState<'list' | 'calendar'>('list')
  const [dayModal, setDayModal] = useState<string | null>(null)

  useEffect(() => {
    void fetchCategories()
    void fetchExpenses()
  }, [fetchCategories, fetchExpenses])

  const groups = expenses?.expensesDayGroup ?? []
  const count = groups.reduce((a, g) => a + g.expenses.length, 0)
  const frequent = frequentItems(groups)

  // Takvim ayı mevcut ay/yıl filtresini takip eder; "Tüm aylar"da içinde bulunulan aya düşer
  const calYear = filter.year ?? new Date().getFullYear()
  const calMonth0 = (filter.month ?? new Date().getMonth() + 1) - 1

  const openDayAdd = (date: string) => {
    setDayModal(null)
    setPresetForm({ date })
  }
  const openEdit = (e: Expense) => {
    setDayModal(null)
    setEditing(e)
  }

  return (
    <>
      {error && (
        <div className="finance-error-box">
          {error}
          <Button variant="ghost" onClick={() => void fetchExpenses()}>Tekrar dene</Button>
        </div>
      )}

      {/* Hızlı ekle — sık harcanan kalemler */}
      {frequent.length > 0 && (
        <div className="fin-quick">
          <span className="fin-quick-label">Hızlı ekle</span>
          <div className="fin-quick-row">
            {frequent.map(f => (
              <button
                key={f.key}
                className="fin-quick-chip"
                onClick={() => setPresetForm({ name: f.name, categoryId: f.categoryId, amount: f.lastAmount })}
                title={`${f.name} · son ${money(f.lastAmount, hide)}`}
              >
                <span className="fin-quick-dot" style={{ background: avatarColor(f.categoryId) }} />
                <span className="fin-quick-name">{f.name}</span>
                <span className="fin-quick-amt">{money(f.lastAmount, hide)}</span>
              </button>
            ))}
          </div>
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
          <div className="filter-tabs">
            <button
              className={`filter-tab ${mode === 'list' ? 'active' : ''}`}
              onClick={() => setMode('list')}
            >
              Liste
            </button>
            <button
              className={`filter-tab ${mode === 'calendar' ? 'active' : ''}`}
              onClick={() => setMode('calendar')}
            >
              Takvim
            </button>
          </div>
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

          {mode === 'calendar' ? (
            <div className="fin-card">
              <ExpenseCalendar
                groups={groups}
                year={calYear}
                month0={calMonth0}
                hidden={hide}
                onDay={setDayModal}
              />
            </div>
          ) : groups.length === 0 ? (
            <div className="fin-card">
              <p className="fin-empty">Bu filtreye uyan harcama yok.</p>
            </div>
          ) : (
            groups.map(g => <DayGroup key={g.expenseDate} group={g} hidden={hide} onEdit={setEditing} />)
          )}
        </>
      )}

      {showForm && <ExpenseFormModal onClose={() => setShowForm(false)} />}
      {presetForm && (
        <ExpenseFormModal preset={presetForm} onClose={() => setPresetForm(null)} />
      )}
      {editing && (
        <ExpenseFormModal
          key={editing.id}
          expense={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {dayModal && (
        <DayExpensesModal
          date={dayModal}
          groups={groups}
          hidden={hide}
          onClose={() => setDayModal(null)}
          onAdd={openDayAdd}
          onEdit={openEdit}
        />
      )}
    </>
  )
}
