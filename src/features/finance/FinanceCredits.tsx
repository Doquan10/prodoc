import { useEffect, useState } from 'react'
import { useFinanceStore } from '../../store/useFinanceStore'
import Button from '../../common/Button'
import FinanceCreditDetail from './FinanceCreditDetail'
import { money } from './finFormat'
import type { CreditListItem } from '../../types/finance'

type Filter = 'all' | 'active' | 'closed'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'active', label: 'Aktif' },
  { id: 'closed', label: 'Kapanan' },
]

function formatStart(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
}

export function BankLogo({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return <span className="fin-bank-logo fallback">{(name || '?').charAt(0).toUpperCase()}</span>
  }
  return (
    <span className="fin-bank-logo">
      <img src={src} alt="" onError={() => setFailed(true)} />
    </span>
  )
}

function CreditCard({ c, onOpen, hidden }: { c: CreditListItem; onOpen: () => void; hidden: boolean }) {
  const paid = Math.max(c.loanTerm - c.remainingNumberOfInstallment, 0)
  const pct = Math.min(Math.max(c.progress, 0), 100)

  return (
    <div
      className={`fin-credit clickable${c.isActive ? '' : ' closed'}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
    >
      <div className="fin-credit-head">
        <BankLogo src={c.bankImage} name={c.creditName} />
        <div className="fin-credit-title">
          <span className="fin-credit-name">{c.creditName}</span>
          <span className="fin-credit-sub">{formatStart(c.startDate)} · {c.loanTerm} ay vade</span>
        </div>
        {c.isActive ? (
          <span className="fin-pill ontime"><i className="fin-pill-dot" />Aktif</span>
        ) : (
          <span className="fin-pill muted"><i className="fin-pill-dot" />Kapandı</span>
        )}
      </div>

      <div className="fin-credit-amounts">
        <div className="fin-metric">
          <span className="fin-metric-label">Kalan Borç</span>
          <span className="fin-metric-value highlight">{money(c.remainingDebt, hidden)}</span>
        </div>
        <div className="fin-metric">
          <span className="fin-metric-label">Aylık Taksit</span>
          <span className="fin-metric-value">{money(c.installmentAmount, hidden, true)}</span>
        </div>
        <div className="fin-metric">
          <span className="fin-metric-label">Kredi Tutarı</span>
          <span className="fin-metric-value">{money(c.creditAmount, hidden)}</span>
        </div>
      </div>

      <div>
        <div className="fin-progress-track">
          <div className="fin-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="fin-progress-row">
          <span>{paid}/{c.loanTerm} taksit ödendi</span>
          <span>%{pct}</span>
        </div>
      </div>
    </div>
  )
}

export default function FinanceCredits() {
  const credits = useFinanceStore(s => s.credits)
  const loading = useFinanceStore(s => s.creditsLoading)
  const error = useFinanceStore(s => s.creditsError)
  const fetchCredits = useFinanceStore(s => s.fetchCredits)
  const selectedCreditId = useFinanceStore(s => s.selectedCreditId)
  const openCredit = useFinanceStore(s => s.openCredit)
  const hide = useFinanceStore(s => s.hideAmounts)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    void fetchCredits()
  }, [fetchCredits])

  // Bir kredi seçiliyse liste yerine detay sayfası göster
  // key: farklı kredi açılınca içerik sıfırlansın
  if (selectedCreditId !== null) return <FinanceCreditDetail key={selectedCreditId} />

  const list = credits ?? []
  const active = list.filter(c => c.isActive)
  const filtered =
    filter === 'all' ? list : filter === 'active' ? active : list.filter(c => !c.isActive)

  const totalRemaining = active.reduce((a, c) => a + c.remainingDebt, 0)
  const monthlyTotal = active.reduce((a, c) => a + c.installmentAmount, 0)

  return (
    <>
      {error && (
        <div className="finance-error-box">
          {error}
          <Button variant="ghost" onClick={() => void fetchCredits()}>Tekrar dene</Button>
        </div>
      )}

      {!credits && loading && (
        <>
          <div className="fin-skel" style={{ height: 74 }} />
          <div className="fin-skel" style={{ height: 170 }} />
          <div className="fin-skel" style={{ height: 170 }} />
        </>
      )}

      {credits && (
        <>
          <div className="fin-mini-grid">
            <div className="fin-mini">
              <span className="fin-mini-label">Toplam Kalan Borç</span>
              <span className="fin-mini-value">{money(totalRemaining, hide)}</span>
            </div>
            <div className="fin-mini">
              <span className="fin-mini-label">Aylık Taksit Yükü</span>
              <span className="fin-mini-value">{money(monthlyTotal, hide)}</span>
            </div>
            <div className="fin-mini">
              <span className="fin-mini-label">Aktif Kredi</span>
              <span className="fin-mini-value">{active.length} / {list.length}</span>
            </div>
          </div>

          <div className="fin-credits-toolbar">
            <div className="filter-tabs">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  className={`filter-tab ${filter === f.id ? 'active' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="fin-count">{filtered.length} kredi</span>
          </div>

          {filtered.length === 0 ? (
            <div className="fin-card">
              <p className="fin-empty">
                {list.length === 0 ? 'Henüz kredi eklenmemiş.' : 'Bu filtreye uyan kredi yok.'}
              </p>
            </div>
          ) : (
            <div className="fin-credit-list">
              {filtered.map(c => (
                <CreditCard key={c.id} c={c} onOpen={() => openCredit(c.id)} hidden={hide} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
