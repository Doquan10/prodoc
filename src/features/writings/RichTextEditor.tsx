import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { TEXT_COLORS } from '../../utils/markdown'
import { mdToHtml, htmlToMd } from '../../utils/wysiwyg'

interface Props {
  /** Başlangıç markdown içeriği — yalnızca ilk render'da DOM'a yazılır (uncontrolled). */
  value: string
  /** Her değişiklikte (ve blur'da) güncel markdown ile çağrılır. */
  onChange: (md: string) => void
  onBlur?: () => void
  placeholder?: string
  /** İçerik alanına eklenecek sınıf — tipografi/boyut için (varsayılan yazı editörü). */
  ceClassName?: string
  /** Renk paletini göster (notlar gibi kompakt yerlerde kapatılabilir). */
  colors?: boolean
}

interface SlashOption {
  id: string
  icon: string
  label: string
  desc: string
  keywords: string[]
}

/** "/" ile açılan blok menüsü. */
const SLASH_OPTIONS: SlashOption[] = [
  { id: 'h1', icon: 'H₁', label: 'Başlık 1', desc: 'Büyük bölüm başlığı', keywords: ['baslik', 'başlık', 'h1', 'heading', 'title'] },
  { id: 'h2', icon: 'H₂', label: 'Başlık 2', desc: 'Orta başlık', keywords: ['baslik', 'başlık', 'h2'] },
  { id: 'h3', icon: 'H₃', label: 'Başlık 3', desc: 'Küçük başlık', keywords: ['baslik', 'başlık', 'h3'] },
  { id: 'ul', icon: '•', label: 'Madde listesi', desc: 'Sırasız liste', keywords: ['liste', 'madde', 'bullet', 'ul'] },
  { id: 'ol', icon: '1.', label: 'Numaralı liste', desc: 'Sıralı liste', keywords: ['liste', 'numara', 'sirali', 'sıralı', 'ol', 'number'] },
  { id: 'todo', icon: '☐', label: 'Yapılacak', desc: 'Onay kutulu görev', keywords: ['todo', 'yapilacak', 'yapılacak', 'gorev', 'görev', 'task', 'checkbox', 'onay'] },
  { id: 'quote', icon: '❝', label: 'Alıntı', desc: 'Alıntı bloğu', keywords: ['alinti', 'alıntı', 'quote', 'blok'] },
  { id: 'code', icon: '</>', label: 'Kod bloğu', desc: 'Tek aralıklı kod', keywords: ['kod', 'code', 'blok'] },
  { id: 'hr', icon: '—', label: 'Ayraç', desc: 'Yatay çizgi', keywords: ['ayrac', 'ayraç', 'cizgi', 'çizgi', 'divider', 'hr'] },
]

// ── Seçim / DOM yardımcıları ──────────────────

const ZW = '​' // sıfır-genişlik boşluk — imleç konumlama için, serialize'de temizlenir

function getSel(): Selection | null {
  const s = window.getSelection()
  return s && s.rangeCount > 0 ? s : null
}

function placeCaretEnd(el: Element) {
  const r = document.createRange()
  r.selectNodeContents(el)
  r.collapse(false)
  const s = window.getSelection()
  s?.removeAllRanges()
  s?.addRange(r)
}

/** Notion tarzı WYSIWYG editör — markdown depolar, yazdıkça biçimlenir.
 *  Slash menüsü, blok/inline oto-biçimlendirme, liste/yapılacak/kod blokları destekler. */
