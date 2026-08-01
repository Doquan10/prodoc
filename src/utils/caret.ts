/**
 * Bir textarea içindeki verilen karakter konumunun ekran (viewport) koordinatını
 * hesaplar. Textarea'nın stillerini birebir kopyalayan gizli bir "ayna" katmanı
 * kurup imlecin oturduğu span'in ofsetini ölçer — slash menüsünü imlecin altına
 * konumlandırmak için kullanılır.
 */

const MIRROR_PROPS = [
  'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize',
  'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent',
  'letterSpacing', 'wordSpacing', 'tabSize', 'whiteSpace', 'wordWrap', 'wordBreak',
] as const

export interface CaretCoords {
  top: number
  left: number
  height: number
}

export function getCaretCoords(el: HTMLTextAreaElement, pos: number): CaretCoords {
  const cs = window.getComputedStyle(el)
  const div = document.createElement('div')
  const s = div.style
  s.position = 'absolute'
  s.visibility = 'hidden'
  s.whiteSpace = 'pre-wrap'
  s.wordWrap = 'break-word'
  s.overflow = 'hidden'
  for (const p of MIRROR_PROPS) {
    s.setProperty(hyphenate(p), cs.getPropertyValue(hyphenate(p)))
  }

  div.textContent = el.value.slice(0, pos)
  const span = document.createElement('span')
  span.textContent = el.value.slice(pos) || '.'
  div.appendChild(span)
  document.body.appendChild(div)

  const rect = el.getBoundingClientRect()
  const top = rect.top + span.offsetTop - el.scrollTop
  const left = rect.left + span.offsetLeft - el.scrollLeft
  const height = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4

  document.body.removeChild(div)
  return { top, left, height }
}

/** camelCase CSS adını kebab-case'e çevirir (getPropertyValue için). */
function hyphenate(prop: string): string {
  return prop.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
}
