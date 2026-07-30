import { useEffect, useState } from 'react'
import { useFinanceStore } from '../../store/useFinanceStore'
import Button from '../../common/Button'
import { money, moneyText, COMPACT } from './finFormat'
import type { FinanceDashboardData, MonthInstallment } from '../../types/finance'

const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function monthLabel(m: number): string {
  return MONTHS_TR[(m - 1 + 12) % 12] ?? String(m)
}

function formatInstallmentDate(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
}

interface GraphPoint {
  month: number
  debt: number
  installment: number
}

function toArr(v: number | number[] | undefined): number[] {
  return Array.isArray(v) ? v : typeof v === 'number' ? [v] : []
}

/**
 * DebtGraph'ı noktalara düzleştirir. Gerçek API `remainingDebt`/`installment` paralel
 * dizileri döner ve ay bilgisi göndermez — ay etiketleri içinde bulunulan aydan başlatılır.
 */
function graphPoints(g: FinanceDashboardData['debtGraph']): GraphPoint[] {
  const entries = Array.isArray(g) ? g : g ? [g] : []
  const pts: GraphPoint[] = []
  const nowMonth = new Date().getMonth() + 1 // 1–12

  for (const e of entries) {
    const debts = toArr(e.debt ?? e.remainingDebt)
    const insts = toArr(e.installment)
    const months = e.month !== undefined ? toArr(e.month) : null
    const len = Math.max(debts.length, insts.length, months?.length ?? 0)
    for (let i = 0; i < len; i++) {
      pts.push({
        month: months?.[i] ?? ((nowMonth - 1 + pts.length) % 12) + 1,
        debt: debts[i] ?? 0,
        installment: insts[i] ?? 0,
      })
    }
  }

  // Kuyruktaki tamamen boş (borç ve taksit 0) ayları kırp
  let end = pts.length
  while (end > 1 && pts[end - 1].debt === 0 && pts[end - 1].installment === 0) end--
  return pts.slice(0, end)
}

/** Noktalardan geçen yumuşatılmış (orta nokta quadratic) SVG path'i. */
function smoothLine(pts: Array<[number, number]>): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2
    const my = (pts[i][1] + pts[i + 1][1]) / 2
    d += ` Q ${pts[i][0]} ${pts[i][1]} ${mx} ${my}`
  }
  const [lx, ly] = pts[pts.length - 1]
  d += ` T ${lx} ${ly}`
  return d
}

const PERIODS = [
  { id: '6', label: '6 Ay', n: 6 },
  { id: '12', label: '12 Ay', n: 12 },
  { id: 'all', label: 'Tümü', n: Infinity },
] as const
type PeriodId = (typeof PERIODS)[number]['id']

