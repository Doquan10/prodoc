import { useState } from 'react'
import { useFinanceStore } from '../../store/useFinanceStore'
import Button from '../../common/Button'
import { BankLogo } from './FinanceCredits'
import { money, moneyText } from './finFormat'
import type { CreditInstallment } from '../../types/finance'

function fmtDate(s?: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function instStatus(ins: CreditInstallment): 'paid' | 'payable' | 'pending' {
  return ins.isApprov ? 'paid' : ins.canPay ? 'payable' : 'pending'
}

export default function FinanceCreditDetail() {
  const details = useFinanceStore(s => s.creditDetails)
  const loading = useFinanceStore(s => s.detailLoading)
  const error = useFinanceStore(s => s.detailError)
  const closeCredit = useFinanceStore(s => s.closeCredit)
  const fetchCreditDetails = useFinanceStore(s => s.fetchCreditDetails)
  const hide = useFinanceStore(s => s.hideAmounts)
  const payingInsId = useFinanceStore(s => s.payingInsId)
  const payError = useFinanceStore(s => s.payError)
  const payInstallment = useFinanceStore(s => s.payInstallment)
  const [selectedInsId, setSelectedInsId] = useState<number | null>(null)
  // Ödeme onayı bekleyen taksit — seçim değişince otomatik sıfırlanır
  const [confirmInsId, setConfirmInsId] = useState<number | null>(null)

  const installments = [...(details?.creditInstallments ?? [])].sort(
    (a, b) => a.installmentOrder - b.installmentOrder,
  )

  // Seçim yoksa sıradaki ödenebilir taksit, o da yoksa ilk ödenmemiş taksit gösterilir
  const shownIns =
    installments.find(i => i.id === selectedInsId) ??
    installments.find(i => i.canPay && !i.isApprov) ??
    installments.find(i => !i.isApprov) ??
    installments[installments.length - 1]
  const paidCount = installments.filter(i => i.isApprov).length
  const totalCount = details?.loanTerm ?? installments.length
  const pct = Math.min(Math.max(details?.progress ?? 0, 0), 100)

  return (
    <>
      <button className="fin-back" onClick={closeCredit}>← Kredilere dön</button>

      {error && (
        <div className="finance-error-box">
          {error}
          <Button variant="ghost" onClick={() => void fetchCreditDetails()}>Tekrar dene</Button>
        </div>
      )}

      {loading && !details && (
        <>
          <div className="fin-skel" style={{ height: 130 }} />
          <div className="fin-skel" style={{ height: 74 }} />
          <div className="fin-skel" style={{ height: 260 }} />
        </>
      )}

      {details && (
        <>
          {/* Kredi başlığı + ilerleme */}
          <section className="fin-card">
            <div className="fin-detail-head">
              <BankLogo
                src={details.bankImage ?? undefined}
                name={details.bankName || details.creditName || '?'}
              />
              <div className="fin-credit-title">
                <span className="fin-credit-name">{details.creditName ?? 'Kredi'}</span>
                <span className="fin-credit-sub">
                  {details.bankName ?? ''}
                  {details.bankName && details.loanTerm ? ' · ' : ''}
                  {details.loanTerm ? `${details.loanTerm} ay vade` : ''}
                </span>
              </div>
              {details.isActive === true ? (
                <span className="fin-pill ontime"><i className="fin-pill-dot" />Aktif</span>
              ) : details.isActive === false ? (
                <span className="fin-pill muted"><i className="fin-pill-dot" />Kapandı</span>
              ) : null}
            </div>
            <div>
              <div className="fin-progress-track">
                <div className="fin-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="fin-progress-row">
                <span>{paidCount}/{totalCount} taksit ödendi</span>
                <span>%{pct}</span>
              </div>
            </div>
          </section>

          {/* Özet bilgiler */}
          <div className="fin-detail-grid">
            <div className="fin-mini">
              <span className="fin-mini-label">Kalan Borç</span>
              <span className="fin-mini-value">{moneyText(details.remainingAmount, hide)}</span>
            </div>
            <div className="fin-mini">
              <span className="fin-mini-label">Kredi Tutarı</span>
              <span className="fin-mini-value">{moneyText(details.loanAmount, hide)}</span>
            </div>
            <div className="fin-mini">
              <span className="fin-mini-label">Faiz Oranı</span>
              <span className="fin-mini-value">
                {details.interestRate != null ? `%${details.interestRate.toLocaleString('tr-TR')}` : '—'}
              </span>
            </div>
            <div className="fin-mini">
              <span className="fin-mini-label">İlk Taksit</span>
              <span className="fin-mini-value">{fmtDate(details.firstInstallmentDate)}</span>
            </div>
            <div className="fin-mini">
              <span className="fin-mini-label">Sonraki Taksite</span>
              <span className="fin-mini-value">
                {details.dayRemaining != null ? `${details.dayRemaining} gün` : '—'}
              </span>
            </div>
            <div className="fin-mini">
              <span className="fin-mini-label">Vade</span>
              <span className="fin-mini-value">
                {details.loanTerm != null ? `${details.loanTerm} ay` : '—'}
              </span>
            </div>
          </div>

          {/* Taksit planı — daire grid'i */}
          <section className="fin-card">
            <div className="fin-card-head">
              <span className="fin-card-title">Taksit Planı</span>
              <div className="fin-legend">
                <span><i className="fin-legend-dot round paid" />Ödendi</span>
                <span><i className="fin-legend-dot round payable" />Sıradaki</span>
                <span><i className="fin-legend-dot round pending" />Bekliyor</span>
              </div>
            </div>

            {installments.length === 0 ? (
              <p className="fin-empty">Taksit planı bulunamadı.</p>
            ) : (
              <>
                <div className="fin-inst-circles">
                  {installments.map(ins => {
                    const status = instStatus(ins)
                    return (
                      <button
                        key={ins.id}
                        className={`fin-circle ${status}${shownIns?.id === ins.id ? ' selected' : ''}`}
                        onClick={() => setSelectedInsId(ins.id)}
                        title={`${ins.installmentOrder}. taksit · ${fmtDate(ins.installmentDate)} · ${money(ins.myInstallmentAmount, hide, true)}`}
                      >
                        {status === 'paid' ? '✓' : ins.installmentOrder}
                      </button>
                    )
                  })}
                </div>

                {shownIns && (
                  <div className={`fin-inst-detail ${instStatus(shownIns)}`}>
                    <div className="fin-inst-detail-info">
                      <span className="fin-inst-detail-title">
                        {shownIns.installmentOrder}. Taksit
                      </span>
                      <span className="fin-inst-detail-sub">
                        {fmtDate(shownIns.installmentDate)}
                        {shownIns.isApprov && shownIns.updatedDate
                          ? ` · Ödendi: ${fmtDate(shownIns.updatedDate)}`
                          : ''}
                      </span>
                    </div>
                    <div className="fin-inst-detail-right">
                      <span className="fin-inst-detail-amount">
                        {money(shownIns.myInstallmentAmount, hide, true)}
                      </span>
                      {instStatus(shownIns) === 'paid' ? (
                        <span className="fin-pill ontime">✓ Ödendi</span>
                      ) : instStatus(shownIns) === 'payable' ? (
                        <span className="fin-pill payable">Ödenebilir</span>
                      ) : (
                        <span className="fin-pill muted">Bekliyor</span>
                      )}
                    </div>

                    {instStatus(shownIns) === 'payable' && (
                      <div className="fin-pay-actions">
                        {payingInsId === shownIns.id ? (
                          <Button disabled>Ödeniyor…</Button>
                        ) : confirmInsId === shownIns.id ? (
                          <>
                            <Button onClick={() => { setConfirmInsId(null); void payInstallment(shownIns.id) }}>
                              Onayla ✓
                            </Button>
                            <Button variant="ghost" onClick={() => setConfirmInsId(null)}>
                              Vazgeç
                            </Button>
                          </>
                        ) : (
                          <Button onClick={() => setConfirmInsId(shownIns.id)}>
                            Taksiti Öde
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {payError && (
                  <div className="finance-error-box">
                    {payError}
                    {shownIns && instStatus(shownIns) === 'payable' && (
                      <Button variant="ghost" onClick={() => void payInstallment(shownIns.id)}>
                        Tekrar dene
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </>
  )
}
