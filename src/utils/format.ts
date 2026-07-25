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

/**
 * Yerel saat dilimine göre YYYY-MM-DD. toISOString() UTC verdiği için
 * UTC+3'te gece yarısından sonra bir önceki güne kayıyordu.
 */
export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayStr(): string {
  return toDateStr(new Date())
}

/** Bir zaman damgasının (ISO) hangi yerel güne düştüğü. */
export function dayOf(iso: string): string {
  return toDateStr(new Date(iso))
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

export const MONTHS_LONG = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
export const DAYS_LONG = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
/** Haftanın Pazartesi'den başlayan kısa günleri (takvim başlığı için). */
export const WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

export function formatDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`
}

/** 'YYYY-MM-DD' → yerel gece yarısı Date. 'Z' eklenmez ki saat dilimi kaymasın. */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00')
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

/** İki yerel gün arasındaki tam gün farkı (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000)
}

/** "23 Temmuz 2026, Perşembe" */
export function fullDateLabel(dateStr: string): string {
  const d = parseDate(dateStr)
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}, ${DAYS_LONG[d.getDay()]}`
}

/** Bugüne göre "bugün" / "yarın" / "3 gün sonra" / "dün" / "5 gün önce". */
export function relativeDayLabel(dateStr: string): string {
  const n = diffDays(todayStr(), dateStr)
  if (n === 0) return 'bugün'
  if (n === 1) return 'yarın'
  if (n === -1) return 'dün'
  return n > 0 ? `${n} gün sonra` : `${-n} gün önce`
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
