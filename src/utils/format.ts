export function formatSeconds(totalSeconds: number): string {
  const abs = Math.abs(totalSeconds)
  const m = Math.floor(abs / 60).toString().padStart(2, '0')
  const s = (abs % 60).toString().padStart(2, '0')
  return totalSeconds < 0 ? `+${m}:${s}` : `${m}:${s}`
}

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}dk`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}s ${m}dk` : `${h}s`
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

export function formatDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`
}

export function difficultyLabel(d?: string): string {
  return d === 'light' ? 'Kolay' : d === 'medium' ? 'Orta' : d === 'deep' ? 'Derin' : ''
}

export function statusLabel(s: string): string {
  const map: Record<string, string> = {
    inbox: 'Gelen Kutusu',
    refined: 'Rafine',
    scheduled: 'Planlandı',
    in_progress: 'Devam Ediyor',
    learned: 'Öğrenildi',
    revisit: 'Tekrar Bak',
  }
  return map[s] ?? s
}
