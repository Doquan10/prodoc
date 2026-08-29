// Finans para formatlama — tutar gizleme destekli

export const TRY = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
export const TRY_EXACT = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })
export const COMPACT = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 })

export const MASK = '₺ ••••'

export function money(v: number, hidden: boolean, exact = false): string {
  return hidden ? MASK : (exact ? TRY_EXACT : TRY).format(v)
}

/** "10,000.00" (US) ya da "10.000,00" (TR) formatlı string'i sayıya çevirir. */
export function parseAmount(s: string | null | undefined): number | null {
  if (!s) return null
  const t = s.replace(/[^\d.,-]/g, '')
  const lastDot = t.lastIndexOf('.')
  const lastCom = t.lastIndexOf(',')
  const norm =
    lastDot > lastCom
      ? t.replace(/,/g, '') // 10,000.00 → 10000.00
      : lastCom > lastDot
        ? t.replace(/\./g, '').replace(',', '.') // 10.000,00 → 10000.00
        : t
  const v = parseFloat(norm)
  return isNaN(v) ? null : v
}

/** API'den string olarak gelen tutarlar için — parse edip ₺ formatında gösterir. */
export function moneyText(s: string | null | undefined, hidden: boolean): string {
  if (hidden) return MASK
  if (s == null) return '—'
  const v = parseAmount(s)
  return v !== null ? TRY_EXACT.format(v) : s
}

// Avatar renk paleti — kategori/kaynak adına göre deterministik seçilir.
const AVATAR_COLORS = [
  '#4d78f5', '#2ea043', '#c9922a', '#d0417e',
  '#8b5cf6', '#0ea5b7', '#e0663a', '#5b8def',
]

/** Bir string'i palet içinden sabit bir renge eşler (aynı kategori → hep aynı renk). */
export function avatarColor(key: string | number | null | undefined): string {
  const s = String(key ?? '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