function DebtChart({ points, hidden }: { points: GraphPoint[]; hidden: boolean }) {
  const [hover, setHover] = useState<number | null>(null)

  const W = 100
  const TOP = 10
  const BOT = 4
  const plotH = 100 - TOP - BOT
  const baseY = TOP + plotH
  const max = Math.max(...points.map(p => Math.max(p.debt, p.installment)), 1)
  const n = points.length
  const step = W / n
  const x = (i: number) => step * (i + 0.5)
  const y = (v: number) => TOP + (1 - v / max) * plotH
  const barW = Math.min(step * 0.3, 5)

  const linePts: Array<[number, number]> = points.map((p, i) => [x(i), y(p.debt)])
  const line = smoothLine(linePts)
  const area = line ? `${line} L ${x(n - 1)} ${baseY} L ${x(0)} ${baseY} Z` : ''
  const gridVals = [max, max / 2, 0]

  // Dönem değişince eski hover index'i taşabilir
  const hp = hover !== null && hover < n ? points[hover] : null
  const hoverIdx = hp !== null && hover !== null ? hover : null

  return (
    <div>
      <div className="fin-chart-wrap" onMouseLeave={() => setHover(null)}>
        <svg className="fin-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="finDebtGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(77, 120, 245, 0.30)" />
              <stop offset="100%" stopColor="rgba(77, 120, 245, 0)" />
            </linearGradient>
          </defs>
          {gridVals.map(v => (
            <line
              key={v}
              className="fin-grid-line"
              x1="0" x2={W} y1={y(v)} y2={y(v)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {points.map((p, i) => (
            <rect
              key={i}
              className="fin-bar-installment"
              x={x(i) - barW / 2}
              y={y(p.installment)}
              width={barW}
              height={Math.max(baseY - y(p.installment), 0.5)}
              rx="1"
            />
          ))}
          {area && <path d={area} fill="url(#finDebtGrad)" />}
          {line && <path d={line} className="fin-line-debt" vectorEffect="non-scaling-stroke" />}
        </svg>

        {gridVals.slice(0, 2).map(v => (
          <span key={v} className="fin-grid-label" style={{ top: `${y(v)}%` }}>
            {hidden ? '••' : `${COMPACT.format(v)} ₺`}
          </span>
        ))}

        <div className="fin-chart-cols">
          {points.map((_, i) => (
            <div key={i} className="fin-chart-col" onMouseEnter={() => setHover(i)} />
          ))}
        </div>

        {hp !== null && hoverIdx !== null && (
          <>
            <span
              className="fin-chart-dot"
              style={{ left: `${x(hoverIdx)}%`, top: `${y(hp.debt)}%` }}
            />
            <div
              className="fin-tooltip"
              style={{ left: `clamp(85px, ${x(hoverIdx)}%, calc(100% - 85px))` }}
            >
              <span className="fin-tooltip-title">{monthLabel(hp.month)}</span>
              <span className="fin-tooltip-row">
                <i className="fin-legend-dot debt" />Borç <b>{money(hp.debt, hidden, true)}</b>
              </span>
              <span className="fin-tooltip-row">
                <i className="fin-legend-dot installment" />Taksit <b>{money(hp.installment, hidden, true)}</b>
              </span>
            </div>
          </>
        )}
      </div>
      <div className="fin-chart-months">
        {points.map((p, i) => (
          <span key={i} className={`fin-chart-month${hoverIdx === i ? ' active' : ''}`}>
            {monthLabel(p.month)}
          </span>
        ))}
      </div>
    </div>
  )
}

function InstallmentRow({ ins, hidden }: { ins: MonthInstallment; hidden: boolean }) {
  return (
    <div className="fin-row">
      <span className="fin-avatar">{(ins.debtName || '?').charAt(0).toUpperCase()}</span>
      <div className="fin-row-info">
        <span className="fin-row-name">{ins.debtName}</span>
        <span className="fin-row-sub">
          {ins.installmentOrder}. taksit · {formatInstallmentDate(ins.installmentDate)}
        </span>
      </div>
      <div className="fin-row-right">
        <span className="fin-row-amount">{moneyText(ins.amount, hidden)}</span>
        {ins.delay === true ? (
          <span className="fin-pill delayed"><i className="fin-pill-dot" />Gecikmiş</span>
        ) : ins.delay === false ? (
          <span className="fin-pill ontime"><i className="fin-pill-dot" />Zamanında</span>
        ) : null}
      </div>
    </div>
  )
}

export default function FinanceDashboard() {
  const dashboard = useFinanceStore(s => s.dashboard)
  const loading = useFinanceStore(s => s.loading)
  const error = useFinanceStore(s => s.error)
  const fetchDashboard = useFinanceStore(s => s.fetchDashboard)
  const hide = useFinanceStore(s => s.hideAmounts)
  const [period, setPeriod] = useState<PeriodId>('all')

  useEffect(() => {
    void fetchDashboard()
  }, [fetchDashboard])

  const allPoints = graphPoints(dashboard?.debtGraph)
  const cfg = PERIODS.find(p => p.id === period)!
  const points = cfg.n === Infinity ? allPoints : allPoints.slice(-cfg.n)
  const installments = dashboard?.monthInstallments ?? []

  return (
    <>
      {error && (
        <div className="finance-error-box">
          {error}
          <Button variant="ghost" onClick={() => void fetchDashboard()}>Tekrar dene</Button>
        </div>
      )}

      {!dashboard && loading && (
        <>
          <div className="fin-skel" style={{ height: 150 }} />
          <div className="fin-skel" style={{ height: 240 }} />
          <div className="fin-skel" style={{ height: 190 }} />
        </>
      )}

      {dashboard && (
        <>
          {/* Hero — toplam borç */}
          <section className="fin-hero">
            <div>
              <span className="fin-hero-label">Toplam Kredi Borcu</span>
              <div className="fin-hero-value">{money(dashboard.totalDebt, hide)}</div>
            </div>
            <div className="fin-hero-metrics">
              <div className="fin-metric">
                <span className="fin-metric-label">Kart Borcu</span>
                <span className="fin-metric-value">{money(dashboard.totalCardDebt, hide)}</span>
              </div>
              <div className="fin-metric">
                <span className="fin-metric-label">Bu Ay Ödenecek</span>
                <span className="fin-metric-value highlight">{money(dashboard.thisMonthFee, hide)}</span>
              </div>
              <div className="fin-metric">
                <span className="fin-metric-label">Gelecek Ay</span>
                <span className="fin-metric-value">{money(dashboard.nextMonthFee, hide)}</span>
              </div>
            </div>
          </section>

          {/* Borç trendi */}
          {allPoints.length > 0 && (
            <section className="fin-card">
              <div className="fin-card-head">
                <span className="fin-card-title">Borç Trendi</span>
                <div className="fin-chart-controls">
                  {allPoints.length > 6 && (
                    <div className="filter-tabs">
                      {PERIODS.map(p => (
                        <button
                          key={p.id}
                          className={`filter-tab ${period === p.id ? 'active' : ''}`}
                          onClick={() => setPeriod(p.id)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="fin-legend">
                    <span><i className="fin-legend-dot debt" />Borç</span>
                    <span><i className="fin-legend-dot installment" />Taksit</span>
                  </div>
                </div>
              </div>
              <DebtChart points={points} hidden={hide} />
            </section>
          )}

          {/* Bu ayın taksitleri */}
          <section className="fin-card">
            <div className="fin-card-head">
              <span className="fin-card-title">Bu Ayın Taksitleri</span>
              {installments.length > 0 && (
                <span className="fin-count">{installments.length} taksit</span>
              )}
            </div>
            {installments.length === 0 ? (
              <p className="fin-empty">Bu ay ödenecek taksit yok. 🎉</p>
            ) : (
              <div className="fin-list">
                {installments.map((ins, i) => (
                  <InstallmentRow key={i} ins={ins} hidden={hide} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
