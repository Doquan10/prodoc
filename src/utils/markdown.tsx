import type { ReactNode } from 'react'

/**
 * Hafif markdown → React render'ı. Harici kütüphane yok; çıktı React
 * elemanları olduğu için XSS riski taşımaz (dangerouslySetInnerHTML kullanılmaz).
 * Desteklenen: #/##/### başlık, **kalın**, *italik*, `kod`, ``` kod bloğu,
 * - / 1. listeler, > alıntı, --- çizgi, [metin](url) link,
 * {renk|metin} renkli yazı (ör. {kırmızı|önemli}).
 */

/** Editör paletindeki renkler — koyu temaya uygun tonlar. */
export const TEXT_COLORS: { name: string; value: string }[] = [
  { name: 'kırmızı', value: '#e46a6a' },
  { name: 'turuncu', value: '#e0a83f' },
  { name: 'sarı', value: '#d9c34a' },
  { name: 'yeşil', value: '#4fbf68' },
  { name: 'mavi', value: '#6b8ef7' },
  { name: 'mor', value: '#a78bfa' },
]

const COLOR_MAP: Record<string, string> = {
  'kırmızı': '#e46a6a', kirmizi: '#e46a6a', red: '#e46a6a',
  turuncu: '#e0a83f', orange: '#e0a83f',
  'sarı': '#d9c34a', sari: '#d9c34a', yellow: '#d9c34a',
  'yeşil': '#4fbf68', yesil: '#4fbf68', green: '#4fbf68',
  mavi: '#6b8ef7', blue: '#6b8ef7',
  mor: '#a78bfa', purple: '#a78bfa',
}

const INLINE_RE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))|(\{[a-zA-ZçğıöşüÇĞİÖŞÜ]+\|[^}]+\})/g

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let k = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const i = m.index
    if (i > last) out.push(text.slice(last, i))
    const token = m[0]
    if (m[1]) {
      out.push(<code key={`${keyBase}-${k++}`}>{token.slice(1, -1)}</code>)
    } else if (m[2]) {
      out.push(<strong key={`${keyBase}-${k++}`}>{token.slice(2, -2)}</strong>)
    } else if (m[3]) {
      out.push(<em key={`${keyBase}-${k++}`}>{token.slice(1, -1)}</em>)
    } else if (m[4]) {
      const label = token.slice(1, token.indexOf(']'))
      out.push(
        <a key={`${keyBase}-${k++}`} href={m[5]} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      )
    } else if (m[6]) {
      const sep = token.indexOf('|')
      const color = COLOR_MAP[token.slice(1, sep).toLocaleLowerCase('tr')]
      const inner = token.slice(sep + 1, -1)
      if (color) {
        // İç metinde kalın/italik gibi işaretler de çalışsın
        out.push(<span key={`${keyBase}-${k++}`} style={{ color }}>{renderInline(inner, `${keyBase}-c${k}`)}</span>)
      } else {
        out.push(token) // bilinmeyen renk — olduğu gibi göster
      }
    }
    last = i + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function renderMarkdown(src: string): ReactNode[] {
  const lines = src.split('\n')
  const out: ReactNode[] = []
  let key = 0

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Kod bloğu
    if (line.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++ // kapanış ```
      out.push(
        <pre key={key++}>
          <code>{buf.join('\n')}</code>
        </pre>
      )
      continue
    }

    // Boş satır
    if (!line.trim()) {
      i++
      continue
    }

    // Başlıklar
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      const content = renderInline(h[2], `h${key}`)
      const level = h[1].length
      out.push(
        level === 1 ? <h1 key={key++}>{content}</h1>
        : level === 2 ? <h2 key={key++}>{content}</h2>
        : <h3 key={key++}>{content}</h3>
      )
      i++
      continue
    }

    // Yatay çizgi
    if (/^(---|\*\*\*)\s*$/.test(line)) {
      out.push(<hr key={key++} />)
      i++
      continue
    }

    // Alıntı bloğu
    if (line.startsWith('> ') || line === '>') {
      const buf: string[] = []
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        buf.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      out.push(<blockquote key={key++}>{renderInline(buf.join(' '), `q${key}`)}</blockquote>)
      continue
    }

    // Sırasız liste
    if (/^[-*]\s+/.test(line)) {
      const items: ReactNode[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(<li key={items.length}>{renderInline(lines[i].replace(/^[-*]\s+/, ''), `ul${key}-${items.length}`)}</li>)
        i++
      }
      out.push(<ul key={key++}>{items}</ul>)
      continue
    }

    // Sıralı liste
    if (/^\d+\.\s+/.test(line)) {
      const items: ReactNode[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(<li key={items.length}>{renderInline(lines[i].replace(/^\d+\.\s+/, ''), `ol${key}-${items.length}`)}</li>)
        i++
      }
      out.push(<ol key={key++}>{items}</ol>)
      continue
    }

    // Paragraf — ardışık dolu satırlar tek paragrafta birleşir
    const buf: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('```') &&
      !/^(#{1,3})\s/.test(lines[i]) &&
      !lines[i].startsWith('> ') &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^(---|\*\*\*)\s*$/.test(lines[i])
    ) {
      buf.push(lines[i])
      i++
    }
    out.push(<p key={key++}>{renderInline(buf.join(' '), `p${key}`)}</p>)
  }

  return out
}

/** Liste kartlarındaki özet için markdown işaretlerini temizler. */
export function stripMarkdown(src: string): string {
  return src
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\{[a-zA-ZçğıöşüÇĞİÖŞÜ]+\|([^}]+)\}/g, '$1')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}
