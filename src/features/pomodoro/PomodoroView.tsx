import { useEffect, useRef, useState } from 'react'
import { usePomodoroStore, type Phase } from '../../store/usePomodoroStore'
import { formatSeconds, todayStr, addDays, fullDateLabel, relativeDayLabel } from '../../utils/format'
import { dayStats, computeStreaks, computeBadges } from '../../utils/pomodoroStats'

const PHASE_INFO: Record<Phase, { label: string; color: string; emoji: string }> = {
  work: { label: 'Çalışma', color: 'var(--ac)', emoji: '🎯' },
  short: { label: 'Kısa Mola', color: 'var(--ok)', emoji: '☕' },
  long: { label: 'Uzun Mola', color: 'var(--warn)', emoji: '🌿' },
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[0, 180].forEach((delay, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination); o.type = 'sine'
      o.frequency.value = i === 0 ? 880 : 660
      const t = ctx.currentTime + delay / 1000
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      o.start(t); o.stop(t + 0.18)
    })
    setTimeout(() => ctx.close(), 600)
  } catch { /* ses yoksa sessiz geç */ }
}

const mins = (sec: number) => Math.round(sec / 60)

export default function PomodoroView() {
  const {
    config, autoStart, phase, running, endsAt, remainingSec, round, note, log,
    start, pause, reset, skip, finishPhase, setConfig, setAutoStart, setNote,
  } = usePomodoroStore()
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [showSettings, setShowSettings] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const overtimeRef = useRef(false)

  // Tek sayaç: kalanı tazeler, süre bitince ses çalar; autoStart açıksa otomatik ilerler.
  useEffect(() => {
    const id = setInterval(() => {
      const st = usePomodoroStore.getState()
      if (st.running && st.endsAt) {
        const over = Date.now() >= st.endsAt
        if (over && !overtimeRef.current) {
          overtimeRef.current = true
          beep()
          if (st.autoStart) st.finishPhase()
        }
        if (!over) overtimeRef.current = false
      } else {
        overtimeRef.current = false
      }
      setNowMs(Date.now())
    }, 250)
    return () => clearInterval(id)
  }, [])

  // Odak modunda Esc ile çık
  useEffect(() => {
    if (!focusMode) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocusMode(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [focusMode])

  const durationSec = (phase === 'work' ? config.work : phase === 'short' ? config.short : config.long) * 60
  const remainingRaw = running && endsAt ? Math.round((endsAt - nowMs) / 1000) : remainingSec
  const overtime = running && remainingRaw < 0
  const info = PHASE_INFO[phase]
  const fracRemaining = overtime ? 1 : Math.max(0, Math.min(1, remainingRaw / durationSec))
  const ringColor = overtime ? 'var(--warn)' : info.color

  const today = todayStr()
  const completedToday = log.filter(l => l.phase === 'work' && l.date === today).length
  const streaks = computeStreaks(log)
  const badges = computeBadges(streaks)
  const nextBadge = badges.find(b => !b.earned)
  const earnedCount = badges.filter(b => b.earned).length

  const sel = dayStats(log, selectedDate)
  const heatDays = Array.from({ length: 14 }, (_, i) => addDays(today, -(13 - i)))
  const maxFocus = Math.max(1, ...heatDays.map(d => dayStats(log, d).focusSec))

  // Geri sayım halkası
  const size = 240
  const stroke = 10
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r

  const mainButton = !running ? (
    <button className="btn btn-primary pomo-main-btn" onClick={start}>
      ▶ {remainingSec < durationSec ? 'Devam' : 'Başlat'}
    </button>
  ) : overtime ? (
    <button className="btn btn-primary pomo-main-btn pomo-btn-over" onClick={finishPhase}>
      {phase === 'work' ? '✓ Bitir' : '→ İşe Dön'}
    </button>
  ) : (
    <button className="btn btn-primary pomo-main-btn" onClick={pause}>⏸ Duraklat</button>
  )

  const timerNode = (
    <>
      <div className={`pomo-timer phase-${phase}${overtime ? ' overtime' : ''}`}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="pomo-ring">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bd2)" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={ringColor} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - fracRemaining)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.3s linear' }}
          />
        </svg>
        <div className="pomo-timer-center">
          <span className="pomo-phase-label">{info.emoji} {info.label}{overtime ? ' · UZUYOR' : ''}</span>
          <span className="pomo-time">{formatSeconds(remainingRaw)}</span>
          <div className="pomo-rounds">
            {Array.from({ length: config.longEvery }, (_, i) => (
              <span key={i} className={`pomo-dot ${i < round ? 'filled' : ''}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="pomo-controls">
        <button className="btn btn-ghost" onClick={reset} title="Sıfırla">↺ Sıfırla</button>
        {mainButton}
        <button className="btn btn-ghost" onClick={skip} title="Bu fazı atla (kaydetmez)">⏭ Atla</button>
      </div>
    </>
  )

  if (focusMode) {
    return (
      <div className={`pomo-focus-overlay phase-${phase}${overtime ? ' overtime' : ''}`}>
        <button className="btn btn-ghost pomo-exit" onClick={() => setFocusMode(false)}>Çık ✕</button>
        {note && <p className="pomo-focus-note">{note}</p>}
        {timerNode}
        <p className="pomo-focus-hint">Esc ile çık · Bugün {completedToday} pomodoro</p>
      </div>
    )
  }

  return (
    <div className="pomodoro-view">
      <div className="pomodoro-inner">
        <div className="pomo-head">
          <h1 className="view-title">Pomodoro</h1>
          <div className="pomo-head-actions">
            <button className="btn btn-ghost pomo-settings-btn" onClick={() => setFocusMode(true)} title="Odak modu">◲ Odak Modu</button>
            <button className="btn btn-ghost pomo-settings-btn" onClick={() => setShowSettings(s => !s)}>
              {showSettings ? 'Kapat' : '⚙ Ayarlar'}
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="pomo-settings">
            <label className="pomo-field">
              <span>Çalışma (dk)</span>
              <input className="input" type="number" min={1} max={120} value={config.work}
                onChange={e => setConfig({ work: Math.max(1, parseInt(e.target.value) || 1) })} />
            </label>
            <label className="pomo-field">
              <span>Kısa mola (dk)</span>
              <input className="input" type="number" min={1} max={60} value={config.short}
                onChange={e => setConfig({ short: Math.max(1, parseInt(e.target.value) || 1) })} />
            </label>
            <label className="pomo-field">
              <span>Uzun mola (dk)</span>
              <input className="input" type="number" min={1} max={60} value={config.long}
                onChange={e => setConfig({ long: Math.max(1, parseInt(e.target.value) || 1) })} />
            </label>
            <label className="pomo-field">
              <span>Uzun mola sıklığı</span>
              <input className="input" type="number" min={1} max={12} value={config.longEvery}
                onChange={e => setConfig({ longEvery: Math.max(1, parseInt(e.target.value) || 1) })} />
            </label>
            <label className="pomo-field pomo-field-check">
              <input type="checkbox" checked={autoStart} onChange={e => setAutoStart(e.target.checked)} />
              <span>Süre dolunca otomatik geç (mola uzatmayı kapatır)</span>
            </label>
          </div>
        )}

        {timerNode}

        <input
          className="input pomo-note"
          placeholder="Ne üzerinde çalışıyorsun?"
          value={note}
          onChange={e => setNote(e.target.value)}
        />

        {/* Ödüller */}
        <div className="pomo-rewards">
          <div className="pomo-reward-tiles">
            <div className="pomo-reward-tile">
              <span className="pomo-reward-val">🔥 {streaks.current}</span>
              <span className="pomo-reward-label">günlük seri</span>
            </div>
            <div className="pomo-reward-tile">
              <span className="pomo-reward-val">🏆 {streaks.best}</span>
              <span className="pomo-reward-label">en iyi seri</span>
            </div>
            <div className="pomo-reward-tile">
              <span className="pomo-reward-val">🍅 {streaks.total}</span>
              <span className="pomo-reward-label">toplam</span>
            </div>
          </div>

          <div className="pomo-badges-head">
            <span className="today-section-label">🎖 ROZETLER · {earnedCount}/{badges.length}</span>
            {nextBadge && (
              <span className="pomo-next-badge">
                Sıradaki: {nextBadge.icon} {nextBadge.label} ({nextBadge.value}/{nextBadge.threshold})
              </span>
            )}
          </div>
          <div className="pomo-badges">
            {badges.map(b => (
              <span key={b.id} className={`pomo-badge ${b.earned ? 'earned' : ''}`} title={b.label}>
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* Geçmiş */}
        <div className="pomo-history">
          <div className="pomo-history-head">
            <span className="today-section-label">📅 GEÇMİŞ</span>
            <input
              className="input pomo-date"
              type="date"
              max={today}
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value || today)}
            />
          </div>

          {/* Son 14 gün ısı şeridi */}
          <div className="pomo-heat">
            {heatDays.map(d => {
              const st = dayStats(log, d)
              const h = st.focusSec > 0 ? Math.max(6, (st.focusSec / maxFocus) * 44) : 3
              return (
                <div key={d} className="pomo-heat-col" onClick={() => setSelectedDate(d)} title={`${d}: ${mins(st.focusSec)}dk · ${st.pomodoros} pomodoro`}>
                  <div className="pomo-heat-bar-wrap">
                    <div className={`pomo-heat-bar${st.focusSec > 0 ? ' active' : ''}${d === selectedDate ? ' selected' : ''}${d === today ? ' today' : ''}`} style={{ height: h }} />
                  </div>
                  <span className="pomo-heat-label">{d.slice(8)}</span>
                </div>
              )
            })}
          </div>

          {/* Seçili günün özeti */}
          <div className="pomo-day-summary">
            <div className="pomo-day-title">
              {fullDateLabel(selectedDate)} <span className="pomo-day-rel">· {relativeDayLabel(selectedDate)}</span>
            </div>
            {sel.pomodoros === 0 ? (
              <p className="day-section-empty">Bu gün pomodoro kaydı yok.</p>
            ) : (
              <div className="pomo-day-stats">
                <div className="pomo-day-stat"><b>{sel.pomodoros}</b><span>pomodoro</span></div>
                <div className="pomo-day-stat"><b>{mins(sel.focusSec)}dk</b><span>odak</span></div>
                <div className="pomo-day-stat">
                  <b className={sel.breakExtendSec > 0 ? 'over' : ''}>
                    {sel.breakExtendSec > 0 ? `+${mins(sel.breakExtendSec)}dk` : '0dk'}
                  </b>
                  <span>mola uzatma</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