export default function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  ceClassName = 'writing-content-input',
  colors = true,
}: Props) {
  const [slash, setSlash] = useState<{ query: string; top: number; left: number } | null>(null)
  const [slashIndex, setSlashIndex] = useState(0)
  const [isEmpty, setIsEmpty] = useState(!value.trim())

  const editorRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef(value)

  // Yükleme anında bir kez markdown → editör HTML'i (bileşen içerik başına remount olur)
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = mdToHtml(valueRef.current)
  }, [])

  /** DOM'u markdown'a serialize edip parent'a bildirir. */
  function flush() {
    if (!editorRef.current) return
    const md = htmlToMd(editorRef.current)
    setIsEmpty(!editorRef.current.textContent?.trim())
    onChange(md)
  }

  // ── Blok komutları ──────────────────────────

  function topBlock(): HTMLElement | null {
    const root = editorRef.current
    const sel = getSel()
    if (!root || !sel) return null
    const range = sel.getRangeAt(0)
    let n: Node | null = range.startContainer
    // İmleç doğrudan kökteyse (nadir) offset'teki çocuğu al
    if (n === root) {
      const child = root.childNodes[range.startOffset] ?? root.lastChild
      return child && child.nodeType === Node.ELEMENT_NODE ? (child as HTMLElement) : null
    }
    while (n && n.parentNode !== root) n = n.parentNode
    return n && n !== root ? (n as HTMLElement) : null
  }

  function replaceBlockTag(tag: string, toggle = true) {
    const b = topBlock()
    if (!b) return
    const target = toggle && b.tagName === tag.toUpperCase() ? 'p' : tag
    const neu = document.createElement(target)
    while (b.firstChild) neu.appendChild(b.firstChild)
    if (!neu.firstChild) neu.appendChild(document.createElement('br'))
    b.replaceWith(neu)
    placeCaretEnd(neu)
  }

  function wrapList(ordered: boolean, task: boolean) {
    const b = topBlock()
    if (!b) return
    const ul = document.createElement(ordered ? 'ol' : 'ul')
    if (task) ul.className = 'ce-task-list'
    const li = document.createElement('li')
    if (task) {
      li.className = 'ce-task'
      li.setAttribute('data-checked', 'false')
      const check = document.createElement('span')
      check.className = 'ce-check'
      check.contentEditable = 'false'
      li.appendChild(check)
    }
    while (b.firstChild) li.appendChild(b.firstChild)
    if (!li.textContent) li.appendChild(document.createElement('br'))
    ul.appendChild(li)
    b.replaceWith(ul)
    placeCaretEnd(li)
  }

  function insertHr() {
    const b = topBlock()
    if (!b) return
    const hr = document.createElement('hr')
    const p = document.createElement('p')
    p.appendChild(document.createElement('br'))
    b.replaceWith(hr)
    hr.after(p)
    placeCaretEnd(p)
  }

  function insertCodeBlock() {
    const b = topBlock()
    if (!b) return
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.appendChild(document.createTextNode(''))
    pre.appendChild(code)
    b.replaceWith(pre)
    const r = document.createRange()
    r.setStart(code.firstChild!, 0)
    r.collapse(true)
    const s = window.getSelection()
    s?.removeAllRanges()
    s?.addRange(r)
  }

  function cmd(name: 'bold' | 'italic') {
    document.execCommand(name)
    flush()
  }

  function wrapInline(build: () => HTMLElement) {
    const sel = getSel()
    if (!sel) return
    const range = sel.getRangeAt(0)
    if (range.collapsed) return
    const el = build()
    el.appendChild(range.extractContents())
    range.insertNode(el)
    const r = document.createRange()
    r.selectNodeContents(el)
    sel.removeAllRanges()
    sel.addRange(r)
    flush()
  }

  function runBlockCommand(id: string) {
    switch (id) {
      case 'h1': replaceBlockTag('h1'); break
      case 'h2': replaceBlockTag('h2'); break
      case 'h3': replaceBlockTag('h3'); break
      case 'ul': wrapList(false, false); break
      case 'ol': wrapList(true, false); break
      case 'todo': wrapList(false, true); break
      case 'quote': replaceBlockTag('blockquote'); break
      case 'code': insertCodeBlock(); break
      case 'hr': insertHr(); break
    }
    flush()
  }

  // ── Otomatik biçim kuralları ─────────────────

  /** Blok başında "# ", "- ", "1. ", "> ", "[] " yazınca bloğu dönüştürür. */
  function blockAutoFormat(): boolean {
    const b = topBlock()
    if (!b || (b.tagName !== 'P' && b.tagName !== 'DIV')) return false
    const text = b.textContent ?? ''
    const rules: [RegExp, () => void][] = [
      [/^#\s$/, () => replaceBlockTag('h1', false)],
      [/^##\s$/, () => replaceBlockTag('h2', false)],
      [/^###\s$/, () => replaceBlockTag('h3', false)],
      [/^[-*]\s$/, () => wrapList(false, false)],
      [/^1\.\s$/, () => wrapList(true, false)],
      [/^>\s$/, () => replaceBlockTag('blockquote', false)],
      [/^\[\s?\]\s$/, () => wrapList(false, true)],
    ]
    for (const [re, act] of rules) {
      if (re.test(text)) {
        b.textContent = ''
        placeCaretEnd(b) // işaretçi silindi — imleci boş bloğa sabitle ki act() bloğu bulsun
        act()
        return true
      }
    }
    return false
  }

  /** İmlecin solunda tamamlanmış `**k**`, `*i*`, `` `kod` `` varsa biçimler. */
  function inlineAutoFormat() {
    const sel = getSel()
    if (!sel) return
    const r = sel.getRangeAt(0)
    if (!r.collapsed || r.startContainer.nodeType !== Node.TEXT_NODE) return
    const node = r.startContainer as Text
    const off = r.startOffset
    const before = (node.textContent ?? '').slice(0, off)

    // Sıra önemli: önce `kod`, sonra **kalın**, sonra *italik*
    let m: RegExpMatchArray | null
    let hit: { tag: string; inner: string; consumed: number } | null = null
    if ((m = before.match(/`([^`]+)`$/))) {
      hit = { tag: 'code', inner: m[1], consumed: m[0].length }
    } else if ((m = before.match(/\*\*([^*]+)\*\*$/))) {
      hit = { tag: 'strong', inner: m[1], consumed: m[0].length }
    } else if ((m = before.match(/\*([^*]+)\*$/)) && before[off - m[0].length - 1] !== '*') {
      hit = { tag: 'em', inner: m[1], consumed: m[0].length }
    }
    if (!hit) return

    const el = document.createElement(hit.tag)
    el.textContent = hit.inner
    const range = document.createRange()
    range.setStart(node, off - hit.consumed)
    range.setEnd(node, off)
    range.deleteContents()
    range.insertNode(el)
    // Biçimin dışında yazmaya devam edebilmek için imleci sonrasına al
    const after = document.createTextNode(ZW)
    el.after(after)
    const nr = document.createRange()
    nr.setStart(after, 1)
    nr.collapse(true)
    sel.removeAllRanges()
    sel.addRange(nr)
  }

  // ── Slash menü ───────────────────────────────

  function caretRect(): { top: number; left: number } | null {
    const sel = getSel()
    const host = editorRef.current
    if (!sel || !host) return null
    const range = sel.getRangeAt(0).cloneRange()
    range.collapse(true)
    let rect = range.getBoundingClientRect()
    if (rect.top === 0 && rect.left === 0) {
      const span = document.createElement('span')
      span.textContent = ZW
      range.insertNode(span)
      rect = span.getBoundingClientRect()
      span.remove()
    }
    const h = host.getBoundingClientRect()
    return { top: rect.bottom - h.top + 4, left: rect.left - h.left }
  }

  function updateSlash() {
    const sel = getSel()
    if (!sel) { setSlash(null); return }
    const r = sel.getRangeAt(0)
    if (!r.collapsed || r.startContainer.nodeType !== Node.TEXT_NODE) { setSlash(null); return }
    const before = (r.startContainer.textContent ?? '').slice(0, r.startOffset)
    const m = before.match(/(?:^|\s)\/(\S*)$/)
    if (!m) { setSlash(null); return }
    const rect = caretRect()
    if (!rect) { setSlash(null); return }
    setSlash({ query: m[1], top: rect.top, left: rect.left })
    setSlashIndex(0)
  }

  function applySlash(opt: SlashOption) {
    const sel = getSel()
    if (sel) {
      const r = sel.getRangeAt(0)
      const node = r.startContainer
      if (node.nodeType === Node.TEXT_NODE) {
        const before = (node.textContent ?? '').slice(0, r.startOffset)
        const m = before.match(/\/(\S*)$/)
        if (m) (node as Text).deleteData(r.startOffset - m[0].length, m[0].length)
      }
    }
    setSlash(null)
    runBlockCommand(opt.id)
  }

  const slashFiltered = slash
    ? SLASH_OPTIONS.filter(o => {
        const q = slash.query.toLocaleLowerCase('tr')
        return !q || o.label.toLocaleLowerCase('tr').includes(q) || o.keywords.some(k => k.includes(q))
      })
    : []

  // ── Olay yakalayıcılar ───────────────────────

  function onEditorInput() {
    if (!blockAutoFormat()) inlineAutoFormat()
    flush()
    updateSlash()
  }

  function onEditorKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (slash && slashFiltered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => (i + 1) % slashFiltered.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex(i => (i - 1 + slashFiltered.length) % slashFiltered.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        applySlash(slashFiltered[Math.min(slashIndex, slashFiltered.length - 1)])
        return
      }
      if (e.key === 'Escape') { e.preventDefault(); setSlash(null); return }
    }
  }

  function onEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const check = (e.target as HTMLElement).closest?.('.ce-check')
    if (check) {
      e.preventDefault()
      const li = check.closest('.ce-task')
      if (li) {
        li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true')
        flush()
      }
    }
  }

  return (
    <>
      {/* Biçim araç çubuğu — seçimi korumak için mousedown'da varsayılan iptal */}
      <div className="writing-toolbar" onMouseDown={e => e.preventDefault()}>
        <button title="Kalın" style={{ fontWeight: 700 }} onClick={() => cmd('bold')}>B</button>
        <button title="İtalik" style={{ fontStyle: 'italic' }} onClick={() => cmd('italic')}>I</button>
        <button title="Kod" onClick={() => wrapInline(() => document.createElement('code'))}>{'</>'}</button>
        <button title="Başlık" onClick={() => runBlockCommand('h2')}>H</button>
        <span className="writing-toolbar-sep" />
        <button title="Madde listesi" onClick={() => runBlockCommand('ul')}>•≡</button>
        <button title="Numaralı liste" onClick={() => runBlockCommand('ol')}>1≡</button>
        <button title="Yapılacak (onay kutusu)" onClick={() => runBlockCommand('todo')}>☑</button>
        <button title="Alıntı" onClick={() => runBlockCommand('quote')}>❝</button>
        {colors && <span className="writing-toolbar-sep" />}
        {colors && TEXT_COLORS.map(c => (
          <button
            key={c.name}
            className="writing-color-swatch"
            title={`${c.name} yazı`}
            style={{ background: c.value }}
            onClick={() =>
              wrapInline(() => {
                const s = document.createElement('span')
                s.className = 'ce-color'
                s.setAttribute('data-color', c.name)
                s.style.color = c.value
                return s
              })
            }
          />
        ))}
      </div>

      <div className="writing-ce-wrap">
        <div
          ref={editorRef}
          className={`${ceClassName} markdown-body${isEmpty ? ' is-empty' : ''}`}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={onEditorInput}
          onKeyDown={onEditorKeyDown}
          onClick={onEditorClick}
          onBlur={() => { flush(); onBlur?.(); setTimeout(() => setSlash(null), 120) }}
        />
        {slash && slashFiltered.length > 0 && (
          <div className="slash-menu" style={{ top: slash.top, left: slash.left }}>
            {slashFiltered.map((o, idx) => (
              <button
                key={o.id}
                className={`slash-item${idx === slashIndex ? ' active' : ''}`}
                onMouseDown={e => { e.preventDefault(); applySlash(o) }}
                onMouseEnter={() => setSlashIndex(idx)}
              >
                <span className="slash-icon">{o.icon}</span>
                <span className="slash-text">
                  <span className="slash-label">{o.label}</span>
                  <span className="slash-desc">{o.desc}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
