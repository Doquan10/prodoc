// WYSIWYG editör ile markdown depolama arasındaki iki yönlü köprü.
// markdown metni depolama biçimi olarak kalır (paylaş/indir/önizleme aynı).
// mdToHtml: yükleme anında bir kez markdown → editör HTML'i.
// htmlToMd: her düzenlemede editör DOM'u → markdown (kaydetmek için).

import { COLOR_MAP } from './markdown'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// markdown.tsx'teki INLINE_RE ile aynı sözdizimi (kod, kalın, italik, link, renk)
const INLINE_RE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))|(\{[a-zA-ZçğıöşüÇĞİÖŞÜ]+\|[^}]+\})/g

function inlineToHtml(text: string): string {
  let out = ''
  let last = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const i = m.index
    if (i > last) out += escapeHtml(text.slice(last, i))
    const token = m[0]
    if (m[1]) {
      out += `<code>${escapeHtml(token.slice(1, -1))}</code>`
    } else if (m[2]) {
      out += `<strong>${escapeHtml(token.slice(2, -2))}</strong>`
    } else if (m[3]) {
      out += `<em>${escapeHtml(token.slice(1, -1))}</em>`
    } else if (m[4]) {
      const label = token.slice(1, token.indexOf(']'))
      out += `<a href="${escapeHtml(m[5])}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
    } else if (m[6]) {
      const sep = token.indexOf('|')
      const name = token.slice(1, sep)
      const hex = COLOR_MAP[name.toLocaleLowerCase('tr')]
      const inner = token.slice(sep + 1, -1)
      if (hex) {
        out += `<span class="ce-color" data-color="${escapeHtml(name)}" style="color:${hex}">${inlineToHtml(inner)}</span>`
      } else {
        out += escapeHtml(token)
      }
    }
    last = i + token.length
  }
  if (last < text.length) out += escapeHtml(text.slice(last))
  return out || '<br>'
}

/** markdown → editör HTML'i. Blok kuralları renderMarkdown ile aynıdır. */
export function mdToHtml(src: string): string {
  const lines = src.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Kod bloğu
    if (line.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++])
      i++ // kapanış ```
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`)
      continue
    }

    // Boş satır
    if (!line.trim()) { i++; continue }

    // Başlık
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      out.push(`<h${h[1].length}>${inlineToHtml(h[2])}</h${h[1].length}>`)
      i++
      continue
    }

    // Yatay çizgi
    if (/^(---|\*\*\*)\s*$/.test(line)) {
      out.push('<hr>')
      i++
      continue
    }

    // Alıntı
    if (line.startsWith('> ') || line === '>') {
      const buf: string[] = []
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        buf.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      out.push(`<blockquote>${inlineToHtml(buf.join(' '))}</blockquote>`)
      continue
    }

    // Yapılacaklar (onay kutulu) — sırasız listeden önce
    if (/^[-*]\s+\[[ xX]\]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+\[[ xX]\]\s+/.test(lines[i])) {
        const lm = lines[i].match(/^[-*]\s+\[([ xX])\]\s+(.*)$/)!
        const checked = lm[1].toLowerCase() === 'x'
        items.push(
          `<li class="ce-task" data-checked="${checked}"><span class="ce-check" contenteditable="false"></span>${inlineToHtml(lm[2])}</li>`,
        )
        i++
      }
      out.push(`<ul class="ce-task-list">${items.join('')}</ul>`)
      continue
    }

    // Sırasız liste
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i]) && !/^[-*]\s+\[[ xX]\]/.test(lines[i])) {
        items.push(`<li>${inlineToHtml(lines[i].replace(/^[-*]\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    // Sıralı liste
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inlineToHtml(lines[i].replace(/^\d+\.\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ol>${items.join('')}</ol>`)
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
    out.push(`<p>${inlineToHtml(buf.join(' '))}</p>`)
  }

  return out.join('') || '<p><br></p>'
}

// ── DOM → markdown ───────────────────────────

/** Bir inline düğümü markdown'a çevirir. */
const ZWSP = new RegExp('\\u200b', 'g')

function inlineMd(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(ZWSP, '')
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  if (el.classList.contains('ce-check')) return ''
  const inner = () => Array.from(el.childNodes).map(inlineMd).join('')
  switch (el.tagName) {
    case 'BR': return '\n'
    case 'STRONG':
    case 'B': {
      const t = inner()
      return t ? `**${t}**` : ''
    }
    case 'EM':
    case 'I': {
      const t = inner()
      return t ? `*${t}*` : ''
    }
    case 'CODE': {
      const t = inner()
      return t ? '`' + t + '`' : ''
    }
    case 'A':
      return `[${inner()}](${el.getAttribute('href') ?? ''})`
    case 'SPAN':
      if (el.classList.contains('ce-color')) {
        const t = inner()
        // Renk inline'dır: içerik boşsa ya da satır sonu (blok kırığı) içeriyorsa sarma.
        // Aksi halde {renk|…} tek satıra sığmaz, parser eşleştiremez ve ham parantez sızar.
        if (!t.trim() || t.includes('\n')) return t
        return `{${el.getAttribute('data-color') || 'mavi'}|${t}}`
      }
      return inner()
    default:
      return inner()
  }
}

/** Bir li'nin (onay kutusu hariç) inline içeriğini markdown'a çevirir. */
function liInline(li: HTMLElement): string {
  return Array.from(li.childNodes).map(inlineMd).join('').trim()
}

/** Editör DOM'unu markdown'a çevirir. */
export function htmlToMd(root: HTMLElement): string {
  const blocks: string[] = []

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = (child.textContent ?? '').trim()
      if (t) blocks.push(t)
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const el = child as HTMLElement

    switch (el.tagName) {
      case 'H1':
        blocks.push('# ' + liInline(el)); break
      case 'H2':
        blocks.push('## ' + liInline(el)); break
      case 'H3':
        blocks.push('### ' + liInline(el)); break
      case 'HR':
        blocks.push('---'); break
      case 'PRE':
        blocks.push('```\n' + (el.textContent ?? '') + '\n```'); break
      case 'BLOCKQUOTE': {
        const text = Array.from(el.childNodes).map(inlineMd).join('')
        blocks.push(text.split('\n').map(l => '> ' + l).join('\n'))
        break
      }
      case 'UL': {
        const rows: string[] = []
        for (const li of Array.from(el.children)) {
          if (li.tagName !== 'LI') continue
          const lel = li as HTMLElement
          const text = liInline(lel)
          if (lel.classList.contains('ce-task')) {
            const checked = lel.getAttribute('data-checked') === 'true'
            rows.push(`- [${checked ? 'x' : ' '}] ${text}`)
          } else {
            rows.push(`- ${text}`)
          }
        }
        if (rows.length) blocks.push(rows.join('\n'))
        break
      }
      case 'OL': {
        const rows: string[] = []
        let n = 1
        for (const li of Array.from(el.children)) {
          if (li.tagName !== 'LI') continue
          rows.push(`${n++}. ${liInline(li as HTMLElement)}`)
        }
        if (rows.length) blocks.push(rows.join('\n'))
        break
      }
      default: {
        // P / DIV / diğer → paragraf (boşsa boş satır olarak korunur)
        const text = Array.from(el.childNodes).map(inlineMd).join('').trim()
        blocks.push(text)
      }
    }
  }

  // Bloklar arası tek boş satır; baş/son boşlukları kırp
  return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\s+$/g, '')
}
